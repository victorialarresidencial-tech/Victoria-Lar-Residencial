/**
 * Test Suite: Victoria Lar Residencial — Scheduling & Availability Security
 * 
 * Verifies all 8 mandatory technical requirements:
 * 1. Duas requisições concorrentes para o mesmo horário: apenas uma pode confirmar.
 * 2. Duas requisições para horários diferentes: ambas podem confirmar.
 * 3. Horário já ocupado: nenhuma nova confirmação nem e-mail de confirmação.
 * 4. Falha ao gravar no Firestore: não confirmar a reserva.
 * 5. Falha no SMTP após reserva persistida: preservar a reserva e informar corretamente que o e-mail falhou.
 * 6. Usuário não autenticado tentando alterar disponibilidade: negar acesso (HTTP 401).
 * 7. Usuário comum tentando alterar disponibilidade: negar acesso (HTTP 403).
 * 8. ADM ativo alterando disponibilidade: permitir (HTTP 200) e persistir no Firestore /content/scheduling.
 */

process.env.NODE_ENV = 'test';

import { app, DEFAULT_AVAILABILITY } from '../server/app';
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

async function runSchedulingSecurityTests() {
  console.log('================================================================');
  console.log('STARTING VICTORIA LAR SCHEDULING & AVAILABILITY AUDIT TEST SUITE');
  console.log('================================================================\n');

  const mockDb = createInMemoryFirestoreMock();
  setServerFirestoreInstanceForTesting(mockDb);

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

  // -------------------------------------------------------------
  // TEST SUITE 1: Concorrência — Duas requisições para o MESMO horário
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Concorrência Atômica — Mesmo Horário ---');
  emailsDispatched = [];

  const reqSameSlot1 = {
    name: 'Família Silva',
    email: 'silva@exemplo.com.br',
    phone: '(11) 98765-4321',
    scheduledDate: '2026-11-25',
    scheduledTime: '10:00',
    relationship: 'Filho',
    serviceInterest: 'Apresentação Geral e Planos',
  };

  const reqSameSlot2 = {
    name: 'Família Santos',
    email: 'santos@exemplo.com.br',
    phone: '(11) 91234-5678',
    scheduledDate: '2026-11-25',
    scheduledTime: '10:00',
    relationship: 'Filha',
    serviceInterest: 'Cuidados de Enfermagem 24h',
  };

  // Dispara simultaneamente no event loop
  const [res1, res2] = await Promise.all([
    dispatchRoute('post', '/api/schedule-meeting', { body: reqSameSlot1 }),
    dispatchRoute('post', '/api/schedule-meeting', { body: reqSameSlot2 }),
  ]);

  const successResults = [res1, res2].filter((r) => r.status === 201 && r.body?.appointmentScheduled === true);
  const conflictResults = [res1, res2].filter(
    (r) => r.status === 409 && r.body?.code === 'SLOT_ALREADY_BOOKED'
  );

  assert(
    successResults.length === 1,
    'Exatamente uma das requisições simultâneas para o mesmo horário obtém status HTTP 201'
  );
  assert(
    conflictResults.length === 1,
    'A requisição conflitante recebe HTTP 409 com código SLOT_ALREADY_BOOKED'
  );
  assert(
    emailsDispatched.length === 1,
    'Apenas uma confirmação por e-mail é disparada (a requisição rejeitada não envia e-mail)'
  );

  const slotDocId = 'meet_2026-11-25_10-00';
  const savedDocSnap = await mockDb.collection('leads').doc(slotDocId).get();
  assert(
    savedDocSnap.exists === true,
    'Reserva persistida no Firestore com identificador determinístico seguro (meet_2026-11-25_10-00)'
  );
  assert(
    savedDocSnap.data().scheduledDate === '2026-11-25' && savedDocSnap.data().scheduledTime === '10:00',
    'Documento em /leads contém data e horário íntegros'
  );

  // -------------------------------------------------------------
  // TEST SUITE 2: Concorrência — Duas requisições para Horários Diferentes
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Concorrência — Horários Diferentes ---');
  emailsDispatched = [];

  const reqDiffSlotA = {
    name: 'Carlos Oliveira',
    email: 'carlos.oliveira@exemplo.com.br',
    phone: '(11) 98888-1111',
    scheduledDate: '2026-11-26',
    scheduledTime: '14:00',
    relationship: 'Sobrinho',
    serviceInterest: 'Acomodação Suíte Individual',
  };

  const reqDiffSlotB = {
    name: 'Ana Paula Rocha',
    email: 'ana.rocha@exemplo.com.br',
    phone: '(11) 97777-2222',
    scheduledDate: '2026-11-26',
    scheduledTime: '15:00',
    relationship: 'Filha',
    serviceInterest: 'Reunião com os Diretores',
  };

  const [resDiffA, resDiffB] = await Promise.all([
    dispatchRoute('post', '/api/schedule-meeting', { body: reqDiffSlotA }),
    dispatchRoute('post', '/api/schedule-meeting', { body: reqDiffSlotB }),
  ]);

  assert(
    resDiffA.status === 201 && resDiffA.body?.appointmentScheduled === true,
    'Requisição para horário A (14:00) confirmada com HTTP 201'
  );
  assert(
    resDiffB.status === 201 && resDiffB.body?.appointmentScheduled === true,
    'Requisição para horário B (15:00) confirmada com HTTP 201'
  );
  assert(
    emailsDispatched.length === 2,
    'Ambos os e-mails de confirmação foram disparados para os horários distintos'
  );

  const docA = await mockDb.collection('leads').doc('meet_2026-11-26_14-00').get();
  const docB = await mockDb.collection('leads').doc('meet_2026-11-26_15-00').get();
  assert(
    docA.exists && docB.exists,
    'Ambos os agendamentos foram persistidos atomicamente no Firestore /leads'
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: Horário já ocupado — Nenhuma nova confirmação nem e-mail
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Tentativa em Horário Já Ocupado ---');
  emailsDispatched = [];

  const reqOccupiedAttempt = {
    name: 'Terceiro Interessado',
    email: 'terceiro@exemplo.com.br',
    phone: '(11) 99999-0000',
    scheduledDate: '2026-11-25',
    scheduledTime: '10:00', // Horário já ocupado no Test Suite 1
  };

  const resOccupied = await dispatchRoute('post', '/api/schedule-meeting', { body: reqOccupiedAttempt });

  assert(
    resOccupied.status === 409,
    'Horário ocupado retorna status HTTP 409 Conflict'
  );
  assert(
    resOccupied.body?.code === 'SLOT_ALREADY_BOOKED',
    'Retorna código explícito SLOT_ALREADY_BOOKED'
  );
  assert(
    resOccupied.body?.appointmentScheduled === false,
    'appointmentScheduled é rigorosamente false'
  );
  assert(
    emailsDispatched.length === 0,
    'Nenhum e-mail de confirmação é disparado quando o horário já está ocupado'
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Falha ao gravar no Firestore — Não confirmar a reserva
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Falha ao Gravar no Firestore ---');
  emailsDispatched = [];

  // Criamos um mock que simula erro de persistência / transação abortada
  const failingDbMock = {
    collection: (col: string) => mockDb.collection(col),
    runTransaction: async () => {
      throw new Error('SIMULATED_FIRESTORE_WRITE_FAILURE: Conexão interrompida com o banco de dados');
    },
  };

  setServerFirestoreInstanceForTesting(failingDbMock);

  const reqDbFail = {
    name: 'Marcos Vinicius',
    email: 'marcos@exemplo.com.br',
    phone: '(11) 98888-3333',
    scheduledDate: '2026-11-27',
    scheduledTime: '11:00',
  };

  const resDbFail = await dispatchRoute('post', '/api/schedule-meeting', { body: reqDbFail });

  assert(
    resDbFail.status === 500,
    'Falha ao gravar no Firestore retorna HTTP 500'
  );
  assert(
    resDbFail.body?.appointmentScheduled === false,
    'CRÍTICO: appointmentScheduled é false quando a persistência falha'
  );
  assert(
    resDbFail.body?.code === 'PERSISTENCE_FAILED',
    'Retorna código PERSISTENCE_FAILED informando o motivo'
  );
  assert(
    emailsDispatched.length === 0,
    'CRÍTICO: Nenhum e-mail de confirmação é despachado se a persistência no Firestore falhar'
  );

  // Restaura o mock normal
  setServerFirestoreInstanceForTesting(mockDb);

  // -------------------------------------------------------------
  // TEST SUITE 5: Falha no SMTP após reserva persistida — Preservar reserva
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Falha no SMTP Após Reserva Persistida ---');

  const mockTimeoutTransporter = {
    sendMail: async () => {
      const err: any = new Error('Connection timeout');
      err.code = 'ETIMEDOUT';
      throw err;
    },
    verify: async () => false,
  };
  setMockTransporter(mockTimeoutTransporter as any);

  const reqSmtpFail = {
    name: 'Juliana Paes',
    email: 'juliana.paes@exemplo.com.br',
    phone: '(11) 97777-4444',
    scheduledDate: '2026-11-28',
    scheduledTime: '16:00',
  };

  const resSmtpFail = await dispatchRoute('post', '/api/schedule-meeting', { body: reqSmtpFail });

  assert(
    resSmtpFail.status === 201,
    'Retorna HTTP 201 Created confirmando a reserva do horário'
  );
  assert(
    resSmtpFail.body?.appointmentScheduled === true,
    'appointmentScheduled é true (a reserva com a direção está garantida)'
  );
  assert(
    resSmtpFail.body?.emailSent === false,
    'emailSent é estritamente false quando o SMTP falha'
  );
  assert(
    resSmtpFail.body?.errorCode === 'ETIMEDOUT',
    'errorCode informa o erro SMTP ocorrido (ETIMEDOUT)'
  );

  const savedSmtpFailDoc = await mockDb.collection('leads').doc('meet_2026-11-28_16-00').get();
  assert(
    savedSmtpFailDoc.exists === true,
    'A reserva no Firestore /leads FOI PRESERVADA intacta apesar da falha de envio do e-mail'
  );

  // Restaura transporte de sucesso
  setMockTransporter(mockSuccessTransporter as any);

  // -------------------------------------------------------------
  // TEST SUITE 6: Segurança da Disponibilidade — Usuário Não Autenticado
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 6: Alteração de Disponibilidade por Usuário Não Autenticado ---');

  const resUnauth = await dispatchRoute('post', '/api/schedule/availability', {
    body: {
      availability: {
        dailyTimeSlots: ['08:00', '12:00'],
      },
    },
  });

  assert(
    resUnauth.status === 401,
    'Tentativa sem token retorna HTTP 401 Unauthorized'
  );
  assert(
    resUnauth.body?.error && resUnauth.body.error.includes('TOKEN_REQUIRED'),
    'Mensagem de erro exige token de autenticação'
  );

  // -------------------------------------------------------------
  // TEST SUITE 7: Segurança da Disponibilidade — Usuário Comum Não-ADM
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 7: Alteração de Disponibilidade por Usuário Comum Não-ADM ---');

  // Configura validador simulado para token de usuário comum
  setMockTokenVerifierForTesting((token) => {
    if (token === 'regular_user_token') {
      return {
        sub: 'user_regular_123',
        uid: 'user_regular_123',
        email: 'usuario.comum@gmail.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
    }
    return null;
  });

  // Garante que o usuário comum NÃO está na coleção /admins
  const adminDoc = await mockDb.collection('admins').doc('user_regular_123').get();
  assert(!adminDoc.exists, 'Usuário comum não possui registro em /admins');

  const resForbidden = await dispatchRoute('post', '/api/schedule/availability', {
    headers: {
      authorization: 'Bearer regular_user_token',
    },
    body: {
      availability: {
        dailyTimeSlots: ['07:00', '08:00'],
      },
    },
  });

  assert(
    resForbidden.status === 403,
    'Tentativa com usuário comum retorna HTTP 403 Forbidden'
  );
  assert(
    resForbidden.body?.error && resForbidden.body.error.includes('FORBIDDEN_NOT_ADMIN'),
    'Mensagem de erro explicita que o acesso administrativo foi negado'
  );

  // -------------------------------------------------------------
  // TEST SUITE 8: Segurança da Disponibilidade — ADM Ativo Permitido
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 8: Alteração de Disponibilidade por ADM Ativo Permitido ---');

  const activeAdminUid = 'admin_olga_456';
  const activeAdminEmail = 'olga@victorialar.com.br';

  // Cadastra administrador ativo no mock Firestore
  await mockDb.collection('admins').doc(activeAdminUid).set({
    uid: activeAdminUid,
    email: activeAdminEmail,
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
  });

  // Configura validador de token para o ADM ativo
  setMockTokenVerifierForTesting((token) => {
    if (token === 'valid_admin_token') {
      return {
        sub: activeAdminUid,
        uid: activeAdminUid,
        email: activeAdminEmail,
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
    }
    return null;
  });

  const newSlotsConfig = ['09:30', '10:30', '14:30', '16:30'];
  const resAdmin = await dispatchRoute('post', '/api/schedule/availability', {
    headers: {
      authorization: 'Bearer valid_admin_token',
    },
    body: {
      availability: {
        dailyTimeSlots: newSlotsConfig,
        meetingDuration: '45 minutos',
        meetingLink: 'https://meet.google.com/vic-tori-lar-oficial',
      },
    },
  });

  assert(
    resAdmin.status === 200,
    'ADM ativo autenticado recebe HTTP 200 OK ao alterar disponibilidade'
  );
  assert(
    resAdmin.body?.success === true,
    'Resposta reporta success: true'
  );
  assert(
    Array.isArray(resAdmin.body?.availability?.dailyTimeSlots) &&
      resAdmin.body.availability.dailyTimeSlots.length === 4,
    'Disponibilidade atualizada reflete os 4 novos horários configurados'
  );

  // Verifica persistência real no Firestore /content/scheduling
  const schedulingDoc = await mockDb.collection('content').doc('scheduling').get();
  assert(
    schedulingDoc.exists === true,
    'Configuração foi persistida no documento oficial do Firestore /content/scheduling'
  );
  assert(
    schedulingDoc.data().availableHours === '09:30, 10:30, 14:30, 16:30',
    'Campo availableHours gravado corretamente no Firestore'
  );
  assert(
    schedulingDoc.data().updatedBy === activeAdminUid,
    'Registro de updatedBy associado ao UID do administrador responsável'
  );

  // Verifica se a leitura pública GET /api/schedule/availability lê a configuração oficial do Firestore
  const resPublicGet = await dispatchRoute('get', '/api/schedule/availability');
  assert(
    resPublicGet.status === 200,
    'Leitura pública da disponibilidade responde HTTP 200'
  );
  assert(
    resPublicGet.body?.availability?.dailyTimeSlots?.join(', ') === '09:30, 10:30, 14:30, 16:30',
    'Leitura pública lê fielmente os dados oficiais persistidos no Firestore pelo ADM'
  );

  // -------------------------------------------------------------
  // TEST SUITE 9: Consulta Pública de Horários Ocupados (Booked Slots)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 9: Consulta de Horários Ocupados no Firestore ---');

  const resBookedSlots = await dispatchRoute('get', '/api/schedule/booked-slots', {
    query: { date: '2026-11-25' },
  });

  assert(
    resBookedSlots.status === 200,
    'GET /api/schedule/booked-slots responde HTTP 200'
  );
  assert(
    resBookedSlots.body?.bookedSlots?.includes('10:00'),
    'Horário 10:00 do dia 2026-11-25 reportado como ocupado a partir do Firestore'
  );

  // Limpeza final
  resetTransporter();
  setMockTokenVerifierForTesting(null);
  resetServerFirestoreInstanceForTesting();

  console.log('\n================================================================');
  console.log(`SCHEDULING SECURITY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSchedulingSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
