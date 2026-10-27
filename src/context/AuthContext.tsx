import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  browserPopupRedirectResolver,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AdminUser, AuthorizedStaffUser, SystemModule, AuthStateStatus } from '../types';

interface AuthContextType {
  user: User | null;
  adminProfile: AdminUser | null;
  staffProfile: AuthorizedStaffUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  authorizedModules: SystemModule[];
  hasPortalAccess: boolean;
  canAccessModule: (mod: SystemModule) => boolean;
  loading: boolean;
  error: string | null;
  authStatus: AuthStateStatus;
  authErrorDetail: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdminProfile: () => Promise<void>;
  reloadUserSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  adminProfile: null,
  staffProfile: null,
  isAdmin: false,
  isSuperAdmin: false,
  isStaff: false,
  authorizedModules: [],
  hasPortalAccess: false,
  canAccessModule: () => false,
  loading: true,
  error: null,
  authStatus: 'loading',
  authErrorDetail: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  logout: async () => {},
  refreshAdminProfile: async () => {},
  reloadUserSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [staffProfile, setStaffProfile] = useState<AuthorizedStaffUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStateStatus>('loading');
  const [authErrorDetail, setAuthErrorDetail] = useState<string | null>(null);

  // Strict session lifecycle tracking
  const sessionIdRef = useRef<number>(0);
  const adminUnsubRef = useRef<(() => void) | null>(null);
  const staffUnsubRef = useRef<(() => void) | null>(null);
  const lastReloadUidRef = useRef<string | null>(null);
  const lastReloadTimeRef = useRef<number>(0);

  const cleanupListeners = () => {
    if (adminUnsubRef.current) {
      try {
        adminUnsubRef.current();
      } catch {
        // Safe disposal
      }
      adminUnsubRef.current = null;
    }
    if (staffUnsubRef.current) {
      try {
        staffUnsubRef.current();
      } catch {
        // Safe disposal
      }
      staffUnsubRef.current = null;
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      sessionIdRef.current += 1;
      const currentSession = sessionIdRef.current;

      // Immediately cancel any listeners from the previous session/user
      cleanupListeners();

      if (!currentUser) {
        setUser(null);
        setAdminProfile(null);
        setStaffProfile(null);
        setError(null);
        setAuthErrorDetail(null);
        setAuthStatus('unauthenticated');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setAuthErrorDetail(null);

      // Etapa 1: Ao detectar sessão autenticada, sincronizar usuário com reload() quando apropriado
      const now = Date.now();
      const shouldReload =
        lastReloadUidRef.current !== currentUser.uid || now - lastReloadTimeRef.current > 15000;

      if (shouldReload) {
        try {
          await currentUser.reload();
          lastReloadUidRef.current = currentUser.uid;
          lastReloadTimeRef.current = Date.now();
        } catch (reloadErr: any) {
          console.warn('[Auth Reload Warning]:', reloadErr?.message || reloadErr);
          if (
            reloadErr?.code === 'auth/user-disabled' ||
            reloadErr?.code === 'auth/user-not-found'
          ) {
            if (sessionIdRef.current !== currentSession) return;
            cleanupListeners();
            await firebaseSignOut(auth).catch(() => {});
            setUser(null);
            setAdminProfile(null);
            setStaffProfile(null);
            setAuthStatus('unauthenticated');
            setAuthErrorDetail('Conta desativada ou não encontrada.');
            setLoading(false);
            return;
          }
        }
      }

      if (sessionIdRef.current !== currentSession) return;

      const freshUser = auth.currentUser || currentUser;
      setUser(freshUser);

      // Verificação do e-mail: se não verificado, interrompe antes de iniciar listeners no Firestore
      if (!freshUser.emailVerified) {
        setAdminProfile(null);
        setStaffProfile(null);
        setAuthStatus('unverified_email');
        setAuthErrorDetail('E-mail não verificado junto ao provedor de autenticação.');
        setLoading(false);
        return;
      }

      // Sincroniza o claim do token forçando renovação controlada
      try {
        await freshUser.getIdToken(true);
      } catch (tokenErr: any) {
        console.warn('[Auth Token Sync Warning]:', tokenErr?.message || tokenErr);
        if (sessionIdRef.current !== currentSession) return;
        // Trate falhas de renovação sem conceder acesso por padrão
        setAdminProfile(null);
        setStaffProfile(null);
        setAuthStatus('network_error');
        setAuthErrorDetail('Falha ao sincronizar credenciais seguras do token.');
        setLoading(false);
        return;
      }

      if (sessionIdRef.current !== currentSession) return;

      // Etapa 2: Iniciar listeners de perfil apenas após verificação inicial de autenticação concluída
      let adminResolved = false;
      let staffResolved = false;
      let adminData: AdminUser | null = null;
      let staffData: AuthorizedStaffUser | null = null;
      let adminError: { type: 'permission_denied' | 'network_error'; message: string } | null = null;
      let staffError: { type: 'permission_denied' | 'network_error'; message: string } | null = null;

      const evaluateProfiles = () => {
        if (sessionIdRef.current !== currentSession) return;
        if (!adminResolved || !staffResolved) return;

        // Administrador ativo com e-mail verificado
        if (adminData && adminData.active === true) {
          setAdminProfile(adminData);
          setStaffProfile(staffData);
          setAuthStatus('active_admin');
          setAuthErrorDetail(null);
          setError(null);
          setLoading(false);
          return;
        }

        // Colaborador autorizado ativo com e-mail verificado
        if (staffData && staffData.ativo === true) {
          setAdminProfile(null);
          setStaffProfile(staffData);
          setAuthStatus('active_staff');
          setAuthErrorDetail(null);
          setError(null);
          setLoading(false);
          return;
        }

        // Erros de autorização ou rede
        const priorityError = adminError || staffError;
        if (priorityError) {
          setAdminProfile(null);
          setStaffProfile(null);
          setAuthStatus(priorityError.type);
          setAuthErrorDetail(priorityError.message);
          setError(priorityError.message);
          setLoading(false);
          return;
        }

        // Nenhum erro, porém documento inexistente em ambos
        setAdminProfile(null);
        setStaffProfile(null);
        setAuthStatus('not_provisioned');
        setAuthErrorDetail(
          'Usuário autenticado, porém não provisionado em /admins ou /usuariosAutorizados no banco (default).'
        );
        setError(null);
        setLoading(false);
      };

      // 1. Listener de /admins/{uid}
      const adminDocRef = doc(db, 'admins', freshUser.uid);
      const unsubAdmin = onSnapshot(
        adminDocRef,
        (snapshot) => {
          if (sessionIdRef.current !== currentSession) return;
          adminResolved = true;
          adminError = null;

          if (snapshot.exists()) {
            const data = snapshot.data();
            if (
              data &&
              data.active === true &&
              (data.role === 'admin' || data.role === 'superadmin')
            ) {
              adminData = {
                uid: freshUser.uid,
                email: data.email || freshUser.email || '',
                role: data.role,
                active: true,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || '',
                bootstrapStatus: data.bootstrapStatus,
              };
            } else {
              adminData = null;
            }
          } else {
            adminData = null;
          }
          evaluateProfiles();
        },
        (err) => {
          if (sessionIdRef.current !== currentSession) return;
          adminResolved = true;
          adminData = null;
          const msg = err?.message || String(err);
          if (
            msg.includes('permission-denied') ||
            msg.includes('Missing or insufficient permissions')
          ) {
            adminError = {
              type: 'permission_denied',
              message: 'Permissão de leitura negada para perfil administrativo no Firestore (default).',
            };
          } else if (
            msg.includes('unavailable') ||
            msg.includes('offline') ||
            msg.includes('network')
          ) {
            adminError = {
              type: 'network_error',
              message: 'Falha temporária de rede ao consultar /admins.',
            };
          } else {
            adminError = {
              type: 'permission_denied',
              message: msg,
            };
          }
          evaluateProfiles();
        }
      );
      adminUnsubRef.current = unsubAdmin;

      // 2. Listener de /usuariosAutorizados/{uid}
      const staffDocRef = doc(db, 'usuariosAutorizados', freshUser.uid);
      const unsubStaff = onSnapshot(
        staffDocRef,
        (snapshot) => {
          if (sessionIdRef.current !== currentSession) return;
          staffResolved = true;
          staffError = null;

          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data && data.ativo === true) {
              staffData = {
                uid: freshUser.uid,
                email: data.email || freshUser.email || '',
                nome: data.nome || '',
                departamento: data.departamento,
                cargo: data.cargo,
                role: data.role || 'colaborador',
                modulos: Array.isArray(data.modulos) ? data.modulos : ['residentes'],
                ativo: true,
                concedidoEm: data.concedidoEm || '',
                concedidoPorUid: data.concedidoPorUid,
                concedidoPorEmail: data.concedidoPorEmail,
                atualizadoEm: data.atualizadoEm || '',
              };
            } else {
              staffData = null;
            }
          } else {
            staffData = null;
          }
          evaluateProfiles();
        },
        (err) => {
          if (sessionIdRef.current !== currentSession) return;
          staffResolved = true;
          staffData = null;
          const msg = err?.message || String(err);
          if (
            msg.includes('permission-denied') ||
            msg.includes('Missing or insufficient permissions')
          ) {
            staffError = {
              type: 'permission_denied',
              message: 'Permissão de leitura negada para perfil de colaborador no Firestore (default).',
            };
          } else if (
            msg.includes('unavailable') ||
            msg.includes('offline') ||
            msg.includes('network')
          ) {
            staffError = {
              type: 'network_error',
              message: 'Falha temporária de rede ao consultar /usuariosAutorizados.',
            };
          } else {
            staffError = {
              type: 'permission_denied',
              message: msg,
            };
          }
          evaluateProfiles();
        }
      );
      staffUnsubRef.current = unsubStaff;
    });

    // Clean up on component unmount
    return () => {
      sessionIdRef.current += 1;
      cleanupListeners();
      unsubscribeAuth();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (err: any) {
      console.error('Falha no login com Google:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('A janela de autenticação foi fechada antes de concluir.');
      } else {
        setError(err?.message || 'Falha ao autenticar com Google');
      }
      setLoading(false);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      setError(null);
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error('Falha no login por email:', err);
      if (
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/invalid-credential'
      ) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err?.message || 'Falha na autenticação.');
      }
      setLoading(false);
      throw err;
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    try {
      setError(null);
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error('Falha no cadastro por email:', err);
      if (err?.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado. Tente entrar com sua senha.');
      } else if (err?.code === 'auth/weak-password') {
        setError('A senha deve ter no mínimo 6 caracteres.');
      } else {
        setError(err?.message || 'Falha ao registrar usuário.');
      }
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    sessionIdRef.current += 1;
    cleanupListeners();
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      console.error('Erro ao encerrar sessão:', err);
    } finally {
      setUser(null);
      setAdminProfile(null);
      setStaffProfile(null);
      setAuthStatus('unauthenticated');
      setAuthErrorDetail(null);
      setError(null);
      setLoading(false);
    }
  };

  const reloadUserSession = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      sessionIdRef.current += 1;
      const currentSession = sessionIdRef.current;
      cleanupListeners();

      const freshUser = auth.currentUser;
      setUser(freshUser);

      if (!freshUser.emailVerified) {
        setAdminProfile(null);
        setStaffProfile(null);
        setAuthStatus('unverified_email');
        setAuthErrorDetail('E-mail não verificado junto ao provedor de autenticação.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.warn('Erro ao atualizar sessão:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAdminProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'admins', auth.currentUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d && d.active === true && (d.role === 'admin' || d.role === 'superadmin')) {
          setAdminProfile({
            uid: auth.currentUser.uid,
            email: d.email || auth.currentUser.email || '',
            role: d.role,
            active: true,
            createdAt: d.createdAt || '',
            updatedAt: d.updatedAt || '',
            bootstrapStatus: d.bootstrapStatus,
          });
          setAuthStatus('active_admin');
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `admins/${auth.currentUser.uid}`);
    }
  };

  // Princípio do menor privilégio & Verificação Criptográfica de Identidade:
  // Administrador estritamente requer:
  // 1. authStatus === 'active_admin' (leitura autorizada confirmada no Firestore)
  // 2. adminProfile.active === true
  // 3. user.emailVerified === true
  const isEmailVerified = !!(user && user.emailVerified === true);
  const isAdmin = !!(
    authStatus === 'active_admin' &&
    adminProfile &&
    adminProfile.active === true &&
    isEmailVerified
  );
  const isSuperAdmin = !!(isAdmin && adminProfile?.role === 'superadmin');
  const isStaff = !!(
    isAdmin ||
    (authStatus === 'active_staff' &&
      staffProfile &&
      staffProfile.ativo === true &&
      isEmailVerified)
  );

  const authorizedModules: SystemModule[] = isAdmin
    ? ['residentes', 'colaboradores', 'landing_page', 'solicitacoes', 'usuarios', 'seguranca']
    : isStaff && staffProfile && Array.isArray(staffProfile.modulos)
    ? staffProfile.modulos
    : [];

  const canAccessModule = (mod: SystemModule): boolean => {
    if (isAdmin) return true;
    return isStaff && authorizedModules.includes(mod);
  };

  const hasPortalAccess = isAdmin || isStaff;

  return (
    <AuthContext.Provider
      value={{
        user,
        adminProfile,
        staffProfile,
        isAdmin,
        isSuperAdmin,
        isStaff,
        authorizedModules,
        hasPortalAccess,
        canAccessModule,
        loading,
        error,
        authStatus,
        authErrorDetail,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        logout,
        refreshAdminProfile,
        reloadUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
