/**
 * Test Suite: Victoria Lar Residencial — RBAC Security & Concurrency Audit (Fase 3.2A)
 * 
 * Verifies all 12 mandatory technical security and concurrency requirements:
 * 1. Usuário não autenticado.
 * 2. Usuário autenticado sem autorização administrativa.
 * 3. Administrador ativo tentando aprovar a própria solicitação.
 * 4. Administrador comum tentando conceder papel admin.
 * 5. Administrador comum tentando conceder papel superadmin.
 * 6. Superadministrador ativo realizando uma operação administrativa autorizada.
 * 7. Solicitação já revisada recebendo nova tentativa de revisão.
 * 8. Dois administradores revisando simultaneamente a mesma solicitação.
 * 9. Usuário enviando solicitação quando já existe uma pendente.
 * 10. Duas solicitações simultâneas do mesmo usuário.
 * 11. Tentativa de modificar campos protegidos pelo payload.
 * 12. Usuário desativado ou com privilégios revogados tentando executar operações administrativas.
 */

process.env.NODE_ENV = 'test';

import { app } from '../server/app';
import {
  setServerFirestoreInstanceForTesting,
  createInMemoryFirestoreMock,
  resetServerFirestoreInstanceForTesting,
} from '../server/firebaseAdmin';
import { setMockTokenVerifierForTesting } from '../server/auth';

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

function findRouteHandler(method: string, path: string): { handler: any; params: Record<string, string> } | null {
  for (const layer of (app as any)._router.stack) {
    if (layer.route && layer.route.methods[method.toLowerCase()]) {
      const routePath = layer.route.path;
      // Exact match
      if (routePath === path) {
        return { handler: layer.route.stack[0].handle, params: {} };
      }
      // Parametric match e.g. /api/access-requests/:id/review -> ^/api/access-requests/([^/]+)/review$
      const paramNames: string[] = [];
      const regexStr =
        '^' +
        routePath.replace(/:([a-zA-Z0-9_]+)/g, (_: string, paramName: string) => {
          paramNames.push(paramName);
          return '([^/]+)';
        }) +
        '$';
      const regex = new RegExp(regexStr);
      const match = path.match(regex);
      if (match) {
        const params: Record<string, string> = {};
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return { handler: layer.route.stack[0].handle, params };
      }
    }
  }
  return null;
}

function dispatchRoute(
  method: 'get' | 'post' | 'patch',
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: any; headers: Record<string, any> }> {
  return new Promise((resolve) => {
    let resolvedStatus = 200;
    let resolvedBody: any = null;
    const resolvedHeaders: Record<string, any> = {};

    const routeMatch = findRouteHandler(method, path);
    if (!routeMatch) {
      resolve({
        status: 404,
        body: { error: `Route ${method.toUpperCase()} ${path} not found` },
        headers: {},
      });
      return;
    }

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers || {})) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const req: any = {
      method: method.toUpperCase(),
      path,
      url: path,
      body: options.body || {},
      headers: normalizedHeaders,
      query: options.query || {},
      params: { ...routeMatch.params, ...(options.params || {}) },
    };

    const res: any = {
      status: (code: number) => {
        resolvedStatus = code;
        return res;
      },
      setHeader: (name: string, val: any) => {
        resolvedHeaders[name.toLowerCase()] = val;
        return res;
      },
      json: (data: any) => {
        resolvedBody = data;
        resolve({ status: resolvedStatus, body: resolvedBody, headers: resolvedHeaders });
        return res;
      },
      send: (data: any) => {
        resolvedBody = data;
        resolve({ status: resolvedStatus, body: resolvedBody, headers: resolvedHeaders });
        return res;
      },
    };

    try {
      routeMatch.handler(req, res);
    } catch (e: any) {
      resolve({ status: 500, body: { error: e.message }, headers: {} });
    }
  });
}

// User accounts used in testing
const USERS = {
  superadmin: {
    uid: 'uid_superadmin_1',
    email: 'superadmin@victorialar.com.br',
    email_verified: true,
  },
  adminRegular1: {
    uid: 'uid_admin_reg_1',
    email: 'admin1@victorialar.com.br',
    email_verified: true,
  },
  adminRegular2: {
    uid: 'uid_admin_reg_2',
    email: 'admin2@victorialar.com.br',
    email_verified: true,
  },
  adminDeactivated: {
    uid: 'uid_admin_deact_1',
    email: 'deactivated@victorialar.com.br',
    email_verified: true,
  },
  commonUser1: {
    uid: 'uid_common_user_1',
    email: 'colaborador1@victorialar.com.br',
    email_verified: true,
  },
  commonUser2: {
    uid: 'uid_common_user_2',
    email: 'colaborador2@victorialar.com.br',
    email_verified: true,
  },
  unverifiedUser: {
    uid: 'uid_unverified_user',
    email: 'unverified@exemplo.com.br',
    email_verified: false,
  },
};

function authHeaderFor(userKey: keyof typeof USERS): Record<string, string> {
  return {
    Authorization: `Bearer token_${userKey}`,
  };
}

async function runRbacSecurityTestSuite() {
  console.log('================================================================');
  console.log('STARTING VICTORIA LAR RBAC & CONCURRENCY SECURITY AUDIT (FASE 3.2A)');
  console.log('================================================================');

  const mockDb = createInMemoryFirestoreMock();
  setServerFirestoreInstanceForTesting(mockDb);

  // Setup Mock Token Verifier
  setMockTokenVerifierForTesting((token: string) => {
    if (!token.startsWith('token_')) {
      return null;
    }
    const key = token.replace('token_', '') as keyof typeof USERS;
    const user = USERS[key];
    if (!user) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    return {
      sub: user.uid,
      uid: user.uid,
      email: user.email,
      email_verified: user.email_verified,
      aud: 'victoria-lar-residencial',
      iss: 'https://securetoken.google.com/victoria-lar-residencial',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    };
  });

  // Seed baseline Firestore accounts
  const nowIso = new Date().toISOString();
  await mockDb.collection('admins').doc(USERS.superadmin.uid).set({
    uid: USERS.superadmin.uid,
    email: USERS.superadmin.email,
    role: 'superadmin',
    active: true,
    createdAt: nowIso,
  });

  await mockDb.collection('admins').doc(USERS.adminRegular1.uid).set({
    uid: USERS.adminRegular1.uid,
    email: USERS.adminRegular1.email,
    role: 'admin',
    active: true,
    createdAt: nowIso,
  });

  await mockDb.collection('admins').doc(USERS.adminRegular2.uid).set({
    uid: USERS.adminRegular2.uid,
    email: USERS.adminRegular2.email,
    role: 'admin',
    active: true,
    createdAt: nowIso,
  });

  await mockDb.collection('admins').doc(USERS.adminDeactivated.uid).set({
    uid: USERS.adminDeactivated.uid,
    email: USERS.adminDeactivated.email,
    role: 'admin',
    active: false,
    createdAt: nowIso,
  });

  // -------------------------------------------------------------
  // Test 1: Usuário não autenticado
  // -------------------------------------------------------------
  console.log('\n--- Cenário 1: Usuário Não Autenticado ---');
  const unauthReq = await dispatchRoute('post', '/api/access-requests', {
    body: { nome: 'Sem Token', motivo: 'Teste' },
  });
  assert(unauthReq.status === 401, 'POST /api/access-requests sem token retorna HTTP 401');

  const unauthReview = await dispatchRoute('post', '/api/access-requests/req_dummy/review', {
    body: { status: 'aprovada' },
  });
  assert(unauthReview.status === 401, 'POST /api/access-requests/:id/review sem token retorna HTTP 401');

  const unauthPatch = await dispatchRoute('patch', '/api/staff-users/some_uid', {
    body: { ativo: true },
  });
  assert(unauthPatch.status === 401, 'PATCH /api/staff-users/:uid sem token retorna HTTP 401');

  // E-mail não verificado
  const unverifiedReq = await dispatchRoute('post', '/api/access-requests', {
    headers: authHeaderFor('unverifiedUser'),
    body: { nome: 'Não Verificado', motivo: 'Teste de e-mail não verificado' },
  });
  assert(unverifiedReq.status === 403, 'Usuário com e-mail não verificado recebe HTTP 403');

  // -------------------------------------------------------------
  // Test 2: Usuário autenticado sem autorização administrativa
  // -------------------------------------------------------------
  console.log('\n--- Cenário 2: Usuário Autenticado Sem Autorização Administrativa ---');
  const nonAdminReview = await dispatchRoute('post', '/api/access-requests/req_dummy/review', {
    headers: authHeaderFor('commonUser1'),
    body: { status: 'aprovada' },
  });
  assert(nonAdminReview.status === 403, 'Usuário comum tentando revisar solicitação recebe HTTP 403');
  assert(
    nonAdminReview.body?.error?.includes('FORBIDDEN_NOT_ADMIN'),
    'Erro indica que conta não é administradora'
  );

  const nonAdminPatch = await dispatchRoute('patch', '/api/staff-users/some_uid', {
    headers: authHeaderFor('commonUser1'),
    body: { ativo: false },
  });
  assert(nonAdminPatch.status === 403, 'Usuário comum tentando alterar colaboradores recebe HTTP 403');

  // -------------------------------------------------------------
  // Test 3: Administrador ativo tentando aprovar a própria solicitação
  // -------------------------------------------------------------
  console.log('\n--- Cenário 3: Administrador Ativo Tentando Aprovar Própria Solicitação ---');
  // Seed access request owned by adminRegular1
  const selfReqId = 'req_self_admin1';
  await mockDb.collection('accessRequests').doc(selfReqId).set({
    id: selfReqId,
    uid: USERS.adminRegular1.uid,
    email: USERS.adminRegular1.email,
    nome: 'Admin 1 Solicitando',
    motivo: 'Preciso de permissão',
    status: 'pendente',
    modulosSolicitados: ['residentes'],
    criadoEm: nowIso,
  });

  const selfReview = await dispatchRoute('post', `/api/access-requests/${selfReqId}/review`, {
    headers: authHeaderFor('adminRegular1'),
    body: { status: 'aprovada' },
  });
  assert(selfReview.status === 403, 'Admin tentando aprovar própria solicitação recebe HTTP 403');
  assert(
    selfReview.body?.error?.includes('CANNOT_REVIEW_OWN_REQUEST'),
    'Mensagem de erro explícita sobre proibição de autoaprovação'
  );

  const selfReqDoc = await mockDb.collection('accessRequests').doc(selfReqId).get();
  assert(selfReqDoc.data()?.status === 'pendente', 'Estado da solicitação permaneceu intacto como "pendente"');

  // -------------------------------------------------------------
  // Test 4: Administrador comum tentando conceder papel admin
  // -------------------------------------------------------------
  console.log('\n--- Cenário 4: Administrador Comum Tentando Conceder Papel Admin ---');
  const targetReqId4 = 'req_user_test_4';
  await mockDb.collection('accessRequests').doc(targetReqId4).set({
    id: targetReqId4,
    uid: 'uid_test_4',
    email: 'user4@exemplo.com.br',
    nome: 'Usuário Quatro',
    motivo: 'Acesso normal',
    status: 'pendente',
    modulosSolicitados: ['residentes'],
    criadoEm: nowIso,
  });

  const adminGrantAdmin = await dispatchRoute('post', `/api/access-requests/${targetReqId4}/review`, {
    headers: authHeaderFor('adminRegular1'),
    body: { status: 'aprovada', role: 'admin' },
  });
  assert(adminGrantAdmin.status === 403, 'Admin comum tentando aprovar com role: admin recebe HTTP 403');
  assert(
    adminGrantAdmin.body?.error?.includes('FORBIDDEN_SUPERADMIN_REQUIRED'),
    'Erro exige autorização de superadministrador ativo'
  );

  // Setup staff doc for PATCH test
  await mockDb.collection('usuariosAutorizados').doc('uid_test_4').set({
    uid: 'uid_test_4',
    email: 'user4@exemplo.com.br',
    nome: 'Usuário Quatro',
    role: 'colaborador',
    modulos: ['residentes'],
    ativo: true,
    concedidoEm: nowIso,
    atualizadoEm: nowIso,
  });

  const adminPatchRole = await dispatchRoute('patch', '/api/staff-users/uid_test_4', {
    headers: authHeaderFor('adminRegular1'),
    body: { role: 'admin' },
  });
  assert(adminPatchRole.status === 403, 'Admin comum tentando promover colaborador via PATCH recebe HTTP 403');

  // -------------------------------------------------------------
  // Test 5: Administrador comum tentando conceder papel superadmin
  // -------------------------------------------------------------
  console.log('\n--- Cenário 5: Administrador Comum Tentando Conceder Papel Superadmin ---');
  const adminGrantSuperAdmin = await dispatchRoute('post', `/api/access-requests/${targetReqId4}/review`, {
    headers: authHeaderFor('adminRegular1'),
    body: { status: 'aprovada', role: 'superadmin' },
  });
  assert(
    adminGrantSuperAdmin.status === 400 || adminGrantSuperAdmin.status === 403,
    'Admin comum tentando conceder papel superadmin é estritamente bloqueado (HTTP 400 ou 403)'
  );

  const adminPatchSuper = await dispatchRoute('patch', '/api/staff-users/uid_test_4', {
    headers: authHeaderFor('adminRegular1'),
    body: { role: 'superadmin' },
  });
  assert(
    adminPatchSuper.status === 400 || adminPatchSuper.status === 403,
    'Admin comum tentando atribuir superadmin via PATCH é estritamente bloqueado'
  );

  // -------------------------------------------------------------
  // Test 6: Superadministrador ativo realizando operação autorizada
  // -------------------------------------------------------------
  console.log('\n--- Cenário 6: Superadministrador Ativo Realizando Operação Autorizada ---');
  const superReview = await dispatchRoute('post', `/api/access-requests/${targetReqId4}/review`, {
    headers: authHeaderFor('superadmin'),
    body: {
      status: 'aprovada',
      role: 'colaborador',
      modulos: ['residentes', 'colaboradores'],
      justificativa: 'Aprovado pelo superadmin com sucesso',
    },
  });
  assert(superReview.status === 200, 'Superadministrador aprovando solicitação recebe HTTP 200');

  const reviewedDoc = await mockDb.collection('accessRequests').doc(targetReqId4).get();
  assert(reviewedDoc.data()?.status === 'aprovada', 'Solicitação foi atualizada para "aprovada"');
  assert(
    reviewedDoc.data()?.revisadoPorUid === USERS.superadmin.uid,
    'Revisão registrada com UID do superadministrador'
  );

  const staffDoc = await mockDb.collection('usuariosAutorizados').doc('uid_test_4').get();
  assert(staffDoc.exists === true, 'Documento em /usuariosAutorizados provisionado');
  assert(staffDoc.data()?.role === 'colaborador', 'Papel inicial atribuído como "colaborador"');

  // Superadmin promovendo colaborador a admin
  const superPromote = await dispatchRoute('patch', '/api/staff-users/uid_test_4', {
    headers: authHeaderFor('superadmin'),
    body: { role: 'admin' },
  });
  assert(superPromote.status === 200, 'Superadministrador promovendo usuário recebe HTTP 200');

  const promotedDoc = await mockDb.collection('usuariosAutorizados').doc('uid_test_4').get();
  assert(promotedDoc.data()?.role === 'admin', 'Papel do colaborador promovido para "admin"');

  // -------------------------------------------------------------
  // Test 7: Solicitação já revisada recebendo nova tentativa de revisão
  // -------------------------------------------------------------
  console.log('\n--- Cenário 7: Solicitação Já Revisada Recebendo Nova Tentativa ---');
  const secondReview = await dispatchRoute('post', `/api/access-requests/${targetReqId4}/review`, {
    headers: authHeaderFor('superadmin'),
    body: { status: 'rejeitada' },
  });
  assert(secondReview.status === 409, 'Nova revisão em solicitação já revisada retorna HTTP 409 Conflict');
  assert(
    secondReview.body?.error?.includes('ALREADY_REVIEWED'),
    'Código de erro explícito ALREADY_REVIEWED'
  );

  // -------------------------------------------------------------
  // Test 8: Dois administradores revisando simultaneamente a mesma solicitação
  // -------------------------------------------------------------
  console.log('\n--- Cenário 8: Concorrência — Dois Administradores Revisando Simultaneamente ---');
  const concReqId = 'req_concurrent_review';
  await mockDb.collection('accessRequests').doc(concReqId).set({
    id: concReqId,
    uid: 'uid_conc_user',
    email: 'conc@exemplo.com.br',
    nome: 'Usuário Concorrente',
    motivo: 'Teste concorrente',
    status: 'pendente',
    modulosSolicitados: ['residentes'],
    criadoEm: nowIso,
  });

  const [revResult1, revResult2] = await Promise.all([
    dispatchRoute('post', `/api/access-requests/${concReqId}/review`, {
      headers: authHeaderFor('adminRegular1'),
      body: { status: 'aprovada', role: 'colaborador' },
    }),
    dispatchRoute('post', `/api/access-requests/${concReqId}/review`, {
      headers: authHeaderFor('adminRegular2'),
      body: { status: 'rejeitada' },
    }),
  ]);

  const statuses = [revResult1.status, revResult2.status].sort();
  assert(
    statuses[0] === 200 && statuses[1] === 409,
    'Exatamente uma das requisições concorrentes obtém HTTP 200 e a outra obtém HTTP 409 Conflict',
    `Status obtidos: ${revResult1.status} e ${revResult2.status}`
  );

  // -------------------------------------------------------------
  // Test 9: Usuário enviando solicitação quando já existe uma pendente
  // -------------------------------------------------------------
  console.log('\n--- Cenário 9: Usuário Enviando Solicitação com Outra Já Pendente ---');
  const firstReq = await dispatchRoute('post', '/api/access-requests', {
    headers: authHeaderFor('commonUser1'),
    body: {
      nome: 'Colaborador Um',
      motivo: 'Primeira solicitação legítima',
      modulosSolicitados: ['residentes'],
    },
  });
  assert(firstReq.status === 201, 'Primeira solicitação criada com sucesso (HTTP 201)');

  const duplicateReq = await dispatchRoute('post', '/api/access-requests', {
    headers: authHeaderFor('commonUser1'),
    body: {
      nome: 'Colaborador Um Novamente',
      motivo: 'Segunda solicitação indevida enquanto a primeira está pendente',
      modulosSolicitados: ['colaboradores'],
    },
  });
  assert(duplicateReq.status === 409, 'Segunda solicitação retorna HTTP 409 Conflict');
  assert(
    duplicateReq.body?.error?.includes('SOLICITACAO_PENDENTE_EXISTENTE'),
    'Código de erro explícito de solicitação pendente existente'
  );

  // -------------------------------------------------------------
  // Test 10: Duas solicitações simultâneas do mesmo usuário
  // -------------------------------------------------------------
  console.log('\n--- Cenário 10: Concorrência — Duas Solicitações Simultâneas do Mesmo Usuário ---');
  const [subResult1, subResult2] = await Promise.all([
    dispatchRoute('post', '/api/access-requests', {
      headers: authHeaderFor('commonUser2'),
      body: {
        nome: 'Colaborador Dois',
        motivo: 'Disparo simultâneo A',
        modulosSolicitados: ['residentes'],
      },
    }),
    dispatchRoute('post', '/api/access-requests', {
      headers: authHeaderFor('commonUser2'),
      body: {
        nome: 'Colaborador Dois',
        motivo: 'Disparo simultâneo B',
        modulosSolicitados: ['residentes'],
      },
    }),
  ]);

  const subStatuses = [subResult1.status, subResult2.status].sort();
  assert(
    subStatuses[0] === 201 && subStatuses[1] === 409,
    'Exatamente uma das requisições simultâneas obtém HTTP 201 e a concorrente recebe HTTP 409',
    `Status obtidos: ${subResult1.status} e ${subResult2.status}`
  );

  // -------------------------------------------------------------
  // Test 11: Tentativa de modificar campos protegidos pelo payload
  // -------------------------------------------------------------
  console.log('\n--- Cenário 11: Modificação de Campos Protegidos via Payload ---');
  // Attempt to forge UID or email on PATCH /api/staff-users
  const forgeUidPatch = await dispatchRoute('patch', '/api/staff-users/uid_test_4', {
    headers: authHeaderFor('superadmin'),
    body: {
      uid: 'attacker_target_override',
      ativo: false,
    },
  });
  assert(forgeUidPatch.status === 400, 'Tentativa de enviar campo "uid" no payload retorna HTTP 400');
  assert(
    forgeUidPatch.body?.error?.includes('PROTECTED_FIELDS_MODIFICATION'),
    'Código de erro PROTECTED_FIELDS_MODIFICATION retornado'
  );

  const forgeEmailPatch = await dispatchRoute('patch', '/api/staff-users/uid_test_4', {
    headers: authHeaderFor('superadmin'),
    body: {
      email: 'hacked@malicious.com',
      ativo: true,
    },
  });
  assert(forgeEmailPatch.status === 400, 'Tentativa de alterar "email" via PATCH retorna HTTP 400');

  // Attempt to inject arbitrary fields in review
  const forgeReview = await dispatchRoute('post', `/api/access-requests/${concReqId}/review`, {
    headers: authHeaderFor('superadmin'),
    body: {
      status: 'aprovada',
      injectedField: 'exploit',
    },
  });
  assert(forgeReview.status === 400, 'Campos arbitrários na revisão retornam HTTP 400');

  // -------------------------------------------------------------
  // Test 12: Usuário desativado tentando executar operações administrativas
  // -------------------------------------------------------------
  console.log('\n--- Cenário 12: Administrador Desativado Tentando Operações Administrativas ---');
  const deactReqId = 'req_deact_test';
  await mockDb.collection('accessRequests').doc(deactReqId).set({
    id: deactReqId,
    uid: 'uid_for_deact_test',
    email: 'user_deact@exemplo.com.br',
    nome: 'Teste Desativado',
    motivo: 'Teste',
    status: 'pendente',
    modulosSolicitados: ['residentes'],
    criadoEm: nowIso,
  });

  const deactReview = await dispatchRoute('post', `/api/access-requests/${deactReqId}/review`, {
    headers: authHeaderFor('adminDeactivated'),
    body: { status: 'aprovada' },
  });
  assert(deactReview.status === 403, 'Administrador desativado tentando revisar solicitação recebe HTTP 403');
  assert(
    deactReview.body?.error?.includes('FORBIDDEN_ADMIN_DEACTIVATED'),
    'Código de erro explícito FORBIDDEN_ADMIN_DEACTIVATED'
  );

  const deactPatch = await dispatchRoute('patch', '/api/staff-users/uid_test_4', {
    headers: authHeaderFor('adminDeactivated'),
    body: { ativo: false },
  });
  assert(deactPatch.status === 403, 'Administrador desativado tentando atualizar colaborador recebe HTTP 403');

  // Concurrency scenario: Admin deactivated while transaction runs
  // If an admin gets deactivated in Firestore after token verification, the live transactional check catches it!
  await mockDb.collection('admins').doc(USERS.adminRegular2.uid).update({ active: false });

  const deactConcurReview = await dispatchRoute('post', `/api/access-requests/${deactReqId}/review`, {
    headers: authHeaderFor('adminRegular2'),
    body: { status: 'aprovada' },
  });
  assert(
    deactConcurReview.status === 403,
    'Admin recém-desativado no Firestore é barrado imediatamente com HTTP 403 na transação'
  );

  console.log('\n================================================================');
  console.log(`RBAC AUDIT TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRbacSecurityTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
