import { auth } from '../lib/firebase';
import { AccessRequest, AuthorizedStaffUser, SystemModule, UserPermissions } from '../types/portal';

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado.');
  }
  return user.getIdToken();
}

/**
 * Consulta as permissões atuais do usuário autenticado no backend confiável.
 */
export async function fetchUserPermissions(): Promise<UserPermissions> {
  const token = await getIdToken();
  const response = await fetch('/api/user/permissions', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao consultar permissões do usuário.');
  }

  const data = await response.json();
  return data.permissions;
}

/**
 * Submete uma solicitação de acesso para a diretoria/administração da instituição.
 */
export async function submitAccessRequest(params: {
  nome: string;
  departamento: string;
  cargo: string;
  motivo: string;
  modulosSolicitados: SystemModule[];
}): Promise<AccessRequest> {
  const token = await getIdToken();
  const response = await fetch('/api/access-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao submeter solicitação de acesso.');
  }

  const data = await response.json();
  return data.request;
}

/**
 * Lista todas as solicitações de acesso (exclusivo para administradores ativos).
 */
export async function fetchAccessRequests(): Promise<AccessRequest[]> {
  const token = await getIdToken();
  const response = await fetch('/api/access-requests', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao buscar solicitações de acesso.');
  }

  const data = await response.json();
  return data.requests || [];
}

/**
 * Revisa (aprova ou rejeita) uma solicitação de acesso com concessão granular de módulos.
 */
export async function reviewAccessRequest(
  requestId: string,
  params: {
    status: 'aprovada' | 'rejeitada';
    justificativa?: string;
    modulos?: SystemModule[];
    role?: 'admin' | 'colaborador';
  }
): Promise<{ success: boolean; message: string }> {
  const token = await getIdToken();
  const response = await fetch(`/api/access-requests/${requestId}/review`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao revisar solicitação de acesso.');
  }

  return response.json();
}

/**
 * Lista funcionários/colaboradores autorizados com suas respectivas permissões de módulo.
 */
export async function fetchStaffUsers(): Promise<AuthorizedStaffUser[]> {
  const token = await getIdToken();
  const response = await fetch('/api/staff-users', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao consultar colaboradores autorizados.');
  }

  const data = await response.json();
  return data.staff || [];
}

/**
 * Atualiza status (ativo/inativo) ou módulos de um colaborador autorizado.
 */
export async function updateStaffUser(
  uid: string,
  params: {
    ativo?: boolean;
    modulos?: SystemModule[];
    role?: 'admin' | 'colaborador';
  }
): Promise<{ success: boolean; message: string }> {
  const token = await getIdToken();
  const response = await fetch(`/api/staff-users/${uid}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao atualizar colaborador.');
  }

  return response.json();
}
