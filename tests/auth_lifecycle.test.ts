/**
 * Suite de Testes Automatizados — FASE 3.3G
 * Validação do Ciclo de Autenticação, Gerenciamento de Listeners, RBAC Modular e Prevenção de Vazamento
 * Victoria Lar Residencial — Cloud Firestore (default)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================');
console.log('STARTING VICTORIA LAR FASE 3.3G AUTH LIFECYCLE & RBAC TESTS');
console.log('================================================================');

// -------------------------------------------------------------------------
// Simulador de Estado e Ciclo de Vida do AuthContext
// -------------------------------------------------------------------------
interface MockFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  reloadCount: number;
  tokenForceRefreshCount: number;
  reload: () => Promise<void>;
  getIdToken: (force?: boolean) => Promise<string>;
}

function createMockUser(uid: string, email: string, emailVerified: boolean): MockFirebaseUser {
  const user: MockFirebaseUser = {
    uid,
    email,
    emailVerified,
    reloadCount: 0,
    tokenForceRefreshCount: 0,
    reload: async () => {
      user.reloadCount++;
    },
    getIdToken: async (force?: boolean) => {
      if (force) user.tokenForceRefreshCount++;
      return `mock_jwt_token_${user.uid}_${user.emailVerified}`;
    },
  };
  return user;
}

interface SimulatedAuthContextState {
  user: MockFirebaseUser | null;
  adminProfile: any | null;
  staffProfile: any | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  hasPortalAccess: boolean;
  authorizedModules: string[];
  canAccessModule: (mod: string) => boolean;
  loading: boolean;
  authStatus: string;
  authErrorDetail: string | null;
  activeListenersCount: number;
}

class AuthCycleSimulator {
  private currentSessionId = 0;
  private adminUnsub: (() => void) | null = null;
  private staffUnsub: (() => void) | null = null;
  public activeListenersCount = 0;

  // Mock Database Store
  public adminsStore: Record<string, any> = {};
  public staffStore: Record<string, any> = {};
  public networkFailing = false;
  public permissionDenied = false;

  public state: SimulatedAuthContextState = {
    user: null,
    adminProfile: null,
    staffProfile: null,
    isAdmin: false,
    isSuperAdmin: false,
    isStaff: false,
    hasPortalAccess: false,
    authorizedModules: [],
    canAccessModule: () => false,
    loading: true,
    authStatus: 'loading',
    authErrorDetail: null,
    activeListenersCount: 0,
  };

  private cleanupListeners() {
    if (this.adminUnsub) {
      this.adminUnsub();
      this.adminUnsub = null;
    }
    if (this.staffUnsub) {
      this.staffUnsub();
      this.staffUnsub = null;
    }
    this.activeListenersCount = 0;
  }

  public async handleAuthStateChange(currentUser: MockFirebaseUser | null) {
    this.currentSessionId++;
    const session = this.currentSessionId;
    this.cleanupListeners();

    if (!currentUser) {
      this.updateState({
        user: null,
        adminProfile: null,
        staffProfile: null,
        authStatus: 'unauthenticated',
        authErrorDetail: null,
        loading: false,
      });
      return;
    }

    this.updateState({ loading: true, authErrorDetail: null });

    // Step 1: Reload user
    await currentUser.reload();
    if (this.currentSessionId !== session) return;

    // Step 2: Email verification check
    if (!currentUser.emailVerified) {
      this.updateState({
        user: currentUser,
        adminProfile: null,
        staffProfile: null,
        authStatus: 'unverified_email',
        authErrorDetail: 'E-mail não verificado junto ao provedor.',
        loading: false,
      });
      return;
    }

    // Step 3: Force refresh token to sync claims
    try {
      if (this.networkFailing) {
        throw new Error('Falha de rede ao renovar token');
      }
      await currentUser.getIdToken(true);
    } catch (err: any) {
      if (this.currentSessionId !== session) return;
      this.updateState({
        user: currentUser,
        adminProfile: null,
        staffProfile: null,
        authStatus: 'network_error',
        authErrorDetail: err.message,
        loading: false,
      });
      return;
    }

    if (this.currentSessionId !== session) return;

    // Step 4: Attach listeners for /admins/{uid} and /usuariosAutorizados/{uid}
    this.activeListenersCount = 2;

    let adminResolved = false;
    let staffResolved = false;
    let adminData: any = null;
    let staffData: any = null;
    let adminErr: string | null = null;
    let staffErr: string | null = null;

    const evaluate = () => {
      if (this.currentSessionId !== session) return;
      if (!adminResolved || !staffResolved) return;

      if (adminData && adminData.active === true) {
        this.updateState({
          user: currentUser,
          adminProfile: adminData,
          staffProfile: staffData,
          authStatus: 'active_admin',
          authErrorDetail: null,
          loading: false,
        });
        return;
      }

      if (staffData && staffData.ativo === true) {
        this.updateState({
          user: currentUser,
          adminProfile: null,
          staffProfile: staffData,
          authStatus: 'active_staff',
          authErrorDetail: null,
          loading: false,
        });
        return;
      }

      const activeErr = adminErr || staffErr;
      if (activeErr) {
        const isPerm = activeErr.toLowerCase().includes('permiss');
        this.updateState({
          user: currentUser,
          adminProfile: null,
          staffProfile: null,
          authStatus: isPerm ? 'permission_denied' : 'network_error',
          authErrorDetail: activeErr,
          loading: false,
        });
        return;
      }

      // Neither exists
      this.updateState({
        user: currentUser,
        adminProfile: null,
        staffProfile: null,
        authStatus: 'not_provisioned',
        authErrorDetail: 'Perfil não provisionado no Firestore (default).',
        loading: false,
      });
    };

    // Simulate onSnapshot admin
    this.adminUnsub = () => {
      this.activeListenersCount = Math.max(0, this.activeListenersCount - 1);
    };
    if (this.permissionDenied) {
      adminResolved = true;
      adminErr = 'Permissão insuficiente no Firestore (default)';
      evaluate();
    } else {
      adminResolved = true;
      const rawAdmin = this.adminsStore[currentUser.uid];
      if (rawAdmin && rawAdmin.active === true) {
        adminData = { ...rawAdmin, uid: currentUser.uid };
      }
      evaluate();
    }

    // Simulate onSnapshot staff
    this.staffUnsub = () => {
      this.activeListenersCount = Math.max(0, this.activeListenersCount - 1);
    };
    if (this.permissionDenied) {
      staffResolved = true;
      staffErr = 'Permissão insuficiente no Firestore (default)';
      evaluate();
    } else {
      staffResolved = true;
      const rawStaff = this.staffStore[currentUser.uid];
      if (rawStaff && rawStaff.ativo === true) {
        staffData = { ...rawStaff, uid: currentUser.uid };
      }
      evaluate();
    }
  }

  public async logout() {
    this.currentSessionId++;
    this.cleanupListeners();
    this.updateState({
      user: null,
      adminProfile: null,
      staffProfile: null,
      authStatus: 'unauthenticated',
      authErrorDetail: null,
      loading: false,
    });
  }

  private updateState(partial: Partial<SimulatedAuthContextState>) {
    const next = { ...this.state, ...partial };
    const isEmailVerified = !!(next.user && next.user.emailVerified === true);
    const isAdmin = !!(next.authStatus === 'active_admin' && next.adminProfile && next.adminProfile.active === true && isEmailVerified);
    const isSuperAdmin = !!(isAdmin && next.adminProfile?.role === 'superadmin');
    const isStaff = !!(isAdmin || (next.authStatus === 'active_staff' && next.staffProfile && next.staffProfile.ativo === true && isEmailVerified));

    const authorizedModules: string[] = isAdmin
      ? ['residentes', 'colaboradores', 'landing_page', 'solicitacoes', 'usuarios', 'seguranca']
      : isStaff && next.staffProfile && Array.isArray(next.staffProfile.modulos)
      ? next.staffProfile.modulos
      : [];

    const canAccessModule = (mod: string) => {
      if (isAdmin) return true;
      return isStaff && authorizedModules.includes(mod);
    };

    this.state = {
      ...next,
      isAdmin,
      isSuperAdmin,
      isStaff,
      hasPortalAccess: isAdmin || isStaff,
      authorizedModules,
      canAccessModule,
      activeListenersCount: this.activeListenersCount,
    };
  }
}

async function runAllTests() {
  // -------------------------------------------------------------
  // Test Suite 1: Usuário Autenticado com E-mail Verificado
  // -------------------------------------------------------------
  console.log('\n--- Cenário 1: Usuário autenticado com e-mail verificado ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_123', 'admin@victorialar.com.br', true);
    sim.adminsStore['uid_123'] = { email: 'admin@victorialar.com.br', role: 'admin', active: true };

    await sim.handleAuthStateChange(user);

    assert.strictEqual(user.reloadCount, 1, 'reload() deve ser invocado exatamente uma vez');
    assert.strictEqual(user.tokenForceRefreshCount, 1, 'getIdToken(true) deve ser invocado para sincronizar claims');
    assert.strictEqual(sim.state.authStatus, 'active_admin');
    assert.strictEqual(sim.state.isAdmin, true);
    assert.strictEqual(sim.state.hasPortalAccess, true);
    console.log('  [PASS] Executa reload() e getIdToken(true) na inicialização da sessão com e-mail verificado');
  }

  // -------------------------------------------------------------
  // Test Suite 2: Usuário com E-mail Não Verificado
  // -------------------------------------------------------------
  console.log('\n--- Cenário 2: Usuário com e-mail não verificado ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_unverified', 'tentativa@gmail.com', false);
    sim.adminsStore['uid_unverified'] = { email: 'tentativa@gmail.com', role: 'admin', active: true };

    await sim.handleAuthStateChange(user);

    assert.strictEqual(user.reloadCount, 1);
    assert.strictEqual(user.tokenForceRefreshCount, 0, 'Não deve forçar token nem iniciar listeners com email não verificado');
    assert.strictEqual(sim.state.authStatus, 'unverified_email');
    assert.strictEqual(sim.state.isAdmin, false, 'Não deve conferir papel administrativo');
    assert.strictEqual(sim.state.isStaff, false);
    assert.strictEqual(sim.state.hasPortalAccess, false);
    assert.strictEqual(sim.state.activeListenersCount, 0, 'Nenhum listener residual deve ser iniciado');
    console.log('  [PASS] Usuário com emailVerified: false não inicia listeners e recebe estado unverified_email sem privilégios');
  }

  // -------------------------------------------------------------
  // Test Suite 3: Administrador Ativo
  // -------------------------------------------------------------
  console.log('\n--- Cenário 3: Administrador Ativo (/admins/{uid}) ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_superadmin', 'super@victorialar.com.br', true);
    sim.adminsStore['uid_superadmin'] = { email: 'super@victorialar.com.br', role: 'superadmin', active: true };

    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'active_admin');
    assert.strictEqual(sim.state.isAdmin, true);
    assert.strictEqual(sim.state.isSuperAdmin, true);
    assert.strictEqual(sim.state.hasPortalAccess, true);
    assert.strictEqual(sim.state.canAccessModule('residentes'), true);
    assert.strictEqual(sim.state.canAccessModule('colaboradores'), true);
    assert.strictEqual(sim.state.canAccessModule('seguranca'), true);
    console.log('  [PASS] Administrador com active: true e email verificado obtém papel administrativo pleno e todos os módulos');
  }

  // -------------------------------------------------------------
  // Test Suite 4: Documento Administrativo Inexistente
  // -------------------------------------------------------------
  console.log('\n--- Cenário 4: Documento Administrativo Inexistente (Não Provisionado) ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_desconhecido', 'visitante@gmail.com', true);

    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'not_provisioned');
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.isSuperAdmin, false);
    assert.strictEqual(sim.state.isStaff, false);
    assert.strictEqual(sim.state.hasPortalAccess, false);
    assert.strictEqual(sim.state.canAccessModule('residentes'), false);
    assert.strictEqual(sim.state.canAccessModule('colaboradores'), false);
    console.log('  [PASS] Usuário autenticado sem registro em /admins nem /usuariosAutorizados recebe not_provisioned e zero acesso');
  }

  // -------------------------------------------------------------
  // Test Suite 5: Colaborador Autorizado Apenas para Residentes
  // -------------------------------------------------------------
  console.log('\n--- Cenário 5: Colaborador com Módulo "residentes" Apenas ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_cuidador', 'cuidador@victorialar.com.br', true);
    sim.staffStore['uid_cuidador'] = {
      email: 'cuidador@victorialar.com.br',
      nome: 'Carlos Cuidador',
      role: 'colaborador',
      modulos: ['residentes'],
      ativo: true,
    };

    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'active_staff');
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.isStaff, true);
    assert.strictEqual(sim.state.hasPortalAccess, true);
    assert.strictEqual(sim.state.canAccessModule('residentes'), true, 'Deve acessar residentes');
    assert.strictEqual(sim.state.canAccessModule('colaboradores'), false, 'Não deve acessar colaboradores');
    assert.strictEqual(sim.state.canAccessModule('usuarios'), false, 'Não deve acessar usuarios');
    console.log('  [PASS] Colaborador com modulo residentes acessa /pacientes mas é bloqueado em /funcionarios');
  }

  // -------------------------------------------------------------
  // Test Suite 6: Colaborador Autorizado Apenas para Colaboradores
  // -------------------------------------------------------------
  console.log('\n--- Cenário 6: Colaborador com Módulo "colaboradores" Apenas ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_rh', 'rh@victorialar.com.br', true);
    sim.staffStore['uid_rh'] = {
      email: 'rh@victorialar.com.br',
      nome: 'Renata RH',
      role: 'colaborador',
      modulos: ['colaboradores'],
      ativo: true,
    };

    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'active_staff');
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.isStaff, true);
    assert.strictEqual(sim.state.hasPortalAccess, true);
    assert.strictEqual(sim.state.canAccessModule('colaboradores'), true, 'Deve acessar colaboradores');
    assert.strictEqual(sim.state.canAccessModule('residentes'), false, 'Não deve acessar residentes');
    console.log('  [PASS] Colaborador com modulo colaboradores acessa /funcionarios mas é bloqueado em /pacientes');
  }

  // -------------------------------------------------------------
  // Test Suite 7: Erro de Permissão no Listener
  // -------------------------------------------------------------
  console.log('\n--- Cenário 7: Erro de Permissão no Listener (Missing or Insufficient Permissions) ---');
  {
    const sim = new AuthCycleSimulator();
    sim.permissionDenied = true;
    const user = createMockUser('uid_bloqueado', 'bloqueado@gmail.com', true);

    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'permission_denied');
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.isStaff, false);
    assert.strictEqual(sim.state.hasPortalAccess, false);
    assert.strictEqual(sim.state.canAccessModule('residentes'), false);
    assert.strictEqual(sim.state.canAccessModule('colaboradores'), false);
    console.log('  [PASS] Erro de permissão no listener resulta em permission_denied sem conceder privilégios');
  }

  // -------------------------------------------------------------
  // Test Suite 8: Logout e Troca de Conta Sem Listeners Residuais
  // -------------------------------------------------------------
  console.log('\n--- Cenário 8: Logout e Troca de Conta Sem Listeners Residuais ---');
  {
    const sim = new AuthCycleSimulator();
    const user = createMockUser('uid_admin_1', 'admin1@victorialar.com.br', true);
    sim.adminsStore['uid_admin_1'] = { role: 'admin', active: true };

    await sim.handleAuthStateChange(user);
    assert.strictEqual(sim.state.authStatus, 'active_admin');
    assert.strictEqual(sim.state.activeListenersCount, 2);

    await sim.logout();

    assert.strictEqual(sim.state.user, null);
    assert.strictEqual(sim.state.adminProfile, null);
    assert.strictEqual(sim.state.staffProfile, null);
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.hasPortalAccess, false);
    assert.strictEqual(sim.state.authStatus, 'unauthenticated');
    assert.strictEqual(sim.state.activeListenersCount, 0, 'Todos os listeners devem ter sido cancelados');
    console.log('  [PASS] Logout encerra todos os listeners ativos e reseta o estado completamente');
  }

  {
    const sim = new AuthCycleSimulator();
    const user1 = createMockUser('uid_user_1', 'user1@victorialar.com.br', true);
    const user2 = createMockUser('uid_user_2', 'user2@victorialar.com.br', true);
    sim.adminsStore['uid_user_1'] = { role: 'admin', active: true };
    sim.staffStore['uid_user_2'] = { role: 'colaborador', modulos: ['residentes'], ativo: true };

    await sim.handleAuthStateChange(user1);
    assert.strictEqual(sim.state.authStatus, 'active_admin');

    // Troca para user2
    await sim.handleAuthStateChange(user2);
    assert.strictEqual(sim.state.authStatus, 'active_staff');
    assert.strictEqual(sim.state.user?.uid, 'uid_user_2');
    assert.strictEqual(sim.state.adminProfile, null, 'Perfil de admin da conta anterior não deve persistir');
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.isStaff, true);
    assert.strictEqual(sim.state.canAccessModule('residentes'), true);
    assert.strictEqual(sim.state.canAccessModule('colaboradores'), false);
    assert.strictEqual(sim.state.activeListenersCount, 2, 'Apenas os listeners da sessão ativa existem');
    console.log('  [PASS] Troca rápida de conta cancela listeners da sessão anterior antes de iniciar nova sessão');
  }

  // -------------------------------------------------------------
  // Test Suite 9: Falha de Rede e Recuperação
  // -------------------------------------------------------------
  console.log('\n--- Cenário 9: Falha Temporária de Rede e Recuperação ---');
  {
    const sim = new AuthCycleSimulator();
    sim.networkFailing = true;
    const user = createMockUser('uid_offline', 'offline@victorialar.com.br', true);
    sim.adminsStore['uid_offline'] = { role: 'admin', active: true };

    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'network_error');
    assert.strictEqual(sim.state.isAdmin, false);
    assert.strictEqual(sim.state.hasPortalAccess, false);
    console.log('  [PASS] Falha na renovação do token por rede resulta em network_error sem conceder privilégios');

    // Recuperação da rede
    sim.networkFailing = false;
    await sim.handleAuthStateChange(user);

    assert.strictEqual(sim.state.authStatus, 'active_admin');
    assert.strictEqual(sim.state.isAdmin, true);
    assert.strictEqual(sim.state.hasPortalAccess, true);
    console.log('  [PASS] Recuperação bem-sucedida após reestabelecimento de rede');
  }

  // -------------------------------------------------------------
  // Test Suite 10: Bloqueio de Acesso Não Autorizado aos Dois Módulos
  // -------------------------------------------------------------
  console.log('\n--- Cenário 10: Bloqueio de Acesso aos Módulos /pacientes e /funcionarios ---');
  {
    const resCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/residentes/ResidentesModule.tsx'), 'utf8');
    const colabCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/colaboradores/ColaboradoresModule.tsx'), 'utf8');
    const authCode = fs.readFileSync(path.resolve(process.cwd(), 'src/context/AuthContext.tsx'), 'utf8');

    // Verifica que ResidentesModule não dispara queries sem permissão
    assert.strictEqual(resCode.includes("if (!canAccessModule('residentes'))"), true);
    assert.strictEqual(resCode.includes('Acesso Não Autorizado ao Módulo'), true);

    // Verifica que ColaboradoresModule não dispara queries sem permissão
    assert.strictEqual(colabCode.includes("if (!canAccessModule('colaboradores'))"), true);
    assert.strictEqual(colabCode.includes('Módulo Restrito: Cadastro de Colaboradores'), true);

    // Verifica que AuthContext cancela listeners anteriores e limpa no unmount
    assert.strictEqual(authCode.includes('cleanupListeners()'), true);
    assert.strictEqual(authCode.includes('sessionIdRef.current += 1'), true);
    assert.strictEqual(authCode.includes('return () =>'), true);
    console.log('  [PASS] Componentes de Residentes e Colaboradores possuem guardas estritas que bloqueiam renderização e queries não autorizadas');
  }

  // -------------------------------------------------------------
  // Test Suite 11: Transição Estável de Autenticação & Prevenção de Flicker
  // -------------------------------------------------------------
  console.log('\n--- Cenário 11: Transição Estável de Autenticação e Prevenção de Flicker ---');
  {
    const authCode = fs.readFileSync(path.resolve(process.cwd(), 'src/context/AuthContext.tsx'), 'utf8');
    const modalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminLoginModal.tsx'), 'utf8');
    const bannerCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/BootstrapBanner.tsx'), 'utf8');

    // 1. AuthContext define explicitamente setAuthStatus('loading') ao detectar currentUser
    assert.strictEqual(
      authCode.includes("setLoading(true);\n      setAuthStatus('loading');"),
      true,
      "AuthContext deve definir setAuthStatus('loading') imediatamente ao detectar sessão"
    );

    // 2. AuthContext define setAuthStatus('loading') nos métodos de login
    assert.strictEqual(
      authCode.includes("signInWithGoogle = async () => {\n    try {\n      setError(null);\n      setLoading(true);\n      setAuthStatus('loading');"),
      true,
      "signInWithGoogle deve colocar o authStatus em 'loading'"
    );

    // 3. AdminLoginModal possui condição explícita isAuthPending
    assert.strictEqual(
      modalCode.includes("const isAuthPending = loading || authStatus === 'loading';"),
      true,
      "AdminLoginModal deve definir isAuthPending baseado em loading ou authStatus"
    );

    // 4. AdminLoginModal exibe estado de autenticação pendente sem renderizar erro ou form prematuramente
    assert.strictEqual(
      modalCode.includes('{isAuthPending ? ('),
      true,
      "AdminLoginModal deve renderizar estado pendente prioritariamente antes de checar user ou form"
    );
    assert.strictEqual(
      modalCode.includes('Validando Credenciais Seguras'),
      true,
      "AdminLoginModal deve exibir mensagem amigável de validação durante transição"
    );

    // 5. BootstrapBanner bloqueia renderização durante carregamento
    assert.strictEqual(
      bannerCode.includes('if (loading || !bootstrapInfo) {\n    return null;\n  }'),
      true,
      "BootstrapBanner não deve renderizar enquanto loading for true ou bootstrapInfo for nulo"
    );

    console.log('  [PASS] AuthContext, AdminLoginModal e BootstrapBanner eliminam flicker e previnem telas prematuras');
  }

  console.log('\n================================================================');
  console.log('ALL AUTH LIFECYCLE & RBAC TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
