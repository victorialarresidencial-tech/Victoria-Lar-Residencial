import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { AdminUser } from '../types';
import { AuthorizedStaffUser, SystemModule } from '../types/portal';

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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdminProfile: () => Promise<void>;
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
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  logout: async () => {},
  refreshAdminProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [staffProfile, setStaffProfile] = useState<AuthorizedStaffUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChanged with memory-only persistence
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError(null);

      if (!currentUser) {
        setAdminProfile(null);
        setStaffProfile(null);
        setLoading(false);
        return;
      }

      // Check live database active state in /admins/{uid}
      const adminDocRef = doc(db, 'admins', currentUser.uid);
      const staffDocRef = doc(db, 'usuariosAutorizados', currentUser.uid);

      let adminLoaded = false;
      let staffLoaded = false;

      const checkFinishLoading = () => {
        if (adminLoaded && staffLoaded) {
          setLoading(false);
        }
      };

      const unsubscribeAdmin = onSnapshot(
        adminDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AdminUser;
            setAdminProfile({
              uid: currentUser.uid,
              email: data.email || currentUser.email || '',
              role: data.role || 'admin',
              active: data.active === true,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
              bootstrapStatus: data.bootstrapStatus,
            });
          } else {
            setAdminProfile(null);
          }
          adminLoaded = true;
          checkFinishLoading();
        },
        (err) => {
          console.warn('[Admin Snapshot Permission Notice]', err.message);
          setAdminProfile(null);
          adminLoaded = true;
          checkFinishLoading();
        }
      );

      const unsubscribeStaff = onSnapshot(
        staffDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AuthorizedStaffUser;
            setStaffProfile({
              uid: currentUser.uid,
              email: data.email || currentUser.email || '',
              nome: data.nome || '',
              departamento: data.departamento,
              cargo: data.cargo,
              role: data.role || 'colaborador',
              modulos: Array.isArray(data.modulos) ? data.modulos : ['residentes'],
              ativo: data.ativo === true,
              concedidoEm: data.concedidoEm || '',
              concedidoPorUid: data.concedidoPorUid,
              concedidoPorEmail: data.concedidoPorEmail,
              atualizadoEm: data.atualizadoEm || '',
            });
          } else {
            setStaffProfile(null);
          }
          staffLoaded = true;
          checkFinishLoading();
        },
        (err) => {
          console.warn('[Staff Snapshot Permission Notice]', err.message);
          setStaffProfile(null);
          staffLoaded = true;
          checkFinishLoading();
        }
      );

      return () => {
        unsubscribeAdmin();
        unsubscribeStaff();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Pass browserPopupRedirectResolver explicitly to prevent auth/argument-error
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
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setAdminProfile(null);
    } catch (err: any) {
      console.error('Erro ao encerrar sessão:', err);
    }
  };

  const refreshAdminProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'admins', auth.currentUser.uid));
      if (snap.exists()) {
        setAdminProfile(snap.data() as AdminUser);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `admins/${auth.currentUser.uid}`);
    }
  };

  // Live database active check & Verified Identity:
  // Administrative authorization strictly REQUIRES:
  // 1. A cryptographically verified email from request/auth credentials (user.emailVerified === true)
  // 2. An active admin record in /admins/{uid} (adminProfile.active === true)
  // Email string comparison alone NEVER confers privileges!
  const isEmailVerified = !!(user && user.emailVerified === true);
  const isAdmin = !!(adminProfile && adminProfile.active === true && isEmailVerified);
  const isSuperAdmin = !!(isAdmin && adminProfile?.role === 'superadmin');
  const isStaff = !!(isAdmin || (staffProfile && staffProfile.ativo === true && isEmailVerified));

  const authorizedModules: SystemModule[] = isAdmin
    ? ['residentes', 'colaboradores', 'landing_page', 'solicitacoes', 'usuarios', 'seguranca']
    : (isStaff && Array.isArray(staffProfile?.modulos) ? staffProfile.modulos : []);

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
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        logout,
        refreshAdminProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
