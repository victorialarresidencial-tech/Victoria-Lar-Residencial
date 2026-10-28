import React, { useState } from 'react';
import {
  User,
  Briefcase,
  Phone,
  Home,
  AlertTriangle,
  HeartPulse,
  CreditCard,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Clock,
  Shield,
  FileBadge,
  Camera,
  RotateCcw
} from 'lucide-react';
import {
  Funcionario,
  Cargo,
  Departamento,
  TipoContrato,
  EscalaTrabalho,
  StatusFuncionario,
  Sexo,
  TipoSanguineo
} from '../../types/employee';
import {
  cadastrarFuncionarioNoFirebase,
  sanitizarPayloadFuncionario,
  formatarErroAmigavel
} from '../../services/colaboradoresService';

interface EmployeeFormProps {
  onSuccess: (novoFuncionario: Funcionario) => void;
  onOpenConfig: () => void;
  isFirebaseConnected: boolean;
}

const CARGOS_OPCOES: Cargo[] = [
  'Cuidador(a) de Idosos',
  'Enfermeiro(a) Responsável Técnico (RT)',
  'Técnico(a) de Enfermagem',
  'Auxiliar de Enfermagem',
  'Fisioterapeuta',
  'Nutricionista',
  'Terapeuta Ocupacional',
  'Médico(a) Geriatra',
  'Psicólogo(a)',
  'Fonoaudiólogo(a)',
  'Cozinheiro(a)',
  'Auxiliar de Cozinha',
  'Auxiliar de Serviços Gerais / Limpeza',
  'Encarregado(a) de Lavanderia',
  'Recepcionista / Atendimento',
  'Assistente Administrativo / DP',
  'Coordenador(a) Operacional',
  'Outro',
];

const DEPARTAMENTOS_OPCOES: Departamento[] = [
  'Cuidados & Enfermagem',
  'Equipe Multidisciplinar / Saúde',
  'Cozinha & Nutrição',
  'Higienização & Hotelaria',
  'Administração & RH',
  'Diretoria & Coordenação',
];

const VACINAS_PADRAO = [
  'COVID-19 (Esquema Completo + Bivalente)',
  'Influenza / Gripe Anual',
  'Hepatite B (3 doses)',
  'Dupla Adulto dT (Tétano e Difteria)',
  'Tríplice Viral',
];

const CURSOS_SUGESTOES = [
  'Curso de Cuidador de Idosos (CBO 5162-10)',
  'Primeiros Socorros e Suporte Básico de Vida (BLS)',
  'Manejo de Demências e Alzheimer',
  'Prevenção de Quedas e Lesão por Pressão (LPP)',
  'Boas Práticas de Manipulação de Alimentos (ANVISA)',
  'Humanização e Cuidados Paliativos em ILPI',
];

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  onSuccess,
  onOpenConfig,
  isFirebaseConnected,
}) => {
  // Identificação Pessoal
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeSocial, setNomeSocial] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [orgaoEmissor, setOrgaoEmissor] = useState('SSP/SP');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState<Sexo>('feminino');
  const [estadoCivil, setEstadoCivil] = useState('Solteiro(a)');
  const [nacionalidade, setNacionalidade] = useState('Brasileira');
  const [naturalidade, setNaturalidade] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [nomePai, setNomePai] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // Cargo & Dados Profissionais
  const [cargo, setCargo] = useState<Cargo>('Cuidador(a) de Idosos');
  const [cargoPersonalizado, setCargoPersonalizado] = useState('');
  const [departamento, setDepartamento] = useState<Departamento>('Cuidados & Enfermagem');
  const [registroConselho, setRegistroConselho] = useState('');
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>('clt_integral');
  const [escalaTrabalho, setEscalaTrabalho] = useState<EscalaTrabalho>('12x36_diurno');
  const [turno, setTurno] = useState<'Manhã' | 'Tarde' | 'Noite' | 'Plantão 12h' | 'Comercial'>('Plantão 12h');
  const [dataAdmissao, setDataAdmissao] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<StatusFuncionario>('ativo');
  const [matricula, setMatricula] = useState(`VLR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [salarioBase, setSalarioBase] = useState('');

  // Contatos
  const [celularWhatsApp, setCelularWhatsApp] = useState('');
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [email, setEmail] = useState('');

  // Endereço Residencial
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [estado, setEstado] = useState('SP');

  // Contato de Emergência
  const [nomeContatoEmergencia, setNomeContatoEmergencia] = useState('');
  const [parentescoEmergencia, setParentescoEmergencia] = useState('');
  const [telefoneEmergencia, setTelefoneEmergencia] = useState('');

  // Documentos Trabalhistas & Dados Bancários
  const [pisPasep, setPisPasep] = useState('');
  const [ctpsNumero, setCtpsNumero] = useState('');
  const [ctpsSerie, setCtpsSerie] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState<'cpf' | 'email' | 'telefone' | 'aleatoria'>('cpf');
  const [chavePix, setChavePix] = useState('');

  // Saúde Ocupacional & ILPI
  const [dataExameAdmissional, setDataExameAdmissional] = useState(new Date().toISOString().split('T')[0]);
  const [dataValidadeASO, setDataValidadeASO] = useState('');
  const [vacinasEmDia, setVacinasEmDia] = useState<string[]>([
    'COVID-19 (Esquema Completo + Bivalente)',
    'Influenza / Gripe Anual',
    'Hepatite B (3 doses)'
  ]);
  const [novaVacinaInput, setNovaVacinaInput] = useState('');
  const [alergiasRestricoes, setAlergiasRestricoes] = useState('');
  const [tipoSanguineo, setTipoSanguineo] = useState<TipoSanguineo>('O+');

  // Cursos & Observações
  const [qualificacoesCursos, setQualificacoesCursos] = useState<string[]>([
    'Curso de Cuidador de Idosos (CBO 5162-10)',
    'Primeiros Socorros e Suporte Básico de Vida (BLS)'
  ]);
  const [novoCursoInput, setNovoCursoInput] = useState('');
  const [observacoesGerais, setObservacoesGerais] = useState('');

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Masks
  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCEP = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  // Quick CEP lookup simulation/helper
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    setCep(formatted);
    const raw = formatted.replace(/\D/g, '');
    if (raw.length === 8) {
      // Auto fetch via viacep if available
      fetch(`https://viacep.com.br/ws/${raw}/json/`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.erro) {
            setLogradouro(data.logradouro || logradouro);
            setBairro(data.bairro || bairro);
            setCidade(data.localidade || cidade);
            setEstado(data.uf || estado);
          }
        })
        .catch(() => {});
    }
  };

  // Image Upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Auto calculate age
  const calcularIdade = (dataNasc: string) => {
    if (!dataNasc) return undefined;
    const nasc = new Date(dataNasc);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade > 0 ? idade : undefined;
  };

  // Add/Remove Vacina
  const adicionarVacina = () => {
    if (novaVacinaInput.trim() && !vacinasEmDia.includes(novaVacinaInput.trim())) {
      setVacinasEmDia([...vacinasEmDia, novaVacinaInput.trim()]);
      setNovaVacinaInput('');
    }
  };

  const removerVacina = (vacina: string) => {
    setVacinasEmDia(vacinasEmDia.filter((v) => v !== vacina));
  };

  // Add/Remove Curso
  const adicionarCurso = () => {
    if (novoCursoInput.trim() && !qualificacoesCursos.includes(novoCursoInput.trim())) {
      setQualificacoesCursos([...qualificacoesCursos, novoCursoInput.trim()]);
      setNovoCursoInput('');
    }
  };

  const removerCurso = (curso: string) => {
    setQualificacoesCursos(qualificacoesCursos.filter((c) => c !== curso));
  };

  // Auto match department when cargo changes
  const handleCargoChange = (novoCargo: Cargo) => {
    setCargo(novoCargo);
    if (novoCargo.includes('Cuidador') || novoCargo.includes('Enfermagem')) {
      setDepartamento('Cuidados & Enfermagem');
      if (novoCargo.includes('Cuidador')) {
        setTurno('Plantão 12h');
        setEscalaTrabalho('12x36_diurno');
      }
    } else if (
      novoCargo.includes('Fisioterapeuta') ||
      novoCargo.includes('Médico') ||
      novoCargo.includes('Psicólogo') ||
      novoCargo.includes('Terapeuta') ||
      novoCargo.includes('Fono')
    ) {
      setDepartamento('Equipe Multidisciplinar / Saúde');
    } else if (novoCargo.includes('Cozinh') || novoCargo.includes('Nutricionista')) {
      setDepartamento('Cozinha & Nutrição');
    } else if (novoCargo.includes('Limpeza') || novoCargo.includes('Lavanderia')) {
      setDepartamento('Higienização & Hotelaria');
    } else if (novoCargo.includes('Administrativo') || novoCargo.includes('Recepcionista')) {
      setDepartamento('Administração & RH');
      setEscalaTrabalho('5x2');
      setTurno('Comercial');
    }
  };

  // Preencher exemplo de colaborador
  const preencherDadosExemplo = () => {
    setNomeCompleto('Carla Regina Mendonça');
    setNomeSocial('Carla');
    setCpf('321.654.987-11');
    setRg('37.892.110-5 SSP/SP');
    setDataNascimento('1988-08-14');
    setSexo('feminino');
    setEstadoCivil('Casada');
    setNacionalidade('Brasileira');
    setNaturalidade('São Paulo - SP');
    setNomeMae('Marlene Mendonça');
    setCargo('Cuidador(a) de Idosos');
    setDepartamento('Cuidados & Enfermagem');
    setRegistroConselho('CBO 5162-10');
    setTipoContrato('clt_integral');
    setEscalaTrabalho('12x36_diurno');
    setTurno('Plantão 12h');
    setDataAdmissao(new Date().toISOString().split('T')[0]);
    setStatus('ativo');
    setSalarioBase('R$ 2.450,00');
    setCelularWhatsApp('(11) 98877-6655');
    setEmail('carla.mendonca@victorialar.com.br');
    setCep('04140-000');
    setLogradouro('Avenida Bosque da Saúde');
    setNumero('850');
    setComplemento('Bloco B Apto 43');
    setBairro('Saúde');
    setCidade('São Paulo');
    setEstado('SP');
    setNomeContatoEmergencia('Fernando Mendonça (Cônjuge)');
    setParentescoEmergencia('Cônjuge');
    setTelefoneEmergencia('(11) 97766-5544');
    setPisPasep('128.94821.10-9');
    setCtpsNumero('4891023');
    setCtpsSerie('0012-SP');
    setBanco('Nubank (260)');
    setAgencia('0001');
    setConta('5891230-4');
    setTipoChavePix('cpf');
    setChavePix('321.654.987-11');
    setDataExameAdmissional(new Date().toISOString().split('T')[0]);
    setDataValidadeASO('2027-04-15');
    setTipoSanguineo('O+');
    setVacinasEmDia([
      'COVID-19 (Esquema Completo + Bivalente)',
      'Influenza / Gripe Anual',
      'Hepatite B (3 doses)',
      'Dupla Adulto dT (Tétano e Difteria)'
    ]);
    setQualificacoesCursos([
      'Curso de Cuidador de Idosos (CBO 5162-10)',
      'Primeiros Socorros e Suporte Básico de Vida (BLS)',
      'Manejo de Demências e Alzheimer'
    ]);
    setObservacoesGerais('Experiência prévia de 4 anos em ILPI com residentes com dependência grau 2 e 3. Disponibilidade imediata.');
    setFormError(null);
  };

  const handleResetForm = () => {
    setNomeCompleto('');
    setNomeSocial('');
    setCpf('');
    setRg('');
    setOrgaoEmissor('SSP/SP');
    setDataNascimento('');
    setSexo('feminino');
    setEstadoCivil('Solteiro(a)');
    setNacionalidade('Brasileira');
    setNaturalidade('');
    setNomeMae('');
    setNomePai('');
    setFotoUrl('');
    setCargo('Cuidador(a) de Idosos');
    setCargoPersonalizado('');
    setDepartamento('Cuidados & Enfermagem');
    setRegistroConselho('');
    setTipoContrato('clt_integral');
    setEscalaTrabalho('12x36_diurno');
    setTurno('Plantão 12h');
    setDataAdmissao(new Date().toISOString().split('T')[0]);
    setStatus('ativo');
    setMatricula(`VLR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setSalarioBase('');
    setCelularWhatsApp('');
    setTelefoneFixo('');
    setEmail('');
    setCep('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setCidade('São Paulo');
    setEstado('SP');
    setNomeContatoEmergencia('');
    setParentescoEmergencia('');
    setTelefoneEmergencia('');
    setPisPasep('');
    setCtpsNumero('');
    setCtpsSerie('');
    setBanco('');
    setAgencia('');
    setConta('');
    setChavePix('');
    setDataExameAdmissional(new Date().toISOString().split('T')[0]);
    setDataValidadeASO('');
    setAlergiasRestricoes('');
    setObservacoesGerais('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validações essenciais e alinhamento com regras de integridade do Firestore
    if (!nomeCompleto.trim()) {
      setFormError('Por favor, informe o Nome Completo do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (nomeCompleto.trim().length > 150) {
      setFormError('O Nome Completo não pode ultrapassar 150 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (!cpf.trim() || cpfLimpo.length < 11) {
      setFormError('Por favor, preencha um CPF válido (mínimo de 11 dígitos).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cpf.trim().length > 20) {
      setFormError('O CPF não pode ultrapassar 20 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!rg.trim()) {
      setFormError('Por favor, informe o RG do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (rg.trim().length > 30) {
      setFormError('O RG do colaborador não pode exceder 30 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!dataNascimento) {
      setFormError('Por favor, informe a Data de Nascimento do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!estadoCivil.trim()) {
      setFormError('Por favor, selecione o Estado Civil do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!cargo) {
      setFormError('Por favor, selecione o Cargo do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cargo === 'Outro' && !cargoPersonalizado.trim()) {
      setFormError('Por favor, especifique o cargo personalizado.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!departamento) {
      setFormError('Por favor, selecione o Departamento.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!tipoContrato) {
      setFormError('Por favor, selecione o Tipo de Contrato.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!escalaTrabalho) {
      setFormError('Por favor, selecione a Escala de Trabalho.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!dataAdmissao) {
      setFormError('Por favor, informe a Data de Admissão do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!status) {
      setFormError('Por favor, selecione o Status do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!matricula.trim()) {
      setFormError('Por favor, informe a Matrícula do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (matricula.trim().length > 50) {
      setFormError('A Matrícula não pode ultrapassar 50 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!celularWhatsApp.trim() || celularWhatsApp.replace(/\D/g, '').length < 8) {
      setFormError('Por favor, forneça o Celular / WhatsApp para contato (mínimo de 8 dígitos).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (celularWhatsApp.trim().length > 30) {
      setFormError('O Celular / WhatsApp não pode ultrapassar 30 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!email.trim() || email.trim().length <= 3 || !email.includes('@')) {
      setFormError('Por favor, forneça um endereço de e-mail válido para o colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (email.trim().length > 160) {
      setFormError('O e-mail do colaborador não pode ultrapassar 160 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!cep.trim()) {
      setFormError('Por favor, informe o CEP residencial do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cep.trim().length > 20) {
      setFormError('O CEP não pode ultrapassar 20 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!logradouro.trim()) {
      setFormError('Por favor, informe o Logradouro (rua/avenida) residencial.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (logradouro.trim().length > 200) {
      setFormError('O Logradouro não pode exceder 200 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!numero.trim()) {
      setFormError('Por favor, informe o Número do endereço residencial.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (numero.trim().length > 30) {
      setFormError('O Número do endereço não pode exceder 30 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!bairro.trim()) {
      setFormError('Por favor, informe o Bairro residencial do colaborador.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (bairro.trim().length > 100) {
      setFormError('O Bairro não pode exceder 100 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!cidade.trim()) {
      setFormError('Por favor, informe a Cidade de residência.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cidade.trim().length > 100) {
      setFormError('A Cidade não pode exceder 100 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!estado.trim()) {
      setFormError('Por favor, informe o Estado (UF) de residência.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (estado.trim().length > 10) {
      setFormError('O Estado (UF) não pode exceder 10 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!nomeContatoEmergencia.trim()) {
      setFormError('Por favor, informe o Nome do Contato de Emergência.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (nomeContatoEmergencia.trim().length > 150) {
      setFormError('O Nome do Contato de Emergência não pode exceder 150 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!parentescoEmergencia.trim()) {
      setFormError('Por favor, informe o Grau de Parentesco do contato de emergência.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (parentescoEmergencia.trim().length > 60) {
      setFormError('O Grau de Parentesco não pode exceder 60 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!telefoneEmergencia.trim() || telefoneEmergencia.replace(/\D/g, '').length < 8) {
      setFormError('Por favor, informe o Telefone de Emergência (mínimo de 8 dígitos).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (telefoneEmergencia.trim().length > 30) {
      setFormError('O Telefone de Emergência não pode exceder 30 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (nacionalidade.trim().length > 60) {
      setFormError('A Nacionalidade não pode ultrapassar 60 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (naturalidade.trim().length > 60) {
      setFormError('A Naturalidade não pode ultrapassar 60 caracteres.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      const dadosBrutos: Record<string, any> = {
        matricula: matricula.trim(),
        nomeCompleto: nomeCompleto.trim(),
        cpf: cpf.trim(),
        rg: rg.trim(),
        dataNascimento,
        sexo,
        estadoCivil: estadoCivil.trim(),
        cargo,
        departamento,
        tipoContrato,
        escalaTrabalho,
        turno,
        dataAdmissao,
        status,
        celularWhatsApp: celularWhatsApp.trim(),
        email: email.trim(),
        cep: cep.trim(),
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim(),
        nomeContatoEmergencia: nomeContatoEmergencia.trim(),
        parentescoEmergencia: parentescoEmergencia.trim(),
        telefoneEmergencia: telefoneEmergencia.trim(),
      };

      if (nomeSocial.trim()) dadosBrutos.nomeSocial = nomeSocial.trim();
      if (orgaoEmissor.trim()) dadosBrutos.orgaoEmissor = orgaoEmissor.trim();

      const idadeCalc = calcularIdade(dataNascimento);
      if (typeof idadeCalc === 'number' && Number.isFinite(idadeCalc) && idadeCalc > 0) {
        dadosBrutos.idade = idadeCalc;
      }

      if (nacionalidade.trim()) dadosBrutos.nacionalidade = nacionalidade.trim();
      if (naturalidade.trim()) dadosBrutos.naturalidade = naturalidade.trim();
      if (nomeMae.trim()) dadosBrutos.nomeMae = nomeMae.trim();
      if (nomePai.trim()) dadosBrutos.nomePai = nomePai.trim();
      if (fotoUrl.trim()) dadosBrutos.fotoUrl = fotoUrl.trim();

      if (cargo === 'Outro' && cargoPersonalizado.trim()) {
        dadosBrutos.cargoPersonalizado = cargoPersonalizado.trim();
      }
      if (registroConselho.trim()) dadosBrutos.registroConselho = registroConselho.trim();
      if (salarioBase.trim()) dadosBrutos.salarioBase = salarioBase.trim();
      if (telefoneFixo.trim()) dadosBrutos.telefoneFixo = telefoneFixo.trim();
      if (complemento.trim()) dadosBrutos.complemento = complemento.trim();

      if (pisPasep.trim()) dadosBrutos.pisPasep = pisPasep.trim();
      if (ctpsNumero.trim()) dadosBrutos.ctpsNumero = ctpsNumero.trim();
      if (ctpsSerie.trim()) dadosBrutos.ctpsSerie = ctpsSerie.trim();
      if (banco.trim()) dadosBrutos.banco = banco.trim();
      if (agencia.trim()) dadosBrutos.agencia = agencia.trim();
      if (conta.trim()) dadosBrutos.conta = conta.trim();

      if (chavePix.trim()) {
        dadosBrutos.tipoChavePix = tipoChavePix;
        dadosBrutos.chavePix = chavePix.trim();
      }

      if (dataExameAdmissional) dadosBrutos.dataExameAdmissional = dataExameAdmissional;
      if (dataValidadeASO) dadosBrutos.dataValidadeASO = dataValidadeASO;

      if (Array.isArray(vacinasEmDia) && vacinasEmDia.length > 0) {
        dadosBrutos.vacinasEmDia = vacinasEmDia;
      }
      if (alergiasRestricoes.trim()) dadosBrutos.alergiasRestricoes = alergiasRestricoes.trim();
      if (tipoSanguineo) dadosBrutos.tipoSanguineo = tipoSanguineo;

      if (Array.isArray(qualificacoesCursos) && qualificacoesCursos.length > 0) {
        dadosBrutos.qualificacoesCursos = qualificacoesCursos;
      }
      if (observacoesGerais.trim()) dadosBrutos.observacoesGerais = observacoesGerais.trim();

      // Sanitização defensiva que garante ausência absoluta de campos com valor undefined
      const funcionarioData = sanitizarPayloadFuncionario(dadosBrutos);

      const result = await cadastrarFuncionarioNoFirebase(funcionarioData as any);

      const novoCriado: Funcionario = {
        ...(funcionarioData as any),
        id: result.id,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

      onSuccess(novoCriado);
      handleResetForm();
    } catch (err: any) {
      console.error('Erro ao cadastrar funcionário:', err);
      // Mensagem amigável sem vazar authInfo ou objetos internos
      setFormError(formatarErroAmigavel(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Fill button */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133827]/10 text-[#133827] text-xs font-bold mb-2">
            <Building2 className="w-3.5 h-3.5 text-[#dfb842]" />
            Victoria Lar Residencial &bull; Recursos Humanos & Admissão
          </div>
          <h2 className="text-xl sm:text-2xl font-serif-brand font-bold text-[#133827]">
            Ficha de Cadastro de Funcionário / Colaborador
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Preencha os dados completos do profissional para admissão, gestão de escalas, saúde ocupacional e folha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={preencherDadosExemplo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#133827] bg-[#dfb842]/20 hover:bg-[#dfb842]/30 border border-[#dfb842]/40 rounded-xl transition-all cursor-pointer"
            title="Preencher com dados fictícios de cuidadora profissional para testar rapidamente"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#b38b25]" />
            Preencher Dados de Exemplo
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
            title="Limpar todos os campos"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
            Limpar
          </button>
        </div>
      </div>

      {/* Form Error Banner */}
      {formError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold">Atenção no cadastro:</strong>
            <p className="mt-0.5 text-xs">{formError}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============================================================== */}
        {/* SEÇÃO 1: IDENTIFICAÇÃO PESSOAL & FOTO                          */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <User className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                1. Identificação Pessoal & Documentos Civis
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Obrigatório *
            </span>
          </div>

          {/* Photo & Main Identification Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Foto Upload Preview */}
            <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 text-center">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-stone-200 border-2 border-[#dfb842]/40 shadow-inner flex items-center justify-center relative mb-3">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto Colaborador" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-14 h-14 text-stone-400" />
                )}
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#133827] text-white hover:bg-[#1c4d37] rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                <Camera className="w-3.5 h-3.5 text-[#dfb842]" />
                {fotoUrl ? 'Alterar Foto' : 'Carregar Foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {fotoUrl && (
                <button
                  type="button"
                  onClick={() => setFotoUrl('')}
                  className="text-[10px] text-red-600 hover:underline mt-1.5 cursor-pointer"
                >
                  Remover foto
                </button>
              )}
              <span className="text-[10px] text-stone-400 mt-2">
                Formatos: JPG, PNG até 2MB
              </span>
            </div>

            {/* Input fields */}
            <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo do colaborador"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nome Social / Apelido
                </label>
                <input
                  type="text"
                  placeholder="Como prefere ser chamado(a)"
                  value={nomeSocial}
                  onChange={(e) => setNomeSocial(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  CPF *
                </label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  RG * & Órgão Emissor
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Número do RG"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                  />
                  <input
                    type="text"
                    placeholder="SSP/SP"
                    value={orgaoEmissor}
                    onChange={(e) => setOrgaoEmissor(e.target.value)}
                    className="w-24 px-2 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Data de Nascimento * {dataNascimento && `(${calcularIdade(dataNascimento)} anos)`}
                </label>
                <input
                  type="date"
                  required
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Sexo Biológico
                </label>
                <select
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value as Sexo)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                >
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                  <option value="outro">Outro / Prefere não declarar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Estado Civil
                </label>
                <select
                  value={estadoCivil}
                  onChange={(e) => setEstadoCivil(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                >
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="União Estável">União Estável</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nacionalidade
                </label>
                <input
                  type="text"
                  placeholder="Ex: Brasileira"
                  value={nacionalidade}
                  onChange={(e) => setNacionalidade(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Naturalidade (Cidade / UF)
                </label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo - SP"
                  value={naturalidade}
                  onChange={(e) => setNaturalidade(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Filiação (Nome da Mãe)
                </label>
                <input
                  type="text"
                  placeholder="Nome completo da mãe"
                  value={nomeMae}
                  onChange={(e) => setNomeMae(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Filiação (Nome do Pai)
                </label>
                <input
                  type="text"
                  placeholder="Nome completo do pai (opcional)"
                  value={nomePai}
                  onChange={(e) => setNomePai(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO 2: CARGO, DEPARTAMENTO & ESCALA NO VICTORIA LAR           */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <Briefcase className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                2. Cargo, Departamento & Escala de Trabalho (Victoria Lar Residencial)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Enquadramento Funcional
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Cargo / Função *
              </label>
              <select
                value={cargo}
                onChange={(e) => handleCargoChange(e.target.value as Cargo)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-semibold text-[#133827]"
              >
                {CARGOS_OPCOES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {cargo === 'Outro' && (
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Especifique a Função *
                </label>
                <input
                  type="text"
                  placeholder="Nome do cargo"
                  value={cargoPersonalizado}
                  onChange={(e) => setCargoPersonalizado(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Departamento / Setor *
              </label>
              <select
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value as Departamento)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              >
                {DEPARTAMENTOS_OPCOES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Registro no Conselho / CBO
              </label>
              <input
                type="text"
                placeholder="Ex: COREN-SP 123.456 / CBO 5162-10"
                value={registroConselho}
                onChange={(e) => setRegistroConselho(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Tipo de Contrato
              </label>
              <select
                value={tipoContrato}
                onChange={(e) => setTipoContrato(e.target.value as TipoContrato)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              >
                <option value="clt_integral">CLT Efetivo (44h semanais)</option>
                <option value="clt_parcial">CLT Tempo Parcial (30h/20h)</option>
                <option value="pj_prestador">PJ / Prestador de Serviços</option>
                <option value="autonomo_plantonista">Autônomo / Plantonista</option>
                <option value="estagio">Estágio Remunerado</option>
                <option value="temporario">Temporário</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Regime / Escala de Trabalho
              </label>
              <select
                value={escalaTrabalho}
                onChange={(e) => setEscalaTrabalho(e.target.value as EscalaTrabalho)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              >
                <option value="12x36_diurno">12x36 Diurno (07h às 19h)</option>
                <option value="12x36_noturno">12x36 Noturno (19h às 07h)</option>
                <option value="6x1">6x1 (Escala com folga semanal)</option>
                <option value="5x2">5x2 (Segunda a Sexta - Comercial)</option>
                <option value="plantonista">Plantonista / Folguista</option>
                <option value="horista">Horista / Dias Fixos</option>
                <option value="outro">Outro Regime</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Turno Principal
              </label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              >
                <option value="Plantão 12h">Plantão 12h</option>
                <option value="Manhã">Manhã (07h às 15h20)</option>
                <option value="Tarde">Tarde (13h40 às 22h00)</option>
                <option value="Noite">Noite (22h às 06h)</option>
                <option value="Comercial">Comercial (08h às 18h)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Data de Admissão *
              </label>
              <input
                type="date"
                required
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Matrícula Interna (ID)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono font-bold text-[#133827]"
                />
                <button
                  type="button"
                  onClick={() => setMatricula(`VLR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`)}
                  className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold"
                  title="Gerar nova matrícula"
                >
                  Gerar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Salário Base / Remuneração
              </label>
              <input
                type="text"
                placeholder="R$ 0.000,00"
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Status Atual do Colaborador
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFuncionario)}
                className={`w-full px-3.5 py-2.5 text-sm border rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#133827] ${
                  status === 'ativo'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : status === 'ferias'
                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                    : status === 'afastado'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-stone-100 text-stone-600 border-stone-300'
                }`}
              >
                <option value="ativo">Ativo no Quadro</option>
                <option value="ferias">Em Férias</option>
                <option value="afastado">Afastado / Licença Médica</option>
                <option value="desligado">Desligado / Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO 3: CONTATOS & ENDEREÇO RESIDENCIAL                       */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <Phone className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                3. Meios de Contato & Endereço Residencial
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Localização & Notificações
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Celular / WhatsApp *
              </label>
              <input
                type="text"
                required
                placeholder="(11) 90000-0000"
                value={celularWhatsApp}
                onChange={(e) => setCelularWhatsApp(formatPhone(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Telefone Residencial / Recado
              </label>
              <input
                type="text"
                placeholder="(11) 3000-0000"
                value={telefoneFixo}
                onChange={(e) => setTelefoneFixo(formatPhone(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                E-mail *
              </label>
              <input
                type="email"
                required
                placeholder="colaborador@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                CEP (Busca Automática) *
              </label>
              <input
                type="text"
                required
                placeholder="00000-000"
                value={cep}
                onChange={handleCepChange}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Logradouro (Rua, Avenida, Praça) *
              </label>
              <input
                type="text"
                required
                placeholder="Nome da rua ou avenida"
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Número *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 123"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Complemento
              </label>
              <input
                type="text"
                placeholder="Apto, Bloco, Casa 2"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Bairro *
              </label>
              <input
                type="text"
                required
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Cidade & UF *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
                <input
                  type="text"
                  required
                  placeholder="SP"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-16 px-2 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] text-center uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO 4: CONTATO DE EMERGÊNCIA                                 */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <AlertTriangle className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                4. Contato de Emergência
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Segurança do Colaborador &bull; Obrigatório *
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Nome do Contato *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Alberto (Esposo)"
                value={nomeContatoEmergencia}
                onChange={(e) => setNomeContatoEmergencia(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Grau de Parentesco / Relação *
              </label>
              <input
                type="text"
                required
                placeholder="Cônjuge, Mãe, Filho(a), Irmão"
                value={parentescoEmergencia}
                onChange={(e) => setParentescoEmergencia(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Telefone de Emergência *
              </label>
              <input
                type="text"
                required
                placeholder="(11) 90000-0000"
                value={telefoneEmergencia}
                onChange={(e) => setTelefoneEmergencia(formatPhone(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO 5: DOCUMENTOS TRABALHISTAS & DADOS BANCÁRIOS            */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <CreditCard className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                5. Documentação Trabalhista & Dados Bancários (Pagamento)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Folha & PIX
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                PIS / PASEP / NIT
              </label>
              <input
                type="text"
                placeholder="000.00000.00-0"
                value={pisPasep}
                onChange={(e) => setPisPasep(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Número CTPS
              </label>
              <input
                type="text"
                placeholder="Nº da Carteira de Trabalho"
                value={ctpsNumero}
                onChange={(e) => setCtpsNumero(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Série / UF CTPS
              </label>
              <input
                type="text"
                placeholder="0001-SP"
                value={ctpsSerie}
                onChange={(e) => setCtpsSerie(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Banco
              </label>
              <input
                type="text"
                placeholder="Ex: Itaú, Bradesco, Nubank"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Agência Bancária
              </label>
              <input
                type="text"
                placeholder="Agência (com dígito)"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Conta Corrente / Salário
              </label>
              <input
                type="text"
                placeholder="Nº da Conta com dígito"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Tipo da Chave PIX
              </label>
              <select
                value={tipoChavePix}
                onChange={(e) => setTipoChavePix(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              >
                <option value="cpf">CPF</option>
                <option value="telefone">Celular</option>
                <option value="email">E-mail</option>
                <option value="aleatoria">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Chave PIX
              </label>
              <input
                type="text"
                placeholder="Chave para transferências"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO 6: SAÚDE OCUPACIONAL & SEGURANÇA EM ILPI                  */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <HeartPulse className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                6. Saúde Ocupacional & Segurança (Ambiente Residencial Geriátrico)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              ASO & Vacinação Obrigatória
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Data do ASO (Exame Admissional)
              </label>
              <input
                type="date"
                value={dataExameAdmissional}
                onChange={(e) => setDataExameAdmissional(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Validade do ASO / Periódico
              </label>
              <input
                type="date"
                value={dataValidadeASO}
                onChange={(e) => setDataValidadeASO(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Tipo Sanguíneo & Fator Rh
              </label>
              <select
                value={tipoSanguineo}
                onChange={(e) => setTipoSanguineo(e.target.value as TipoSanguineo)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] font-bold"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="Desconhecido">Não Informado</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Carteira de Vacinação do Colaborador (Protocolo ILPI Victoria Lar)
              </label>
              <p className="text-xs text-stone-500 mb-2.5">
                Em instituições de longa permanência para idosos, a imunização atualizada é essencial para proteger residentes vulneráveis.
              </p>

              {/* Tag list */}
              <div className="flex flex-wrap gap-2 mb-3">
                {vacinasEmDia.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {v}
                    <button
                      type="button"
                      onClick={() => removerVacina(v)}
                      className="ml-1 text-emerald-700 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              {/* Add vacina input & quick chips */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Nome de outra vacina recebida"
                  value={novaVacinaInput}
                  onChange={(e) => setNovaVacinaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarVacina();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
                />
                <button
                  type="button"
                  onClick={adicionarVacina}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-[#133827] text-white hover:bg-[#1a4d3d] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#dfb842]" />
                  Adicionar
                </button>
              </div>

              {/* Suggestions chips */}
              <div className="flex flex-wrap gap-1.5 text-[11px] text-stone-500">
                <span className="font-semibold text-stone-600">Sugestões rápidas:</span>
                {VACINAS_PADRAO.filter((v) => !vacinasEmDia.includes(v)).map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => setVacinasEmDia([...vacinasEmDia, sugestao])}
                    className="px-2 py-0.5 bg-stone-100 hover:bg-[#dfb842]/20 hover:text-[#133827] border border-stone-200 rounded-md transition-colors cursor-pointer"
                  >
                    + {sugestao}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Alergias, Restrições ou Condições Especiais de Saúde
              </label>
              <input
                type="text"
                placeholder="Ex: Alergia a látex, intolerância a determinados produtos de limpeza, restrição de levantamento de peso excessivo..."
                value={alergiasRestricoes}
                onChange={(e) => setAlergiasRestricoes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO 7: CURSOS, QUALIFICAÇÕES & OBSERVAÇÕES                   */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <GraduationCap className="w-4 h-4 text-[#dfb842]" />
              </div>
              <h3 className="font-serif-brand font-bold text-base sm:text-lg text-[#133827]">
                7. Qualificações, Certificações & Observações Internas
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Histórico & Competências
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Cursos e Treinamentos Realizados
            </label>

            {/* Chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {qualificacoesCursos.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#dfb842]/15 text-[#133827] border border-[#dfb842]/40 rounded-lg text-xs font-semibold"
                >
                  <FileBadge className="w-3.5 h-3.5 text-[#b38b25]" />
                  {c}
                  <button
                    type="button"
                    onClick={() => removerCurso(c)}
                    className="ml-1 text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Título do curso ou certificação adicional"
                value={novoCursoInput}
                onChange={(e) => setNovoCursoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    adicionarCurso();
                  }
                }}
                className="flex-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
              />
              <button
                type="button"
                onClick={adicionarCurso}
                className="inline-flex items-center gap-1 px-3 py-2 bg-[#133827] text-white hover:bg-[#1a4d3d] rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#dfb842]" />
                Adicionar Curso
              </button>
            </div>

            {/* Suggestions chips */}
            <div className="flex flex-wrap gap-1.5 text-[11px] text-stone-500">
              <span className="font-semibold text-stone-600">Recomendados para ILPI:</span>
              {CURSOS_SUGESTOES.filter((c) => !qualificacoesCursos.includes(c)).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setQualificacoesCursos([...qualificacoesCursos, sug])}
                  className="px-2 py-0.5 bg-stone-100 hover:bg-[#dfb842]/20 hover:text-[#133827] border border-stone-200 rounded-md transition-colors cursor-pointer"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Observações Gerais & Histórico Interno
            </label>
            <textarea
              rows={3}
              placeholder="Descreva detalhes adicionais, escala preferencial, histórico de entrevistas, competências específicas ou peculiaridades do colaborador..."
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827] resize-y"
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* SUBMIT BUTTON & ACTIONS BAR                                    */}
        {/* ============================================================== */}
        <div className="bg-[#133827] rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#dfb842]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base">
                Pronto para registrar o colaborador?
              </h4>
              <p className="text-xs text-stone-300">
                {isFirebaseConnected
                  ? 'Os dados serão sincronizados diretamente no banco de dados Firestore da Victoria Lar.'
                  : 'Os dados serão salvos com segurança no repositório com suporte a sincronização Firestore.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-4 py-3 rounded-xl border border-white/20 text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer w-1/3 sm:w-auto text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-7 py-3 bg-[#dfb842] hover:bg-[#cda432] text-[#133827] rounded-xl font-bold text-sm shadow-md transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-[#133827]" />
              {submitting ? 'Salvando Cadastro...' : 'Salvar Funcionário na Victoria Lar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
