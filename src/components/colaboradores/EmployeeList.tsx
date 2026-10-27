import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Filter,
  List as ListIcon,
  Grid,
  Trash2,
  Eye,
  Printer,
  Download,
  PlusCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building2,
  HeartPulse,
  ArrowDownAZ,
  ArrowUpAZ,
  ExternalLink
} from 'lucide-react';
import { Funcionario, Departamento, StatusFuncionario } from '../../types/employee';
import { excluirFuncionarioNoFirebase } from '../../services/colaboradoresService';

interface EmployeeListProps {
  funcionarios: Funcionario[];
  isLoading: boolean;
  onSelectFuncionario: (funcionario: Funcionario) => void;
  onNewEmployeeClick: () => void;
  onRefresh: () => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  funcionarios,
  isLoading,
  onSelectFuncionario,
  onNewEmployeeClick,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  // Default view mode is explicitly 'table' (lista)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedLetter, setSelectedLetter] = useState<string>('todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Statistics
  const stats = useMemo(() => {
    const total = funcionarios.length;
    const ativos = funcionarios.filter((f) => f.status === 'ativo').length;
    const enfermagemCuidados = funcionarios.filter(
      (f) => f.departamento === 'Cuidados & Enfermagem'
    ).length;
    const ausentes = funcionarios.filter(
      (f) => f.status === 'ferias' || f.status === 'afastado'
    ).length;
    return { total, ativos, enfermagemCuidados, ausentes };
  }, [funcionarios]);

  // Available initial letters
  const alphabetLetters = useMemo(() => {
    const lettersSet = new Set<string>();
    funcionarios.forEach((f) => {
      const initial = f.nomeCompleto.trim().charAt(0).toUpperCase();
      if (initial) lettersSet.add(initial);
    });
    return Array.from(lettersSet).sort();
  }, [funcionarios]);

  // Filtering & Alphabetical Sorting
  const filteredFuncionarios = useMemo(() => {
    const filtered = funcionarios.filter((f) => {
      // Search
      const search = searchTerm.toLowerCase().trim();
      const matchSearch =
        !search ||
        f.nomeCompleto.toLowerCase().includes(search) ||
        (f.nomeSocial && f.nomeSocial.toLowerCase().includes(search)) ||
        f.cpf.includes(search) ||
        f.cargo.toLowerCase().includes(search) ||
        f.matricula.toLowerCase().includes(search) ||
        f.celularWhatsApp.includes(search);

      // Dept filter
      const matchDept =
        selectedDepartamento === 'todos' || f.departamento === selectedDepartamento;

      // Status filter
      const matchStatus =
        selectedStatus === 'todos' || f.status === selectedStatus;

      // Letter filter
      const matchLetter =
        selectedLetter === 'todos' ||
        f.nomeCompleto.trim().toUpperCase().startsWith(selectedLetter);

      return matchSearch && matchDept && matchStatus && matchLetter;
    });

    // Explicit alphabetical sorting (A-Z or Z-A)
    return filtered.sort((a, b) => {
      const comparison = a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR', {
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [funcionarios, searchTerm, selectedDepartamento, selectedStatus, selectedLetter, sortOrder]);

  const handleDelete = async (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja remover o cadastro de ${nome}?`)) {
      setDeletingId(id);
      try {
        await excluirFuncionarioNoFirebase(id);
      } catch (err) {
        console.error('Erro ao excluir:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Matricula',
      'Nome Completo',
      'CPF',
      'Cargo',
      'Departamento',
      'Status',
      'Escala',
      'Turno',
      'Telefone',
      'Email',
      'Data Admissao'
    ];
    const rows = filteredFuncionarios.map((f) => [
      f.matricula,
      `"${f.nomeCompleto}"`,
      f.cpf,
      `"${f.cargo}"`,
      `"${f.departamento}"`,
      f.status,
      f.escalaTrabalho,
      f.turno || '',
      f.celularWhatsApp,
      f.email,
      f.dataAdmissao
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `funcionarios_victoria_lar_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusBadge = (status: StatusFuncionario) => {
    const map = {
      ativo: { text: 'Ativo', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
      ferias: { text: 'Em Férias', bg: 'bg-blue-50 text-blue-800 border-blue-300' },
      afastado: { text: 'Afastado', bg: 'bg-amber-50 text-amber-800 border-amber-300' },
      desligado: { text: 'Desligado', bg: 'bg-stone-100 text-stone-600 border-stone-300' },
    }[status] || { text: status, bg: 'bg-stone-100 text-stone-700 border-stone-200' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${map.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'ativo' ? 'bg-emerald-500' : status === 'ferias' ? 'bg-blue-500' : 'bg-amber-500'
        }`} />
        {map.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#133827]/10 flex items-center justify-center text-[#133827] shrink-0">
            <Users className="w-6 h-6 text-[#dfb842]" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              Total Quadro
            </p>
            <h3 className="text-xl sm:text-2xl font-bold font-serif-brand text-[#133827]">
              {stats.total}
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              Ativos em Escala
            </p>
            <h3 className="text-xl sm:text-2xl font-bold font-serif-brand text-emerald-700">
              {stats.ativos}
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#dfb842]/20 flex items-center justify-center text-[#133827] shrink-0">
            <HeartPulse className="w-6 h-6 text-[#b38b25]" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              Cuidados & Saúde
            </p>
            <h3 className="text-xl sm:text-2xl font-bold font-serif-brand text-[#133827]">
              {stats.enfermagemCuidados}
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              Férias / Afastados
            </p>
            <h3 className="text-xl sm:text-2xl font-bold font-serif-brand text-amber-700">
              {stats.ausentes}
            </h3>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Alphabetical Order & Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-stone-200/80 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar colaborador por nome, cargo, CPF, matrícula ou WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                &times;
              </button>
            )}
          </div>

          {/* Action buttons & views */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort Toggle (A-Z / Z-A) */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#133827] bg-[#dfb842]/20 hover:bg-[#dfb842]/30 border border-[#dfb842]/40 rounded-xl transition-colors cursor-pointer"
              title={sortOrder === 'asc' ? 'Ordenado de A a Z. Clique para inverter' : 'Ordenado de Z a A. Clique para inverter'}
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowDownAZ className="w-4 h-4 text-[#b38b25]" />
                  <span>Ordem A &rarr; Z</span>
                </>
              ) : (
                <>
                  <ArrowUpAZ className="w-4 h-4 text-[#b38b25]" />
                  <span>Ordem Z &rarr; A</span>
                </>
              )}
            </button>

            <button
              onClick={onRefresh}
              className="p-2.5 text-stone-600 hover:text-[#133827] hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
              title="Exportar para planilha CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            {/* View Switcher: Lista vs Cards */}
            <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden bg-stone-50 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#133827] shadow-xs font-bold'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
                title="Visualização em Lista Resumida"
              >
                <ListIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#133827] shadow-xs font-bold'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
                title="Visualização em Cards"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <button
              onClick={onNewEmployeeClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#133827] text-white hover:bg-[#1c4d37] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#dfb842]" />
              Novo Cadastro
            </button>
          </div>
        </div>

        {/* Alphabet quick letters bar */}
        {alphabetLetters.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100 text-xs overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 mr-1">
              Índice Alfabético:
            </span>
            <button
              onClick={() => setSelectedLetter('todos')}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedLetter === 'todos'
                  ? 'bg-[#133827] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Todos ({funcionarios.length})
            </button>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
              const hasEmployees = alphabetLetters.includes(letter);
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  disabled={!hasEmployees}
                  onClick={() => setSelectedLetter(letter)}
                  className={`w-6 h-6 rounded-md text-xs font-bold shrink-0 transition-colors flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#133827] text-[#dfb842]'
                      : hasEmployees
                      ? 'bg-stone-100 text-[#133827] hover:bg-[#dfb842]/20 font-bold'
                      : 'text-stone-300 opacity-40 cursor-not-allowed'
                  }`}
                  title={hasEmployees ? `Filtrar colaboradores que começam com ${letter}` : `Nenhum colaborador com a letra ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-1 text-stone-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Departamento:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'Cuidados & Enfermagem', label: 'Cuidados & Enfermagem' },
              { id: 'Equipe Multidisciplinar / Saúde', label: 'Multidisciplinar' },
              { id: 'Cozinha & Nutrição', label: 'Cozinha & Nutrição' },
              { id: 'Higienização & Hotelaria', label: 'Hotelaria & Limpeza' },
              { id: 'Administração & RH', label: 'Administração' },
            ].map((dep) => (
              <button
                key={dep.id}
                onClick={() => setSelectedDepartamento(dep.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDepartamento === dep.id
                    ? 'bg-[#133827] text-white font-bold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {dep.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-stone-200 hidden sm:block" />

          {/* Status selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-semibold">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-stone-100 border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 font-semibold"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Apenas Ativos</option>
              <option value="ferias">Em Férias</option>
              <option value="afastado">Afastados</option>
              <option value="desligado">Desligados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-stone-500 space-y-2">
          <RefreshCw className="w-7 h-7 animate-spin text-[#133827]" />
          <p className="text-xs font-semibold">Carregando quadro de colaboradores...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredFuncionarios.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-stone-300 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#133827]/10 flex items-center justify-center text-[#133827] mx-auto">
            <Users className="w-8 h-8 text-[#dfb842]" />
          </div>
          <div>
            <h3 className="font-serif-brand font-bold text-lg text-[#133827]">
              Nenhum colaborador encontrado
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {searchTerm || selectedDepartamento !== 'todos' || selectedStatus !== 'todos' || selectedLetter !== 'todos'
                ? 'Tente ajustar os filtros, a letra selecionada ou os termos da busca.'
                : 'Cadastre os profissionais da Victoria Lar para iniciar o controle da equipe.'}
            </p>
          </div>
          <button
            onClick={onNewEmployeeClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#133827] hover:bg-[#1a4d3d] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#dfb842]" />
            Cadastrar Colaborador
          </button>
        </div>
      )}

      {/* LIST / TABLE VIEW (Default view, formatted as structured alphabetical employee directory list) */}
      {!isLoading && viewMode === 'table' && filteredFuncionarios.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200/80 overflow-hidden">
          {/* Header of the list with alphabetical count */}
          <div className="bg-[#133827] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#214f3b]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[#dfb842]">
                <ArrowDownAZ className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif-brand font-bold text-sm text-white">
                  Resumo Geral do Quadro de Colaboradores
                </h4>
                <p className="text-[11px] text-stone-300">
                  Listagem ordenada alfabeticamente ({sortOrder === 'asc' ? 'A &rarr; Z' : 'Z &rarr; A'}) &bull; {filteredFuncionarios.length} colaboradores exibidos
                </p>
              </div>
            </div>

            <div className="text-xs font-mono text-[#dfb842] bg-black/20 px-3 py-1 rounded-full border border-white/10">
              Ordem Alfabética Ativa
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-100 text-stone-600 uppercase text-[10px] tracking-wider font-bold border-b border-stone-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Colaborador / Matrícula</th>
                  <th className="py-3.5 px-4">Cargo / Função</th>
                  <th className="py-3.5 px-4">Departamento</th>
                  <th className="py-3.5 px-4">Escala / Turno</th>
                  <th className="py-3.5 px-4">Contato (WhatsApp)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredFuncionarios.map((f, index) => (
                  <tr
                    key={f.id}
                    onClick={() => onSelectFuncionario(f)}
                    className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Number Index */}
                    <td className="py-3 px-4 text-center text-stone-400 font-mono text-[11px]">
                      {index + 1}
                    </td>

                    {/* Name, Social Name, Photo, and Matricula */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-100 border border-[#dfb842]/40 shrink-0 flex items-center justify-center">
                          {f.fotoUrl ? (
                            <img src={f.fotoUrl} alt={f.nomeCompleto} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-xs text-[#133827]">
                              {f.nomeCompleto.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900 group-hover:text-[#133827] transition-colors flex items-center gap-2">
                            <span>{f.nomeCompleto}</span>
                            {f.nomeSocial && (
                              <span className="text-[10px] text-stone-500 italic bg-stone-100 px-1.5 py-0.5 rounded">
                                "{f.nomeSocial}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono mt-0.5">
                            <span className="text-[#133827] font-semibold">{f.matricula}</span>
                            <span>&bull;</span>
                            <span>CPF: {f.cpf}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#dfb842] shrink-0" />
                        <span>{f.cargo === 'Outro' ? f.cargoPersonalizado : f.cargo}</span>
                      </div>
                      {f.registroConselho && (
                        <span className="text-[10px] text-stone-500 font-mono block mt-0.5">
                          {f.registroConselho}
                        </span>
                      )}
                    </td>

                    {/* Departamento */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700">
                        {f.departamento}
                      </span>
                    </td>

                    {/* Escala & Turno */}
                    <td className="py-3 px-4">
                      <div className="text-stone-800 font-semibold uppercase text-[11px]">
                        {f.escalaTrabalho.replace('_', ' ')}
                      </div>
                      <span className="text-[10px] text-stone-500">
                        Turno: {f.turno || 'Geral'}
                      </span>
                    </td>

                    {/* Telefone / WhatsApp */}
                    <td className="py-3 px-4">
                      <a
                        href={`https://wa.me/55${f.celularWhatsApp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-mono text-emerald-800 hover:text-emerald-950 font-semibold hover:underline"
                        title="Conversar no WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{f.celularWhatsApp}</span>
                      </a>
                      {f.email && (
                        <span className="text-[10px] text-stone-400 block truncate max-w-[150px]">
                          {f.email}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {statusBadge(f.status)}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFuncionario(f);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#133827] bg-[#dfb842]/20 hover:bg-[#dfb842]/40 rounded-lg transition-colors cursor-pointer"
                          title="Ver Ficha Funcional Completa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ficha</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, f.id, f.nomeCompleto)}
                          disabled={deletingId === f.id}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* List Footer with count */}
          <div className="bg-stone-50 px-5 py-3 border-t border-stone-200 text-xs text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Mostrando <strong>{filteredFuncionarios.length}</strong> de <strong>{funcionarios.length}</strong> colaboradores cadastrados
            </span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-emerald-700">
                {stats.ativos} ativos
              </span>
              <span>&bull;</span>
              <span className="font-semibold text-amber-700">
                {stats.ausentes} em férias/afastados
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid View (Cards) */}
      {!isLoading && viewMode === 'grid' && filteredFuncionarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFuncionarios.map((f) => (
            <div
              key={f.id}
              onClick={() => onSelectFuncionario(f)}
              className="bg-white rounded-2xl p-5 shadow-xs border border-stone-200/80 hover:border-[#dfb842] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                {/* Card Header with Photo and Badges */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-100 border border-[#dfb842]/40 shrink-0 flex items-center justify-center">
                      {f.fotoUrl ? (
                        <img src={f.fotoUrl} alt={f.nomeCompleto} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-stone-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-serif-brand font-bold text-sm text-[#133827] group-hover:text-[#b38b25] transition-colors line-clamp-1">
                        {f.nomeCompleto}
                      </h4>
                      <p className="text-[11px] font-mono text-stone-400">
                        {f.matricula}
                      </p>
                    </div>
                  </div>
                  <div>{statusBadge(f.status)}</div>
                </div>

                {/* Role and Department */}
                <div className="space-y-1.5 py-2 border-t border-stone-100 text-xs">
                  <div className="flex items-center gap-1.5 text-stone-700 font-semibold">
                    <Briefcase className="w-3.5 h-3.5 text-[#dfb842] shrink-0" />
                    <span className="line-clamp-1">{f.cargo === 'Outro' ? f.cargoPersonalizado : f.cargo}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                    <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{f.departamento}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>Escala: <strong className="font-medium uppercase">{f.escalaTrabalho.replace('_', ' ')}</strong> ({f.turno || 'Geral'})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono">{f.celularWhatsApp}</span>
                  </div>
                </div>

                {/* Extra tags */}
                {f.vacinasEmDia && f.vacinasEmDia.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center gap-1 text-[10px] text-emerald-700">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Vacinas em dia ({f.vacinasEmDia.length} imunizações)</span>
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span className="text-[10px] text-stone-400">
                  Admissão: {new Date(f.dataAdmissao).toLocaleDateString('pt-BR')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFuncionario(f);
                    }}
                    className="p-1.5 text-stone-500 hover:text-[#133827] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                    title="Ver Ficha Completa"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, f.id, f.nomeCompleto)}
                    disabled={deletingId === f.id}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remover Cadastro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
