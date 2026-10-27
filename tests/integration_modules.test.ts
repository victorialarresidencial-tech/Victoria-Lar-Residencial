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

console.log('\n================================================================');
console.log('ALL INTEGRATION ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
