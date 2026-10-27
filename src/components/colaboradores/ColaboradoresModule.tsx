import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  Database,
  ShieldCheck,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Funcionario, StatusFuncionario } from '../../types/employee';
import {
  ouvirFuncionarios,
  atualizarFuncionarioNoFirebase,
} from '../../services/colaboradoresService';
import { EmployeeForm } from './EmployeeForm';
import { EmployeeList } from './EmployeeList';
import { EmployeeDetailsModal } from './EmployeeDetailsModal';

interface ColaboradoresModuleProps {
  canWrite?: boolean;
}

export const ColaboradoresModule: React.FC<ColaboradoresModuleProps> = ({
  canWrite = true,
}) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'lista' | 'cadastro'>('lista');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [selectedFuncionario, setSelectedFuncionario] = useState<Funcionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = ouvirFuncionarios(
      (data) => {
        setFuncionarios(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[Colaboradores Module Error]:', err);
        const msg = err.message || String(err);
        if (msg.includes('Missing or insufficient permissions') || msg.includes('permission-denied')) {
          setError(
            'Permissão insuficiente no Firestore (default). Verifique se o usuário autenticado possui registro ativo em /admins ou em /usuariosAutorizados com o módulo "colaboradores" e e-mail verificado.'
          );
        } else {
          setError(msg || 'Falha ao sincronizar dados de colaboradores com o Firestore.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleFormSuccess = (novoFuncionario: Funcionario) => {
    setNotification({
      type: 'success',
      message: `Colaborador(a) "${novoFuncionario.nomeCompleto}" cadastrado(a) com sucesso!`,
    });
    setActiveTab('lista');
    setTimeout(() => setNotification(null), 5000);
  };

  const handleStatusChange = async (id: string, novoStatus: StatusFuncionario) => {
    try {
      await atualizarFuncionarioNoFirebase(id, { status: novoStatus });
      setNotification({
        type: 'success',
        message: 'Status do colaborador atualizado com sucesso no Firestore!',
      });
      if (selectedFuncionario && selectedFuncionario.id === id) {
        setSelectedFuncionario({
          ...selectedFuncionario,
          status: novoStatus,
        });
      }
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Falha ao atualizar status do colaborador.',
      });
    }
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
                <Briefcase className="w-5 h-5 text-[#8c6b2d]" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">
                  Cadastro & Gestão de Colaboradores
                </h2>
                <p className="text-xs text-stone-500">
                  Corpo técnico, escalas de trabalho, registros em conselhos (COREN/CREFITO/CRN) e saúde ocupacional
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Firestore: /funcionarios</span>
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
              onClick={() => setActiveTab('lista')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'lista'
                  ? 'bg-[#133827] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Quadro de Colaboradores ({funcionarios.length})</span>
            </button>

            {canWrite && (
              <button
                onClick={() => setActiveTab('cadastro')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'cadastro'
                    ? 'bg-[#133827] text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Novo Colaborador</span>
              </button>
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
            Conforme a especificação oficial, nenhuma persistência local em navegador é utilizada.
          </p>
        </div>
      ) : activeTab === 'lista' ? (
        <EmployeeList
          funcionarios={funcionarios}
          isLoading={loading}
          onSelectFuncionario={(f) => setSelectedFuncionario(f)}
          onNewEmployeeClick={() => setActiveTab('cadastro')}
          onRefresh={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
        />
      ) : (
        <EmployeeForm
          onSuccess={handleFormSuccess}
          onOpenConfig={() => {}}
          isFirebaseConnected={true}
        />
      )}

      {/* Modal de Detalhes e Ficha Funcional do Colaborador */}
      <EmployeeDetailsModal
        funcionario={selectedFuncionario}
        onClose={() => setSelectedFuncionario(null)}
        onStatusChange={canWrite ? handleStatusChange : undefined}
      />
    </div>
  );
};
