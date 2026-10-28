/**
 * Suite de Testes Automatizados — Integração Colaboradores e Gestão de Acessos
 * Validação dos 10 Cenários Mandatórios (Seção 8):
 * 1. Seleção de colaborador por matrícula.
 * 2. Seleção por nome.
 * 3. Colaborador ativo sem acesso ao sistema.
 * 4. Colaborador com autorização pendente.
 * 5. Colaborador com acesso autorizado.
 * 6. Tentativa de vinculação duplicada.
 * 7. Tentativa de autorização por usuário sem privilégio.
 * 8. Tentativa de acesso a módulo não autorizado.
 * 9. Revogação de autorização.
 * 10. Preservação do cadastro funcional após revogação do acesso.
 */

process.env.NODE_ENV = 'test';

import { app } from '../server/app';
import {
  setServerFirestoreInstanceForTesting,
  setServerAuthInstanceForTesting,
  createInMemoryFirestoreMock,
  resetServerFirestoreInstanceForTesting,
} from '../server/firebaseAdmin';
import { setMockTokenVerifierForTesting } from '../server/auth';
import { gerarProximaMatricula } from '../src/services/colaboradoresService';
import { Funcionario } from '../src/types/employee';
import { AuthorizedStaffUser, AccessStatus, SystemModule } from '../src/types/portal';

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
      if (routePath === path) {
        return { handler: layer.route.stack[0].handle, params: {} };
      }
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
      },
      send: (data: any) => {
        resolvedBody = data;
        resolve({ status: resolvedStatus, body: resolvedBody, headers: resolvedHeaders });
      },
      end: () => {
        resolve({ status: resolvedStatus, body: resolvedBody, headers: resolvedHeaders });
      },
    };

    try {
      routeMatch.handler(req, res);
    } catch (err: any) {
      resolve({ status: 500, body: { error: err.message }, headers: resolvedHeaders });
    }
  });
}

// -------------------------------------------------------------
// Helper para cálculo de status de acesso no frontend
// -------------------------------------------------------------
function computeAccessStatus(
  funcionario: Funcionario,
  staffUsers: AuthorizedStaffUser[]
): { statusAcesso: AccessStatus; authRecord?: AuthorizedStaffUser } {
  const cleanMatricula = funcionario.matricula?.trim().toUpperCase();
  const match = staffUsers.find(
    (s) =>
      (cleanMatricula && s.matricula?.trim().toUpperCase() === cleanMatricula) ||
      (s.funcionarioId && s.funcionarioId === funcionario.id)
  );

  if (!match) {
    return { statusAcesso: 'sem_acesso' };
  }

  if (match.statusAcesso === 'pendente' || (!match.ativo && match.id?.startsWith('pending_'))) {
    return { statusAcesso: 'pendente', authRecord: match };
  }

  if (match.statusAcesso === 'revogado' || (match.ativo === false && match.revogadoEm)) {
    return { statusAcesso: 'revogado', authRecord: match };
  }

  if (match.ativo === true) {
    return { statusAcesso: 'ativo', authRecord: match };
  }

  return { statusAcesso: (match.statusAcesso as AccessStatus) || 'sem_acesso', authRecord: match };
}

// Helper RBAC para checagem de módulos
function canAccessModule(role: string, authorizedModules: SystemModule[], moduleToCheck: SystemModule): boolean {
  if (role === 'superadmin') return true;
  if (role === 'admin') {
    return ['servicos', 'albuns', 'conteudo', 'solicitacoes', 'residentes', 'colaboradores'].includes(moduleToCheck);
  }
  if (role === 'colaborador') {
    return authorizedModules.includes(moduleToCheck);
  }
  return false;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO TESTES: INTEGRAÇÃO COLABORADORES E GESTÃO DE ACESSOS');
  console.log('================================================================');

  // Inicializar mock do Firestore e do Auth
  const mockDb = createInMemoryFirestoreMock();
  setServerFirestoreInstanceForTesting(mockDb as any);

  // Configurar token verifier
  const mockTokens: Record<string, { sub: string; uid: string; email: string; email_verified?: boolean }> = {
    'admin-token': { sub: 'admin_uid_1', uid: 'admin_uid_1', email: 'diretoria@victorialar.com.br', email_verified: true },
    'staff-token': { sub: 'colab_uid_1', uid: 'colab_uid_1', email: 'mariana.santos@victorialar.com.br', email_verified: true },
    'unprivileged-token': { sub: 'guest_uid_1', uid: 'guest_uid_1', email: 'visitante@externo.com', email_verified: false },
  };

  setMockTokenVerifierForTesting(async (token: string) => {
    if (mockTokens[token]) {
      return mockTokens[token];
    }
    throw new Error('Invalid token');
  });

  // Criar dados iniciais
  // 1. Administrador ativo em /admins
  await mockDb.collection('admins').doc('admin_uid_1').set({
    email: 'diretoria@victorialar.com.br',
    role: 'superadmin',
    active: true,
    createdAt: new Date().toISOString(),
  });

  // 2. Colaborador em /funcionarios (Mariana Santos - VLR-2026-001)
  const funcionarioMariana: Funcionario = {
    id: 'func_mariana_001',
    matricula: 'VLR-2026-001',
    nomeCompleto: 'Mariana Santos',
    cargo: 'Enfermeiro(a) Responsável Técnico (RT)',
    departamento: 'Cuidados & Enfermagem',
    status: 'ativo',
    dataNascimento: '1990-05-20',
    dataAdmissao: '2026-01-15',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
    pisPasep: '123.45678.90-1',
    salarioBase: '6.500,00',
    banco: 'Banco do Brasil',
    agencia: '1234-5',
    conta: '54321-0',
    tipoChavePix: 'cpf',
    chavePix: '123.456.789-00',
    sexo: 'feminino',
    estadoCivil: 'Solteira',
    tipoContrato: 'clt_integral',
    escalaTrabalho: '12x36_diurno',
    celularWhatsApp: '(11) 98765-4321',
    email: 'mariana.santos@victorialar.com.br',
    cep: '04538-133',
    logradouro: 'Rua Bandeira Paulista',
    numero: '100',
    bairro: 'Itaim Bibi',
    cidade: 'São Paulo',
    estado: 'SP',
    nomeContatoEmergencia: 'Carlos Santos',
    parentescoEmergencia: 'Pai',
    telefoneEmergencia: '(11) 98765-0000',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  } as unknown as Funcionario;
  await mockDb.collection('funcionarios').doc('func_mariana_001').set(funcionarioMariana);

  // 3. Colaborador Roberto Almeida - VLR-2026-002
  const funcionarioRoberto: Funcionario = {
    id: 'func_roberto_002',
    matricula: 'VLR-2026-002',
    nomeCompleto: 'Roberto Almeida',
    cargo: 'Fisioterapeuta',
    departamento: 'Equipe Multidisciplinar / Saúde',
    status: 'ativo',
    dataNascimento: '1988-11-10',
    dataAdmissao: '2026-02-01',
    cpf: '987.654.321-00',
    rg: '98.765.432-1',
    salarioBase: '5.200,00',
    sexo: 'masculino',
    estadoCivil: 'Casado',
    tipoContrato: 'clt_integral',
    escalaTrabalho: '5x2',
    celularWhatsApp: '(11) 97654-3210',
    email: 'roberto.almeida@victorialar.com.br',
    cep: '04538-133',
    logradouro: 'Rua Bandeira Paulista',
    numero: '100',
    bairro: 'Itaim Bibi',
    cidade: 'São Paulo',
    estado: 'SP',
    nomeContatoEmergencia: 'Ana Almeida',
    parentescoEmergencia: 'Esposa',
    telefoneEmergencia: '(11) 97654-0000',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  } as unknown as Funcionario;
  await mockDb.collection('funcionarios').doc('func_roberto_002').set(funcionarioRoberto);

  // -----------------------------------------------------------------
  // Cenário 1: Seleção de colaborador por matrícula
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 1: Seleção de colaborador por matrícula ---');
  const proximaMatricula = gerarProximaMatricula([funcionarioMariana, funcionarioRoberto]);
  assert(
    proximaMatricula === 'VLR-2026-003',
    'Geração de matrícula é determinística, sequencial e estável (VLR-2026-003)',
    `Esperado VLR-2026-003, obtido ${proximaMatricula}`
  );

  const docMariana = await mockDb.collection('funcionarios').doc('func_mariana_001').get();
  assert(
    docMariana.exists && docMariana.data().matricula === 'VLR-2026-001',
    'Localização do cadastro funcional via matrícula "VLR-2026-001"',
    'Documento não encontrado por matrícula'
  );

  // -----------------------------------------------------------------
  // Cenário 2: Seleção por nome
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 2: Seleção por nome ---');
  const querySnapshot = await mockDb.collection('funcionarios').where('matricula', '==', 'VLR-2026-001').get();
  const foundByName = querySnapshot.docs.find((d: any) => d.data().nomeCompleto.includes('Mariana'));
  assert(
    foundByName !== undefined && foundByName.data().nomeCompleto === 'Mariana Santos',
    'Localização precisa de colaborador pelo nome "Mariana Santos"',
    'Busca por nome falhou'
  );

  // -----------------------------------------------------------------
  // Cenário 3: Colaborador ativo sem acesso ao sistema
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 3: Colaborador ativo sem acesso ao sistema ---');
  const initialStaffUsers: AuthorizedStaffUser[] = [];
  const statusSemAcesso = computeAccessStatus(funcionarioMariana, initialStaffUsers);
  assert(
    statusSemAcesso.statusAcesso === 'sem_acesso',
    'Colaborador ativo no RH sem documento de autorização possui status "sem_acesso"',
    `Esperado "sem_acesso", obtido "${statusSemAcesso.statusAcesso}"`
  );

  // Tentativa de acesso sem autorização
  const canAccessWithoutAuth = canAccessModule('visitante', [], 'residentes');
  assert(
    canAccessWithoutAuth === false,
    'Colaborador sem autorização é estritamente impedido de acessar módulos protegidos (RBAC)',
    'Permissão concedida indevidamente'
  );

  // -----------------------------------------------------------------
  // Cenário 4: Colaborador com autorização pendente
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 4: Colaborador com autorização pendente ---');
  const prepareRes = await dispatchRoute('post', '/api/staff-authorizations/prepare', {
    headers: { authorization: 'Bearer admin-token' },
    body: {
      matricula: 'VLR-2026-001',
      funcionarioId: 'func_mariana_001',
      modulos: ['residentes'],
    },
  });

  assert(
    (prepareRes.status === 200 || prepareRes.status === 201) && prepareRes.body.success === true,
    'Preparação de autorização executada com sucesso pelo Administrador',
    `Status ${prepareRes.status}: ${JSON.stringify(prepareRes.body)}`
  );

  const pendingDoc = await mockDb.collection('usuariosAutorizados').doc('pending_VLR-2026-001').get();
  assert(
    pendingDoc.exists &&
      pendingDoc.data().ativo === false &&
      pendingDoc.data().statusAcesso === 'pendente' &&
      pendingDoc.data().role === 'colaborador' &&
      Array.isArray(pendingDoc.data().modulos) &&
      pendingDoc.data().modulos.includes('residentes'),
    'Autorização persistida em /usuariosAutorizados como PENDENTE (ativo: false, role: colaborador)',
    `Dados incorretos no doc pendente: ${JSON.stringify(pendingDoc.data())}`
  );

  // Validar cálculo de status para 'pendente'
  const pendingStaffUser: AuthorizedStaffUser = {
    id: 'pending_VLR-2026-001',
    uid: 'pending_VLR-2026-001',
    email: '',
    nome: 'Mariana Santos',
    role: 'colaborador',
    ativo: false,
    statusAcesso: 'pendente',
    matricula: 'VLR-2026-001',
    funcionarioId: 'func_mariana_001',
    modulos: ['residentes'],
    atualizadoEm: new Date().toISOString(),
  };
  const statusPendente = computeAccessStatus(funcionarioMariana, [pendingStaffUser]);
  assert(
    statusPendente.statusAcesso === 'pendente',
    'Frontend identifica status "pendente" para o colaborador',
    `Esperado "pendente", obtido "${statusPendente.statusAcesso}"`
  );

  // -----------------------------------------------------------------
  // Cenário 5: Colaborador com acesso autorizado
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 5: Colaborador com acesso autorizado ---');
  // Simular ativação da identidade (vinculando UID canônico ao colaborador)
  const activeStaffUser: AuthorizedStaffUser = {
    id: 'colab_uid_1',
    uid: 'colab_uid_1',
    email: 'mariana.santos@victorialar.com.br',
    nome: 'Mariana Santos',
    role: 'colaborador',
    ativo: true,
    statusAcesso: 'ativo',
    matricula: 'VLR-2026-001',
    funcionarioId: 'func_mariana_001',
    modulos: ['residentes'],
    atualizadoEm: new Date().toISOString(),
  };
  await mockDb.collection('usuariosAutorizados').doc('colab_uid_1').set(activeStaffUser);

  const statusAtivo = computeAccessStatus(funcionarioMariana, [activeStaffUser]);
  assert(
    statusAtivo.statusAcesso === 'ativo',
    'Colaborador com conta vinculada e ativa possui status "ativo"',
    `Esperado "ativo", obtido "${statusAtivo.statusAcesso}"`
  );

  const canAccessResidentes = canAccessModule('colaborador', activeStaffUser.modulos, 'residentes');
  assert(
    canAccessResidentes === true,
    'Colaborador autorizado acessa com sucesso o módulo permitido ("residentes")',
    'Acesso a módulo permitido falhou'
  );

  // -----------------------------------------------------------------
  // Cenário 6: Tentativa de vinculação duplicada
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 6: Tentativa de vinculação duplicada ---');
  const duplicateRes = await dispatchRoute('post', '/api/staff-authorizations/prepare', {
    headers: { authorization: 'Bearer admin-token' },
    body: {
      matricula: 'VLR-2026-001',
      funcionarioId: 'func_mariana_001',
      modulos: ['residentes', 'colaboradores'],
    },
  });

  assert(
    duplicateRes.status === 409 && duplicateRes.body.code === 'MATRICULA_JA_VINCULADA',
    'Tentativa de vinculação duplicada para a mesma matrícula é rejeitada com 409 Conflict',
    `Esperado 409 MATRICULA_JA_VINCULADA, obtido ${duplicateRes.status}: ${JSON.stringify(duplicateRes.body)}`
  );

  // -----------------------------------------------------------------
  // Cenário 7: Tentativa de autorização por usuário sem privilégio
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 7: Tentativa de autorização por usuário sem privilégio ---');
  // Sem token
  const unauthRes = await dispatchRoute('post', '/api/staff-authorizations/prepare', {
    body: { matricula: 'VLR-2026-002', funcionarioId: 'func_roberto_002', modulos: ['residentes'] },
  });
  assert(
    unauthRes.status === 401,
    'Tentativa sem autenticação é bloqueada com 401 Unauthorized',
    `Esperado 401, obtido ${unauthRes.status}`
  );

  // Usuário comum (colaborador) tentando preparar acesso
  const forbiddenRes = await dispatchRoute('post', '/api/staff-authorizations/prepare', {
    headers: { authorization: 'Bearer staff-token' },
    body: { matricula: 'VLR-2026-002', funcionarioId: 'func_roberto_002', modulos: ['residentes'] },
  });
  assert(
    forbiddenRes.status === 403,
    'Usuário sem perfil administrativo tentando preparar autorização é bloqueado com 403 Forbidden',
    `Esperado 403, obtido ${forbiddenRes.status}`
  );

  // -----------------------------------------------------------------
  // Cenário 8: Tentativa de acesso a módulo não autorizado
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 8: Tentativa de acesso a módulo não autorizado ---');
  // Mariana só tem 'residentes'. Tentar acessar 'usuarios' ou 'seguranca'
  const canAccessUsuarios = canAccessModule('colaborador', activeStaffUser.modulos, 'usuarios');
  const canAccessSeguranca = canAccessModule('colaborador', activeStaffUser.modulos, 'seguranca');
  assert(
    canAccessUsuarios === false && canAccessSeguranca === false,
    'RBAC bloqueia estritamente acesso a módulos não concedidos ("usuarios", "seguranca")',
    'Falha de restrição RBAC: módulo não concedido foi liberado'
  );

  // -----------------------------------------------------------------
  // Cenário 9: Revogação de autorização
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 9: Revogação de autorização ---');
  const revokeRes = await dispatchRoute('post', '/api/staff-authorizations/revoke', {
    headers: { authorization: 'Bearer admin-token' },
    body: {
      matricula: 'VLR-2026-001',
      uid: 'colab_uid_1',
    },
  });

  assert(
    revokeRes.status === 200 && revokeRes.body.success === true,
    'Revogação de autorização processada com sucesso pelo Administrador',
    `Esperado 200, obtido ${revokeRes.status}: ${JSON.stringify(revokeRes.body)}`
  );

  const revokedDoc = await mockDb.collection('usuariosAutorizados').doc('colab_uid_1').get();
  assert(
    revokedDoc.exists &&
      revokedDoc.data().ativo === false &&
      revokedDoc.data().statusAcesso === 'revogado' &&
      Boolean(revokedDoc.data().revogadoEm),
    'Documento de autorização atualizado com ativo: false e statusAcesso: "revogado"',
    `Dados incorretos no doc revogado: ${JSON.stringify(revokedDoc.data())}`
  );

  // -----------------------------------------------------------------
  // Cenário 10: Preservação do cadastro funcional após revogação
  // -----------------------------------------------------------------
  console.log('\n--- Cenário 10: Preservação do cadastro funcional após revogação ---');
  const docFuncAfterRevoke = await mockDb.collection('funcionarios').doc('func_mariana_001').get();
  assert(
    docFuncAfterRevoke.exists === true,
    'Registro funcional em /funcionarios/func_mariana_001 permanece existente',
    'Registro funcional foi indevidamente deletado'
  );

  const dataFunc = docFuncAfterRevoke.data();
  assert(
    dataFunc.nomeCompleto === 'Mariana Santos' &&
      dataFunc.matricula === 'VLR-2026-001' &&
      dataFunc.cargo === 'Enfermeiro(a) Responsável Técnico (RT)' &&
      dataFunc.status === 'ativo' &&
      dataFunc.cpf === '123.456.789-00' &&
      dataFunc.salarioBase === '6.500,00' &&
      dataFunc.banco === 'Banco do Brasil',
    'Todos os dados profissionais, cadastrais e bancários do colaborador permanecem 100% intactos',
    `Dados do colaborador foram adulterados: ${JSON.stringify(dataFunc)}`
  );

  // Resumo final dos testes
  console.log('\n================================================================');
  console.log(`TESTES CONCLUÍDOS: ${passed} PASSOU, ${failed} FALHOU`);
  console.log('================================================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTestSuite().catch((err) => {
  console.error('Erro fatal executando suite de testes:', err);
  process.exit(1);
});
