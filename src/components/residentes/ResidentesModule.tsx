import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  Database,
  ShieldCheck,
  Heart,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Paciente, DiagnosticResult } from '../../types/patient';
import {
  ouvirPacientes,
  excluirPacienteNoFirebase,
} from '../../services/residentesService';
import { PatientForm } from './PatientForm';
import { PatientList } from './PatientList';
import { PatientDetailsModal } from './PatientDetailsModal';

interface ResidentesModuleProps {
  canWrite?: boolean;
  canDelete?: boolean;
}

export const ResidentesModule: React.FC<ResidentesModuleProps> = ({
  canWrite = true,
  canDelete = false,
}) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const effectiveCanDelete = isAdmin || canDelete;

  const diagnostic: DiagnosticResult = {
    status: 'conectado_autorizado',
    title: 'Acesso Autorizado',
    description: 'Sessão autenticada e validada no Firebase victoria-lar-residencial.',
    recommendation: 'Operações validadas pelas regras de segurança do Firestore.',
    isAdmin: isAdmin,
    isStaff: true,
    canReadResidents: true,
    canWriteResidents: canWrite,
    canDeleteResidents: effectiveCanDelete,
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = ouvirPacientes(
      (data) => {
        setPacientes(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[Residentes Module Error]:', err);
        const msg = err.message || String(err);
        if (msg.includes('Missing or insufficient permissions') || msg.includes('permission-denied')) {
          setError(
            'Permissão insuficiente no Firestore (default). Verifique se o usuário autenticado possui registro ativo em /admins ou em /usuariosAutorizados com o módulo "residentes" e e-mail verificado.'
          );
        } else {
          setError(msg || 'Falha ao sincronizar dados de residentes com o Firestore.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleFormSuccess = (savedPaciente: Paciente) => {
    setNotification({
      type: 'success',
      message: editingPaciente
        ? `Prontuário de "${savedPaciente.nomeCompleto}" atualizado com sucesso!`
        : `Residente "${savedPaciente.nomeCompleto}" cadastrado com sucesso!`,
    });
    setEditingPaciente(null);
    setActiveTab('lista');
    setTimeout(() => setNotification(null), 5000);
  };

  const handleEditPaciente = (paciente: Paciente) => {
    setEditingPaciente(paciente);
    setActiveTab('cadastro');
  };

  const handleCancelEdit = () => {
    setEditingPaciente(null);
    setActiveTab('lista');
  };

  return (
    <div className="space-y-6">
      {/* Top Notification Toast */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-medium shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs uppercase tracking-wider font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Module Header & Sub-Navigation */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#133827]/10 flex items-center justify-center text-[#133827]">
                <Heart className="w-5 h-5 text-[#8c6b2d]" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">
                  Cadastro & Prontuários de Residentes
                </h2>
                <p className="text-xs text-stone-500">
                  Gestão clínica, graus de dependência, medicação contínua e responsáveis familiares
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Firestore: /pacientes</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8c6b2d]" />
              <span>victoria-lar-residencial</span>
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingPaciente(null);
                setActiveTab('lista');
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'lista'
                  ? 'bg-[#133827] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Lista de Residentes ({pacientes.length})</span>
            </button>

            {canWrite && (
              <button
                onClick={() => {
                  setEditingPaciente(null);
                  setActiveTab('cadastro');
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'cadastro' && !editingPaciente
                    ? 'bg-[#133827] text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Novo Residente</span>
              </button>
            )}

            {editingPaciente && activeTab === 'cadastro' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#8c6b2d] text-white">
                <FileText className="w-4 h-4" />
                <span>Editando: {editingPaciente.nomeCompleto}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="font-bold text-red-900 text-base">Falha na Conexão com o Firestore</h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <p className="text-[11px] text-stone-500">
            Conforme especificado, nenhuma informação simulada ou em armazenamento local é exibida.
          </p>
        </div>
      ) : activeTab === 'lista' ? (
        <PatientList
          pacientes={pacientes}
          isLoading={loading}
          onSelectPaciente={(p) => setSelectedPaciente(p)}
          onNewPatientClick={() => {
            setEditingPaciente(null);
            setActiveTab('cadastro');
          }}
          onRefresh={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
          currentUser={user}
          onEditPaciente={canWrite ? handleEditPaciente : undefined}
          diagnostic={diagnostic}
        />
      ) : (
        <PatientForm
          onSuccess={handleFormSuccess}
          onOpenConfig={() => {}}
          isFirebaseConnected={true}
          currentUser={user}
          editingPaciente={editingPaciente}
          onCancelEdit={handleCancelEdit}
        />
      )}

      {/* Modal de Detalhes e Prontuário Clínico */}
      <PatientDetailsModal
        paciente={selectedPaciente}
        onClose={() => setSelectedPaciente(null)}
        onEdit={
          canWrite
            ? (p) => {
                setSelectedPaciente(null);
                handleEditPaciente(p);
              }
            : undefined
        }
      />
    </div>
  );
};
