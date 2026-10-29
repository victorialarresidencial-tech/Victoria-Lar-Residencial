/**
 * Test Suite: Victoria Lar Residencial — Hardening Fase 2.1
 * 
 * Verifies all 5 key hardening areas:
 * 1. Bloqueio de acesso não autorizado ao diagnóstico SMTP e ocultação de dados internos.
 * 2. Diagnóstico SMTP acessível para administradores autorizados com token válido.
 * 3. Limitação conservadora de abuso na rota /api/contact sem afetar envios legítimos.
 * 4. Proteção de agendamento em massa na rota /api/schedule-meeting com preservação da transação atômica.
 * 5. Garantia de privacidade e conformidade LGPD: ausência estrita de IPs brutos ou PII no armazenamento de rate limit.
 */

process.env.NODE_ENV = 'test';

import { app } from '../server/app';
import {
  setServerFirestoreInstanceForTesting,
  createInMemoryFirestoreMock,
  resetServerFirestoreInstanceForTesting,
} from '../server/firebaseAdmin';
import {
  setMockTransporter,
  resetTransporter,
  OFFICIAL_GMAIL,
} from '../server/mailer';
import { setMockTokenVerifierForTesting } from '../server/auth';
import { resetRateLimiterForTesting } from '../server/rateLimiter';

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

    const req: any = {
      method: method.toUpperCase(),
      path,
      url: path,
      body: options.body || {},
      headers: options.headers || {},
      query: options.query || {},
      params: options.params || {},
      socket: { remoteAddress: '127.0.0.1' },
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

    const routes = (app as any)._router.stack.filter(
      (layer: any) => layer.route && layer.route.path === path && layer.route.methods[method]
    );

    if (routes.length === 0) {
      resolve({ status: 404, body: { error: `Route ${method.toUpperCase()} ${path} not found` }, headers: {} });
      return;
    }

    const handler = routes[0].route.stack[0].handle;
    handler(req, res);
  });
}

async function runHardeningPhase21Tests() {
  console.log('================================================================');
  console.log('STARTING VICTORIA LAR — TESTES DE HARDENING FASE 2.1');
  console.log('================================================================\n');

  const mockDb = createInMemoryFirestoreMock();
  setServerFirestoreInstanceForTesting(mockDb);
  resetRateLimiterForTesting();

  let emailsDispatched: any[] = [];
  const mockSuccessTransporter = {
    sendMail: async (opts: any) => {
      emailsDispatched.push(opts);
      return {
        messageId: `<msg_mock_${Date.now()}@victorialar.com.br>`,
        accepted: [opts.to],
        rejected: [],
        response: '250 OK',
      };
    },
    verify: async () => true,
  };
  setMockTransporter(mockSuccessTransporter as any);

  // Setup Admin Account in Mock Firestore
  const adminUid = 'admin_fase21_user';
  const adminEmail = 'diretoria@victorialar.com.br';
  mockDb.data.get('admins')!.set(adminUid, {
    uid: adminUid,
    email: adminEmail,
    role: 'admin',
    active: true,
  });

  // Setup Token Verifier Mock
  setMockTokenVerifierForTesting(async (token: string) => {
    if (token === 'valid_admin_token') {
      return { sub: adminUid, uid: adminUid, email: adminEmail, email_verified: true };
    }
    if (token === 'regular_user_token') {
      return { sub: 'user_regular_123', uid: 'user_regular_123', email: 'regular@exemplo.com.br', email_verified: true };
    }
    throw new Error('TOKEN_INVALID');
  });

  // -------------------------------------------------------------
  // TEST SUITE 1: Proteção e Hardening do Diagnóstico SMTP (/api/mail/status)
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Proteção do Diagnóstico SMTP ---');

  // 1.1 Chamada pública sem autenticação: Oculta dados de infraestrutura e credenciais
  const publicMailStatus = await dispatchRoute('get', '/api/mail/status');
  assert(publicMailStatus.status === 200, 'Chamada pública a /api/mail/status retorna status HTTP 200');
  assert(
    publicMailStatus.body?.status === 'online' && publicMailStatus.body?.success === true,
    'Chamada pública retorna status online genérico'
  );
  assert(
    publicMailStatus.body?.connection === undefined,
    'CRÍTICO: Chamada pública NÃO expõe bloco connection (host, porta, timeouts)'
  );
  assert(
    publicMailStatus.body?.mode === undefined,
    'CRÍTICO: Chamada pública NÃO expõe modo de operação interna do SMTP'
  );
  assert(
    publicMailStatus.body?.platform === undefined,
    'CRÍTICO: Chamada pública NÃO expõe informações da plataforma de hospedagem'
  );
  assert(
    publicMailStatus.body?.serverlessTips === undefined,
    'CRÍTICO: Chamada pública NÃO expõe dicas de arquitetura interna ou portas'
  );

  // 1.2 Chamada pública tentando disparar teste ativo de conexão SMTP (?verify=true): Deve ser rejeitada
  const publicVerifyAttempt = await dispatchRoute('get', '/api/mail/status', {
    query: { verify: 'true' },
  });
  assert(
    publicVerifyAttempt.status === 401,
    'Tentativa não autenticada de executar verificação SMTP ativa retorna HTTP 401 Unauthorized'
  );
  assert(
    publicVerifyAttempt.body?.error?.includes('TOKEN_REQUIRED'),
    'Mensagem de erro explicita necessidade de token administrativo'
  );

  // 1.3 Usuário autenticado comum (sem perfil de admin) tentando ?verify=true: Bloqueado com HTTP 403
  const unauthorizedVerifyAttempt = await dispatchRoute('get', '/api/mail/status', {
    headers: { authorization: 'Bearer regular_user_token' },
    query: { verify: 'true' },
  });
  assert(
    unauthorizedVerifyAttempt.status === 403,
    'Usuário sem privilégio administrativo tentando verify=true é bloqueado com HTTP 403 Forbidden'
  );

  // 1.4 Administrador autorizado consultando status: Recebe telemetria completa com segurança
  const adminMailStatus = await dispatchRoute('get', '/api/mail/status', {
    headers: { authorization: 'Bearer valid_admin_token' },
  });
  assert(adminMailStatus.status === 200, 'Administrador autorizado obtém status HTTP 200');
  assert(
    adminMailStatus.body?.connection && adminMailStatus.body.connection.host,
    'Administrador autorizado recebe dados de telemetria da conexão'
  );
  assert(
    adminMailStatus.body?.authenticatedAdmin === adminEmail,
    'Administrador autenticado devidamente identificado no diagnóstico'
  );

  // 1.5 Administrador autorizado executando verificação ativa (?verify=true)
  const adminActiveVerify = await dispatchRoute('get', '/api/mail/status', {
    headers: { authorization: 'Bearer valid_admin_token' },
    query: { verify: 'true' },
  });
  assert(adminActiveVerify.status === 200, 'Verificação ativa de administrador retorna HTTP 200');
  assert(
    adminActiveVerify.body?.verification?.ok === true,
    'Verificação ativa executada com sucesso para administrador autorizado'
  );

  // -------------------------------------------------------------
  // TEST SUITE 2: Proteção do Formulário de Contato (/api/contact)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Proteção e Limitação de Abuso no Formulário de Contato ---');
  resetRateLimiterForTesting();
  emailsDispatched = [];

  // 2.1 Honeypot: submissão de bot com campo oculto preenchido
  const botSubmission = await dispatchRoute('post', '/api/contact', {
    body: {
      name: 'Spam Bot',
      phone: '1199999999',
      email: 'bot@spam.com',
      honeypot: 'http://spam-link.ru',
    },
    headers: { 'x-forwarded-for': '198.51.100.1' },
  });
  assert(
    botSubmission.status === 200 && botSubmission.body?.success === true,
    'Honeypot retorna 200 silencioso para descartar o bot'
  );
  assert(
    emailsDispatched.length === 0,
    'Honeypot descarta o disparo de qualquer e-mail pelo servidor'
  );

  // 2.2 Submissões legítimas dentro do limite (limite conservador: 5 por janela de 15 minutos)
  const contactIp = '203.0.113.42';
  for (let i = 1; i <= 5; i++) {
    const legitContact = await dispatchRoute('post', '/api/contact', {
      body: {
        name: `Familiar Legítimo ${i}`,
        email: `contato.${i}@familia.com.br`,
        phone: '(11) 98765-4321',
        message: 'Gostaria de saber mais informações sobre as acomodações.',
        serviceInterest: 'Hospedagem Permanente',
      },
      headers: { 'x-forwarded-for': contactIp },
    });
    assert(
      legitContact.status === 201 && legitContact.body?.success === true,
      `Envio legítimo ${i}/5 processado com sucesso (HTTP 201)`
    );
  }
  assert(
    emailsDispatched.length === 5,
    'Todos os 5 e-mails de confirmação legítimos foram despachados com êxito'
  );

  // 2.3 Tentativa de abuso (6ª submissão consecutiva pelo mesmo cliente): Deve retornar HTTP 429
  const abusiveContact = await dispatchRoute('post', '/api/contact', {
    body: {
      name: 'Familiar Repetido',
      email: 'contato.flood@familia.com.br',
      phone: '(11) 98765-4321',
      message: 'Mensagem automatizada de flooding.',
    },
    headers: { 'x-forwarded-for': contactIp },
  });
  assert(
    abusiveContact.status === 429,
    'Envio excessivo além da cota retorna HTTP 429 Too Many Requests'
  );
  assert(
    abusiveContact.body?.code === 'RATE_LIMIT_EXCEEDED',
    'Retorna código explícito RATE_LIMIT_EXCEEDED'
  );
  assert(
    emailsDispatched.length === 5,
    'Nenhum e-mail adicional foi despachado para a requisição bloqueada por rate limit'
  );

  // 2.4 Submissão por outro cliente (IP diferente): Não é prejudicada
  const otherClientContact = await dispatchRoute('post', '/api/contact', {
    body: {
      name: 'Outra Família',
      email: 'outra.familia@exemplo.com.br',
      phone: '(11) 91234-5678',
      message: 'Solicito agendamento para conhecer as suítes.',
    },
    headers: { 'x-forwarded-for': '198.51.100.99' },
  });
  assert(
    otherClientContact.status === 201,
    'Cliente distinto consegue enviar contato normalmente sem ser afetado pelo bloqueio do IP anterior'
  );

  // 2.5 Preservação das validações de formato e limites de campos
  const invalidContact = await dispatchRoute('post', '/api/contact', {
    body: {
      name: '', // Nome vazio
      phone: '123', // Telefone curto demais
      email: 'email_invalido_sem_arroba',
    },
    headers: { 'x-forwarded-for': '198.51.100.150' },
  });
  assert(invalidContact.status === 400, 'Formulário com campos inválidos retorna HTTP 400');

  // -------------------------------------------------------------
  // TEST SUITE 3: Proteção de Agendamento em Massa (/api/schedule-meeting)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Proteção de Agendamento em Massa e Transação Atômica ---');
  resetRateLimiterForTesting();
  emailsDispatched = [];

  const schedulerIp = '203.0.113.88';

  // 3.1 Agendamento legítimo bem-sucedido
  const legitMeeting = await dispatchRoute('post', '/api/schedule-meeting', {
    body: {
      name: 'Mariana Duarte',
      email: 'mariana.duarte@exemplo.com.br',
      phone: '(11) 98765-1111',
      scheduledDate: '2026-11-28',
      scheduledTime: '09:00',
      relationship: 'Neta',
      serviceInterest: 'Reunião com a Direção',
    },
    headers: { 'x-forwarded-for': schedulerIp },
  });
  assert(
    legitMeeting.status === 201 && legitMeeting.body?.appointmentScheduled === true,
    'Agendamento legítimo confirmado com HTTP 201 e slot reservado'
  );
  assert(
    emailsDispatched.length === 1,
    'E-mail de confirmação com link do Google Meet despachado para a família'
  );

  // 3.2 Tentativa para o mesmo horário (Transação atômica contra duplicidade): 409 Conflict
  const duplicateSlotAttempt = await dispatchRoute('post', '/api/schedule-meeting', {
    body: {
      name: 'Outro Solicitante',
      email: 'outro@exemplo.com.br',
      phone: '(11) 97777-8888',
      scheduledDate: '2026-11-28',
      scheduledTime: '09:00', // Mesmo horário
    },
    headers: { 'x-forwarded-for': '198.51.100.220' },
  });
  assert(
    duplicateSlotAttempt.status === 409 && duplicateSlotAttempt.body?.code === 'SLOT_ALREADY_BOOKED',
    'Transação atômica do Firestore bloqueia reserva duplicada com HTTP 409'
  );
  assert(
    emailsDispatched.length === 1,
    'Nenhum e-mail de confirmação despachado para horário já ocupado'
  );

  // 3.3 Teste de esgotamento de cota de tentativas pelo mesmo IP (limite: 8 por janela de 15 min)
  for (let i = 2; i <= 8; i++) {
    const slotHour = String(9 + i).padStart(2, '0');
    await dispatchRoute('post', '/api/schedule-meeting', {
      body: {
        name: `Mariana Tentativa ${i}`,
        email: 'mariana.duarte@exemplo.com.br',
        phone: '(11) 98765-1111',
        scheduledDate: '2026-11-28',
        scheduledTime: `${slotHour}:00`,
      },
      headers: { 'x-forwarded-for': schedulerIp },
    });
  }

  // 9ª tentativa pelo mesmo IP: Bloqueio proporcional por taxa de tentativas
  const rateLimitedSchedule = await dispatchRoute('post', '/api/schedule-meeting', {
    body: {
      name: 'Mariana Tentativa Excessiva',
      email: 'mariana.duarte@exemplo.com.br',
      phone: '(11) 98765-1111',
      scheduledDate: '2026-11-29',
      scheduledTime: '10:00',
    },
    headers: { 'x-forwarded-for': schedulerIp },
  });
  assert(
    rateLimitedSchedule.status === 429,
    'Disparos em massa de agendamento bloqueados com HTTP 429 Too Many Requests'
  );
  assert(
    rateLimitedSchedule.body?.code === 'RATE_LIMIT_EXCEEDED' &&
      rateLimitedSchedule.body?.appointmentScheduled === false,
    'appointmentScheduled é rigorosamente false quando bloqueado por rate limit'
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Privacidade e Conformidade LGPD (Ausência de IP bruto / PII)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Privacidade e Não Armazenamento de Dados Pessoais ---');

  const rateLimitDocsMap = mockDb.data.get('rateLimits');
  assert(
    rateLimitDocsMap && rateLimitDocsMap.size > 0,
    'Documentos de rate limiting persistidos na base distribuída'
  );

  let rawIpFoundInRateLimitDocs = false;
  let rawPersonalDataFound = false;

  rateLimitDocsMap?.forEach((docData: any, docId: string) => {
    const docJson = JSON.stringify(docData);
    // Verifica se algum IP de teste sobreviveu em texto claro
    if (
      docJson.includes('203.0.113.42') ||
      docJson.includes('203.0.113.88') ||
      docJson.includes('198.51.100.1') ||
      docId.includes('203.0.113')
    ) {
      rawIpFoundInRateLimitDocs = true;
    }
    // Verifica se nomes ou emails foram gravados na collection de rateLimit
    if (docJson.includes('familia.com.br') || docJson.includes('Mariana')) {
      rawPersonalDataFound = true;
    }
  });

  assert(
    !rawIpFoundInRateLimitDocs,
    'CRÍTICO (LGPD): Zero IPs brutos armazenados nos documentos de rate limit (apenas hash unidirecional de 16 caracteres)'
  );
  assert(
    !rawPersonalDataFound,
    'CRÍTICO (LGPD): Zero dados pessoais (nomes, e-mails ou mensagens) armazenados no rate limit'
  );

  // Cleanup
  resetTransporter();
  resetServerFirestoreInstanceForTesting();
  resetRateLimiterForTesting();

  console.log('\n================================================================');
  console.log(`FASE 2.1 HARDENING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningPhase21Tests().catch((err) => {
  console.error('Fatal hardening test error:', err);
  process.exit(1);
});
