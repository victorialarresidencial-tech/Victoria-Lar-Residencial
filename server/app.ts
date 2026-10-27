import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Load Firebase configuration with environment variables / secrets override
// Resilient path lookup supporting both local runtime and Vercel serverless functions
let rawFirebaseConfig: any = null;
try {
  const cwdPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const parentPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  const directPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const resolvedPath = [cwdPath, parentPath, directPath].find((p) => fs.existsSync(p));

  if (resolvedPath) {
    rawFirebaseConfig = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

const activeFirebaseProjectId =
  (process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_PROJECT_ID.trim()) ||
  (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim()) ||
  rawFirebaseConfig?.projectId ||
  'victoria-lar-residencial';

const activeFirebaseDatabaseId =
  (process.env.VITE_FIREBASE_DATABASE_ID && process.env.VITE_FIREBASE_DATABASE_ID.trim()) ||
  (process.env.FIREBASE_DATABASE_ID && process.env.FIREBASE_DATABASE_ID.trim()) ||
  rawFirebaseConfig?.firestoreDatabaseId ||
  '(default)';

const activeStorageBucket =
  (process.env.VITE_FIREBASE_STORAGE_BUCKET && process.env.VITE_FIREBASE_STORAGE_BUCKET.trim()) ||
  (process.env.FIREBASE_STORAGE_BUCKET && process.env.FIREBASE_STORAGE_BUCKET.trim()) ||
  rawFirebaseConfig?.storageBucket ||
  'victoria-lar-residencial.firebasestorage.app';

const isConfiguredFromSecrets = !!(
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY
);

import {
  OFFICIAL_GMAIL,
  OFFICIAL_SENDER_NAME,
  getTransporter,
  sendMeetingConfirmationEmail,
  buildSmtpConfig,
  verifySmtpConnection,
  sanitizeLog,
} from './mailer';
import {
  requireVerifiedOwner,
  requireActiveAdmin,
  requireActiveSuperAdmin,
  recordServerAuditLog,
  verifyFirebaseIdToken,
} from './auth';
import {
  getServerFirestore,
  getFirebaseAdminStatus,
} from './firebaseAdmin';

/**
 * Registers an API route with both /api prefix (standard Express)
 * and without /api prefix (for Vercel serverless rewrites where prefix might be trimmed).
 * Keeps routes directly on app._router.stack for backwards-compatibility with test suites.
 */
function registerRoute(
  method: 'get' | 'post' | 'patch',
  apiPath: string,
  handler: (req: Request, res: Response) => any
) {
  (app as any)[method](apiPath, handler);
  const strippedPath = apiPath.startsWith('/api') ? apiPath.substring(4) : apiPath;
  if (strippedPath && strippedPath !== apiPath) {
    (app as any)[method](strippedPath, handler);
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check endpoint
registerRoute('get', '/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    firebase: {
      configured: !!activeFirebaseProjectId,
      projectId: activeFirebaseProjectId,
      databaseId: activeFirebaseDatabaseId,
      storageBucket: activeStorageBucket,
      source: isConfiguredFromSecrets ? 'SECRETS_ENV' : 'APPLET_CONFIG_JSON',
      admin: getFirebaseAdminStatus(),
    },
    institution: 'Victoria Lar Residencial',
    platform: process.env.VERCEL ? 'VERCEL_SERVERLESS' : 'NODE_EXPRESS',
  });
});

// Bootstrap Status Query (Minimal safe state only, zero secret leakage)
registerRoute('get', '/api/bootstrap/status', async (_req: Request, res: Response) => {
  try {
    const serverDb = getServerFirestore();
    const bootstrapRef = serverDb.collection('system').doc('bootstrap');
    const bootstrapSnap = await bootstrapRef.get();

    let isCompleted = false;
    if (bootstrapSnap.exists) {
      const data = bootstrapSnap.data();
      isCompleted = Boolean(data && (data.lockedPermanently === true || data.status === 'COMPLETED'));
    }

    res.json({
      success: true,
      initialized: isCompleted,
      status: isCompleted ? 'COMPLETED' : 'UNINITIALIZED',
      lockedPermanently: isCompleted,
    });
  } catch {
    // Safe response during offline or initial bootstrapping queries
    res.json({
      success: true,
      initialized: false,
      status: 'UNINITIALIZED',
      lockedPermanently: false,
    });
  }
});

// Trusted Server-Side Initial Bootstrap Initiation Endpoint (Single-use, Concurrency-Safe, Cryptographically Verified)
registerRoute('post', '/api/bootstrap/initiate', async (req: Request, res: Response) => {
  try {
    // 1. Extract Bearer token from Authorization header or request body
    const authHeader = req.headers.authorization || '';
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.body && typeof req.body.idToken === 'string') {
      token = req.body.idToken.trim();
    } else if (req.body && typeof req.body.token === 'string') {
      token = req.body.token.trim();
    }

    if (!token) {
      return res.status(401).json({
        error: 'TOKEN_REQUIRED: O token de autenticação Firebase ID Token é obrigatório para inicializar o sistema.',
      });
    }

    // 2. Cryptographically verify Firebase ID token, identity and email verification
    // STRICT: Never trusts unverified email or uid sent in the request body!
    const verifiedOwner = await requireVerifiedOwner(token, activeFirebaseProjectId);
    const ownerUid = verifiedOwner.uid;
    const ownerEmail = verifiedOwner.email;

    // Use server-authoritative Firestore connection (Firebase Admin SDK)
    const serverDb = getServerFirestore();
    const bootstrapRef = serverDb.collection('system').doc('bootstrap');
    const guardRef = serverDb.collection('system').doc('superAdminGuard');
    const adminRef = serverDb.collection('admins').doc(ownerUid);
    const logId = `log_boot_${Date.now()}`;
    const auditRef = serverDb.collection('auditLogs').doc(logId);

    const result = await serverDb.runTransaction(async (tx) => {
      const bootstrapSnap = await tx.get(bootstrapRef);
      const guardSnap = await tx.get(guardRef);

      if (bootstrapSnap.exists) {
        const data = bootstrapSnap.data();
        if (data && (data.lockedPermanently === true || data.status === 'COMPLETED')) {
          if (data.superAdminUid === ownerUid) {
            return {
              success: true,
              message: 'Sistema já inicializado para este superadministrador.',
              alreadyInitialized: true,
            };
          }
          throw new Error('SISTEMA_JA_INICIALIZADO: O bootstrap inicial já foi executado e permanentemente selado. Novas contas de administrador devem ser convidadas exclusivamente pelo painel interno.');
        }
      }

      if (guardSnap.exists) {
        const gData = guardSnap.data();
        if (gData && typeof gData.activeSuperAdminCount === 'number' && gData.activeSuperAdminCount >= 1) {
          throw new Error('SISTEMA_JA_INICIALIZADO: O sistema já possui superadministrador ativo configurado.');
        }
      }

      const nowIso = new Date().toISOString();

      // 1. Establish initial superadministrator with active: true
      tx.set(adminRef, {
        uid: ownerUid,
        email: ownerEmail,
        role: 'superadmin',
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: 'SERVER_TRUSTED_BOOTSTRAP',
        bootstrapStatus: 'COMPLETED',
      });

      // 2. Set SuperAdminGuard with initial activeSuperAdminCount = 1
      tx.set(guardRef, {
        activeSuperAdminCount: 1,
        activeSuperAdminUids: [ownerUid],
        version: 1,
        updatedAt: nowIso,
      });

      // 3. Permanently seal bootstrap (minimal safe representation)
      tx.set(bootstrapRef, {
        status: 'COMPLETED',
        superAdminUid: ownerUid,
        completedAt: nowIso,
        lockedPermanently: true,
      });

      // 4. Generate trusted immutable audit log
      tx.set(auditRef, {
        id: logId,
        action: 'BOOTSTRAP_INITIAL_SEALED',
        performedByUid: ownerUid,
        performedByEmail: ownerEmail,
        targetResource: `/admins/${ownerUid}`,
        details: 'Initial superadmin account provisioned and permanent system bootstrap lock sealed by cryptographic server authority.',
        timestamp: nowIso,
      });

      return {
        success: true,
        message: 'Superadministrador inicial provisionado com sucesso e sistema selado.',
        alreadyInitialized: false,
      };
    });

    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.message?.includes('SISTEMA_JA_INICIALIZADO')) {
      return res.status(409).json({ error: err.message });
    }
    if (
      err?.message?.includes('TOKEN_') ||
      err?.message?.includes('EMAIL_NOT_VERIFIED') ||
      err?.message?.includes('UNAUTHORIZED_OWNER')
    ) {
      return res.status(403).json({ error: err.message });
    }
    console.error('[Server Bootstrap Initiation Error]:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: 'Falha ao executar bootstrap no servidor.' });
  }
});

// Server-Side Authenticated Admin Creation Endpoint (SuperAdmin Only, Atomic Transaction)
registerRoute('post', '/api/admin/users', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    // 1. Verify caller is active superadministrator with verified email
    const superAdmin = await requireActiveSuperAdmin(token, activeFirebaseProjectId);

    const { uid, email, role } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(uid)) {
      return res.status(400).json({ error: 'UID inválido fornecido para o administrador.' });
    }
    if (!email || typeof email !== 'string' || email.length > 160 || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail inválido fornecido para o administrador.' });
    }
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(400).json({ error: 'Função deve ser "admin" ou "superadmin".' });
    }

    const serverDb = getServerFirestore();
    const adminRef = serverDb.collection('admins').doc(uid);
    const guardRef = serverDb.collection('system').doc('superAdminGuard');

    await serverDb.runTransaction(async (tx) => {
      const existingDoc = await tx.get(adminRef);
      if (existingDoc.exists) {
        throw new Error('ADMIN_EXISTS: Já existe um administrador cadastrado com este UID.');
      }

      const guardSnap = await tx.get(guardRef);
      const guardData = guardSnap.exists ? guardSnap.data() : null;

      // Authoritative count of active superadmins derived from REAL records in Firestore
      const adminsSnap = await tx.get(serverDb.collection('admins'));
      const activeSuperAdminUids: string[] = [];
      adminsSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role === 'superadmin' && d.active === true) {
          activeSuperAdminUids.push(doc.id);
        }
      });

      const nowIso = new Date().toISOString();
      const adminData = {
        uid,
        email: email.trim().toLowerCase(),
        role,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: superAdmin.uid,
        bootstrapStatus: 'COMPLETED',
      };

      tx.set(adminRef, adminData);

      if (role === 'superadmin') {
        const updatedList = Array.from(new Set([...activeSuperAdminUids, uid]));
        tx.set(guardRef, {
          activeSuperAdminCount: updatedList.length,
          activeSuperAdminUids: updatedList,
          version: ((guardData?.version || 1) + 1),
          updatedAt: nowIso,
        }, { merge: true });
      }
    });

    await recordServerAuditLog({
      action: 'ADMIN_CREATED',
      performedByUid: superAdmin.uid,
      performedByEmail: superAdmin.email,
      targetResource: `/admins/${uid}`,
      details: `Novo administrador (${email}, função: ${role}) provisionado com autoridade atômica do servidor.`,
    });

    return res.status(201).json({ success: true, message: 'Administrador cadastrado com sucesso.' });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes('ADMIN_EXISTS')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('[Create Admin Error]:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || 'Falha ao cadastrar administrador.' });
  }
});

// Server-Side Authenticated Admin Status & Role Modification Endpoint (SuperAdmin Only, Atomic Transaction)
registerRoute('patch', '/api/admin/users/:uid', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    // 1. Verify caller is active superadministrator
    const superAdmin = await requireActiveSuperAdmin(token, activeFirebaseProjectId);

    const targetUid = req.params.uid;
    if (!targetUid || typeof targetUid !== 'string' || targetUid.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(targetUid)) {
      return res.status(400).json({ error: 'UID inválido de administrador.' });
    }

    const { role, active } = req.body || {};
    if (role !== undefined && role !== 'admin' && role !== 'superadmin') {
      return res.status(400).json({ error: 'Função deve ser "admin" ou "superadmin".' });
    }
    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Campo active deve ser booleano.' });
    }
    if (role === undefined && active === undefined) {
      return res.status(400).json({ error: 'Nenhum campo para atualização fornecido.' });
    }

    const serverDb = getServerFirestore();
    const adminRef = serverDb.collection('admins').doc(targetUid);
    const guardRef = serverDb.collection('system').doc('superAdminGuard');

    await serverDb.runTransaction(async (tx) => {
      const targetSnap = await tx.get(adminRef);
      if (!targetSnap.exists) {
        throw new Error('ADMIN_NOT_FOUND: Administrador não encontrado.');
      }

      const currentAdmin = targetSnap.data() || {};
      const isCurrentlyActiveSuperAdmin = currentAdmin.role === 'superadmin' && currentAdmin.active === true;

      const targetRole = role !== undefined ? role : currentAdmin.role;
      const targetActive = active !== undefined ? active : currentAdmin.active;
      const willBeActiveSuperAdmin = targetRole === 'superadmin' && targetActive === true;

      const guardSnap = await tx.get(guardRef);
      const guardData = guardSnap.exists ? guardSnap.data() : null;

      // Authoritative count of active superadmins derived from REAL records in Firestore
      const adminsSnap = await tx.get(serverDb.collection('admins'));
      const activeSuperAdminUids: string[] = [];
      adminsSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role === 'superadmin' && d.active === true) {
          activeSuperAdminUids.push(doc.id);
        }
      });

      const nowIso = new Date().toISOString();

      // If we are removing an active superadmin (via deactivation or demotion)
      if (isCurrentlyActiveSuperAdmin && !willBeActiveSuperAdmin) {
        if (activeSuperAdminUids.length <= 1) {
          throw new Error('PROTECAO_BLOQUEADA: Impossível desativar ou rebaixar o único superadministrador ativo remanescente. O sistema ficaria sem superadministrador.');
        }

        const remainingUids = activeSuperAdminUids.filter((u) => u !== targetUid);
        tx.set(guardRef, {
          activeSuperAdminCount: remainingUids.length,
          activeSuperAdminUids: remainingUids,
          version: ((guardData?.version || 1) + 1),
          updatedAt: nowIso,
        }, { merge: true });
      } else if (!isCurrentlyActiveSuperAdmin && willBeActiveSuperAdmin) {
        const updatedUids = Array.from(new Set([...activeSuperAdminUids, targetUid]));
        tx.set(guardRef, {
          activeSuperAdminCount: updatedUids.length,
          activeSuperAdminUids: updatedUids,
          version: ((guardData?.version || 1) + 1),
          updatedAt: nowIso,
        }, { merge: true });
      }

      const updateData: Record<string, any> = { updatedAt: nowIso };
      if (role !== undefined) updateData.role = role;
      if (active !== undefined) updateData.active = active;

      tx.update(adminRef, updateData);
    });

    await recordServerAuditLog({
      action: 'ADMIN_UPDATED',
      performedByUid: superAdmin.uid,
      performedByEmail: superAdmin.email,
      targetResource: `/admins/${targetUid}`,
      details: `Administrador ${targetUid} atualizado: ${JSON.stringify({ role, active })}.`,
    });

    return res.status(200).json({ success: true, message: 'Administrador atualizado com sucesso.' });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes('ADMIN_NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    if (err?.message?.includes('PROTECAO_BLOQUEADA')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('[Update Admin Error]:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || 'Falha ao atualizar administrador.' });
  }
});

// Server-Side Authenticated Admin Directory Query Endpoint
registerRoute('get', '/api/admin/users', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    // Caller must be active admin
    await requireActiveAdmin(token, activeFirebaseProjectId);

    const serverDb = getServerFirestore();
    const snap = await serverDb.collection('admins').get();
    const users = snap.docs.map((d) => d.data());

    return res.json({ success: true, users });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Falha ao consultar administradores.' });
  }
});

// Server-Side Authenticated Audit Logging Endpoint (Zero Client Forgery)
registerRoute('post', '/api/audit/log', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    // Authenticate token and verify live active admin status in Firestore
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId);

    const { action, targetResource, details } = req.body || {};
    if (!action || typeof action !== 'string' || action.length > 80) {
      return res.status(400).json({ error: 'Ação de auditoria inválida.' });
    }

    await recordServerAuditLog({
      action: action.trim(),
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: typeof targetResource === 'string' ? targetResource.slice(0, 200) : 'general',
      details: typeof details === 'string' ? details.slice(0, 1000) : '',
    });

    return res.status(201).json({ success: true, message: 'Evento de auditoria registrado pelo servidor.' });
  } catch (err: any) {
    return res.status(403).json({ error: 'Falha na validação de auditoria.' });
  }
});

// -------------------------------------------------------------
// Portal Access Requests & Modular Permissions (Zero Self-Elevation)
// -------------------------------------------------------------

// Submete solicitação de acesso para novos colaboradores/profissionais
registerRoute('post', '/api/access-requests', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária para solicitar acesso.' });
    }

    // 1. Verify token cryptographically and enforce email_verified
    const verifiedUser = await verifyFirebaseIdToken(token, activeFirebaseProjectId);
    if (!verifiedUser.email_verified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED: E-mail da conta Google deve ser verificado.' });
    }

    const uid = verifiedUser.uid;
    const email = (verifiedUser.email || '').trim().toLowerCase();

    const { nome, departamento, cargo, motivo, modulosSolicitados } = req.body || {};
    if (!nome || typeof nome !== 'string' || nome.trim().length === 0 || nome.length > 120) {
      return res.status(400).json({ error: 'Nome completo é obrigatório (até 120 caracteres).' });
    }
    if (!motivo || typeof motivo !== 'string' || motivo.trim().length === 0 || motivo.length > 1000) {
      return res.status(400).json({ error: 'Justificativa do pedido é obrigatória (até 1000 caracteres).' });
    }

    const validModules = ['residentes', 'colaboradores', 'landing_page', 'solicitacoes', 'usuarios', 'seguranca'];
    const sanitizedModules = Array.isArray(modulosSolicitados)
      ? modulosSolicitados.filter((m: any) => typeof m === 'string' && validModules.includes(m))
      : ['residentes'];

    if (sanitizedModules.length === 0) {
      sanitizedModules.push('residentes');
    }

    const serverDb = getServerFirestore();
    const requestId = `req_${uid}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const requestRecord = {
      id: requestId,
      uid,
      email,
      nome: nome.trim(),
      departamento: typeof departamento === 'string' ? departamento.slice(0, 100) : 'Equipe',
      cargo: typeof cargo === 'string' ? cargo.slice(0, 100) : 'Colaborador',
      motivo: motivo.trim(),
      modulosSolicitados: sanitizedModules,
      status: 'pendente', // STRICT: Initial state is ALWAYS pendente; client cannot self-approve!
      criadoEm: nowIso,
    };

    await serverDb.collection('accessRequests').doc(requestId).set(requestRecord);

    await recordServerAuditLog({
      action: 'ACCESS_REQUEST_SUBMITTED',
      performedByUid: uid,
      performedByEmail: email,
      targetResource: `/accessRequests/${requestId}`,
      details: `Solicitação de acesso criada por ${email} para os módulos: ${sanitizedModules.join(', ')}.`,
    });

    return res.status(201).json({
      success: true,
      message: 'Solicitação de acesso enviada com sucesso para a diretoria da Victoria Lar Residencial.',
      request: requestRecord,
    });
  } catch (err: any) {
    console.error('[Create Access Request Error]:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || 'Falha ao registrar solicitação de acesso.' });
  }
});

// Lista todas as solicitações de acesso (Apenas Administradores Ativos)
registerRoute('get', '/api/access-requests', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    await requireActiveAdmin(token, activeFirebaseProjectId);

    const serverDb = getServerFirestore();
    const snap = await serverDb.collection('accessRequests').orderBy('criadoEm', 'desc').get();
    const requests = snap.docs.map((d) => d.data());

    return res.json({ success: true, requests });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Falha ao buscar solicitações de acesso.' });
  }
});

// Revisa solicitação de acesso: Aprovar ou Rejeitar (Apenas Administradores Ativos)
registerRoute('post', '/api/access-requests/:id/review', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId);

    const requestId = req.params.id;
    const { status, justificativa, modulos, role } = req.body || {};

    if (status !== 'aprovada' && status !== 'rejeitada') {
      return res.status(400).json({ error: 'Status da revisão deve ser "aprovada" ou "rejeitada".' });
    }

    const serverDb = getServerFirestore();
    const requestRef = serverDb.collection('accessRequests').doc(requestId);

    const result = await serverDb.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) {
        throw new Error('NOT_FOUND: Solicitação de acesso não encontrada.');
      }
      const reqData = snap.data() || {};
      if (reqData.status !== 'pendente') {
        throw new Error('ALREADY_REVIEWED: Esta solicitação já foi revisada anteriormente.');
      }

      const nowIso = new Date().toISOString();
      const updatedRequest: Record<string, any> = {
        status,
        revisadoEm: nowIso,
        revisadoPorUid: activeAdmin.uid,
        revisadoPorEmail: activeAdmin.email,
        justificativaRevisao: typeof justificativa === 'string' ? justificativa.slice(0, 500) : '',
      };

      tx.update(requestRef, updatedRequest);

      // Se aprovada, provisiona ou atualiza o usuário em /usuariosAutorizados/{uid}
      if (status === 'aprovada') {
        const staffRef = serverDb.collection('usuariosAutorizados').doc(reqData.uid);
        const validModules = ['residentes', 'colaboradores', 'landing_page', 'solicitacoes', 'usuarios', 'seguranca'];
        const grantedModules = Array.isArray(modulos) && modulos.length > 0
          ? modulos.filter((m: any) => typeof m === 'string' && validModules.includes(m))
          : reqData.modulosSolicitados || ['residentes'];

        tx.set(staffRef, {
          uid: reqData.uid,
          email: reqData.email,
          nome: reqData.nome || '',
          departamento: reqData.departamento || '',
          cargo: reqData.cargo || '',
          role: role === 'admin' ? 'admin' : 'colaborador',
          modulos: grantedModules,
          ativo: true,
          concedidoEm: nowIso,
          concedidoPorUid: activeAdmin.uid,
          concedidoPorEmail: activeAdmin.email,
          atualizadoEm: nowIso,
        }, { merge: true });
      }

      return {
        success: true,
        message: status === 'aprovada'
          ? `Solicitação aprovada com sucesso. Acesso concedido para ${reqData.email}.`
          : `Solicitação de acesso rejeitada para ${reqData.email}.`,
      };
    });

    await recordServerAuditLog({
      action: status === 'aprovada' ? 'ACCESS_REQUEST_APPROVED' : 'ACCESS_REQUEST_REJECTED',
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: `/accessRequests/${requestId}`,
      details: `Revisão de solicitação por ${activeAdmin.email}: resultado ${status}.`,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    if (err?.message?.includes('ALREADY_REVIEWED')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('[Review Access Request Error]:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || 'Falha ao revisar solicitação de acesso.' });
  }
});

// Consulta permissões e módulos liberados para o usuário autenticado atual
registerRoute('get', '/api/user/permissions', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    const verifiedUser = await verifyFirebaseIdToken(token, activeFirebaseProjectId);
    const uid = verifiedUser.uid;
    const email = (verifiedUser.email || '').trim().toLowerCase();
    const isEmailVerified = !!verifiedUser.email_verified;

    const serverDb = getServerFirestore();

    // 1. Check if user is in /admins/{uid}
    const adminSnap = await serverDb.collection('admins').doc(uid).get();
    if (adminSnap.exists && isEmailVerified) {
      const adminData = adminSnap.data() || {};
      if (adminData.active === true) {
        return res.json({
          success: true,
          permissions: {
            uid,
            email,
            emailVerified: true,
            isAdmin: true,
            isSuperAdmin: adminData.role === 'superadmin',
            isStaff: true,
            ativo: true,
            modulos: ['residentes', 'colaboradores', 'landing_page', 'solicitacoes', 'usuarios', 'seguranca'],
          },
        });
      }
    }

    // 2. Check if user is in /usuariosAutorizados/{uid}
    const staffSnap = await serverDb.collection('usuariosAutorizados').doc(uid).get();
    if (staffSnap.exists && isEmailVerified) {
      const staffData = staffSnap.data() || {};
      if (staffData.ativo === true) {
        return res.json({
          success: true,
          permissions: {
            uid,
            email,
            emailVerified: true,
            isAdmin: staffData.role === 'admin',
            isSuperAdmin: false,
            isStaff: true,
            ativo: true,
            modulos: Array.isArray(staffData.modulos) ? staffData.modulos : ['residentes'],
          },
        });
      }
    }

    // 3. User is unassigned or inactive: check for existing pending or reviewed access request
    let pendingRequest: any = null;
    const requestsSnap = await serverDb
      .collection('accessRequests')
      .where('uid', '==', uid)
      .orderBy('criadoEm', 'desc')
      .limit(1)
      .get()
      .catch(() => null);

    if (requestsSnap && !requestsSnap.empty) {
      pendingRequest = requestsSnap.docs[0].data();
    }

    return res.json({
      success: true,
      permissions: {
        uid,
        email,
        emailVerified: isEmailVerified,
        isAdmin: false,
        isSuperAdmin: false,
        isStaff: false,
        ativo: false,
        modulos: [],
        pendingRequest,
      },
    });
  } catch (err: any) {
    return res.status(401).json({ error: 'Falha ao autenticar usuário para consulta de permissões.' });
  }
});

// Lista colaboradores autorizados no portal (Apenas Administradores Ativos)
registerRoute('get', '/api/staff-users', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    await requireActiveAdmin(token, activeFirebaseProjectId);

    const serverDb = getServerFirestore();
    const snap = await serverDb.collection('usuariosAutorizados').get();
    const staff = snap.docs.map((d) => d.data());

    return res.json({ success: true, staff });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Falha ao buscar colaboradores autorizados.' });
  }
});

// Atualiza permissões de módulo ou status ativo de um colaborador (Apenas Administradores Ativos)
registerRoute('patch', '/api/staff-users/:uid', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'TOKEN_REQUIRED: Autenticação necessária.' });
    }

    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId);
    const targetUid = req.params.uid;
    const { ativo, modulos, role } = req.body || {};

    const serverDb = getServerFirestore();
    const staffRef = serverDb.collection('usuariosAutorizados').doc(targetUid);
    const snap = await staffRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Colaborador não encontrado.' });
    }

    const nowIso = new Date().toISOString();
    const updateData: Record<string, any> = { atualizadoEm: nowIso };

    if (typeof ativo === 'boolean') updateData.ativo = ativo;
    if (Array.isArray(modulos)) updateData.modulos = modulos;
    if (role === 'admin' || role === 'colaborador') updateData.role = role;

    await staffRef.update(updateData);

    await recordServerAuditLog({
      action: 'STAFF_USER_UPDATED',
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: `/usuariosAutorizados/${targetUid}`,
      details: `Permissões de colaborador atualizadas por ${activeAdmin.email}: ${JSON.stringify(updateData)}.`,
    });

    return res.json({ success: true, message: 'Colaborador atualizado com sucesso.' });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Falha ao atualizar colaborador.' });
  }
});

// Availability & Scheduling Endpoints
export const DEFAULT_AVAILABILITY = {
  dailyTimeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
  activeDays: [1, 2, 3, 4, 5],
  blockedSlots: [] as Array<{ id: string; date: string; time?: string; reason?: string }>,
  meetingDuration: '30 a 45 minutos',
  meetingLink: 'https://meet.google.com/vic-tori-lar',
};

const bookedAppointments: Array<{ date: string; time: string }> = [];
let serverAvailabilityConfig = { ...DEFAULT_AVAILABILITY };

registerRoute('get', '/api/schedule/availability', async (_req: Request, res: Response) => {
  try {
    const serverDb = getServerFirestore();
    const snap = await serverDb.collection('content').doc('scheduling').get();
    if (snap.exists) {
      const data = snap.data() || {};
      let slots = DEFAULT_AVAILABILITY.dailyTimeSlots;
      if (data.availableHours && typeof data.availableHours === 'string') {
        const parsed = data.availableHours
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (parsed.length > 0) {
          slots = parsed;
        }
      }

      let activeDays = DEFAULT_AVAILABILITY.activeDays;
      let blockedSlots = DEFAULT_AVAILABILITY.blockedSlots;

      if (data.body && typeof data.body === 'string') {
        try {
          const parsedBody = JSON.parse(data.body);
          if (Array.isArray(parsedBody.activeDays)) activeDays = parsedBody.activeDays;
          if (Array.isArray(parsedBody.blockedSlots)) blockedSlots = parsedBody.blockedSlots;
          if (Array.isArray(parsedBody.dailyTimeSlots) && parsedBody.dailyTimeSlots.length > 0) {
            slots = parsedBody.dailyTimeSlots;
          }
        } catch {
          // ignore parse error on corrupted body
        }
      }

      const resolved = {
        dailyTimeSlots: slots,
        activeDays,
        blockedSlots,
        meetingDuration: data.meetingDuration || DEFAULT_AVAILABILITY.meetingDuration,
        meetingLink: data.meetingLink || DEFAULT_AVAILABILITY.meetingLink,
      };
      serverAvailabilityConfig = resolved;

      return res.json({
        success: true,
        availability: resolved,
      });
    }
  } catch (err: any) {
    console.warn('[Get Availability Firestore Warning]:', sanitizeLog(err?.message || err));
  }

  return res.json({
    success: true,
    availability: serverAvailabilityConfig,
  });
});

registerRoute('post', '/api/schedule/availability', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    if (!token) {
      return res.status(401).json({
        error: 'TOKEN_REQUIRED: Autenticação de administrador necessária para alterar a disponibilidade.',
      });
    }

    // Caller must be an active administrator with verified email
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId);

    const { availability } = req.body || {};
    if (!availability || typeof availability !== 'object') {
      return res.status(400).json({ error: 'Dados de disponibilidade inválidos.' });
    }

    const serverDb = getServerFirestore();
    const schedulingRef = serverDb.collection('content').doc('scheduling');
    const existingSnap = await schedulingRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : {};

    const slots = Array.isArray(availability.dailyTimeSlots)
      ? availability.dailyTimeSlots.map((s: any) => String(s).trim()).filter(Boolean)
      : (existingData.availableHours
          ? existingData.availableHours.split(',').map((s: string) => s.trim()).filter(Boolean)
          : DEFAULT_AVAILABILITY.dailyTimeSlots);

    const activeDays = Array.isArray(availability.activeDays)
      ? availability.activeDays
      : DEFAULT_AVAILABILITY.activeDays;

    const blockedSlots = Array.isArray(availability.blockedSlots)
      ? availability.blockedSlots
      : DEFAULT_AVAILABILITY.blockedSlots;

    const meetingDuration = typeof availability.meetingDuration === 'string'
      ? availability.meetingDuration.slice(0, 100)
      : (existingData.meetingDuration || DEFAULT_AVAILABILITY.meetingDuration);

    const meetingLink = typeof availability.meetingLink === 'string'
      ? availability.meetingLink.slice(0, 500)
      : (existingData.meetingLink || DEFAULT_AVAILABILITY.meetingLink);

    const nowIso = new Date().toISOString();
    const payload: Record<string, any> = {
      key: 'scheduling',
      title: existingData.title || 'Agende uma Conversa ou Visita Guiada',
      subtitle: existingData.subtitle || 'Escolha o canal mais prático para você. Atendimento direto com os proprietários e equipe de saúde, sem burocracia.',
      availableHours: slots.join(', '),
      meetingDuration,
      meetingLink,
      body: JSON.stringify({ activeDays, blockedSlots, dailyTimeSlots: slots }),
      updatedAt: nowIso,
      updatedBy: activeAdmin.uid,
    };

    await schedulingRef.set(payload, { merge: true });

    serverAvailabilityConfig = {
      dailyTimeSlots: slots,
      activeDays,
      blockedSlots,
      meetingDuration,
      meetingLink,
    };

    await recordServerAuditLog({
      action: 'AVAILABILITY_CONFIG_UPDATED',
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: '/content/scheduling',
      details: `Disponibilidade atualizada por ${activeAdmin.email}: ${slots.length} horários configurados.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Disponibilidade atualizada com sucesso no Firestore.',
      availability: serverAvailabilityConfig,
    });
  } catch (err: any) {
    if (err?.message?.includes('FORBIDDEN_') || err?.message?.includes('EMAIL_NOT_VERIFIED')) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes('TOKEN_')) {
      return res.status(401).json({ error: err.message });
    }
    console.error('[Update Availability Error]:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: 'Falha ao salvar configuração de disponibilidade no servidor.' });
  }
});

registerRoute('get', '/api/schedule/booked-slots', async (req: Request, res: Response) => {
  const dateQuery = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const bookedSlotsSet = new Set<string>();

  // Official source of truth: retrieve booked slots from Firestore /leads on this date
  if (dateQuery) {
    try {
      const serverDb = getServerFirestore();
      const snap = await serverDb
        .collection('leads')
        .where('scheduledDate', '==', dateQuery)
        .get();

      snap.forEach((doc) => {
        const d = doc.data();
        if (d && d.scheduledTime && d.status !== 'archived') {
          bookedSlotsSet.add(d.scheduledTime);
        }
      });
    } catch (err: any) {
      console.warn('[Booked Slots Query Warning]:', sanitizeLog(err?.message || err));
    }
  }

  // Memory fallback sync for test environments
  bookedAppointments
    .filter((a) => a.date === dateQuery)
    .forEach((a) => bookedSlotsSet.add(a.time));

  res.json({
    success: true,
    date: dateQuery,
    bookedSlots: Array.from(bookedSlotsSet),
  });
});

// Meeting Scheduling Intake API (Atomic slot reservation in Firestore + confirmation email)
registerRoute('post', '/api/schedule-meeting', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      scheduledDate,
      scheduledTime,
      meetingLink,
      relationship,
      serviceInterest,
      message,
      honeypot,
      emailSubject,
      emailInstructions,
    } = req.body || {};

    // Honeypot anti-bot check
    if (honeypot) {
      return res.status(200).json({ success: true, message: 'Agendamento recebido.' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      return res.status(400).json({ error: 'Nome completo é obrigatório e deve ter até 120 caracteres.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 160) {
      return res.status(400).json({ error: 'E-mail válido é obrigatório para envio da confirmação.' });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8 || phone.length > 30) {
      return res.status(400).json({ error: 'Telefone ou WhatsApp é obrigatório (mínimo 8 dígitos).' });
    }

    if (!scheduledDate || typeof scheduledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate.trim())) {
      return res.status(400).json({ error: 'Selecione uma data válida para a reunião (formato AAAA-MM-DD).' });
    }

    if (!scheduledTime || typeof scheduledTime !== 'string' || !/^\d{2}:\d{2}$/.test(scheduledTime.trim())) {
      return res.status(400).json({ error: 'Selecione um horário válido para a reunião (formato HH:MM).' });
    }

    const cleanDate = scheduledDate.trim();
    const cleanTime = scheduledTime.trim();
    const normalizedTime = cleanTime.replace(':', '-');
    const appointmentDocId = `meet_${cleanDate}_${normalizedTime}`;

    // Formata a data para formato amigável brasileiro (DD/MM/AAAA)
    const [y, m, d] = cleanDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    const resolvedMeetingLink = meetingLink || 'https://meet.google.com/vic-tori-lar';
    const nowIso = new Date().toISOString();

    const appointmentRecord = {
      id: appointmentDocId,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      scheduledDate: cleanDate,
      scheduledTime: cleanTime,
      meetingLink: resolvedMeetingLink,
      relationship: relationship ? String(relationship).slice(0, 60) : 'Familiar',
      serviceInterest: serviceInterest ? String(serviceInterest).slice(0, 100) : 'Reunião de Apresentação',
      message: message ? String(message).trim().slice(0, 2000) : '',
      status: 'unread',
      type: 'meeting',
      createdAt: nowIso,
    };

    // 1. ATOMIC RESERVATION IN FIRESTORE (DEFAULT)
    // Runs inside a server-side Firestore transaction with deterministic ID locking.
    // If the slot is already taken, transaction throws SLOT_ALREADY_BOOKED and aborts cleanly.
    const serverDb = getServerFirestore();
    const leadRef = serverDb.collection('leads').doc(appointmentDocId);

    try {
      await serverDb.runTransaction(async (tx) => {
        // A. Inspect deterministic document for this exact date & time slot
        const existingSlotDoc = await tx.get(leadRef);
        if (existingSlotDoc.exists) {
          const slotData = existingSlotDoc.data();
          if (slotData && slotData.status !== 'archived') {
            throw new Error('SLOT_ALREADY_BOOKED');
          }
        }

        // B. Also inspect if any active legacy lead has this slot
        const activeLeadsSnap = await tx.get(
          serverDb
            .collection('leads')
            .where('scheduledDate', '==', cleanDate)
            .where('scheduledTime', '==', cleanTime)
        );

        let hasActiveBooking = false;
        activeLeadsSnap.forEach((docSnap) => {
          if (docSnap.id !== appointmentDocId) {
            const data = docSnap.data();
            if (data && data.status !== 'archived') {
              hasActiveBooking = true;
            }
          }
        });

        if (hasActiveBooking) {
          throw new Error('SLOT_ALREADY_BOOKED');
        }

        // C. Atomically write the appointment reservation in Firestore
        tx.set(leadRef, appointmentRecord);
      });
    } catch (dbErr: any) {
      if (dbErr?.message === 'SLOT_ALREADY_BOOKED') {
        return res.status(409).json({
          success: false,
          appointmentScheduled: false,
          error: 'Este horário já está reservado. Por favor, escolha outro horário disponível.',
          code: 'SLOT_ALREADY_BOOKED',
        });
      }
      console.error('[Schedule Meeting Database Persistence Error]:', sanitizeLog(dbErr?.message || dbErr));
      return res.status(500).json({
        success: false,
        appointmentScheduled: false,
        error: 'Falha ao salvar agendamento no banco de dados. A reserva não foi confirmada. Tente novamente mais tarde.',
        code: 'PERSISTENCE_FAILED',
      });
    }

    // Keep bookedAppointments in sync for legacy memory observers
    if (!bookedAppointments.some((a) => a.date === cleanDate && a.time === cleanTime)) {
      bookedAppointments.push({ date: cleanDate, time: cleanTime });
    }

    // 2. DISPATCH CONFIRMATION EMAIL SYNCHRONOUSLY
    // (Only reaches this point if Firestore atomic persistence succeeded!)
    let emailResult = {
      success: false,
      error: 'Envio de e-mail não iniciado',
      errorCode: 'SEND_FAILED',
      googleCalendarUrl: null as string | null,
      previewUrl: null as string | null,
    };

    try {
      emailResult = (await sendMeetingConfirmationEmail({
        to: email.trim(),
        name: name.trim(),
        scheduledDate: cleanDate,
        scheduledTime: cleanTime,
        meetingLink: resolvedMeetingLink,
        serviceInterest,
        phone,
        subject: emailSubject,
        instructions: emailInstructions,
      })) as any;
    } catch (mailErr: any) {
      console.warn('[Schedule Meeting Email Dispatch Warning]:', sanitizeLog(mailErr?.message || mailErr));
      emailResult = {
        success: false,
        error: mailErr?.message || 'Falha no despacho SMTP',
        errorCode: mailErr?.code || 'SEND_FAILED',
        googleCalendarUrl: null,
        previewUrl: null,
      };
    }

    // 3. ASSEMBLE HTTP RESPONSE
    // Strictly distinguishes appointmentScheduled (persisted in DB) from emailSent
    const emailSent = emailResult.success === true;
    const userMessage = emailSent
      ? `Reunião agendada com sucesso para ${formattedDate} às ${cleanTime}! Um e-mail de confirmação com a sala do Google Meet e botão para registro no Google Calendar foi enviado para ${email.trim()} a partir de ${OFFICIAL_GMAIL}.`
      : `Reunião agendada com sucesso para ${formattedDate} às ${cleanTime}! Não foi possível despachar o e-mail de confirmação automaticamente (${emailResult.error || 'instabilidade na conexão SMTP'}), mas seu horário com a direção está confirmado. Salve o link do Google Meet e adicione o compromisso ao seu calendário pelos botões abaixo.`;

    return res.status(201).json({
      success: true,
      appointmentScheduled: true,
      emailSent,
      emailError: emailSent ? null : (emailResult.error || 'Falha no envio de e-mail'),
      errorCode: emailSent ? null : (emailResult.errorCode || 'SEND_FAILED'),
      message: userMessage,
      data: appointmentRecord,
      meetingLink: resolvedMeetingLink,
      googleCalendarUrl: emailResult?.googleCalendarUrl || null,
      sender: OFFICIAL_GMAIL,
      previewUrl: emailResult?.previewUrl || null,
    });
  } catch (err: any) {
    console.error('Erro no agendamento de reunião:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: 'Falha ao processar agendamento. Tente novamente mais tarde.' });
  }
});

// Mailer Status & Health Endpoint
registerRoute('get', '/api/mail/status', async (req: Request, res: Response) => {
  const config = buildSmtpConfig();
  const shouldVerify = req.query.verify === 'true';

  let verificationResult: { ok: boolean; error?: string } | null = null;
  if (shouldVerify) {
    verificationResult = await verifySmtpConnection();
  }

  res.json({
    success: true,
    senderEmail: OFFICIAL_GMAIL,
    senderName: OFFICIAL_SENDER_NAME,
    configured: !config.isFallback,
    mode: config.isCustomHost
      ? 'CUSTOM_SMTP'
      : config.isDirectGmail
      ? 'GMAIL_OFFICIAL'
      : 'DEVELOPMENT_FALLBACK',
    connection: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      hasAuth: !!config.pass,
      timeouts: {
        connection: config.connectionTimeout,
        greeting: config.greetingTimeout,
        socket: config.socketTimeout,
      },
    },
    verification: verificationResult,
    platform: process.env.VERCEL ? 'VERCEL_SERVERLESS' : 'NODE_CONTAINER',
    serverlessTips: [
      'Vercel bloqueia conexões SMTP na porta 25.',
      'Para Gmail no Vercel, recomenda-se porta 465 com SSL/TLS (SMTP_PORT=465 e SMTP_SECURE=true).',
      'Para porta 587, use STARTTLS (SMTP_PORT=587 e SMTP_SECURE=false).',
      'Timeouts ajustados para execução serverless (5s conexão / 5s saudação / 8s socket).',
    ],
  });
});

// Contact Intake API (Server-side validation and confirmation)
registerRoute('post', '/api/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, relationship, serviceInterest, message, honeypot } = req.body;

    // Honeypot check: anti-bot protection
    if (honeypot) {
      return res.status(200).json({ success: true, message: 'Solicitação recebida com sucesso.' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      return res.status(400).json({ error: 'Nome é obrigatório e deve ter até 120 caracteres.' });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8 || phone.length > 30) {
      return res.status(400).json({ error: 'Telefone de contato válido é obrigatório.' });
    }

    if (email && (typeof email !== 'string' || email.length > 160 || !email.includes('@'))) {
      return res.status(400).json({ error: 'E-mail fornecido é inválido.' });
    }

    if (message && (typeof message !== 'string' || message.length > 2000)) {
      return res.status(400).json({ error: 'Mensagem excede o limite de 2000 caracteres.' });
    }

    // SERVERLESS COMPATIBLE:
    // Await confirmation email delivery within try/catch so function lifecycle
    // does not terminate/freeze before SMTP transmission finishes.
    if (email && email.includes('@')) {
      try {
        const transporter = await getTransporter();
        await transporter.sendMail({
          from: `"${OFFICIAL_SENDER_NAME}" <${OFFICIAL_GMAIL}>`,
          replyTo: OFFICIAL_GMAIL,
          to: email.trim(),
          bcc: OFFICIAL_GMAIL,
          subject: 'Recebemos sua mensagem - Victoria Lar Residencial',
          html: `
            <div style="font-family: sans-serif; background-color: #FAF9F5; padding: 24px; color: #173D2B;">
              <div style="max-width: 550px; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #B8954A; margin: 0 auto;">
                <h2 style="color: #173D2B; font-family: Georgia, serif;">Olá, ${name.trim()}!</h2>
                <p>Recebemos sua solicitação de contato e interesse em <strong>${serviceInterest || 'nossos cuidados'}</strong>.</p>
                <p>Nossa equipe entrará em contato prontamente pelo telefone <strong>${phone.trim()}</strong> para tirar todas as suas dúvidas e acolher sua família.</p>
                <p style="margin-top: 20px; font-weight: bold; color: #173D2B;">Victoria Lar Residencial</p>
                <p style="font-size: 11px; color: #718096; margin-top: 10px;">E-mail oficial: ${OFFICIAL_GMAIL}</p>
              </div>
            </div>
          `,
        });
      } catch (e: any) {
        console.warn('[Victoria Lar Mailer] Aviso no envio de e-mail de contato simples:', sanitizeLog(e?.message || e));
      }
    }

    const leadRecord = {
      name: name.trim(),
      email: email ? email.trim() : null,
      phone: phone.trim(),
      relationship: relationship ? String(relationship).slice(0, 60) : 'Familiar',
      serviceInterest: serviceInterest ? String(serviceInterest).slice(0, 100) : 'Geral',
      message: message ? message.trim() : '',
      status: 'unread',
      type: 'form',
      createdAt: new Date().toISOString(),
      origin: 'landing_page_form',
    };

    return res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso! Um e-mail de confirmação foi encaminhado e nossa equipe retornará rapidamente.',
      data: leadRecord,
    });
  } catch (err: any) {
    console.error('Erro no processamento de contato:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: 'Falha no envio da mensagem. Tente novamente mais tarde.' });
  }
});

export { app, bookedAppointments, serverAvailabilityConfig };
export default app;
