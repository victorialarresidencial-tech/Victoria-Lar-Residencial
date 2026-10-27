export type StatusFuncionario = 'ativo' | 'ferias' | 'afastado' | 'desligado';

export type TipoContrato =
  | 'clt_integral'
  | 'clt_parcial'
  | 'pj_prestador'
  | 'estagio'
  | 'autonomo_plantonista'
  | 'temporario';

export type EscalaTrabalho =
  | '12x36_diurno'
  | '12x36_noturno'
  | '6x1'
  | '5x2'
  | 'plantonista'
  | 'horista'
  | 'outro';

export type Departamento =
  | 'Cuidados & Enfermagem'
  | 'Equipe Multidisciplinar / Saúde'
  | 'Cozinha & Nutrição'
  | 'Higienização & Hotelaria'
  | 'Administração & RH'
  | 'Diretoria & Coordenação';

export type Cargo =
  | 'Cuidador(a) de Idosos'
  | 'Enfermeiro(a) Responsável Técnico (RT)'
  | 'Técnico(a) de Enfermagem'
  | 'Auxiliar de Enfermagem'
  | 'Fisioterapeuta'
  | 'Nutricionista'
  | 'Terapeuta Ocupacional'
  | 'Médico(a) Geriatra'
  | 'Psicólogo(a)'
  | 'Fonoaudiólogo(a)'
  | 'Cozinheiro(a)'
  | 'Auxiliar de Cozinha'
  | 'Auxiliar de Serviços Gerais / Limpeza'
  | 'Encarregado(a) de Lavanderia'
  | 'Recepcionista / Atendimento'
  | 'Assistente Administrativo / DP'
  | 'Coordenador(a) Operacional'
  | 'Outro';

export type Sexo = 'feminino' | 'masculino' | 'outro';
export type TipoSanguineo = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Desconhecido';

export interface Funcionario {
  id: string;
  // Identificação Pessoal
  nomeCompleto: string;
  nomeSocial?: string;
  cpf: string;
  rg: string;
  orgaoEmissor?: string;
  dataNascimento: string;
  idade?: number;
  sexo: Sexo;
  estadoCivil: string;
  nacionalidade?: string;
  naturalidade?: string;
  nomeMae?: string;
  nomePai?: string;
  fotoUrl?: string;

  // Cargo & Dados Profissionais (Victoria Lar)
  cargo: Cargo;
  cargoPersonalizado?: string;
  departamento: Departamento;
  registroConselho?: string; // ex: COREN-SP 123456-ENF, CREFITO 4567, CRN, CRM
  tipoContrato: TipoContrato;
  escalaTrabalho: EscalaTrabalho;
  turno?: 'Manhã' | 'Tarde' | 'Noite' | 'Plantão 12h' | 'Comercial';
  dataAdmissao: string;
  status: StatusFuncionario;
  matricula: string;
  salarioBase?: string;

  // Contatos
  celularWhatsApp: string;
  telefoneFixo?: string;
  email: string;

  // Endereço Residencial
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Contato de Emergência
  nomeContatoEmergencia: string;
  parentescoEmergencia: string;
  telefoneEmergencia: string;

  // Documentos Trabalhistas & Bancários
  pisPasep?: string;
  ctpsNumero?: string;
  ctpsSerie?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoChavePix?: 'cpf' | 'email' | 'telefone' | 'aleatoria';
  chavePix?: string;

  // Saúde Ocupacional & ILPI
  dataExameAdmissional?: string;
  dataValidadeASO?: string;
  vacinasEmDia?: string[]; // COVID-19, Influenza/Gripe, Hepatite B, Tétano/dT
  alergiasRestricoes?: string;
  tipoSanguineo?: TipoSanguineo;

  // Cursos & Observações
  qualificacoesCursos?: string[];
  observacoesGerais?: string;

  criadoEm: string;
  atualizadoEm: string;
}
