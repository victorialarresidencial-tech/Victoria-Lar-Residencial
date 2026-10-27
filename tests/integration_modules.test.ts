import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================');
console.log('STARTING VICTORIA LAR FASE 3.3B INTEGRATION ACCEPTANCE TESTS');
console.log('================================================================');

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => console.log(`  [PASS] ${name}`),
        (err) => {
          console.error(`  [FAIL] ${name}:`, err);
          process.exitCode = 1;
        }
      );
    }
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Test 1: Verificação de Ausência Absoluta de LocalStorage / Mocks
// -------------------------------------------------------------
console.log('\n--- Test Suite 1: Proibição Estrita de Armazenamento Local / Fallbacks ---');

test('Arquivos de serviço de residentes e colaboradores não utilizam localStorage', () => {
  const residentesPath = path.resolve(process.cwd(), 'src/services/residentesService.ts');
  const colaboradoresPath = path.resolve(process.cwd(), 'src/services/colaboradoresService.ts');

  const contentRes = fs.readFileSync(residentesPath, 'utf8');
  const contentColab = fs.readFileSync(colaboradoresPath, 'utf8');

  assert.strictEqual(contentRes.includes('localStorage'), false, 'residentesService.ts não deve conter localStorage');
  assert.strictEqual(contentRes.includes('sessionStorage'), false, 'residentesService.ts não deve conter sessionStorage');
  assert.strictEqual(contentColab.includes('localStorage'), false, 'colaboradoresService.ts não deve conter localStorage');
  assert.strictEqual(contentColab.includes('sessionStorage'), false, 'colaboradoresService.ts não deve conter sessionStorage');
});

test('Componentes integrados em src/components/residentes e colaboradores não utilizam localStorage', () => {
  const filesToCheck = [
    'src/components/residentes/PatientForm.tsx',
    'src/components/residentes/PatientList.tsx',
    'src/components/residentes/PatientDetailsModal.tsx',
    'src/components/residentes/ResidentesModule.tsx',
    'src/components/colaboradores/EmployeeForm.tsx',
    'src/components/colaboradores/EmployeeList.tsx',
    'src/components/colaboradores/EmployeeDetailsModal.tsx',
    'src/components/colaboradores/ColaboradoresModule.tsx',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.strictEqual(fs.existsSync(fullPath), true, `Arquivo deve existir: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.strictEqual(content.includes('localStorage'), false, `${relPath} não deve conter localStorage`);
    assert.strictEqual(content.includes('sessionStorage'), false, `${relPath} não deve conter sessionStorage`);
  }
});

// -------------------------------------------------------------
// Test 2: Configuração e Destino do Firebase Oficial
// -------------------------------------------------------------
console.log('\n--- Test Suite 2: Configuração Oficial do Firebase victoria-lar-residencial ---');

test('firebase-applet-config.json aponta exclusivamente para o projeto oficial victoria-lar-residencial', () => {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);

  assert.strictEqual(config.projectId, 'victoria-lar-residencial', 'projectId deve ser victoria-lar-residencial');
  assert.strictEqual(config.authDomain, 'victoria-lar-residencial.firebaseapp.com');
  assert.strictEqual(config.storageBucket, 'victoria-lar-residencial.firebasestorage.app');
});

// -------------------------------------------------------------
// Test 3: Rodapé da Landing Page — Acesso Administrativo
// -------------------------------------------------------------
console.log('\n--- Test Suite 3: Rodapé da Landing Page — Coluna Área Restrita ---');

test('Rodapé contém a coluna "Área Restrita" entre Navegação e Atendimento com link "Portal ADM"', () => {
  const landingPath = path.resolve(process.cwd(), 'src/components/LandingPage.tsx');
  const content = fs.readFileSync(landingPath, 'utf8');

  // Verifica presença da seção
  assert.strictEqual(content.includes('Área Restrita'), true, 'Rodapé deve conter cabeçalho "Área Restrita"');
  assert.strictEqual(content.includes('Portal ADM'), true, 'Rodapé deve conter link "Portal ADM"');
  assert.strictEqual(content.includes('Acesso administrativo seguro'), true, 'Rodapé deve conter texto "Acesso administrativo seguro"');
  assert.strictEqual(content.includes('onClick={onOpenAdminLogin}'), true, 'Link do Portal ADM deve acionar fluxo onOpenAdminLogin');

  // Verifica ordem visual dentro do elemento footer: Navegação antes de Área Restrita, e Área Restrita antes de Atendimento
  const footerContent = content.substring(content.indexOf('<footer'));
  const posNav = footerContent.indexOf('Navegação');
  const posRestrita = footerContent.indexOf('Área Restrita');
  const posAtendimento = footerContent.indexOf('Atendimento');

  assert.strictEqual(posNav < posRestrita, true, 'Navegação deve vir antes de Área Restrita');
  assert.strictEqual(posRestrita < posAtendimento, true, 'Área Restrita deve vir antes de Atendimento');
});

// -------------------------------------------------------------
// Test 4: Controle de Permissões e Modularidade no Portal ADM
// -------------------------------------------------------------
console.log('\n--- Test Suite 4: Controle de Permissões e Modularidade no Portal ADM ---');

test('AdminPanel incorpora e protege os módulos de residentes e colaboradores', () => {
  const adminPanelPath = path.resolve(process.cwd(), 'src/components/AdminPanel.tsx');
  const content = fs.readFileSync(adminPanelPath, 'utf8');

  // Verifica importação dos módulos originais
  assert.strictEqual(content.includes("import { ResidentesModule } from './residentes/ResidentesModule'"), true);
  assert.strictEqual(content.includes("import { ColaboradoresModule } from './colaboradores/ColaboradoresModule'"), true);

  // Verifica renderização condicionada por permissão
  assert.strictEqual(content.includes("canAccessModule('residentes')"), true, 'Módulo de residentes deve ser protegido');
  assert.strictEqual(content.includes("canAccessModule('colaboradores')"), true, 'Módulo de colaboradores deve ser protegido');
  assert.strictEqual(content.includes('<ResidentesModule'), true, 'ResidentesModule deve ser renderizado');
  assert.strictEqual(content.includes('<ColaboradoresModule'), true, 'ColaboradoresModule deve ser renderizado');
});

test('AuthContext expõe estado granular para controle de módulos e autorização', () => {
  const authContextPath = path.resolve(process.cwd(), 'src/context/AuthContext.tsx');
  const content = fs.readFileSync(authContextPath, 'utf8');

  assert.strictEqual(content.includes('staffProfile'), true);
  assert.strictEqual(content.includes('authorizedModules'), true);
  assert.strictEqual(content.includes('canAccessModule'), true);
  assert.strictEqual(content.includes('hasPortalAccess'), true);
  assert.strictEqual(content.includes('usuariosAutorizados'), true, 'Deve verificar snapshot de usuariosAutorizados');
});

// -------------------------------------------------------------
// Test 5: Regras de Segurança do Firestore (/pacientes e /funcionarios)
// -------------------------------------------------------------
console.log('\n--- Test Suite 5: Regras de Segurança do Firestore (/pacientes e /funcionarios) ---');

test('firestore.rules restringe /pacientes a quem tem permissão canAccessResidentes() e exclusão por isActiveAdmin()', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  assert.strictEqual(rules.includes('match /pacientes/{pacienteId}'), true);
  assert.strictEqual(rules.includes('allow get: if isValidId(pacienteId) && canAccessResidentes();'), true);
  assert.strictEqual(rules.includes('allow delete: if isValidId(pacienteId) && isActiveAdmin();'), true);
});

test('firestore.rules restringe /funcionarios a quem tem permissão canAccessColaboradores() e exclusão por isActiveAdmin()', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  assert.strictEqual(rules.includes('match /funcionarios/{funcionarioId}'), true);
  assert.strictEqual(rules.includes('allow get: if isValidId(funcionarioId) && canAccessColaboradores();'), true);
  assert.strictEqual(rules.includes('allow delete: if isValidId(funcionarioId) && isActiveAdmin();'), true);
});

// -------------------------------------------------------------
// Test 6: Centralização no Banco Firestore (default) e Compartilhamento de Instância (FASE 3.3C)
// -------------------------------------------------------------
console.log('\n--- Test Suite 6: Centralização Firestore (default) e Compartilhamento da Instância db ---');

test('firebase-applet-config.json aponta exclusivamente para o banco (default)', () => {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);

  assert.strictEqual(config.firestoreDatabaseId, '(default)', 'firestoreDatabaseId deve ser (default)');
});

test('src/lib/firebase.ts inicializa db com getFirestore(app) sem banco customizado', () => {
  const firebaseLibPath = path.resolve(process.cwd(), 'src/lib/firebase.ts');
  const content = fs.readFileSync(firebaseLibPath, 'utf8');

  assert.strictEqual(
    content.includes('export const db = getFirestore(app);'),
    true,
    'db deve ser instanciado diretamente com getFirestore(app)'
  );
  assert.strictEqual(
    content.includes("firestoreDatabaseId: '(default)'"),
    true,
    'firestoreDatabaseId ativo deve ser fixado em (default)'
  );
});

test('server/firebaseAdmin.ts e server/app.ts utilizam exclusivamente o banco (default)', () => {
  const adminPath = path.resolve(process.cwd(), 'server/firebaseAdmin.ts');
  const appPath = path.resolve(process.cwd(), 'server/app.ts');
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert.strictEqual(
    adminContent.includes("export const activeFirebaseDatabaseId: string = '(default)';"),
    true,
    'server/firebaseAdmin.ts deve fixar activeFirebaseDatabaseId em (default)'
  );
  assert.strictEqual(
    adminContent.includes('serverFirestoreInstance = getFirestore(app);'),
    true,
    'server/firebaseAdmin.ts deve inicializar Firestore com getFirestore(app)'
  );
  assert.strictEqual(
    appContent.includes("const activeFirebaseDatabaseId = '(default)';"),
    true,
    'server/app.ts deve fixar activeFirebaseDatabaseId em (default)'
  );
});

test('Todos os serviços (residentes, colaboradores, firestoreService, bootstrapService) compartilham a mesma instância db de src/lib/firebase', () => {
  const services = [
    'src/services/residentesService.ts',
    'src/services/colaboradoresService.ts',
    'src/services/firestoreService.ts',
    'src/services/bootstrapService.ts',
    'src/context/AuthContext.tsx',
  ];

  for (const relPath of services) {
    const fullPath = path.resolve(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.strictEqual(
      content.includes("from '../lib/firebase'") || content.includes("from './lib/firebase'"),
      true,
      `${relPath} deve importar db a partir de lib/firebase`
    );
  }
});

test('Mensagens de diagnóstico amigáveis e precisas ao capturar erro de permissão em residentes e colaboradores', () => {
  const resModulePath = path.resolve(process.cwd(), 'src/components/residentes/ResidentesModule.tsx');
  const colabModulePath = path.resolve(process.cwd(), 'src/components/colaboradores/ColaboradoresModule.tsx');
  const resContent = fs.readFileSync(resModulePath, 'utf8');
  const colabContent = fs.readFileSync(colabModulePath, 'utf8');

  assert.strictEqual(
    resContent.includes('Permissão insuficiente no Firestore (default).'),
    true,
    'ResidentesModule deve fornecer diagnóstico claro sobre permissão no Firestore (default)'
  );
  assert.strictEqual(
    colabContent.includes('Permissão insuficiente no Firestore (default).'),
    true,
    'ColaboradoresModule deve fornecer diagnóstico claro sobre permissão no Firestore (default)'
  );
});

console.log('\n================================================================');
console.log('ALL INTEGRATION ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
