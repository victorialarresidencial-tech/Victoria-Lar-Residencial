/**
 * Test & Validation Suite for Architecture Adjustments
 * 
 * 1. Claims & Deactivation Real-time Check (Firestore Rules + Backend)
 * 2. Concurrency-Safe Last Superadmin Protection (OCC / Firestore Transactions)
 * 3. Firestore Query Rules vs Filter Semantics (Drafts, Published, Deactivated Access)
 * 4. Resilient Bootstrap State Machine (Idempotence, Concurrency, Crash Recovery & Permanent Lock)
 */

interface AdminDoc {
  uid: string;
  email: string;
  role: 'superadmin' | 'admin';
  active: boolean;
  bootstrapStatus?: 'PENDING_CLAIMS' | 'COMPLETED';
}

interface SuperAdminGuardDoc {
  activeSuperAdminCount: number;
  activeSuperAdminUids: string[];
  version: number;
}

interface BootstrapDoc {
  status: 'UNINITIALIZED' | 'IN_PROGRESS' | 'COMPLETED';
  bootstrapId?: string;
  superAdminUid?: string;
  startedAt?: number;
  expiresAt?: number;
  completedAt?: number;
  lockedPermanently?: boolean;
}

interface ServiceDoc {
  id: string;
  title: string;
  status: 'draft' | 'published';
  createdAt: number;
}

// -------------------------------------------------------------
// MODULE 1 & 3: Firestore Security Rules Evaluation Engine
// -------------------------------------------------------------
class MockFirestoreSecurityEngine {
  private admins = new Map<string, AdminDoc>();
  private services = new Map<string, ServiceDoc>();

  setAdmin(admin: AdminDoc) {
    this.admins.set(admin.uid, admin);
  }

  setService(service: ServiceDoc) {
    this.services.set(service.id, service);
  }

  // Helper in Firestore Rules:
  // function isActiveAdmin() {
  //   return request.auth != null &&
  //     exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
  //     get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.active == true;
  // }
  private evaluateIsActiveAdmin(auth: { uid?: string; tokenRoleClaim?: string } | null): boolean {
    if (!auth || !auth.uid) return false;
    const adminDoc = this.admins.get(auth.uid);
    if (!adminDoc) return false;
    // CRITICAL: Live database active check overrides any stale token role claims!
    return adminDoc.active === true;
  }

  // Rule for /services/{serviceId}:
  // allow get: if resource.data.status == 'published' || isActiveAdmin();
  // allow list: if resource.data.status == 'published' || isActiveAdmin();
  evaluateGet(auth: { uid?: string; tokenRoleClaim?: string } | null, docPath: string): { allowed: boolean; reason: string } {
    const parts = docPath.split('/');
    if (parts[0] === 'services') {
      const serviceId = parts[1];
      const doc = this.services.get(serviceId);
      if (!doc) {
        return { allowed: false, reason: 'NOT_FOUND' };
      }
      const isAdmin = this.evaluateIsActiveAdmin(auth);
      const isPublished = doc.status === 'published';

      if (isPublished || isAdmin) {
        return { allowed: true, reason: 'OK' };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED: Drafts accessible only by active admins' };
    }
    return { allowed: false, reason: 'PERMISSION_DENIED' };
  }

  // FIRESTORE RULES ARE NOT FILTERS!
  // In Firestore, if a client queries `services` without where('status', '==', 'published'),
  // Firestore checks if the user has permission to read ALL potential documents the query could match.
  // Unless the user is an active admin (who can read any service), an unconstrained query is REJECTED.
  evaluateListQuery(
    auth: { uid?: string; tokenRoleClaim?: string } | null,
    collectionName: string,
    queryFilters: { field: string; op: string; value: any }[]
  ): { allowed: boolean; reason: string } {
    if (collectionName === 'services') {
      const isAdmin = this.evaluateIsActiveAdmin(auth);
      if (isAdmin) {
        return { allowed: true, reason: 'OK: Active admin can list all services' };
      }

      // Check if the query has the required security filter
      const hasPublishedFilter = queryFilters.some(
        f => f.field === 'status' && f.op === '==' && f.value === 'published'
      );

      if (!hasPublishedFilter) {
        // Query rejected because client did not filter out unpublished drafts!
        return {
          allowed: false,
          reason: 'PERMISSION_DENIED: Rules are not filters. Query must include where("status", "==", "published")'
        };
      }

      return { allowed: true, reason: 'OK: Query satisfies security rule criteria' };
    }

    return { allowed: false, reason: 'PERMISSION_DENIED' };
  }
}

// -------------------------------------------------------------
// MODULE 2: Concurrency-Safe Last Superadmin Protection
// -------------------------------------------------------------
class ConcurrentFirestoreDatabase {
  public superAdminGuard: SuperAdminGuardDoc = {
    activeSuperAdminCount: 2,
    activeSuperAdminUids: ['admin_1', 'admin_2'],
    version: 1
  };
  public admins = new Map<string, AdminDoc>([
    ['admin_1', { uid: 'admin_1', email: 'sa1@test.com', role: 'superadmin', active: true }],
    ['admin_2', { uid: 'admin_2', email: 'sa2@test.com', role: 'superadmin', active: true }],
  ]);

  // Simulates Firestore optimistic concurrency transaction with retries
  async runTransaction<T>(
    updateFunction: (transaction: {
      getGuard: () => Promise<SuperAdminGuardDoc>;
      getAdmin: (uid: string) => Promise<AdminDoc | undefined>;
      updateGuard: (guard: SuperAdminGuardDoc) => void;
      updateAdmin: (admin: AdminDoc) => void;
    }) => Promise<T>,
    maxRetries = 5
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const readVersion = this.superAdminGuard.version;
      let pendingGuardUpdate: SuperAdminGuardDoc | null = null;
      let pendingAdminUpdate: AdminDoc | null = null;

      const tx = {
        getGuard: async () => ({ ...this.superAdminGuard }),
        getAdmin: async (uid: string) => {
          const adm = this.admins.get(uid);
          return adm ? { ...adm } : undefined;
        },
        updateGuard: (guard: SuperAdminGuardDoc) => {
          pendingGuardUpdate = guard;
        },
        updateAdmin: (admin: AdminDoc) => {
          pendingAdminUpdate = admin;
        }
      };

      try {
        const result = await updateFunction(tx);

        // Optimistic concurrency check: did superAdminGuard change during the transaction execution?
        // Add random jitter to simulate network concurrency
        await new Promise(res => setTimeout(res, Math.floor(Math.random() * 20)));

        if (this.superAdminGuard.version !== readVersion) {
          // Transaction conflict (OCC retry)
          continue;
        }

        // Commit transaction atomically
        if (pendingGuardUpdate) {
          const guardToCommit: SuperAdminGuardDoc = pendingGuardUpdate;
          this.superAdminGuard = {
            ...guardToCommit,
            version: this.superAdminGuard.version + 1
          };
        }
        if (pendingAdminUpdate) {
          this.admins.set((pendingAdminUpdate as AdminDoc).uid, pendingAdminUpdate);
        }

        return result;
      } catch (err) {
        // Business logic exception (e.g. last superadmin protection), don't retry
        throw err;
      }
    }
    throw new Error('TRANSACTION_ABORTED: Max retries exceeded due to contention');
  }

  // Deactivate or demote an admin with serialization guarantee
  async modifyAdminRoleOrStatus(
    callerUid: string,
    targetUid: string,
    newStatus: { role?: 'superadmin' | 'admin'; active?: boolean }
  ): Promise<{ success: boolean; activeSuperAdminCount: number }> {
    return this.runTransaction(async (tx) => {
      const guard = await tx.getGuard();
      const targetAdmin = await tx.getAdmin(targetUid);

      if (!targetAdmin) {
        throw new Error('ADMIN_NOT_FOUND');
      }

      const willBeActiveSuperAdmin = 
        (newStatus.role ?? targetAdmin.role) === 'superadmin' &&
        (newStatus.active ?? targetAdmin.active) === true;

      const isCurrentlyActiveSuperAdmin =
        targetAdmin.role === 'superadmin' && targetAdmin.active === true;

      // If we are removing an active superadmin (via deactivation or demotion)
      if (isCurrentlyActiveSuperAdmin && !willBeActiveSuperAdmin) {
        if (guard.activeSuperAdminCount <= 1) {
          throw new Error('OPERATION_REJECTED: Cannot deactivate or demote the last remaining active superadmin');
        }

        // Decrement guard counter atomically
        const updatedUids = guard.activeSuperAdminUids.filter(u => u !== targetUid);
        tx.updateGuard({
          ...guard,
          activeSuperAdminCount: guard.activeSuperAdminCount - 1,
          activeSuperAdminUids: updatedUids
        });
      }

      // Update admin doc
      tx.updateAdmin({
        ...targetAdmin,
        role: newStatus.role ?? targetAdmin.role,
        active: newStatus.active ?? targetAdmin.active
      });

      return {
        success: true,
        activeSuperAdminCount: isCurrentlyActiveSuperAdmin && !willBeActiveSuperAdmin 
          ? guard.activeSuperAdminCount - 1 
          : guard.activeSuperAdminCount
      };
    });
  }
}

// -------------------------------------------------------------
// MODULE 4: Resilient Bootstrap State Machine
// -------------------------------------------------------------
class ResilientBootstrapSystem {
  public bootstrapDoc: BootstrapDoc = { status: 'UNINITIALIZED' };
  public admins = new Map<string, AdminDoc>();
  public authCustomClaims = new Map<string, Record<string, any>>();
  public simulateFailurePoint: 'FAIL_BEFORE_CLAIMS' | 'FAIL_DURING_CLAIMS' | 'FAIL_BEFORE_FINAL_LOCK' | null = null;

  async executeBootstrap(
    targetUid: string,
    targetEmail: string,
    options?: { runId?: string }
  ): Promise<{ status: string; message: string }> {
    const now = Date.now();
    const runId = options?.runId || `boot_${Math.random().toString(36).substring(7)}`;

    // STEP 1: Concurrency & Lock check in Firestore Transaction
    if (this.bootstrapDoc.lockedPermanently || this.bootstrapDoc.status === 'COMPLETED') {
      throw new Error('ALREADY_BOOTSTRAPPED: System is permanently initialized and locked');
    }

    if (this.bootstrapDoc.status === 'IN_PROGRESS') {
      // Lease timeout check (60s)
      if (this.bootstrapDoc.expiresAt && now < this.bootstrapDoc.expiresAt) {
        // Same targetUid can recover, different request is blocked
        if (this.bootstrapDoc.superAdminUid !== targetUid) {
          throw new Error('BOOTSTRAP_IN_PROGRESS: Another bootstrap initialization is actively in progress');
        }
      }
    }

    // Acquire lock and record intent
    this.bootstrapDoc = {
      status: 'IN_PROGRESS',
      bootstrapId: runId,
      superAdminUid: targetUid,
      startedAt: now,
      expiresAt: now + 60000,
      lockedPermanently: false
    };

    this.admins.set(targetUid, {
      uid: targetUid,
      email: targetEmail,
      role: 'superadmin',
      active: true,
      bootstrapStatus: 'PENDING_CLAIMS'
    });

    if (this.simulateFailurePoint === 'FAIL_BEFORE_CLAIMS') {
      throw new Error('SIMULATED_CRASH: Process died before assigning custom claims');
    }

    // STEP 2: Auth Custom Claims assignment
    try {
      if (this.simulateFailurePoint === 'FAIL_DURING_CLAIMS') {
        throw new Error('AUTH_SERVICE_UNAVAILABLE: Firebase Auth RPC failed');
      }
      this.authCustomClaims.set(targetUid, { role: 'superadmin' });
    } catch (authErr) {
      // Recovery state remains IN_PROGRESS with PENDING_CLAIMS so idempotent retry can finish
      throw authErr;
    }

    if (this.simulateFailurePoint === 'FAIL_BEFORE_FINAL_LOCK') {
      throw new Error('SIMULATED_CRASH: Process died before final transaction lock');
    }

    // STEP 3: Final Commit Transaction (Permanent lock)
    this.bootstrapDoc = {
      ...this.bootstrapDoc,
      status: 'COMPLETED',
      completedAt: Date.now(),
      lockedPermanently: true
    };

    const admin = this.admins.get(targetUid)!;
    admin.bootstrapStatus = 'COMPLETED';
    this.admins.set(targetUid, admin);

    return { status: 'COMPLETED', message: 'Bootstrap successfully initialized and permanently sealed' };
  }

  // Recovery runner for interrupted bootstrap
  async resumeBootstrapRecovery(targetUid: string, targetEmail: string): Promise<{ status: string; recovered: boolean }> {
    if (this.bootstrapDoc.status === 'COMPLETED') {
      return { status: 'COMPLETED', recovered: false };
    }

    if (this.bootstrapDoc.status === 'IN_PROGRESS' && this.bootstrapDoc.superAdminUid === targetUid) {
      // Clear simulation failure
      this.simulateFailurePoint = null;
      // Resumes Step 2 & Step 3 safely
      await this.executeBootstrap(targetUid, targetEmail, { runId: this.bootstrapDoc.bootstrapId });
      return { status: 'COMPLETED', recovered: true };
    }

    throw new Error('CANNOT_RECOVER: Invalid bootstrap state');
  }
}

// -------------------------------------------------------------
// TEST RUNNER
// -------------------------------------------------------------
async function runAllTests() {
  console.log('================================================================');
  console.log('STARTING ARCHITECTURAL VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}: ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // TEST SUITE 1: CLAIMS & DEACTIVATION CHECK
  console.log('--- Test Suite 1: Claims vs Live Deactivation State ---');
  const engine = new MockFirestoreSecurityEngine();
  engine.setAdmin({
    uid: 'admin_deactivated',
    email: 'revoked@lar.com',
    role: 'admin',
    active: false // DEACTIVATED IN DATABASE!
  });
  engine.setAdmin({
    uid: 'admin_active',
    email: 'active@lar.com',
    role: 'admin',
    active: true // ACTIVE IN DATABASE
  });
  engine.setService({
    id: 'draft_serv',
    title: 'Rascunho de Atendimento Especial',
    status: 'draft',
    createdAt: Date.now()
  });
  engine.setService({
    id: 'pub_serv',
    title: 'Enfermagem e Cuidados 24h',
    status: 'published',
    createdAt: Date.now()
  });

  // A revoked admin attempts to read a draft document using a still-valid token claim
  const revokedAccess = engine.evaluateGet(
    { uid: 'admin_deactivated', tokenRoleClaim: 'admin' },
    'services/draft_serv'
  );
  assert(
    !revokedAccess.allowed,
    'Deactivated admin with valid token claim CANNOT read drafts',
    `Expected rejected, got allowed=${revokedAccess.allowed}`
  );

  // An active admin reads draft
  const activeAccess = engine.evaluateGet(
    { uid: 'admin_active', tokenRoleClaim: 'admin' },
    'services/draft_serv'
  );
  assert(
    activeAccess.allowed,
    'Active admin CAN read draft service document',
    `Expected allowed, got allowed=${activeAccess.allowed}`
  );

  // TEST SUITE 2: LAST SUPERADMIN CONCURRENCY PROTECTION
  console.log('\n--- Test Suite 2: Last Superadmin Concurrency Protection ---');
  const db = new ConcurrentFirestoreDatabase();

  // Initial state: 2 active superadmins
  assert(db.superAdminGuard.activeSuperAdminCount === 2, 'Initial active superadmin count is 2');

  // Both superadmins attempt to deactivate each other simultaneously!
  let err1: any = null;
  let err2: any = null;

  const [res1, res2] = await Promise.allSettled([
    db.modifyAdminRoleOrStatus('admin_1', 'admin_2', { active: false }),
    db.modifyAdminRoleOrStatus('admin_2', 'admin_1', { active: false })
  ]);

  const settled1 = res1.status === 'fulfilled';
  const settled2 = res2.status === 'fulfilled';

  // Exactly one of the two concurrent calls MUST succeed, and the other MUST be rejected!
  assert(
    (settled1 && !settled2) || (!settled1 && settled2),
    'Exactly one concurrent deactivation succeeds and the conflicting one is blocked',
    `settled1=${settled1}, settled2=${settled2}`
  );

  // The database MUST still have exactly 1 active superadmin
  assert(
    db.superAdminGuard.activeSuperAdminCount === 1,
    'Database activeSuperAdminCount remains strictly 1 (Zero lockout prevented)'
  );

  // Now, the last remaining superadmin attempts to self-deactivate
  const remainingUid = db.superAdminGuard.activeSuperAdminUids[0];
  try {
    await db.modifyAdminRoleOrStatus(remainingUid, remainingUid, { active: false });
    assert(false, 'Last superadmin deactivation should throw error');
  } catch (err: any) {
    assert(
      err.message.includes('Cannot deactivate or demote the last remaining active superadmin'),
      'Direct attempt to deactivate the last superadmin is rejected with error'
    );
  }

  // TEST SUITE 3: FIRESTORE RULES ARE NOT FILTERS
  console.log('\n--- Test Suite 3: Firestore Rules "Rules are not filters" ---');
  // Public unauthenticated user queries services without status filter
  const unconstrainedQuery = engine.evaluateListQuery(null, 'services', []);
  assert(
    !unconstrainedQuery.allowed,
    'Public query WITHOUT where("status", "==", "published") is REJECTED (Rules are not filters)',
    unconstrainedQuery.reason
  );

  // Public unauthenticated user queries services WITH status == 'published'
  const constrainedQuery = engine.evaluateListQuery(null, 'services', [
    { field: 'status', op: '==', value: 'published' }
  ]);
  assert(
    constrainedQuery.allowed,
    'Public query WITH where("status", "==", "published") is ALLOWED',
    constrainedQuery.reason
  );

  // Public get of published service
  const pubGet = engine.evaluateGet(null, 'services/pub_serv');
  assert(pubGet.allowed, 'Public get on published service is ALLOWED');

  // Public get of draft service
  const draftGet = engine.evaluateGet(null, 'services/draft_serv');
  assert(!draftGet.allowed, 'Public get on draft service is REJECTED');

  // TEST SUITE 4: RESILIENT BOOTSTRAP STATE MACHINE
  console.log('\n--- Test Suite 4: Resilient Bootstrap & Crash Recovery ---');
  const bootstrapSystem = new ResilientBootstrapSystem();

  // Test 4.1: Crash between Firestore Transaction and Custom Claims assignment
  bootstrapSystem.simulateFailurePoint = 'FAIL_BEFORE_CLAIMS';
  let crashCaught = false;
  try {
    await bootstrapSystem.executeBootstrap('root_user_1', 'root@lar.com');
  } catch (err: any) {
    crashCaught = err.message.includes('SIMULATED_CRASH');
  }
  assert(crashCaught, 'Simulated mid-step crash caught during bootstrap');
  assert(
    bootstrapSystem.bootstrapDoc.status === 'IN_PROGRESS',
    'Bootstrap status is preserved as IN_PROGRESS after crash'
  );
  assert(
    bootstrapSystem.admins.get('root_user_1')?.bootstrapStatus === 'PENDING_CLAIMS',
    'Admin doc correctly flagged as PENDING_CLAIMS'
  );

  // Test 4.2: Concurrent bootstrap attempt while IN_PROGRESS by another user
  let concurrentBlocked = false;
  try {
    await bootstrapSystem.executeBootstrap('intruder_user_2', 'intruder@lar.com');
  } catch (err: any) {
    concurrentBlocked = err.message.includes('BOOTSTRAP_IN_PROGRESS');
  }
  assert(concurrentBlocked, 'Concurrent bootstrap attempt by another user is BLOCKED');

  // Test 4.3: Safe recovery resumes and completes bootstrap
  const recoveryResult = await bootstrapSystem.resumeBootstrapRecovery('root_user_1', 'root@lar.com');
  assert(recoveryResult.recovered, 'Bootstrap recovery executed successfully');
  assert(
    bootstrapSystem.bootstrapDoc.status === 'COMPLETED' && bootstrapSystem.bootstrapDoc.lockedPermanently === true,
    'Bootstrap is now COMPLETED and lockedPermanently=true'
  );
  assert(
    bootstrapSystem.authCustomClaims.get('root_user_1')?.role === 'superadmin',
    'Auth custom claims assigned successfully during recovery'
  );

  // Test 4.4: Permanent lock rejects subsequent bootstrap requests
  let lockBlocked = false;
  try {
    await bootstrapSystem.executeBootstrap('intruder_user_3', 'intruder2@lar.com');
  } catch (err: any) {
    lockBlocked = err.message.includes('ALREADY_BOOTSTRAPPED');
  }
  assert(lockBlocked, 'Subsequent bootstrap attempts permanently blocked with ALREADY_BOOTSTRAPPED');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
