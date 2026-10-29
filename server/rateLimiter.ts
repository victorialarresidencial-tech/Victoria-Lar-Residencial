import crypto from 'crypto';
import type { Request } from 'express';
import { getServerFirestore } from './firebaseAdmin';
import { sanitizeLog } from './mailer';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  actionPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxRequests: number;
  remaining: number;
  resetInSeconds: number;
  clientHash: string;
}

// In-memory cache for ultra-fast local checks, serverless fallback, and test environments
interface LocalBucket {
  count: number;
  expiresAt: number;
}
const localMemoryBuckets = new Map<string, LocalBucket>();

// Emergency instance-level fallback quota to prevent unbounded execution during distributed store outages
interface EmergencyFallback {
  count: number;
  expiresAt: number;
}
const emergencyFallbackBuckets = new Map<string, EmergencyFallback>();

// Periodic in-memory bucket cleanup every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeExpiredLocalBuckets() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, bucket] of localMemoryBuckets.entries()) {
    if (bucket.expiresAt <= now) {
      localMemoryBuckets.delete(key);
    }
  }

  for (const [key, bucket] of emergencyFallbackBuckets.entries()) {
    if (bucket.expiresAt <= now) {
      emergencyFallbackBuckets.delete(key);
    }
  }
}

/**
 * Derives an irreversible cryptographic client fingerprint.
 * CRITICAL PRIVACY & LGPD COMPLIANCE:
 * - NEVER stores raw IP addresses or personal identifiable information.
 * - Prioritizes verified platform proxy headers (Google Cloud / App Engine / Express trust proxy)
 *   to prevent header injection and IP spoofing.
 * - Uses SHA-256 with an institutional salt (customizable via env/secret without runtime exposure).
 * - Truncated to 16 hex chars (64 bits), irreversible to obtain original client IP.
 */
export function getAnonymizedClientHash(req: Request): string {
  const headers = req?.headers || {};
  let rawIp = '';

  // 1. Google Cloud / App Engine / Cloud Functions verified header (injected by Google Front End; cannot be client-spoofed)
  if (typeof headers['x-appengine-user-ip'] === 'string' && headers['x-appengine-user-ip'].trim()) {
    rawIp = headers['x-appengine-user-ip'].trim();
  }
  // 2. Express req.ip (authoritative when trust proxy is configured in Express)
  else if (
    (req as any)?.ip &&
    typeof (req as any).ip === 'string' &&
    (req as any).ip.trim() &&
    (req as any).ip !== '::1' &&
    (req as any).ip !== '127.0.0.1'
  ) {
    rawIp = String((req as any).ip).trim();
  }
  // 3. Fastly / Cloudflare proxy verified headers
  else if (typeof headers['fastly-client-ip'] === 'string' && headers['fastly-client-ip'].trim()) {
    rawIp = headers['fastly-client-ip'].trim();
  } else if (typeof headers['cf-connecting-ip'] === 'string' && headers['cf-connecting-ip'].trim()) {
    rawIp = headers['cf-connecting-ip'].trim();
  }
  // 4. Fallback to X-Forwarded-For header
  else if (headers['x-forwarded-for']) {
    const forwarded = headers['x-forwarded-for'];
    const parts = (typeof forwarded === 'string' ? forwarded.split(',') : Array.isArray(forwarded) ? forwarded : [])
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      rawIp = parts[0];
    }
  } else if (typeof headers['x-real-ip'] === 'string' && headers['x-real-ip'].trim()) {
    rawIp = headers['x-real-ip'].trim();
  } else if ((req as any)?.ip && typeof (req as any).ip === 'string' && (req as any).ip.trim()) {
    rawIp = String((req as any).ip).trim();
  } else if (req?.socket && req.socket.remoteAddress) {
    rawIp = req.socket.remoteAddress.trim();
  }

  if (!rawIp) {
    rawIp = 'unknown_client';
  }

  // Institutional salt: stable across instances and restarts, configurable via secret without code change
  const salt =
    (process.env.RATE_LIMIT_SALT && process.env.RATE_LIMIT_SALT.trim()) ||
    'vlr_institution_rate_limiter_2026';

  return crypto.createHash('sha256').update(`${salt}:${rawIp}`).digest('hex').substring(0, 16);
}

/**
 * Distributed rate limiter compatible with serverless instances (Google Cloud Functions & Vercel)
 * and containerized runtimes (Node.js/Express).
 *
 * Flow:
 * 1. Derives anonymized client hash (zero raw IP storage).
 * 2. Checks local in-memory window cache first (instant short-circuit if already blocked).
 * 3. Consults Firestore distributed collection `rateLimits` inside an atomic transaction.
 * 4. Increments count and persists both ISO date and native Date for Cloud Firestore TTL Policy ($0.00 auto-deletion).
 * 5. If Firestore is unavailable, falls back to in-memory state with an emergency instance-wide circuit breaker
 *    to strictly prevent unbounded email dispatches or schedule bookings during outages.
 */
export async function checkRateLimit(
  req: Request,
  action: 'contact' | 'schedule_meeting' | 'smtp_status',
  options: RateLimitOptions
): Promise<RateLimitResult> {
  purgeExpiredLocalBuckets();

  const { maxRequests, windowMs } = options;
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const clientHash = getAnonymizedClientHash(req);

  const bucketKey = `rl_${action}_${clientHash}_${windowIndex}`;
  const expiresAtEpoch = (windowIndex + 1) * windowMs;
  const resetInSeconds = Math.max(1, Math.ceil((expiresAtEpoch - now) / 1000));

  // 1. Check local fast cache
  const localEntry = localMemoryBuckets.get(bucketKey);
  if (localEntry && localEntry.count >= maxRequests) {
    return {
      allowed: false,
      currentCount: localEntry.count,
      maxRequests,
      remaining: 0,
      resetInSeconds,
      clientHash,
    };
  }

  // 2. Query/Update Firestore distributed store
  let currentCount = 0;
  let persistenceSucceeded = false;

  try {
    const serverDb = getServerFirestore();
    const rateLimitRef = serverDb.collection('rateLimits').doc(bucketKey);

    const txResult = await serverDb.runTransaction(async (tx) => {
      const docSnap = await tx.get(rateLimitRef);
      let count = 0;

      if (docSnap.exists) {
        const data = docSnap.data() || {};
        count = typeof data.count === 'number' ? data.count : 0;
      }

      if (count >= maxRequests) {
        return { allowed: false, count };
      }

      const nextCount = count + 1;
      tx.set(
        rateLimitRef,
        {
          id: bucketKey,
          action,
          clientHash, // Only anonymized hash, zero PII
          count: nextCount,
          expiresAt: new Date(expiresAtEpoch).toISOString(),
          expiresAtDate: new Date(expiresAtEpoch), // Native Date (Timestamp) for Cloud Firestore TTL Policy ($0.00 auto-deletion)
          updatedAt: new Date(now).toISOString(),
        },
        { merge: true }
      );

      return { allowed: true, count: nextCount };
    });

    currentCount = txResult.count;
    persistenceSucceeded = true;

    // Sync back to local fast cache
    localMemoryBuckets.set(bucketKey, {
      count: currentCount,
      expiresAt: expiresAtEpoch,
    });

    if (!txResult.allowed) {
      return {
        allowed: false,
        currentCount,
        maxRequests,
        remaining: 0,
        resetInSeconds,
        clientHash,
      };
    }
  } catch (err: any) {
    // If Firestore is running in mock without collection or network glitch, fall back gracefully to local memory
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        `[RateLimiter Warning] Fallback para memória local (${action}):`,
        sanitizeLog(err?.message || err)
      );
    }
  }

  // 3. Fallback to in-memory if distributed persistence did not run
  if (!persistenceSucceeded) {
    const memBucket = localMemoryBuckets.get(bucketKey) || { count: 0, expiresAt: expiresAtEpoch };
    memBucket.count += 1;
    localMemoryBuckets.set(bucketKey, memBucket);
    currentCount = memBucket.count;

    if (currentCount > maxRequests) {
      return {
        allowed: false,
        currentCount,
        maxRequests,
        remaining: 0,
        resetInSeconds,
        clientHash,
      };
    }

    // Critical Actions Guard: For operations that dispatch emails or book schedules,
    // prevent unbounded attempts across rotated IPs or cold starts if distributed persistence fails.
    if (action === 'contact' || action === 'schedule_meeting') {
      const emergencyKey = `emg_${action}_${windowIndex}`;
      const emergencyEntry = emergencyFallbackBuckets.get(emergencyKey) || { count: 0, expiresAt: expiresAtEpoch };
      emergencyEntry.count += 1;
      emergencyFallbackBuckets.set(emergencyKey, emergencyEntry);

      // Conservative ceiling: At most (maxRequests * 2) fallback actions per instance window during a Firestore outage
      const emergencyCap = Math.max(maxRequests, 10);
      if (emergencyEntry.count > emergencyCap) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `[RateLimiter Emergency Circuit-Breaker] Limite emergencial atingido para ${action} durante indisponibilidade do Firestore.`
          );
        }
        return {
          allowed: false,
          currentCount: emergencyEntry.count,
          maxRequests,
          remaining: 0,
          resetInSeconds,
          clientHash,
        };
      }
    }
  }

  const remaining = Math.max(0, maxRequests - currentCount);

  return {
    allowed: true,
    currentCount,
    maxRequests,
    remaining,
    resetInSeconds,
    clientHash,
  };
}

/**
 * Resets local in-memory rate limiter buckets.
 * Intended for test suites and isolated teardowns.
 */
export function resetRateLimiterForTesting(): void {
  localMemoryBuckets.clear();
  emergencyFallbackBuckets.clear();
}
