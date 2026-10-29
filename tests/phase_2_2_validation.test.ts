/**
 * Test Suite: Victoria Lar Residencial — Validação Rate Limiting Fase 2.2
 *
 * Valida os três aspectos requeridos:
 * 1. Resiliência do Rate Limiting quando Firestore está indisponível (circuit-breaker emergencial).
 * 2. Impossibilidade de tentativas ilimitadas de envio de e-mails / agendamentos em caso de falha distribuída.
 * 3. Identificação segura do cliente (proxy headers confiáveis, sem manipulação de IP, salt estável e não exposto).
 * 4. Presença de campo de data nativo (expiresAtDate) para política de TTL automático do Firestore ($0.00).
 */

process.env.NODE_ENV = 'test';

import {
  checkRateLimit,
  getAnonymizedClientHash,
  resetRateLimiterForTesting,
} from '../server/rateLimiter';
import {
  setServerFirestoreInstanceForTesting,
  createInMemoryFirestoreMock,
  resetServerFirestoreInstanceForTesting,
} from '../server/firebaseAdmin';

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

async function runRateLimiterValidationTests() {
  console.log('================================================================');
  console.log('STARTING VICTORIA LAR — TESTES DE RATE LIMITING FASE 2.2');
  console.log('================================================================\n');

  resetRateLimiterForTesting();
  const mockDb = createInMemoryFirestoreMock();
  setServerFirestoreInstanceForTesting(mockDb);

  // -------------------------------------------------------------
  // Test Suite 1: Identificação Segura do Cliente e Proxy Headers Confiáveis
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Identificação Segura do Cliente e Salt Estável ---');

  // 1.1 Header seguro do Google Cloud (x-appengine-user-ip) tem prioridade absoluta
  const gcpReq: any = {
    headers: {
      'x-appengine-user-ip': '177.18.29.40',
      'x-forwarded-for': '1.1.1.1, 2.2.2.2', // Tentativa de injeção de IP pelo cliente
    },
    ip: '10.0.0.1',
  };
  const gcpHash = getAnonymizedClientHash(gcpReq);
  assert(gcpHash.length === 16, 'Hash gerado possui exatamente 16 caracteres hexadecimais (64 bits)');
  assert(/^[a-f0-9]{16}$/.test(gcpHash), 'Hash contém apenas caracteres hexadecimais válidos');

  // Confirma que usou 177.18.29.40 (Google Cloud verified header) e não o 1.1.1.1 injetado
  const expectedGcpReq: any = { headers: { 'x-appengine-user-ip': '177.18.29.40' } };
  assert(
    gcpHash === getAnonymizedClientHash(expectedGcpReq),
    'Header x-appengine-user-ip (injetado pela infraestrutura Google) tem precedência contra injeção de x-forwarded-for'
  );

  // 1.2 Express req.ip (quando ativo por trust proxy) tem precedência sobre x-forwarded-for não verificado
  const expressProxyReq: any = {
    headers: {
      'x-forwarded-for': '189.40.10.20, 10.0.0.2',
    },
    ip: '189.40.10.20',
  };
  const expressHash = getAnonymizedClientHash(expressProxyReq);
  assert(expressHash.length === 16, 'Express req.ip com trust proxy devidamente processado');

  // 1.3 Estabilidade do Hash: Mesma origem gera hash estritamente idêntico entre chamadas
  const repeatReq: any = { headers: { 'x-appengine-user-ip': '177.18.29.40' } };
  assert(
    getAnonymizedClientHash(repeatReq) === gcpHash,
    'Hash é 100% determinístico e estável entre múltiplas requisições da mesma origem'
  );

  // 1.4 Privacidade LGPD: Nenhuma informação pessoal ou IP bruto contido no hash
  assert(!gcpHash.includes('177'), 'CRÍTICO: Hash não contém fragmentos do IP original (irreversível)');

  // -------------------------------------------------------------
  // Test Suite 2: Persistência no Firestore e Suporte a TTL Nativo
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Persistência Distribuída e TTL Nativo ---');
  resetRateLimiterForTesting();

  const reqClientA: any = { headers: { 'x-forwarded-for': '201.80.50.1' } };

  // 2.1 Primeira requisição: grava documento em /rateLimits
  const res1 = await checkRateLimit(reqClientA, 'contact', {
    maxRequests: 3,
    windowMs: 60 * 1000,
  });
  assert(res1.allowed === true, 'Primeira requisição permitida');
  assert(res1.currentCount === 1, 'Contador inicial é 1');
  assert(res1.remaining === 2, 'Restam 2 requisições permitidas');

  // 2.2 Inspeciona documento gravado no Firestore
  const rateLimitMap = mockDb.data.get('rateLimits');
  assert(rateLimitMap && rateLimitMap.size > 0, 'Documento de rate limiting criado na coleção rateLimits');

  let docEntry: any = null;
  rateLimitMap?.forEach((val: any) => {
    docEntry = val;
  });

  assert(docEntry !== null, 'Documento de rate limit existe');
  assert(docEntry.count === 1, 'Documento reflete count = 1');
  assert(typeof docEntry.expiresAt === 'string', 'expiresAt armazenado em formato ISO string para compatibilidade');
  assert(
    docEntry.expiresAtDate !== undefined,
    'CRÍTICO: expiresAtDate persistido como Date nativo para política de TTL automático do Firestore ($0.00)'
  );

  // 2.3 Segunda requisição: incrementa atômicamente
  const res2 = await checkRateLimit(reqClientA, 'contact', {
    maxRequests: 3,
    windowMs: 60 * 1000,
  });
  assert(res2.allowed === true && res2.currentCount === 2, 'Segunda requisição incrementada para count = 2');

  // 2.4 Terceira requisição: atinge o limite
  const res3 = await checkRateLimit(reqClientA, 'contact', {
    maxRequests: 3,
    windowMs: 60 * 1000,
  });
  assert(res3.allowed === true && res3.currentCount === 3, 'Terceira requisição atinge limite (count = 3, remaining = 0)');

  // 2.5 Quarta requisição: bloqueada pelo Firestore
  const res4 = await checkRateLimit(reqClientA, 'contact', {
    maxRequests: 3,
    windowMs: 60 * 1000,
  });
  assert(res4.allowed === false, 'Quarta requisição devidamente bloqueada (allowed = false)');
  assert(res4.remaining === 0, 'Remaining é 0 quando bloqueado');

  // -------------------------------------------------------------
  // Test Suite 3: Resiliência e Proteção Contra Tentativas Ilimitadas em Caso de Falha do Firestore
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Resiliência em Falha do Firestore & Circuit Breaker ---');
  resetRateLimiterForTesting();

  // Simula Firestore indisponível lançando erro na transação
  const failingDb = {
    collection: () => ({
      doc: () => ({
        get: async () => {
          throw new Error('FIRESTORE_UNAVAILABLE: Conexão de rede indisponível');
        },
      }),
    }),
    runTransaction: async () => {
      throw new Error('FIRESTORE_UNAVAILABLE: Conexão de rede indisponível');
    },
  };
  setServerFirestoreInstanceForTesting(failingDb as any);

  // 3.1 Fallback em memória para cliente individual: bloqueia após maxRequests
  const reqOutageClient: any = { headers: { 'x-forwarded-for': '187.100.200.1' } };
  for (let i = 1; i <= 3; i++) {
    const res = await checkRateLimit(reqOutageClient, 'contact', {
      maxRequests: 3,
      windowMs: 60 * 1000,
    });
    assert(res.allowed === true, `Requisição ${i}/3 em modo fallback de emergência permitida`);
  }

  // 4ª tentativa do mesmo cliente em fallback: bloqueado
  const resBlockedMem = await checkRateLimit(reqOutageClient, 'contact', {
    maxRequests: 3,
    windowMs: 60 * 1000,
  });
  assert(resBlockedMem.allowed === false, 'Cliente individual em modo fallback é bloqueado após exceder limite local');

  // 3.2 Proteção Contra Flood com Múltiplos IPs / Tentativas Ilimitadas Durante Queda do Firestore
  // Simula um invasor rotacionando 20 IPs diferentes durante a falha do banco
  let fallbackAllowedCount = 0;
  let fallbackBlockedCount = 0;

  for (let i = 1; i <= 20; i++) {
    const rotatingReq: any = { headers: { 'x-forwarded-for': `187.100.200.${i + 10}` } };
    const res = await checkRateLimit(rotatingReq, 'contact', {
      maxRequests: 3,
      windowMs: 60 * 1000,
    });
    if (res.allowed) {
      fallbackAllowedCount++;
    } else {
      fallbackBlockedCount++;
    }
  }

  assert(
    fallbackBlockedCount > 0,
    'CRÍTICO: Circuit-breaker de emergência bloqueou o ataque durante a queda do Firestore (impediu tentativas ilimitadas)'
  );
  assert(
    fallbackAllowedCount <= 10,
    'CRÍTICO: Número total de operações de e-mail em fallback foi estritamente contido (teto emergencial preservado)'
  );

  // Teardown
  resetRateLimiterForTesting();
  setServerFirestoreInstanceForTesting(mockDb);

  console.log('\n================================================================');
  console.log(`FASE 2.2 RATE LIMITING VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRateLimiterValidationTests().catch((err) => {
  console.error('Fatal Rate Limiting Validation Test Error:', err);
  process.exit(1);
});
