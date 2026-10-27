import React, { useState } from 'react';
import {
  X,
  Printer,
  User,
  Briefcase,
  Phone,
  Home,
  ShieldAlert,
  CreditCard,
  HeartPulse,
  GraduationCap,
  Calendar,
  Clock,
  Building2,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Funcionario, StatusFuncionario } from '../../types/employee';
import { VictoriaLogo } from '../VictoriaLogo';
import { atualizarFuncionarioNoFirebase } from '../../services/colaboradoresService';

interface EmployeeDetailsModalProps {
  funcionario: Funcionario | null;
  onClose: () => void;
  onStatusChange?: (id: string, novoStatus: StatusFuncionario) => void;
}

export const EmployeeDetailsModal: React.FC<EmployeeDetailsModalProps> = ({
  funcionario,
  onClose,
  onStatusChange,
}) => {
  const [currentStatus, setCurrentStatus] = useState<StatusFuncionario | undefined>(funcionario?.status);
  const [savingStatus, setSavingStatus] = useState(false);

  if (!funcionario) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateStatus = async (novoStatus: StatusFuncionario) => {
    setSavingStatus(true);
    setCurrentStatus(novoStatus);
    try {
      await atualizarFuncionarioNoFirebase(funcionario.id, { status: novoStatus });
      if (onStatusChange) {
        onStatusChange(funcionario.id, novoStatus);
      }
    } catch (e) {
      console.warn('Erro ao atualizar status:', e);
    } finally {
      setSavingStatus(false);
    }
  };

  const statusColors = {
    ativo: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    ferias: 'bg-blue-100 text-blue-800 border-blue-300',
    afastado: 'bg-amber-100 text-amber-800 border-amber-300',
    desligado: 'bg-stone-200 text-stone-700 border-stone-300',
  }[currentStatus || funcionario.status];

  const statusLabel = {
    ativo: 'Ativo no Quadro',
    ferias: 'Em Férias',
    afastado: 'Afastado / Licença',
    desligado: 'Desligado',
  }[currentStatus || funcionario.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Modal Topbar (Hidden in print) */}
        <div className="bg-[#133827] text-white px-6 py-3.5 flex items-center justify-between no-print border-b border-[#214f3b]">
          <div className="flex items-center gap-3">
            <VictoriaLogo size="sm" />
            <div className="h-4 w-px bg-white/20" />
            <span className="font-serif-brand font-bold text-sm sm:text-base">
              Ficha Funcional do Colaborador
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#dfb842] text-[#133827] hover:bg-[#cfa631] font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Imprimir Ficha Completa"
            >
              <Printer className="w-3.5 h-3.5 text-[#133827]" />
              <span className="hidden sm:inline">Imprimir Ficha</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-stone-800 print-card">
          {/* Official Letterhead Header for Print and Screen */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b-2 border-[#133827] pb-6">
            <div className="flex items-center gap-4">
              <VictoriaLogo size="lg" />
              <div>
                <h1 className="font-serif-brand text-xl sm:text-2xl font-bold text-[#133827] leading-tight">
                  Victoria Lar Residencial
                </h1>
                <p className="text-xs text-stone-500 font-sans">
                  Instituição de Longa Permanência para Idosos &bull; Gestão de Pessoas
                </p>
                <p className="text-[11px] text-[#dfb842] font-semibold mt-0.5">
                  FICHA CADASTRAL E FUNCIONAL DE COLABORADOR
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right flex flex-col items-center sm:items-end">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-1.5 capitalize font-mono">
                <span className={`w-2 h-2 rounded-full ${currentStatus === 'ativo' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {statusLabel}
              </div>
              <p className="text-xs text-stone-600 font-mono">
                Matrícula: <strong className="text-[#133827]">{funcionario.matricula}</strong>
              </p>
              <p className="text-[11px] text-stone-400">
                Admissão: {new Date(funcionario.dataAdmissao).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Quick status selector (no-print) */}
          <div className="no-print bg-stone-50 border border-stone-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-stone-600">
              <span className="font-semibold text-stone-700">Alterar Status Rápido:</span>
              <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${statusColors}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['ativo', 'ferias', 'afastado', 'desligado'] as StatusFuncionario[]).map((st) => (
                <button
                  key={st}
                  disabled={savingStatus}
                  onClick={() => handleUpdateStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    (currentStatus || funcionario.status) === st
                      ? 'bg-[#133827] text-white border-[#133827]'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Main Profile Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Foto e Resumo */}
            <div className="md:col-span-3 flex flex-col items-center text-center p-4 rounded-xl bg-stone-50 border border-stone-200">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-stone-200 border-2 border-[#dfb842]/50 shadow-sm flex items-center justify-center mb-3">
                {funcionario.fotoUrl ? (
                  <img src={funcionario.fotoUrl} alt={funcionario.nomeCompleto} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-14 h-14 text-stone-400" />
                )}
              </div>
              <h2 className="font-serif-brand font-bold text-base text-[#133827]">
                {funcionario.nomeCompleto}
              </h2>
              {funcionario.nomeSocial && (
                <p className="text-xs text-stone-500 italic">
                  "{funcionario.nomeSocial}"
                </p>
              )}
              <span className="mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#dfb842]/20 text-[#133827]">
                {funcionario.cargo}
              </span>
              <p className="text-[11px] text-stone-500 mt-1">
                {funcionario.departamento}
              </p>
            </div>

            {/* Dados Pessoais & Documentos */}
            <div className="md:col-span-9 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">CPF</span>
                  <span className="font-mono font-semibold text-stone-800">{funcionario.cpf}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">RG / Órgão</span>
                  <span className="font-semibold text-stone-800">{funcionario.rg || 'Não informado'} {funcionario.orgaoEmissor}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Nascimento & Idade</span>
                  <span className="font-semibold text-stone-800">
                    {funcionario.dataNascimento ? new Date(funcionario.dataNascimento).toLocaleDateString('pt-BR') : '-'}
                    {funcionario.idade ? ` (${funcionario.idade} anos)` : ''}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Estado Civil</span>
                  <span className="font-semibold text-stone-800">{funcionario.estadoCivil}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Sexo Biológico</span>
                  <span className="font-semibold text-stone-800 capitalize">{funcionario.sexo}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Nacionalidade / Origem</span>
                  <span className="font-semibold text-stone-800">{funcionario.nacionalidade || 'Brasileira'} {funcionario.naturalidade ? `(${funcionario.naturalidade})` : ''}</span>
                </div>
              </div>

              {(funcionario.nomeMae || funcionario.nomePai) && (
                <div className="text-xs p-3 rounded-lg bg-stone-50 border border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Mãe</span>
                    <span className="font-medium text-stone-800">{funcionario.nomeMae || 'Não informada'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Pai</span>
                    <span className="font-medium text-stone-800">{funcionario.nomePai || 'Não informado'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dados Contratuais, Escala & Conselho */}
          <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#133827] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#dfb842]" />
              Dados do Cargo, Escala & Regime Trabalhista
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Função Contratada</span>
                <span className="font-semibold text-stone-800">{funcionario.cargo === 'Outro' ? funcionario.cargoPersonalizado : funcionario.cargo}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Setor / Departamento</span>
                <span className="font-semibold text-stone-800">{funcionario.departamento}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Regime de Escala</span>
                <span className="font-semibold text-stone-800 uppercase">{funcionario.escalaTrabalho.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Turno de Trabalho</span>
                <span className="font-semibold text-stone-800">{funcionario.turno || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Tipo de Contrato</span>
                <span className="font-semibold text-stone-800 uppercase">{funcionario.tipoContrato.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Registro no Conselho / CBO</span>
                <span className="font-semibold text-stone-800">{funcionario.registroConselho || 'Sem conselho requerido'}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Salário Base</span>
                <span className="font-semibold text-stone-800">{funcionario.salarioBase || 'Confidencial / RH'}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">Admissão</span>
                <span className="font-semibold text-stone-800">{new Date(funcionario.dataAdmissao).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Contatos, Endereço & Emergência */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Endereço & Contato */}
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-2.5 text-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#133827] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#dfb842]" />
                Contatos & Endereço Residencial
              </h3>
              <p>
                <strong>Celular / WhatsApp:</strong> <span className="font-mono">{funcionario.celularWhatsApp}</span>
              </p>
              {funcionario.telefoneFixo && (
                <p>
                  <strong>Telefone Fixo / Recado:</strong> <span className="font-mono">{funcionario.telefoneFixo}</span>
                </p>
              )}
              {funcionario.email && (
                <p>
                  <strong>E-mail:</strong> {funcionario.email}
                </p>
              )}
              <div className="pt-1.5 border-t border-stone-200 text-stone-600">
                <p>
                  <strong>Logradouro:</strong> {funcionario.logradouro}, {funcionario.numero} {funcionario.complemento ? `(${funcionario.complemento})` : ''}
                </p>
                <p>
                  <strong>Bairro / Cidade:</strong> {funcionario.bairro} - {funcionario.cidade}/{funcionario.estado}
                </p>
                <p>
                  <strong>CEP:</strong> <span className="font-mono">{funcionario.cep}</span>
                </p>
              </div>
            </div>

            {/* Emergência & Bancário */}
            <div className="space-y-4">
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-2 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#133827] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  Contato de Emergência
                </h3>
                <p>
                  <strong>Nome do Contato:</strong> {funcionario.nomeContatoEmergencia || 'Não informado'}
                </p>
                <p>
                  <strong>Parentesco:</strong> {funcionario.parentescoEmergencia || 'Não informado'}
                </p>
                <p>
                  <strong>Telefone Emergência:</strong> <span className="font-mono font-bold text-red-700">{funcionario.telefoneEmergencia || 'Não informado'}</span>
                </p>
              </div>

              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-1.5 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#133827] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#dfb842]" />
                  Dados de Pagamento & Bancários
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase block">Banco / Agência</span>
                    <span className="font-medium text-stone-800">{funcionario.banco || '-'} / Ag: {funcionario.agencia || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase block">Conta Bancária</span>
                    <span className="font-medium text-stone-800">{funcionario.conta || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-stone-500 uppercase block">Chave PIX ({funcionario.tipoChavePix})</span>
                    <span className="font-mono font-bold text-[#133827]">{funcionario.chavePix || 'Não informada'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Saúde Ocupacional & Vacinação ILPI */}
          <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#133827] flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-[#dfb842]" />
                Saúde Ocupacional, ASO & Protocolo de Vacinas ILPI
              </h3>
              <span className="text-xs font-bold text-[#133827]">
                Tipo Sanguíneo: <span className="px-2 py-0.5 rounded bg-[#dfb842]/20 font-mono">{funcionario.tipoSanguineo || 'N/A'}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <strong>ASO Realizado:</strong> {funcionario.dataExameAdmissional ? new Date(funcionario.dataExameAdmissional).toLocaleDateString('pt-BR') : 'Pendente'}
              </div>
              <div>
                <strong>Validade do Exame Periódico:</strong> {funcionario.dataValidadeASO ? new Date(funcionario.dataValidadeASO).toLocaleDateString('pt-BR') : 'Não especificada'}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-stone-500 uppercase font-bold block mb-1.5">
                Vacinas Registradas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {funcionario.vacinasEmDia && funcionario.vacinasEmDia.length > 0 ? (
                  funcionario.vacinasEmDia.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md text-xs font-medium"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {v}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-amber-700 italic">Nenhuma vacina registrada ainda.</span>
                )}
              </div>
            </div>

            {funcionario.alergiasRestricoes && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>Alergias / Restrições Médicas:</strong> {funcionario.alergiasRestricoes}
              </div>
            )}
          </div>

          {/* Qualificações & Observações */}
          {(funcionario.qualificacoesCursos?.length || funcionario.observacoesGerais) && (
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#133827] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#dfb842]" />
                Cursos, Certificações & Observações
              </h3>

              {funcionario.qualificacoesCursos && funcionario.qualificacoesCursos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {funcionario.qualificacoesCursos.map((c) => (
                    <span
                      key={c}
                      className="px-2.5 py-1 bg-stone-100 text-stone-800 border border-stone-200 rounded-md text-xs font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {funcionario.observacoesGerais && (
                <p className="text-xs text-stone-700 bg-white p-3 rounded-lg border border-stone-200 whitespace-pre-wrap leading-relaxed">
                  {funcionario.observacoesGerais}
                </p>
              )}
            </div>
          )}

          {/* Signatures footer for print */}
          <div className="print-only pt-12 mt-8 border-t border-stone-300">
            <div className="grid grid-cols-2 gap-12 text-center text-xs">
              <div className="border-t border-stone-400 pt-2">
                <p className="font-bold text-stone-800">{funcionario.nomeCompleto}</p>
                <p className="text-stone-500">Assinatura do Colaborador</p>
              </div>
              <div className="border-t border-stone-400 pt-2">
                <p className="font-bold text-stone-800">Victoria Lar Residencial</p>
                <p className="text-stone-500">Coordenação / Recursos Humanos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex items-center justify-between no-print">
          <span className="text-xs text-stone-500">
            Última atualização: {new Date(funcionario.atualizadoEm || funcionario.criadoEm).toLocaleString('pt-BR')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#133827] hover:bg-[#1a4d3d] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
