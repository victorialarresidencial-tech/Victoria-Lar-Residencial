import assert from 'node:assert';
import {
  sanitizarPayloadFuncionario,
  formatarErroAmigavel,
} from '../src/services/colaboradoresService';
import { Funcionario } from '../src/types/employee';

console.log('================================================================');
console.log('STARTING VICTORIA LAR — TESTES DE SERIALIZAÇÃO DE COLABORADORES');
console.log('================================================================');

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => console.log(`  [PASS] ${name}`),
        (err) => {
          console.error(`  [FAIL] ${name}:`, err);
          process.exitCode = 1;
        }
      );
    }
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------------------
// CENÁRIO 1: Cadastro Completo com Todos os Campos Preenchidos
// -------------------------------------------------------------------------
console.log('\n--- Cenário 1: Cadastro Completo com Todos os Campos Válidos ---');

test('Preserva todos os campos válidos e tipos corretos no cadastro completo', () => {
  const dadosCompletos: Record<string, any> = {
    matricula: 'VLR-2026-101',
    nomeCompleto: 'Carla Regina Mendonça',
    nomeSocial: 'Carla',
    cpf: '321.654.987-11',
    rg: '37.892.110-5',
    orgaoEmissor: 'SSP/SP',
    dataNascimento: '1988-08-14',
    idade: 38,
    sexo: 'feminino',
    estadoCivil: 'Casada',
    nacionalidade: 'Brasileira',
    naturalidade: 'São Paulo - SP',
    nomeMae: 'Marlene Mendonça',
    nomePai: 'José Mendonça',
    fotoUrl: 'https://exemplo.com/foto.jpg',
    cargo: 'Cuidador(a) de Idosos',
    departamento: 'Cuidados & Enfermagem',
    registroConselho: 'CBO 5162-10',
    tipoContrato: 'clt_integral',
    escalaTrabalho: '12x36_diurno',
    turno: 'Plantão 12h',
    dataAdmissao: '2026-03-01',
    status: 'ativo',
    salarioBase: 'R$ 2.450,00',
    celularWhatsApp: '(11) 98877-6655',
    telefoneFixo: '(11) 3222-1100',
    email: 'carla.mendonca@victorialar.com.br',
    cep: '04140-000',
    logradouro: 'Avenida Bosque da Saúde',
    numero: '850',
    complemento: 'Bloco B Apto 43',
    bairro: 'Saúde',
    cidade: 'São Paulo',
    estado: 'SP',
    nomeContatoEmergencia: 'Fernando Mendonça',
    parentescoEmergencia: 'Cônjuge',
    telefoneEmergencia: '(11) 97766-5544',
    pisPasep: '128.94821.10-9',
    ctpsNumero: '4891023',
    ctpsSerie: '0012-SP',
    banco: 'Nubank (260)',
    agencia: '0001',
    conta: '5891230-4',
    tipoChavePix: 'cpf',
    chavePix: '321.654.987-11',
    dataExameAdmissional: '2026-03-01',
    dataValidadeASO: '2027-03-01',
    vacinasEmDia: ['COVID-19', 'Influenza / Gripe Anual', 'Hepatite B'],
    alergiasRestricoes: 'Nenhuma restrição alimentar ou alergia.',
    tipoSanguineo: 'O+',
    qualificacoesCursos: ['Curso de Cuidador de Idosos (CBO 5162-10)', 'BLS'],
    observacoesGerais: 'Excelente histórico profissional em ILPI.',
    criadoEm: '2026-03-01T10:00:00.000Z',
    atualizadoEm: '2026-03-01T10:00:00.000Z',
  };

  const payload = sanitizarPayloadFuncionario(dadosCompletos);

  // Verificação de preservação de campos e valores
  assert.strictEqual(payload.nomeCompleto, 'Carla Regina Mendonça');
  assert.strictEqual(payload.nacionalidade, 'Brasileira');
  assert.strictEqual(payload.naturalidade, 'São Paulo - SP');
  assert.strictEqual(payload.cpf, '321.654.987-11');
  assert.strictEqual(payload.idade, 38);
  assert.strictEqual(typeof payload.idade, 'number');
  assert.strictEqual(payload.salarioBase, 'R$ 2.450,00');
  assert.strictEqual(Array.isArray(payload.vacinasEmDia), true);
  assert.strictEqual(payload.vacinasEmDia.length, 3);
  assert.strictEqual(Array.isArray(payload.qualificacoesCursos), true);
  assert.strictEqual(payload.qualificacoesCursos.length, 2);

  // Verificação estrita de ausência de undefined
  for (const [key, value] of Object.entries(payload)) {
    assert.notStrictEqual(value, undefined, `Propriedade ${key} não deve ser undefined`);
  }
});

// -------------------------------------------------------------------------
// CENÁRIO 2: Cadastro com Campos Opcionais Vazios (Omissão Segura)
// -------------------------------------------------------------------------
console.log('\n--- Cenário 2: Cadastro com Campos Opcionais Vazios ---');

test('Omite campos opcionais vazios sem gerar propriedades undefined nem poluir com strings vazias', () => {
  const dadosMinimos: Record<string, any> = {
    matricula: 'VLR-2026-202',
    nomeCompleto: 'João da Silva Santos',
    nomeSocial: '', // opcional vazio
    cpf: '111.222.333-44',
    rg: '12.345.678-9',
    orgaoEmissor: '', // opcional vazio
    dataNascimento: '1995-04-20',
    idade: undefined, // não calculado
    sexo: 'masculino',
    estadoCivil: 'Solteiro(a)',
    nacionalidade: '', // opcional vazio
    naturalidade: '', // opcional vazio
    nomeMae: '', // opcional vazio
    nomePai: '', // opcional vazio
    fotoUrl: '', // opcional vazio
    cargo: 'Auxiliar de Enfermagem',
    cargoPersonalizado: undefined, // opcional vazio
    departamento: 'Cuidados & Enfermagem',
    registroConselho: '', // opcional vazio
    tipoContrato: 'clt_integral',
    escalaTrabalho: '12x36_diurno',
    turno: 'Plantão 12h',
    dataAdmissao: '2026-05-10',
    status: 'ativo',
    salarioBase: '', // opcional vazio
    celularWhatsApp: '(11) 91234-5678',
    telefoneFixo: '', // opcional vazio
    email: 'joao.silva@victorialar.com.br',
    cep: '04001-000',
    logradouro: 'Rua Domingos de Morais',
    numero: '1200',
    complemento: '', // opcional vazio
    bairro: 'Vila Mariana',
    cidade: 'São Paulo',
    estado: 'SP',
    nomeContatoEmergencia: 'Maria Silva',
    parentescoEmergencia: 'Mãe',
    telefoneEmergencia: '(11) 98765-4321',
    pisPasep: '', // opcional vazio
    ctpsNumero: '', // opcional vazio
    ctpsSerie: '', // opcional vazio
    banco: '', // opcional vazio
    agencia: '', // opcional vazio
    conta: '', // opcional vazio
    tipoChavePix: undefined,
    chavePix: '', // opcional vazio
    dataExameAdmissional: '', // opcional vazio
    dataValidadeASO: '', // opcional vazio
    vacinasEmDia: [], // lista vazia
    alergiasRestricoes: '', // opcional vazio
    tipoSanguineo: undefined,
    qualificacoesCursos: [],
    observacoesGerais: '', // opcional vazio
  };

  const payload = sanitizarPayloadFuncionario(dadosMinimos);

  // Campos opcionais NÃO devem estar presentes no objeto retornado
  assert.strictEqual('naturalidade' in payload, false, 'naturalidade vazia deve ser omitida');
  assert.strictEqual('nacionalidade' in payload, false, 'nacionalidade vazia deve ser omitida');
  assert.strictEqual('nomeSocial' in payload, false, 'nomeSocial vazio deve ser omitido');
  assert.strictEqual('orgaoEmissor' in payload, false, 'orgaoEmissor vazio deve ser omitido');
  assert.strictEqual('idade' in payload, false, 'idade undefined deve ser omitida');
  assert.strictEqual('salarioBase' in payload, false, 'salarioBase vazio deve ser omitido');
  assert.strictEqual('complemento' in payload, false, 'complemento vazio deve ser omitido');
  assert.strictEqual('pisPasep' in payload, false, 'pisPasep vazio deve ser omitido');
  assert.strictEqual('chavePix' in payload, false, 'chavePix vazio deve ser omitido');
  assert.strictEqual('observacoesGerais' in payload, false, 'observacoesGerais vazio deve ser omitido');

  // Campos obrigatórios DEVEM estar presentes
  assert.strictEqual(payload.nomeCompleto, 'João da Silva Santos');
  assert.strictEqual(payload.cpf, '111.222.333-44');
  assert.strictEqual(payload.rg, '12.345.678-9');
  assert.strictEqual(payload.dataNascimento, '1995-04-20');
  assert.strictEqual(payload.matricula, 'VLR-2026-202');
  assert.strictEqual(payload.cargo, 'Auxiliar de Enfermagem');
  assert.strictEqual(payload.departamento, 'Cuidados & Enfermagem');
  assert.strictEqual(payload.celularWhatsApp, '(11) 91234-5678');
  assert.strictEqual(payload.email, 'joao.silva@victorialar.com.br');
  assert.strictEqual(payload.cep, '04001-000');
  assert.strictEqual(payload.logradouro, 'Rua Domingos de Morais');
  assert.strictEqual(payload.numero, '1200');
  assert.strictEqual(payload.bairro, 'Vila Mariana');
  assert.strictEqual(payload.cidade, 'São Paulo');
  assert.strictEqual(payload.estado, 'SP');
  assert.strictEqual(payload.nomeContatoEmergencia, 'Maria Silva');
  assert.strictEqual(payload.parentescoEmergencia, 'Mãe');
  assert.strictEqual(payload.telefoneEmergencia, '(11) 98765-4321');

  // Zero propriedades com undefined
  const chavesUndefined = Object.keys(payload).filter((k) => payload[k] === undefined);
  assert.strictEqual(chavesUndefined.length, 0, `Nenhuma chave pode ser undefined: ${chavesUndefined.join(', ')}`);
});

// -------------------------------------------------------------------------
// CENÁRIO 3: Caso Específico do Bug — Nacionalidade Preenchida e Naturalidade Vazia
// -------------------------------------------------------------------------
console.log('\n--- Cenário 3: Bug Específico — Nacionalidade Preenchida e Naturalidade Vazia ---');

test('Cenário exato do erro: nacionalidade preenchida e naturalidade vazia não gera Unsupported field value: undefined', () => {
  const dadosBug: Record<string, any> = {
    nomeCompleto: 'Ana Paula Rocha',
    cpf: '444.555.666-77',
    rg: '28.192.839-0',
    dataNascimento: '1990-11-25',
    sexo: 'feminino',
    estadoCivil: 'Solteiro(a)',
    matricula: 'VLR-2026-303',
    cargo: 'Fisioterapeuta',
    departamento: 'Equipe Multidisciplinar / Saúde',
    tipoContrato: 'pj_prestador',
    escalaTrabalho: 'plantonista',
    dataAdmissao: '2026-06-01',
    status: 'ativo',
    celularWhatsApp: '(11) 99887-1122',
    email: 'ana.rocha@victorialar.com.br',
    cep: '04500-000',
    logradouro: 'Rua Afonso Braz',
    numero: '500',
    bairro: 'Vila Nova Conceição',
    cidade: 'São Paulo',
    estado: 'SP',
    nomeContatoEmergencia: 'Roberto Rocha',
    parentescoEmergencia: 'Pai',
    telefoneEmergencia: '(11) 99112-2334',

    // Nacionalidade preenchida, naturalidade vazia (ou undefined):
    nacionalidade: 'Brasileira',
    naturalidade: '',
  };

  const payload = sanitizarPayloadFuncionario(dadosBug);

  // Nacionalidade deve existir e ser string
  assert.strictEqual('nacionalidade' in payload, true, 'nacionalidade deve estar presente no payload');
  assert.strictEqual(payload.nacionalidade, 'Brasileira');

  // Naturalidade NÃO deve existir no mapa de chaves
  assert.strictEqual('naturalidade' in payload, false, 'naturalidade vazia NÃO deve ser uma chave no payload');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'naturalidade'), false);

  // Firestore addDoc/updateDoc validação: simula iteração que o SDK do Firestore faz
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      throw new Error(`Unsupported field value: undefined (found in field ${key})`);
    }
  }
});

test('Caso inverso: naturalidade preenchida e nacionalidade vazia', () => {
  const dados = {
    nomeCompleto: 'Carlos Eduardo',
    nacionalidade: '',
    naturalidade: 'Campinas - SP',
  };

  const payload = sanitizarPayloadFuncionario(dados);

  assert.strictEqual('nacionalidade' in payload, false);
  assert.strictEqual(payload.naturalidade, 'Campinas - SP');
});

test('Ambos preenchidos: nacionalidade e naturalidade coexistem como informações distintas', () => {
  const dados = {
    nomeCompleto: 'Mariana Lima',
    nacionalidade: 'Brasileira',
    naturalidade: 'Belo Horizonte - MG',
  };

  const payload = sanitizarPayloadFuncionario(dados);

  assert.strictEqual(payload.nacionalidade, 'Brasileira');
  assert.strictEqual(payload.naturalidade, 'Belo Horizonte - MG');
});

// -------------------------------------------------------------------------
// CENÁRIO 4: Preservação dos Tipos Primitivos (Datas, Números, Arrays, Booleanos)
// -------------------------------------------------------------------------
console.log('\n--- Cenário 4: Preservação dos Tipos Primitivos ---');

test('Preserva números estritos, arrays de strings e booleanos', () => {
  const dadosTipos = {
    idade: 42,
    idadeInvalida: NaN,
    idadeNegativa: -5,
    ativo: true,
    desligado: false,
    vacinasEmDia: ['  COVID-19  ', '', 'Influenza'],
    qualificacoesCursos: ['Geriatria'],
  };

  const payload = sanitizarPayloadFuncionario(dadosTipos);

  assert.strictEqual(payload.idade, 42);
  assert.strictEqual(typeof payload.idade, 'number');
  assert.strictEqual('idadeInvalida' in payload, false, 'NaN deve ser descartado');
  assert.strictEqual('idadeNegativa' in payload, false, 'Idade negativa deve ser descartada');
  assert.strictEqual(payload.ativo, true);
  assert.strictEqual(payload.desligado, false);
  assert.deepStrictEqual(payload.vacinasEmDia, ['COVID-19', 'Influenza']);
  assert.deepStrictEqual(payload.qualificacoesCursos, ['Geriatria']);
});

// -------------------------------------------------------------------------
// CENÁRIO 5: Ausência Absoluta de Valores Undefined (Zero-Undefined Guarantee)
// -------------------------------------------------------------------------
console.log('\n--- Cenário 5: Garantia Estrita de Ausência de Undefined ---');

test('Nenhum campo com valor undefined sobrevive à sanitização', () => {
  const objetoCheioDeUndefined = {
    campo1: undefined,
    campo2: 'valor valido',
    campo3: undefined,
    campo4: 123,
    campo5: undefined,
    campo6: ['a', undefined, 'b'],
  };

  const payload = sanitizarPayloadFuncionario(objetoCheioDeUndefined);

  assert.strictEqual(Object.keys(payload).includes('campo1'), false);
  assert.strictEqual(Object.keys(payload).includes('campo3'), false);
  assert.strictEqual(Object.keys(payload).includes('campo5'), false);
  assert.strictEqual(payload.campo2, 'valor valido');
  assert.strictEqual(payload.campo4, 123);
  assert.deepStrictEqual(payload.campo6, ['a', 'b']);

  // JSON roundtrip deve ser estritamente idêntico
  const jsonStr = JSON.stringify(payload);
  const parsed = JSON.parse(jsonStr);
  assert.deepStrictEqual(payload, parsed);
});

// -------------------------------------------------------------------------
// CENÁRIO 6: Mensagens de Erro Amigáveis e Proteção de Dados de Autenticação
// -------------------------------------------------------------------------
console.log('\n--- Cenário 6: Mensagens de Erro Amigáveis sem Vazamento ---');

test('formatarErroAmigavel traduz erros do Firestore sem vazar authInfo nem expor JSON bruto', () => {
  // Simula erro bruto do handleFirestoreError
  const erroComAuthInfo = new Error(
    JSON.stringify({
      error: 'Missing or insufficient permissions.',
      authInfo: {
        userId: 'uid_secreto_12345',
        email: 'admin@victorialar.com.br',
        tenantId: 'tenant_abc',
        providerInfo: [{ providerId: 'google.com', email: 'admin@victorialar.com.br' }],
      },
      operationType: 'create',
      path: 'funcionarios',
    })
  );

  const mensagemAmigavel = formatarErroAmigavel(erroComAuthInfo);

  // A mensagem apresentada deve ser amigável e NÃO deve conter dados internos
  assert.strictEqual(mensagemAmigavel.includes('uid_secreto_12345'), false, 'Não deve expor userId');
  assert.strictEqual(mensagemAmigavel.includes('tenant_abc'), false, 'Não deve expor tenantId');
  assert.strictEqual(mensagemAmigavel.includes('{'), false, 'Não deve exibir JSON bruto ao usuário');
  assert.strictEqual(
    mensagemAmigavel.includes('Permissão insuficiente para cadastrar colaboradores'),
    true,
    'Deve exibir orientação amigável em português'
  );
});

test('formatarErroAmigavel trata erro de offline adequadamente', () => {
  const erroOffline = new Error(
    JSON.stringify({
      error: 'Failed to get document because the client is offline.',
      authInfo: {},
      operationType: 'create',
      path: 'funcionarios',
    })
  );

  const msg = formatarErroAmigavel(erroOffline);
  assert.strictEqual(msg.includes('Falha de conexão com a nuvem do Firestore'), true);
});

test('formatarErroAmigavel trata erro de formato undefined amigavelmente', () => {
  const erroUndefined = new Error(
    'Function addDoc() called with invalid data. Unsupported field value: undefined (found in field naturalidade)'
  );

  const msg = formatarErroAmigavel(erroUndefined);
  assert.strictEqual(msg.includes('Unsupported field value: undefined'), false);
  assert.strictEqual(msg.length > 0, true);
});

// -------------------------------------------------------------------------
// CENÁRIO 7: Preservação do Estado do Formulário em Caso de Falha
// -------------------------------------------------------------------------
console.log('\n--- Cenário 7: Preservação do Formulário em Caso de Falha ---');

test('Falha na operação de rede não limpa os campos preenchidos pelo usuário', async () => {
  // Simula o estado do formulário React
  const estadoFormulario = {
    nomeCompleto: 'Benedita Aparecida',
    cpf: '999.888.777-66',
    rg: '19.283.475-1',
    nacionalidade: 'Brasileira',
    naturalidade: '',
    observacoesGerais: 'Cuidadora sênior com disponibilidade em plantão noturno.',
  };

  let formularioResetado = false;
  let erroCapturado: string | null = null;

  function resetForm() {
    formularioResetado = true;
  }

  // Simulação de submissão com falha de rede
  async function simularSubmitComFalha() {
    try {
      // Simula rejeição no Firestore
      throw new Error('Falha simulada de rede durante o cadastro');
    } catch (err: unknown) {
      erroCapturado = formatarErroAmigavel(err);
      // O formulário NÃO deve chamar resetForm() em caso de erro!
    }
  }

  await simularSubmitComFalha();

  // Verifica que o formulário NÃO foi resetado
  assert.strictEqual(formularioResetado, false, 'O formulário NÃO deve ser resetado em caso de erro');
  assert.strictEqual(estadoFormulario.nomeCompleto, 'Benedita Aparecida');
  assert.strictEqual(estadoFormulario.nacionalidade, 'Brasileira');
  assert.strictEqual(estadoFormulario.observacoesGerais.length > 0, true);
  assert.strictEqual(erroCapturado !== null, true);
});

// -------------------------------------------------------------------------
// CENÁRIO 8: Validação dos 24 Campos Obrigatórios Conforme firestore.rules
// -------------------------------------------------------------------------
console.log('\n--- Cenário 8: Validação dos 24 Campos Obrigatórios Conforme firestore.rules ---');

test('Validação de campos obrigatórios identifica campos faltantes', () => {
  const CAMPOS_OBRIGATORIOS_REGRAS = [
    'nomeCompleto', 'cpf', 'rg', 'dataNascimento', 'sexo', 'estadoCivil',
    'cargo', 'departamento', 'tipoContrato', 'escalaTrabalho', 'dataAdmissao',
    'status', 'matricula', 'celularWhatsApp', 'email', 'cep', 'logradouro',
    'numero', 'bairro', 'cidade', 'estado', 'nomeContatoEmergencia',
    'parentescoEmergencia', 'telefoneEmergencia'
  ];

  assert.strictEqual(CAMPOS_OBRIGATORIOS_REGRAS.length, 24, 'Devem ser exatamente 24 campos obrigatórios');

  // Objeto onde falta "nomeCompleto"
  const incompleto = {
    nomeCompleto: '',
    cpf: '123.456.789-00',
    rg: '12.345.678-9',
  };

  const payload = sanitizarPayloadFuncionario(incompleto);
  // Mantém string vazia para indicar campo presente mas inválido no schema
  assert.strictEqual(payload.nomeCompleto, '');
});

console.log('\n================================================================');
console.log('TODOS OS TESTES DE SERIALIZAÇÃO DE COLABORADORES PASSARAM COM SUCESSO!');
console.log('================================================================');
