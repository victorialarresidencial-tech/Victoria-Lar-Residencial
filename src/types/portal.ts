export type SystemModule =
  | 'residentes'
  | 'colaboradores'
  | 'landing_page'
  | 'solicitacoes'
  | 'usuarios'
  | 'seguranca';

export type AuthStateStatus =
  | 'loading'
  | 'unauthenticated'
  | 'unverified_email'
  | 'active_admin'
  | 'active_staff'
  | 'not_provisioned'
  | 'permission_denied'
  | 'network_error';

export type AccessRequestStatus = 'pendente' | 'aprovada' | 'rejeitada';

export interface AccessRequest {
  id: string;
  uid: string;
  nome: string;
  email: string;
  departamento: string;
  cargo: string;
  motivo: string;
  modulosSolicitados: SystemModule[];
  status: AccessRequestStatus;
  criadoEm: string;
  revisadoEm?: string;
  revisadoPorUid?: string;
  revisadoPorEmail?: string;
  justificativaRevisao?: string;
}

export type AccessStatus = 'sem_acesso' | 'pendente' | 'ativo' | 'revogado';

export interface AuthorizedStaffUser {
  id?: string;
  uid?: string;
  email: string;
  nome: string;
  departamento?: string;
  cargo?: string;
  role: 'admin' | 'colaborador';
  modulos: SystemModule[];
  ativo: boolean;
  statusAcesso?: AccessStatus;
  matricula?: string;
  funcionarioId?: string;
  situacaoFuncional?: string;
  concedidoEm?: string;
  concedidoPorUid?: string;
  concedidoPorEmail?: string;
  preparadoEm?: string;
  preparadoPorUid?: string;
  preparadoPorEmail?: string;
  revogadoEm?: string;
  revogadoPorUid?: string;
  revogadoPorEmail?: string;
  atualizadoEm: string;
}

export interface UserPermissions {
  uid: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  ativo: boolean;
  modulos: SystemModule[];
  pendingRequest?: AccessRequest | null;
}
