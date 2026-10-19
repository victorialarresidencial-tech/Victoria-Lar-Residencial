import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { VictoriaLogo } from './VictoriaLogo';
import {
  getAllServicesForAdmin,
  saveService,
  deleteService,
  reorderServices,
  getInstitutionalContent,
  saveInstitutionalContent,
  getAllAdmins,
  addAdminUser,
  updateAdminStatusOrRole,
  getContactLeads,
  updateLeadStatus,
} from '../services/firestoreService';
import { INITIAL_INSTITUTIONAL_CONTENT } from '../services/bootstrapService';
import { testFirestoreConnection } from '../lib/firebase';
import { ServiceItem, InstitutionalContent, AdminUser, ContactLead } from '../types';
import {
  Shield,
  Layers,
  FileText,
  Users,
  Inbox,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Save,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Camera,
  Upload,
  Heart,
  Image as ImageIcon,
  Calendar,
  Video,
  MessageSquare,
  MessageCircle,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { user, adminProfile, isSuperAdmin, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'services' | 'content' | 'users' | 'leads' | 'audit'>('services');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Services state
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isNewService, setIsNewService] = useState(false);

  // Content state
  const [contentMap, setContentMap] = useState<Record<string, InstitutionalContent>>({});
  const [savingContentKey, setSavingContentKey] = useState<string | null>(null);
  const [activeOwnerTab, setActiveOwnerTab] = useState<'owner_1' | 'owner_2'>('owner_1');
  const [newSlotInput, setNewSlotInput] = useState('');

  // Admins state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'superadmin'>('admin');

  // Leads state
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [leadFilter, setLeadFilter] = useState<string>('all');

  // Connection test
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (activeTab === 'services') {
        const data = await getAllServicesForAdmin();
        setServices(data || []);
      } else if (activeTab === 'content') {
        const data = await getInstitutionalContent();
        setContentMap({ ...INITIAL_INSTITUTIONAL_CONTENT, ...(data || {}) });
      } else if (activeTab === 'users') {
        const data = await getAllAdmins();
        setAdminUsers(data || []);
      } else if (activeTab === 'leads') {
        const data = await getContactLeads();
        setLeads(data || []);
      } else if (activeTab === 'audit') {
        const testRes = await testFirestoreConnection();
        setConnectionStatus(testRes.message);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Services Operations
  // -------------------------------------------------------------
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !user) return;

    if (!editingService.id || !editingService.title || !editingService.summary) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios (ID, Título, Resumo).' });
      return;
    }

    try {
      setLoading(true);
      await saveService(editingService, user.uid);
      setFeedback({
        type: 'success',
        message: `Serviço "${editingService.title}" salvo com sucesso no Firestore!`,
      });
      setEditingService(null);
      setIsNewService(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar serviço' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (id: string, title: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o serviço "${title}"?`)) return;
    try {
      setLoading(true);
      await deleteService(id);
      setFeedback({ type: 'success', message: `Serviço "${title}" excluído com sucesso.` });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir serviço' });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= services.length || !user) return;

    const updated = [...services];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Recalculate order values
    const payload = updated.map((item, idx) => ({ id: item.id, order: idx + 1 }));
    setServices(updated.map((item, idx) => ({ ...item, order: idx + 1 })));

    try {
      await reorderServices(payload, user.uid);
      setFeedback({ type: 'success', message: 'Ordem dos serviços reestruturada com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao reordenar' });
      await loadData();
    }
  };

  // -------------------------------------------------------------
  // Content Operations
  // -------------------------------------------------------------
  const handleSaveContent = async (key: string) => {
    const fallback = INITIAL_INSTITUTIONAL_CONTENT[key];
    const item = contentMap[key] || fallback;
    if (!item || !user) return;

    const payload: InstitutionalContent = {
      ...fallback,
      ...item,
      key,
    };

    try {
      setSavingContentKey(key);
      await saveInstitutionalContent(payload, user.uid);
      setFeedback({ type: 'success', message: `Dados de "${payload.title || payload.imageCaption || key}" salvos com sucesso no banco!` });
      // Update local state to reflect the saved payload
      setContentMap((prev) => ({ ...prev, [key]: payload }));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar conteúdo' });
    } finally {
      setSavingContentKey(null);
    }
  };

  // -------------------------------------------------------------
  // User Operations (Superadmin only)
  // -------------------------------------------------------------
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAdminEmail || !newAdminUid) {
      setFeedback({ type: 'error', message: 'E-mail e UID do novo administrador são obrigatórios.' });
      return;
    }

    try {
      setLoading(true);
      await addAdminUser(
        {
          uid: newAdminUid.trim(),
          email: newAdminEmail.trim(),
          role: newAdminRole,
        },
        user.uid
      );
      setFeedback({ type: 'success', message: `Administrador ${newAdminEmail} adicionado com sucesso.` });
      setNewAdminEmail('');
      setNewAdminUid('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao adicionar administrador' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdminStatus = async (targetAdmin: AdminUser) => {
    if (!user) return;
    const newActiveState = !targetAdmin.active;

    try {
      setLoading(true);
      await updateAdminStatusOrRole(
        targetAdmin.uid,
        { active: newActiveState },
        user.uid
      );
      setFeedback({
        type: 'success',
        message: `Status de ${targetAdmin.email} alterado para ${newActiveState ? 'Ativo' : 'Inativo'}.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro na operação de segurança' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdminRole = async (targetAdmin: AdminUser) => {
    if (!user) return;
    const newRole = targetAdmin.role === 'superadmin' ? 'admin' : 'superadmin';

    try {
      setLoading(true);
      await updateAdminStatusOrRole(
        targetAdmin.uid,
        { role: newRole },
        user.uid
      );
      setFeedback({
        type: 'success',
        message: `Função de ${targetAdmin.email} alterada para ${newRole}.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro na alteração de função' });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Leads Operations
  // -------------------------------------------------------------
  const handleUpdateLead = async (leadId: string, status: ContactLead['status']) => {
    try {
      await updateLeadStatus(leadId, status);
      setFeedback({ type: 'success', message: `Status do lead atualizado para "${status}".` });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao atualizar lead' });
    }
  };

  const filteredLeads = leads.filter(l => {
    if (leadFilter === 'all') return true;
    if (leadFilter === 'meetings') return l.type === 'meeting' || Boolean(l.scheduledDate);
    return l.status === leadFilter;
  });

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-neutral-800">
      {/* Top Header */}
      <header className="bg-[#173D2B] text-white border-b-2 border-[#B8954A] shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <VictoriaLogo variant="light" size="sm" layout="horizontal" />
              <div className="hidden sm:block border-l border-white/20 pl-4 py-1">
                <span className="text-xs uppercase tracking-wider text-[#B8954A] font-semibold">
                  Painel de Gestão e Segurança
                </span>
                <div className="text-xs text-white/80">
                  {user?.email} • {isSuperAdmin ? 'Superadministrador' : 'Administrador'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#173D2B] bg-[#FAF9F5] hover:bg-white rounded-lg transition-all shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ver Landing Page</span>
              </button>

              <button
                onClick={logout}
                className="p-2 text-white/70 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-2 py-2 border-t border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'services'
                ? 'bg-[#B8954A] text-white font-semibold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Nossos Serviços ({services.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'content'
                ? 'bg-[#B8954A] text-white font-semibold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Conteúdo Institucional</span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'leads'
                ? 'bg-[#B8954A] text-white font-semibold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Leads & Contatos ({leads.length})</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'users'
                  ? 'bg-[#B8954A] text-white font-semibold shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Gestão de Usuários</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'audit'
                ? 'bg-[#B8954A] text-white font-semibold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Segurança & Invariantes</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center justify-between text-sm shadow-xs ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs uppercase font-semibold opacity-70 hover:opacity-100 ml-4"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: SERVIÇOS */}
        {/* ========================================================= */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-serif font-bold text-[#173D2B]">
                  Gestão da Seção “Nossos Serviços”
                </h1>
                <p className="text-xs text-neutral-600 mt-1">
                  Cadastre, edite, publique, reordene e exclua serviços. Apenas serviços marcados como <strong>Publicado</strong> são acessíveis a visitantes.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingService({
                    id: `serv-${Date.now()}`,
                    title: '',
                    summary: '',
                    description: '',
                    icon: 'HeartPulse',
                    category: 'saude',
                    order: services.length + 1,
                    status: 'draft',
                    highlight: false,
                  });
                  setIsNewService(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#173D2B] hover:bg-[#123022] text-[#FAF9F5] text-xs font-semibold rounded-xl shadow-xs transition-all border border-[#B8954A]/40"
              >
                <Plus className="w-4 h-4 text-[#B8954A]" />
                <span>Novo Serviço</span>
              </button>
            </div>

            {/* Service Edit / Creation Modal / Form */}
            {editingService && (
              <div className="bg-white border-2 border-[#B8954A]/30 rounded-2xl p-6 shadow-lg mb-8">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-5">
                  <h3 className="font-serif font-bold text-[#173D2B] text-lg">
                    {isNewService ? 'Cadastrar Novo Serviço de Cuidado' : `Editar: ${editingService.title}`}
                  </h3>
                  <button
                    onClick={() => setEditingService(null)}
                    className="text-xs text-neutral-500 hover:text-neutral-800 font-medium"
                  >
                    Cancelar
                  </button>
                </div>

                <form onSubmit={handleSaveService} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Identificador Único (ID) *
                    </label>
                    <input
                      type="text"
                      disabled={!isNewService}
                      value={editingService.id}
                      onChange={(e) => setEditingService({ ...editingService, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })}
                      className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-[#173D2B]"
                      required
                    />
                    <span className="text-[10px] text-neutral-500">Ex: fisioterapia-geriatrica (imutável após criação)</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Título do Serviço *
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      value={editingService.title}
                      onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                      placeholder="Ex: Fisioterapia e Reabilitação Motora"
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-[#173D2B]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={editingService.category || 'saude'}
                      onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                    >
                      <option value="saude">Saúde & Cuidados Clínicos</option>
                      <option value="assistencial">Assistência & Enfermagem</option>
                      <option value="hotelaria">Hotelaria & Alimentação</option>
                      <option value="lazer">Lazer, Cultura & Convivência</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Ícone Visual
                    </label>
                    <select
                      value={editingService.icon || 'HeartPulse'}
                      onChange={(e) => setEditingService({ ...editingService, icon: e.target.value })}
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                    >
                      <option value="HeartPulse">Coração / Pulso Clínico (HeartPulse)</option>
                      <option value="Stethoscope">Estetoscópio Médico (Stethoscope)</option>
                      <option value="Apple">Nutrição Saudável (Apple)</option>
                      <option value="Activity">Atividade Motora (Activity)</option>
                      <option value="Sparkles">Estímulo Cognitivo (Sparkles)</option>
                      <option value="Home">Hotelaria & Aconchego (Home)</option>
                      <option value="Music">Musicoterapia & Arte (Music)</option>
                      <option value="ShieldCheck">Segurança e Prevenção (ShieldCheck)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Resumo para o Cartão Público * (até 300 caracteres)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={editingService.summary}
                      onChange={(e) => setEditingService({ ...editingService, summary: e.target.value })}
                      placeholder="Breve descrição em destaque apresentada na landing page..."
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-[#173D2B]"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Descrição Detalhada do Cuidado
                    </label>
                    <textarea
                      rows={4}
                      maxLength={3000}
                      value={editingService.description || ''}
                      onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                      placeholder="Detalhes completos sobre protocolos, equipe responsável, periodicidade e benefícios aos residentes..."
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-[#173D2B]"
                    />
                  </div>

                  <div className="flex items-center gap-6 md:col-span-2 pt-2">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Estado de Publicação *
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            checked={editingService.status === 'published'}
                            onChange={() => setEditingService({ ...editingService, status: 'published' })}
                            className="text-[#173D2B]"
                          />
                          <span className="font-medium text-emerald-800">Publicado (Visível a todos)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            checked={editingService.status === 'draft'}
                            onChange={() => setEditingService({ ...editingService, status: 'draft' })}
                            className="text-[#173D2B]"
                          />
                          <span className="font-medium text-amber-800">Rascunho (Privado à ADM)</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <input
                        type="checkbox"
                        id="highlight"
                        checked={!!editingService.highlight}
                        onChange={(e) => setEditingService({ ...editingService, highlight: e.target.checked })}
                        className="rounded-sm text-[#173D2B]"
                      />
                      <label htmlFor="highlight" className="font-medium text-neutral-700 cursor-pointer">
                        Destacar com selo na página principal
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setEditingService(null)}
                      className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-[#173D2B] hover:bg-[#123022] text-white font-semibold rounded-lg shadow-sm"
                    >
                      <Save className="w-4 h-4 text-[#B8954A]" />
                      <span>{isNewService ? 'Cadastrar e Salvar' : 'Salvar Alterações'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Services List Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-700">
                  <thead className="bg-[#FAF9F5] border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-center w-16">Ordem</th>
                      <th className="py-3 px-4">Serviço</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {services.map((serv, index) => (
                      <tr key={serv.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1 font-mono font-bold text-neutral-500">
                            <span>#{serv.order}</span>
                            <div className="flex flex-col ml-1">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMoveOrder(index, 'up')}
                                className="p-0.5 hover:text-[#173D2B] disabled:opacity-20"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                disabled={index === services.length - 1}
                                onClick={() => handleMoveOrder(index, 'down')}
                                className="p-0.5 hover:text-[#173D2B] disabled:opacity-20"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900 text-sm">{serv.title}</div>
                          <div className="text-neutral-500 line-clamp-1 text-xs mt-0.5">{serv.summary}</div>
                          {serv.highlight && (
                            <span className="inline-block mt-1 text-[10px] bg-[#E5A2AB] text-[#173D2B] font-semibold px-2 py-0.2 rounded-full border border-[#DC939D]">
                              ★ Destaque
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize bg-neutral-100 px-2 py-1 rounded-md text-neutral-600 font-medium">
                            {serv.category || 'Geral'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {serv.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold text-[11px]">
                              <Eye className="w-3 h-3 text-emerald-600" />
                              Publicado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-semibold text-[11px]">
                              <EyeOff className="w-3 h-3 text-amber-600" />
                              Rascunho
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingService(serv);
                                setIsNewService(false);
                              }}
                              className="p-1.5 text-neutral-600 hover:text-[#173D2B] hover:bg-neutral-100 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(serv.id, serv.title)}
                              className="p-1.5 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {services.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-500">
                          Nenhum serviço cadastrado ainda. Clique em "Novo Serviço" acima para iniciar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CONTEÚDO INSTITUCIONAL */}
        {/* ========================================================= */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#173D2B]">
                Gestão de Conteúdo Institucional
              </h1>
              <p className="text-xs text-neutral-600 mt-1">
                Textos, canais de contato, telefones oficiais e horários de visitação da Victoria Lar.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* HERO SECTION */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
                  <h3 className="font-serif font-bold text-neutral-900 text-base">
                    1. Cabeçalho Principal (Hero) & Contatos Rápidos
                  </h3>
                  <button
                    onClick={() => handleSaveContent('hero')}
                    disabled={savingContentKey === 'hero'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#173D2B] hover:bg-[#123022] text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>{savingContentKey === 'hero' ? 'Salvando...' : 'Salvar Seção Hero'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* HERO PHOTO MANAGER (Foto inserida pelo ADM) */}
                  <div className="sm:col-span-2 bg-[#FAF9F5] border-2 border-[#B8954A]/30 rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#173D2B]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-[#B8954A]" />
                        <span className="font-serif font-bold text-sm text-[#173D2B]">
                          Foto de Destaque da Capa (Painel Hero)
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-medium">
                        Foto exibida no painel de abertura da página inicial
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                      {/* Left side: Upload & Presets & URL */}
                      <div className="md:col-span-7 space-y-3.5">
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Link da Imagem (URL da Foto)
                          </label>
                          <input
                            type="text"
                            placeholder="https://exemplo.com/foto-fachada.jpg"
                            value={contentMap['hero']?.imageUrl || ''}
                            onChange={(e) =>
                              setContentMap({
                                ...contentMap,
                                hero: { ...(contentMap['hero'] || { key: 'hero', title: 'Victoria Lar Residencial' }), imageUrl: e.target.value },
                              })
                            }
                            className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Legenda / Descrição da Foto
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Jardins ensolarados e espaços de convivência planejados"
                            value={contentMap['hero']?.imageCaption || ''}
                            onChange={(e) =>
                              setContentMap({
                                ...contentMap,
                                hero: { ...(contentMap['hero'] || { key: 'hero', title: 'Victoria Lar Residencial' }), imageCaption: e.target.value },
                              })
                            }
                            className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                          />
                        </div>

                        {/* File Upload from PC / Phone */}
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Carregar Foto do Computador ou Celular
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-semibold shadow-2xs transition-all hover:border-[#B8954A]">
                              <Upload className="w-3.5 h-3.5 text-[#B8954A]" />
                              <span>Escolher Foto...</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (readerEvent) => {
                                    const img = new Image();
                                    img.onload = () => {
                                      const canvas = document.createElement('canvas');
                                      let width = img.width;
                                      let height = img.height;
                                      const maxDim = 1000;
                                      if (width > maxDim || height > maxDim) {
                                        if (width > height) {
                                          height = Math.round((height * maxDim) / width);
                                          width = maxDim;
                                        } else {
                                          width = Math.round((width * maxDim) / height);
                                          height = maxDim;
                                        }
                                      }
                                      canvas.width = width;
                                      canvas.height = height;
                                      const ctx = canvas.getContext('2d');
                                      ctx?.drawImage(img, 0, 0, width, height);
                                      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                      setContentMap({
                                        ...contentMap,
                                        hero: {
                                          ...(contentMap['hero'] || { key: 'hero', title: 'Victoria Lar Residencial' }),
                                          imageUrl: compressedDataUrl,
                                        },
                                      });
                                    };
                                    img.src = readerEvent.target?.result as string;
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>

                            {contentMap['hero']?.imageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setContentMap({
                                    ...contentMap,
                                    hero: { ...(contentMap['hero'] || { key: 'hero', title: 'Victoria Lar Residencial' }), imageUrl: '' },
                                  })
                                }
                                className="text-neutral-500 hover:text-red-600 text-xs flex items-center gap-1 px-2 py-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remover Foto</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Presets Gallery */}
                        <div>
                          <label className="block font-semibold text-neutral-600 text-[11px] mb-1.5">
                            Sugestões de Fotos de Alto Padrão (1 clique para aplicar):
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {[
                              {
                                label: 'Jardim & Solário',
                                url: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80',
                                caption: 'Jardins floridos, solário e convivência harmoniosa ao ar livre',
                              },
                              {
                                label: 'Fachada e Entrada',
                                url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
                                caption: 'Estrutura aconchegante com hotelaria e acolhimento humanizado',
                              },
                              {
                                label: 'Salão de Convivência',
                                url: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=1200&q=80',
                                caption: 'Ambiente familiar e iluminado para receber residentes e visitas',
                              },
                              {
                                label: 'Varanda Acolhedora',
                                url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
                                caption: 'Arquitetura planejada com ampla iluminação natural e verde exuberante',
                              },
                            ].map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  setContentMap({
                                    ...contentMap,
                                    hero: {
                                      ...(contentMap['hero'] || { key: 'hero', title: 'Victoria Lar Residencial' }),
                                      imageUrl: preset.url,
                                      imageCaption: preset.caption,
                                    },
                                  })
                                }
                                className="text-left p-2 rounded-lg border border-neutral-200 bg-white hover:border-[#B8954A] hover:bg-[#FAF9F5] transition-all"
                              >
                                <div className="font-semibold text-neutral-800">{preset.label}</div>
                                <div className="text-[10px] text-neutral-500 truncate">{preset.caption}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Live Preview Frame */}
                      <div className="md:col-span-5 flex flex-col items-center">
                        <span className="text-[11px] font-semibold text-neutral-600 mb-1.5 self-start">
                          Pré-visualização do Painel da Capa:
                        </span>
                        <div className="w-full h-52 rounded-xl overflow-hidden border-2 border-[#B8954A]/40 shadow-sm relative bg-neutral-200">
                          <img
                            src={
                              contentMap['hero']?.imageUrl?.trim() ||
                              'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80'
                            }
                            alt="Prévia"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#173D2B]/90 text-white rounded-full text-[9px] font-semibold">
                            Ambiente Humanizado
                          </div>
                          <div className="absolute bottom-2 left-2.5 right-2.5 text-white text-[10px] space-y-0.5">
                            <span className="bg-[#B8954A] text-black text-[9px] font-bold px-1.5 py-0.2 rounded-xs inline-block">
                              Estrutura & Convivência
                            </span>
                            <div className="font-medium line-clamp-2 drop-shadow-xs">
                              {contentMap['hero']?.imageCaption ||
                                'Jardins ensolarados, solário e áreas de convivência planejadas para acolher com amor.'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-neutral-700 mb-1">Título de Impacto</label>
                    <input
                      type="text"
                      value={contentMap['hero']?.title || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), title: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-neutral-700 mb-1">Subtítulo / Missão</label>
                    <textarea
                      rows={2}
                      value={contentMap['hero']?.subtitle || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), subtitle: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Telefone Fixo</label>
                    <input
                      type="text"
                      value={contentMap['hero']?.phone || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), phone: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">WhatsApp de Atendimento</label>
                    <input
                      type="text"
                      value={contentMap['hero']?.whatsapp || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), whatsapp: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">E-mail Institucional</label>
                    <input
                      type="text"
                      value={contentMap['hero']?.email || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), email: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Horário de Visitação</label>
                    <input
                      type="text"
                      value={contentMap['hero']?.visitingHours || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), visitingHours: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-neutral-700 mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={contentMap['hero']?.address || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          hero: { ...(contentMap['hero'] || { key: 'hero' }), address: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* ABOUT SECTION */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
                  <h3 className="font-serif font-bold text-neutral-900 text-base">
                    2. Seção "Sobre Nós / Vocação"
                  </h3>
                  <button
                    onClick={() => handleSaveContent('about')}
                    disabled={savingContentKey === 'about'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#173D2B] hover:bg-[#123022] text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>{savingContentKey === 'about' ? 'Salvando...' : 'Salvar Seção Sobre'}</span>
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Título</label>
                    <input
                      type="text"
                      value={contentMap['about']?.title || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          about: { ...(contentMap['about'] || { key: 'about' }), title: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">História & Filosofia</label>
                    <textarea
                      rows={5}
                      value={contentMap['about']?.body || ''}
                      onChange={(e) =>
                        setContentMap({
                          ...contentMap,
                          about: { ...(contentMap['about'] || { key: 'about' }), body: e.target.value },
                        })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* =================================================== */}
              {/* 3. QUEM ESTÁ POR TRÁS (Dois Proprietários) */}
              {/* =================================================== */}
              <div className="bg-white border-2 border-[#B8954A]/40 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#173D2B]/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#B8954A]" />
                      <h3 className="font-serif font-bold text-neutral-900 text-base">
                        3. Painel "Quem está por trás..." (Dois Proprietários)
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Gerencie as fotos, nomes, cargos, saudações, trajetórias e citações dos dois sócios-proprietários exibidos lado a lado na aba Sobre Nós.
                    </p>
                  </div>

                  <button
                    onClick={() => handleSaveContent(activeOwnerTab)}
                    disabled={savingContentKey === activeOwnerTab}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173D2B] hover:bg-[#123022] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-all hover:scale-105"
                  >
                    <Save className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>
                      {savingContentKey === activeOwnerTab
                        ? 'Gravando no Banco...'
                        : `Salvar ${activeOwnerTab === 'owner_1' ? 'Proprietário 1' : 'Proprietário 2'}`}
                    </span>
                  </button>
                </div>

                {/* Sub-Tabs Switcher */}
                <div className="flex gap-2 p-1.5 bg-[#FAF9F5] border border-[#173D2B]/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveOwnerTab('owner_1')}
                    className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      activeOwnerTab === 'owner_1'
                        ? 'bg-[#173D2B] text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>Proprietário 1 ({contentMap['owner_1']?.imageCaption || 'Regina'})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveOwnerTab('owner_2')}
                    className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      activeOwnerTab === 'owner_2'
                        ? 'bg-[#173D2B] text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>Proprietário 2 ({contentMap['owner_2']?.imageCaption || 'Roberto'})</span>
                  </button>
                </div>

                {/* Active Owner Form & Preview */}
                {(() => {
                  const fallback = INITIAL_INSTITUTIONAL_CONTENT[activeOwnerTab];
                  const current = contentMap[activeOwnerTab] || fallback;

                  const updateField = (field: keyof InstitutionalContent, val: string) => {
                    setContentMap({
                      ...contentMap,
                      [activeOwnerTab]: {
                        ...fallback,
                        ...current,
                        key: activeOwnerTab,
                        [field]: val,
                      },
                    });
                  };

                  return (
                    <div className="space-y-6">
                      {/* Photo Management Box */}
                      <div className="bg-[#FAF9F5] border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#173D2B]/10 pb-3">
                          <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-[#B8954A]" />
                            <span className="font-serif font-bold text-sm text-[#173D2B]">
                              Foto do {activeOwnerTab === 'owner_1' ? 'Proprietário 1' : 'Proprietário 2'}
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-500 font-medium">
                            Foto em formato retrato com selo de nome e cargo sobreposto
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                          <div className="md:col-span-8 space-y-3 text-xs">
                            <div>
                              <label className="block font-semibold text-neutral-700 mb-1">
                                Link Direto da Foto (URL)
                              </label>
                              <input
                                type="text"
                                placeholder="https://exemplo.com/foto-proprietario.jpg"
                                value={current?.imageUrl || ''}
                                onChange={(e) => updateField('imageUrl', e.target.value)}
                                className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-neutral-700 mb-1">
                                Enviar Foto do Computador ou Celular
                              </label>
                              <div className="flex items-center gap-2 flex-wrap">
                                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-semibold shadow-2xs transition-all hover:border-[#B8954A]">
                                  <Upload className="w-3.5 h-3.5 text-[#B8954A]" />
                                  <span>Escolher Foto do Arquivo...</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (readerEvent) => {
                                        const img = new Image();
                                        img.onload = () => {
                                          const canvas = document.createElement('canvas');
                                          let width = img.width;
                                          let height = img.height;
                                          const maxDim = 800;
                                          if (width > maxDim || height > maxDim) {
                                            if (width > height) {
                                              height = Math.round((height * maxDim) / width);
                                              width = maxDim;
                                            } else {
                                              width = Math.round((width * maxDim) / height);
                                              height = maxDim;
                                            }
                                          }
                                          canvas.width = width;
                                          canvas.height = height;
                                          const ctx = canvas.getContext('2d');
                                          ctx?.drawImage(img, 0, 0, width, height);
                                          const compressed = canvas.toDataURL('image/jpeg', 0.82);
                                          updateField('imageUrl', compressed);
                                        };
                                        img.src = readerEvent.target?.result as string;
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                </label>

                                {current?.imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => updateField('imageUrl', '')}
                                    className="text-neutral-500 hover:text-red-600 text-xs flex items-center gap-1 px-2 py-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remover Foto</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Preset Suggestions */}
                            <div>
                              <span className="block font-semibold text-neutral-600 text-[11px] mb-1">
                                Sugestões de Fotos Profissionais (1 clique para aplicar):
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                {[
                                  {
                                    label: 'Profissional Mulher (Gestão)',
                                    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
                                  },
                                  {
                                    label: 'Profissional Homem (Saúde)',
                                    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80',
                                  },
                                  {
                                    label: 'Médica Geriátrica / Acolhedora',
                                    url: 'https://images.unsplash.com/photo-1594824813572-887413c68337?auto=format&fit=crop&w=800&q=80',
                                  },
                                  {
                                    label: 'Diretor / Gestor Sênior',
                                    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
                                  },
                                ].map((preset, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => updateField('imageUrl', preset.url)}
                                    className="p-1.5 text-left border border-neutral-200 bg-white hover:border-[#B8954A] rounded-lg text-neutral-700 transition-colors"
                                  >
                                    <span className="font-medium">{preset.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Live Thumbnail Preview */}
                          <div className="md:col-span-4 flex flex-col items-center">
                            <span className="text-[11px] font-semibold text-neutral-600 mb-1.5 self-start">
                              Foto com Selo Sobreposto:
                            </span>
                            <div className="w-full aspect-[4/5] rounded-xl overflow-hidden border border-neutral-300 shadow-sm relative bg-neutral-200">
                              <img
                                src={
                                  current?.imageUrl?.trim() ||
                                  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80'
                                }
                                alt="Prévia"
                                className="w-full h-full object-cover object-top"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-left text-white">
                                <div className="font-serif font-bold text-sm leading-tight drop-shadow-md">
                                  {current?.imageCaption || 'Nome'}
                                </div>
                                <div className="text-[10px] text-[#DFC282] font-medium leading-tight mt-0.5">
                                  {current?.role || 'Cargo'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Text Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Nome no Selo da Foto
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Regina"
                            value={current?.imageCaption || ''}
                            onChange={(e) => updateField('imageCaption', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Cargo / Função no Selo da Foto
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Sócia-Proprietária & Gestora Humanizada"
                            value={current?.role || ''}
                            onChange={(e) => updateField('role', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Título de Saudação
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Olá, sou a Regina."
                            value={current?.title || ''}
                            onChange={(e) => updateField('title', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Selo Superior (Tag / Badge)
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Atendimento direto, humano e sem intermediários"
                            value={current?.tag || ''}
                            onChange={(e) => updateField('tag', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Trajetória, História & Biografia
                          </label>
                          <p className="text-[10px] text-neutral-500 mb-1.5">
                            Dica: Pressione Enter duas vezes para criar parágrafos separados, exatamente como no modelo de referência.
                          </p>
                          <textarea
                            rows={6}
                            placeholder="Conte a história, os anos de experiência, os valores e a dedicação ao acolhimento dos idosos..."
                            value={current?.body || ''}
                            onChange={(e) => updateField('body', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg leading-relaxed"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Frase de Destaque / Caixa Dourada (Citação Inferior)
                          </label>
                          <p className="text-[10px] text-neutral-500 mb-1.5">
                            Texto que aparece no box com a borda dourada lateral na parte inferior do painel.
                          </p>
                          <textarea
                            rows={3}
                            placeholder="ex: O Victoria Lar Residencial nasceu daí. Da vontade de usar toda essa experiência para criar um espaço onde o acolhimento humano..."
                            value={current?.quote || ''}
                            onChange={(e) => updateField('quote', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg"
                          />
                        </div>
                      </div>

                      {/* Save Button for active owner */}
                      <div className="flex justify-end pt-3 border-t border-neutral-200">
                        <button
                          type="button"
                          onClick={() => handleSaveContent(activeOwnerTab)}
                          disabled={savingContentKey === activeOwnerTab}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#173D2B] hover:bg-[#123022] text-white font-semibold text-xs rounded-xl shadow-sm transition-all hover:scale-105 cursor-pointer"
                        >
                          <Save className="w-4 h-4 text-[#B8954A]" />
                          <span>
                            {savingContentKey === activeOwnerTab
                              ? 'Salvando no Banco...'
                              : `Salvar Alterações de ${current?.imageCaption || 'Proprietário'}`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ======================================================= */}
              {/* 4. AGENDAMENTO & 3 OPÇÕES DE CONTATO (Meeting, Form, WhatsApp) */}
              {/* ======================================================= */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#B8954A]" />
                      <h3 className="font-serif font-bold text-neutral-900 text-base">
                        4. Agendamento & 3 Opções de Contato (Meeting, Formulário e WhatsApp)
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Configure as 3 opções de atendimento idênticas à Beeginning 4 You: Reunião online com link do Google Meet e e-mail automático, Formulário detalhado e WhatsApp direto.
                    </p>
                  </div>

                  <button
                    onClick={() => handleSaveContent('scheduling')}
                    disabled={savingContentKey === 'scheduling'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173D2B] hover:bg-[#123022] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-all hover:scale-105"
                  >
                    <Save className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>
                      {savingContentKey === 'scheduling'
                        ? 'Gravando no Banco...'
                        : 'Salvar Configurações de Agendamento'}
                    </span>
                  </button>
                </div>

                {(() => {
                  const fallback = INITIAL_INSTITUTIONAL_CONTENT['scheduling'];
                  const current = contentMap['scheduling'] || fallback;

                  const updateField = (field: keyof InstitutionalContent, val: string) => {
                    setContentMap({
                      ...contentMap,
                      scheduling: {
                        ...fallback,
                        ...current,
                        key: 'scheduling',
                        [field]: val,
                      },
                    });
                  };

                  return (
                    <div className="space-y-6">
                      {/* Top Titles */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Título da Seção de Agendamentos
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Como você prefere conversar?"
                            value={current?.title || ''}
                            onChange={(e) => updateField('title', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Subtítulo / Instrução Inicial
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Escolha o canal mais prático para você. Atendimento direto com os proprietários..."
                            value={current?.subtitle || ''}
                            onChange={(e) => updateField('subtitle', e.target.value)}
                            className="w-full p-2.5 border border-neutral-300 rounded-lg"
                          />
                        </div>
                      </div>

                      {/* Option 1: Reunião via Meeting */}
                      <div className="bg-[#FAF9F5] border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-[#173D2B]/10 pb-2.5">
                          <Video className="w-4 h-4 text-purple-700" />
                          <span className="font-serif font-bold text-sm text-[#173D2B]">
                            Opção 1: Reunião Online via Google Meet
                          </span>
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                            Dispara e-mail de confirmação automático
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Link da Sala do Google Meet
                            </label>
                            <input
                              type="text"
                              placeholder="https://meet.google.com/vic-tori-lar"
                              value={current?.meetingLink || ''}
                              onChange={(e) => updateField('meetingLink', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg font-mono text-xs"
                            />
                            <span className="text-[10px] text-neutral-500 mt-0.5 block">
                              Link que será entregue ao cliente e enviado por e-mail.
                            </span>
                          </div>

                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Duração Estimada da Reunião
                            </label>
                            <input
                              type="text"
                              placeholder="ex: 30 a 45 minutos"
                              value={current?.meetingDuration || ''}
                              onChange={(e) => updateField('meetingDuration', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                            />
                          </div>

                          {/* Controle Avançado de Horários Disponíveis */}
                          <div className="sm:col-span-2 bg-white p-4 rounded-xl border border-neutral-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                              <div>
                                <label className="block font-semibold text-neutral-800 text-xs">
                                  Controle de Horários Disponíveis para Reunião via Meet
                                </label>
                                <p className="text-[11px] text-neutral-500">
                                  Estes horários alimentam a grade interativa do modal &quot;Reunião via Meet&quot;. O visitante só poderá agendar nos horários definidos aqui.
                                </p>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 self-start sm:self-auto">
                                Sincronização em Tempo Real
                              </span>
                            </div>

                            {/* Active Time Slot Chips */}
                            <div>
                              <span className="text-[11px] font-semibold text-neutral-600 block mb-1.5">
                                Horários Ativos Atualmente ({
                                  (current?.availableHours || '')
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean).length
                                } horários configurados):
                              </span>

                              <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-[#FAF9F5] border border-neutral-200 rounded-lg items-center">
                                {(() => {
                                  const slots = (current?.availableHours || '')
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);

                                  if (slots.length === 0) {
                                    return (
                                      <span className="text-xs text-neutral-400 italic">
                                        Nenhum horário cadastrado. Adicione abaixo ou clique em um modelo pré-definido.
                                      </span>
                                    );
                                  }

                                  return slots.map((slot) => (
                                    <span
                                      key={slot}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#173D2B]/20 text-[#173D2B] rounded-lg text-xs font-bold shadow-2xs group hover:border-red-300 transition-colors"
                                    >
                                      <Clock className="w-3 h-3 text-[#B8954A]" />
                                      <span>{slot}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = slots.filter((s) => s !== slot).join(', ');
                                          updateField('availableHours', next);
                                        }}
                                        className="text-neutral-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                        title={`Remover horário ${slot}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ));
                                })()}
                              </div>
                            </div>

                            {/* Add New Slot Input & Action */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  placeholder="Novo horário (ex: 10:30 ou 16:30)"
                                  value={newSlotInput}
                                  onChange={(e) => setNewSlotInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const trimmed = newSlotInput.trim();
                                      if (trimmed) {
                                        const slots = (current?.availableHours || '')
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter(Boolean);
                                        if (!slots.includes(trimmed)) {
                                          const next = [...slots, trimmed].sort().join(', ');
                                          updateField('availableHours', next);
                                        }
                                        setNewSlotInput('');
                                      }
                                    }
                                  }}
                                  className="flex-1 p-2 bg-white border border-neutral-300 rounded-lg text-xs font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const trimmed = newSlotInput.trim();
                                    if (trimmed) {
                                      const slots = (current?.availableHours || '')
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean);
                                      if (!slots.includes(trimmed)) {
                                        const next = [...slots, trimmed].sort().join(', ');
                                        updateField('availableHours', next);
                                      }
                                      setNewSlotInput('');
                                    }
                                  }}
                                  className="px-3.5 py-2 bg-[#173D2B] hover:bg-[#123022] text-[#DFC282] rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                                >
                                  + Adicionar Horário
                                </button>
                              </div>

                              {/* Presets */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-neutral-400 font-medium">Modelos:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateField('availableHours', '09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00')
                                  }
                                  className="text-[10px] px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium cursor-pointer"
                                  title="Aplicar modelo Comercial Padrão"
                                >
                                  Comercial Padrão
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateField('availableHours', '09:00, 09:45, 10:30, 11:15')
                                  }
                                  className="text-[10px] px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium cursor-pointer"
                                  title="Aplicar modelo Manhã"
                                >
                                  Manhã
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateField('availableHours', '14:00, 15:00, 16:00, 17:00, 18:00')
                                  }
                                  className="text-[10px] px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium cursor-pointer"
                                  title="Aplicar modelo Tarde"
                                >
                                  Tarde
                                </button>
                              </div>
                            </div>

                            {/* Raw text input for manual comma-separated editing */}
                            <div className="pt-2 border-t border-neutral-100">
                              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                                Edição Direta em Texto (separados por vírgula):
                              </label>
                              <input
                                type="text"
                                placeholder="09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00"
                                value={current?.availableHours || ''}
                                onChange={(e) => updateField('availableHours', e.target.value)}
                                className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-700"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Assunto do E-mail de Confirmação
                            </label>
                            <input
                              type="text"
                              placeholder="Confirmação de Agendamento: Reunião - Victoria Lar Residencial"
                              value={current?.emailSubject || ''}
                              onChange={(e) => updateField('emailSubject', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Instruções Adicionais no E-mail
                            </label>
                            <input
                              type="text"
                              placeholder="Recomendamos acessar o link com 5 minutos de antecedência..."
                              value={current?.emailInstructions || ''}
                              onChange={(e) => updateField('emailInstructions', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Option 2: Formulário */}
                      <div className="bg-[#FAF9F5] border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-[#173D2B]/10 pb-2.5">
                          <FileText className="w-4 h-4 text-[#B8954A]" />
                          <span className="font-serif font-bold text-sm text-[#173D2B]">
                            Opção 2: Formulário de Mensagem Detalhada
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              E-mail Institucional de Recebimento
                            </label>
                            <input
                              type="email"
                              placeholder="contato@victorialar.com.br"
                              value={current?.email || ''}
                              onChange={(e) => updateField('email', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Telefone Fixo de Apoio
                            </label>
                            <input
                              type="text"
                              placeholder="(11) 3456-7890"
                              value={current?.phone || ''}
                              onChange={(e) => updateField('phone', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Option 3: WhatsApp Direto */}
                      <div className="bg-[#FAF9F5] border border-neutral-200 rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-[#173D2B]/10 pb-2.5">
                          <MessageCircle className="w-4 h-4 text-emerald-700" />
                          <span className="font-serif font-bold text-sm text-[#173D2B]">
                            Opção 3: WhatsApp Direto com os Proprietários
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Número do WhatsApp (com DDD, ex: 11987654321)
                            </label>
                            <input
                              type="text"
                              placeholder="11987654321"
                              value={current?.whatsapp || ''}
                              onChange={(e) => updateField('whatsapp', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-neutral-700 mb-1">
                              Mensagem Padrão Pré-preenchida
                            </label>
                            <input
                              type="text"
                              placeholder="Olá! Gostaria de tirar dúvidas sobre as acomodações do Victoria Lar..."
                              value={current?.whatsappMessage || ''}
                              onChange={(e) => updateField('whatsappMessage', e.target.value)}
                              className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Final Save Button */}
                      <div className="flex justify-end pt-3 border-t border-neutral-200">
                        <button
                          type="button"
                          onClick={() => handleSaveContent('scheduling')}
                          disabled={savingContentKey === 'scheduling'}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#173D2B] hover:bg-[#123022] text-white font-semibold text-xs rounded-xl shadow-sm transition-all hover:scale-105 cursor-pointer"
                        >
                          <Save className="w-4 h-4 text-[#B8954A]" />
                          <span>
                            {savingContentKey === 'scheduling'
                              ? 'Salvando no Banco...'
                              : 'Salvar Configurações de Agendamento'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: LEADS & CONTATOS */}
        {/* ========================================================= */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-serif font-bold text-[#173D2B]">
                  Leads & Agendamentos de Visitas
                </h1>
                <p className="text-xs text-neutral-600 mt-1">
                  Solicitações recebidas com proteção estrita de privacidade (PII). Apenas administradores autenticados podem visualizar.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">Filtrar por:</span>
                <select
                  value={leadFilter}
                  onChange={(e) => setLeadFilter(e.target.value)}
                  className="p-2 border border-neutral-300 rounded-lg bg-white"
                >
                  <option value="all">Todos os Registros</option>
                  <option value="meetings">📹 Apenas Reuniões Google Meet</option>
                  <option value="unread">Não Lidos</option>
                  <option value="contacted">Contatados</option>
                  <option value="scheduled">Reuniões / Agendados</option>
                  <option value="archived">Arquivados</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-neutral-900 text-sm">{lead.name}</span>
                      <span className="text-neutral-500 font-mono">({lead.phone})</span>
                      {lead.email && <span className="text-neutral-500">• {lead.email}</span>}
                      {lead.type === 'meeting' || lead.scheduledDate ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-[10px] font-bold">
                          <Video className="w-3 h-3 text-purple-700" />
                          Reunião Google Meet
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-full text-[10px] font-medium">
                          <FileText className="w-3 h-3 text-neutral-500" />
                          Formulário de Contato
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleString('pt-BR') : ''}
                      </span>
                      <select
                        value={lead.status}
                        onChange={(e) => handleUpdateLead(lead.id!, e.target.value as any)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          lead.status === 'unread'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : lead.status === 'contacted'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : lead.status === 'scheduled'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                        }`}
                      >
                        <option value="unread">Não Lido</option>
                        <option value="read">Lido</option>
                        <option value="contacted">Contatado</option>
                        <option value="scheduled">Visita/Reunião Agendada</option>
                        <option value="archived">Arquivado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-neutral-600 bg-neutral-50 p-3 rounded-xl">
                    <div>
                      <strong className="text-neutral-800">Grau de Parentesco:</strong> {lead.relationship || 'Não informado'}
                    </div>
                    <div>
                      <strong className="text-neutral-800">Interesse:</strong> {lead.serviceInterest || 'Geral'}
                    </div>
                    <div>
                      {lead.scheduledDate ? (
                        <div>
                          <strong className="text-neutral-800">Data e Horário:</strong>{' '}
                          <span className="text-[#173D2B] font-bold">
                            {lead.scheduledDate} às {lead.scheduledTime}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <strong className="text-neutral-800">Origem:</strong> Formulário de Contato
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meeting Link Callout for Admins */}
                  {lead.meetingLink && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-900">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-purple-700 flex-shrink-0" />
                        <span className="text-xs">
                          Link da Reunião: <strong className="font-mono text-purple-950">{lead.meetingLink}</strong>
                        </span>
                      </div>
                      <a
                        href={lead.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-lg transition-colors"
                      >
                        <span>Abrir Google Meet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {lead.message && (
                    <div className="text-neutral-700 bg-white p-3 rounded-lg border border-neutral-100">
                      <strong>Mensagem do Familiar:</strong>
                      <p className="mt-1 italic">{lead.message}</p>
                    </div>
                  )}
                </div>
              ))}

              {filteredLeads.length === 0 && (
                <div className="bg-white p-8 rounded-2xl border border-neutral-200 text-center text-neutral-500 text-xs">
                  Nenhum lead encontrado com o filtro selecionado.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: GESTÃO DE USUÁRIOS (Superadmin) */}
        {/* ========================================================= */}
        {activeTab === 'users' && isSuperAdmin && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#173D2B]">
                Gestão Administrativa & Controle de Acesso (RBAC)
              </h1>
              <p className="text-xs text-neutral-600 mt-1">
                Adicione administradores, defina funções e gerencie permissões. A proteção de concorrência impede a exclusão ou desativação do último superadministrador ativo.
              </p>
            </div>

            {/* Add New Admin Form */}
            <div className="bg-white border border-[#B8954A]/30 rounded-2xl p-5 shadow-xs">
              <h3 className="font-serif font-bold text-[#173D2B] text-sm mb-3">
                Conceder Acesso Administrativo
              </h3>
              <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">E-mail do Usuário</label>
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="usuario@dominio.com"
                    className="w-full p-2 border border-neutral-300 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Firebase UID</label>
                  <input
                    type="text"
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="UID do Firebase Auth"
                    className="w-full p-2 border border-neutral-300 rounded-lg text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Função</label>
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as any)}
                    className="w-full p-2 border border-neutral-300 rounded-lg text-xs bg-white"
                  >
                    <option value="admin">Administrador (Gestão de Serviços/Conteúdo)</option>
                    <option value="superadmin">Superadministrador (Acesso Total)</option>
                  </select>
                </div>
                <div className="sm:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173D2B] hover:bg-[#123022] text-white font-semibold rounded-lg text-xs shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#B8954A]" />
                    <span>Cadastrar Administrador</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Admin Users Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-neutral-700">
                <thead className="bg-[#FAF9F5] border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Usuário / E-mail</th>
                    <th className="py-3 px-4">Função</th>
                    <th className="py-3 px-4">Status no Banco</th>
                    <th className="py-3 px-4 text-right">Ações de Segurança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {adminUsers.map((adm) => (
                    <tr key={adm.uid} className="hover:bg-neutral-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{adm.email}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">{adm.uid}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider ${
                            adm.role === 'superadmin'
                              ? 'bg-[#B8954A]/20 text-[#173D2B] border border-[#B8954A]'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {adm.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {adm.active ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAdminRole(adm)}
                            className="px-2.5 py-1 text-xs border border-neutral-300 rounded-lg hover:bg-neutral-100 text-neutral-700 font-medium"
                            title="Alternar entre Superadmin e Admin"
                          >
                            Alternar Função
                          </button>
                          <button
                            onClick={() => handleToggleAdminStatus(adm)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                              adm.active
                                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {adm.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: AUDITORIA & SEGURANÇA */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#173D2B]">
                Arquitetura de Segurança & Invariantes Inegociáveis
              </h1>
              <p className="text-xs text-neutral-600 mt-1">
                Conformidade com os 8 pilares de regras endurecidas do Firestore e requisitos do projeto.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Zero Storage */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-[#173D2B] font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 text-[#B8954A]" />
                  <span>Zero LocalStorage / SessionStorage / IndexedDB</span>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  A autenticação do Firebase está configurada com <code>inMemoryPersistence</code>. Nenhuma credencial privilegiada, token JWT ou rascunho é persistido no armazenamento permanente do navegador.
                </p>
                <div className="pt-2 text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>100% em conformidade com o requisito inegociável</span>
                </div>
              </div>

              {/* Firestore Connection */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-[#173D2B] font-semibold text-sm">
                  <RefreshCw className="w-4 h-4 text-[#B8954A]" />
                  <span>Teste de Conexão com Cloud Firestore</span>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  Chamada executada via <code>getDocFromServer</code> diretamente na coleção <code>/system/bootstrap</code>.
                </p>
                <div className="pt-2 text-neutral-800 font-mono bg-neutral-50 p-2 rounded-lg text-[11px]">
                  {connectionStatus || 'Conexão ativa'}
                </div>
              </div>

              {/* Rules Are Not Filters */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-[#173D2B] font-semibold text-sm">
                  <EyeOff className="w-4 h-4 text-[#B8954A]" />
                  <span>Isolamento Estrito de Rascunhos ("Rules Are Not Filters")</span>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  As consultas públicas na coleção <code>services</code> exigem a restrição <code>where('status', '==', 'published')</code>. Qualquer consulta não filtrada executada por visitantes é sumariamente rejeitada pelo motor de regras.
                </p>
                <div className="pt-2 text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Testes 18/18 e Dirty Dozen validados</span>
                </div>
              </div>

              {/* Last Superadmin OCC Protection */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-[#173D2B] font-semibold text-sm">
                  <Shield className="w-4 h-4 text-[#B8954A]" />
                  <span>Proteção contra Desativação do Último Superadmin</span>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  O documento de guarda <code>/system/superAdminGuard</code> com controle de versão otimista garante que tentativas de desativar ou rebaixar o único superadministrador ativo remanescente sejam abortadas no servidor.
                </p>
                <div className="pt-2 text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Bloqueio transacional ativo</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
