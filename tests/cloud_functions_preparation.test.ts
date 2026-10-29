import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../server/app';
import { api, FUNCTION_REGION, smtpPass, gmailAppPassword, smtpUser, firebaseServiceAccountKey } from '../functions/src/index';
import {
  activeFirebaseProjectId,
  activeFirebaseDatabaseId,
  getFirebaseAdminStatus,
} from '../server/firebaseAdmin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING VICTORIA LAR — TESTES DE PREPARAÇÃO CLOUD FUNCTIONS 2GEN');
  console.log('================================================================');

  // -------------------------------------------------------------
  // Test Suite 1: Configuração e Exportação da Cloud Function (2ª Geração)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 1: Cloud Function 2ª Geração e Opções Conservadoras ---');

  assert(typeof api === 'function', 'api é uma Cloud Function HTTP exportada');
  assert(FUNCTION_REGION === 'southamerica-east1', 'Região padrão é southamerica-east1 (São Paulo, Brasil)');

  // Verifica as opções anexadas à Cloud Function
  const funcOpts = (api as any).__endpoint || (api as any).__requiredAPIs || (api as any);
  assert(funcOpts !== undefined, 'Objeto da Cloud Function está devidamente instanciado');

  // Verifica declaração dos segredos com Secret Manager
  assert(smtpPass !== undefined && typeof smtpPass.name === 'string', 'Segredo SMTP_PASS declarado via defineSecret');
  assert(smtpPass.name === 'SMTP_PASS', 'Nome do segredo SMTP_PASS confere');
  assert(gmailAppPassword !== undefined && gmailAppPassword.name === 'GMAIL_APP_PASSWORD', 'Segredo GMAIL_APP_PASSWORD declarado');
  assert(smtpUser !== undefined && smtpUser.name === 'SMTP_USER', 'Segredo SMTP_USER declarado');
  assert(firebaseServiceAccountKey !== undefined && firebaseServiceAccountKey.name === 'FIREBASE_SERVICE_ACCOUNT_KEY', 'Segredo FIREBASE_SERVICE_ACCOUNT_KEY declarado');

  // -------------------------------------------------------------
  // Test Suite 2: Reaproveitamento Integral do Express (server/app.ts)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Reaproveitamento de server/app.ts sem Duplicação ---');

  assert(app !== undefined && typeof app.use === 'function', 'Express app de server/app.ts é válido');

  // Inspeciona as rotas registradas na stack do Express
  const registeredRoutes: string[] = [];
  if ((app as any)._router && (app as any)._router.stack) {
    (app as any)._router.stack.forEach((layer: any) => {
      if (layer.route && layer.route.path) {
        registeredRoutes.push(layer.route.path);
      }
    });
  }

  const expectedEndpoints = [
    '/api/health',
    '/api/bootstrap/status',
    '/api/bootstrap/initiate',
    '/api/admin/users',
    '/api/access-requests',
    '/api/schedule/availability',
    '/api/schedule-meeting',
    '/api/mail/status',
    '/api/contact',
  ];

  expectedEndpoints.forEach((route) => {
    const hasRoute = registeredRoutes.includes(route);
    assert(hasRoute, `Endpoint essencial ${route} preservado e acessível na rota do servidor Express`);
  });

  // Garante que não existem cópias de rotas em functions/src/index.ts (reutiliza server/app.ts)
  const functionsSource = fs.readFileSync(path.resolve(rootDir, 'functions/src/index.ts'), 'utf-8');
  assert(
    functionsSource.includes("import { app } from '../../server/app';"),
    'functions/src/index.ts reaproveita server/app.ts sem recriar controladores nem duplicar regras'
  );
  assert(
    !functionsSource.includes('app.get(') && !functionsSource.includes('app.post('),
    'functions/src/index.ts não duplica endpoints do Express'
  );

  // -------------------------------------------------------------
  // Test Suite 3: Firebase Hosting & firebase.json (Prioridade de Rewrites)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Configuração do firebase.json e Prioridade de Rewrites ---');

  const firebaseJsonRaw = fs.readFileSync(path.resolve(rootDir, 'firebase.json'), 'utf-8');
  const firebaseJson = JSON.parse(firebaseJsonRaw);

  // 1. Firestore intacto
  assert(firebaseJson.firestore !== undefined, 'Bloco firestore presente em firebase.json');
  assert(firebaseJson.firestore.database === '(default)', 'Banco Firestore configurado exclusivamente como (default)');
  assert(firebaseJson.firestore.rules === 'firestore.rules', 'Regras do Firestore apontam para firestore.rules');

  // 2. Hosting configurado
  assert(firebaseJson.hosting !== undefined, 'Bloco hosting configurado em firebase.json');
  assert(firebaseJson.hosting.public === 'dist', 'Hosting publica a pasta dist (Vite build)');
  assert(Array.isArray(firebaseJson.hosting.rewrites), 'Hosting contém lista de rewrites');

  const rewrites = firebaseJson.hosting.rewrites;
  assert(rewrites.length >= 2, 'Pelo menos 2 regras de rewrite configuradas');

  // CRÍTICO: Regra 1 DEVE ser /api/** para a Cloud Function ANTES do fallback da SPA
  const apiRewrite = rewrites[0];
  assert(apiRewrite.source === '/api/**', 'Primeira regra de rewrite captura /api/**');
  const targetFunction = typeof apiRewrite.function === 'string'
    ? apiRewrite.function
    : apiRewrite.function?.functionId;
  assert(targetFunction === 'api', 'Rewrite /api/** encaminha para a Cloud Function "api"');

  const spaRewrite = rewrites[rewrites.length - 1];
  assert(spaRewrite.source === '**', 'Última regra de rewrite captura ** para SPA');
  assert(spaRewrite.destination === '/index.html', 'Fallback da SPA entrega /index.html');

  // 3. Functions configurado
  assert(Array.isArray(firebaseJson.functions), 'Bloco functions configurado como array em firebase.json');
  assert(firebaseJson.functions[0].source === 'functions', 'Source da função aponta para a pasta functions');

  // -------------------------------------------------------------
  // Test Suite 4: Compatibilidade com Firebase Admin SDK & ADC
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Firebase Admin SDK e Application Default Credentials ---');

  assert(activeFirebaseProjectId === 'victoria-lar-residencial', 'Projeto ativo do Firebase é victoria-lar-residencial');
  assert(activeFirebaseDatabaseId === '(default)', 'Database ID do Firestore é (default)');

  const status = getFirebaseAdminStatus();
  assert(status.projectId === 'victoria-lar-residencial', 'Status do Admin SDK reflete o projectId correto');
  assert(status.databaseId === '(default)', 'Status do Admin SDK reflete banco (default)');
  assert(typeof status.configured === 'boolean', 'Status do Admin SDK reporta configured');

  // -------------------------------------------------------------
  // Test Suite 5: Ausência de Segredos no Bundle do Frontend
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Ausência de Segredos no Código do Frontend (src/) ---');

  // Varredura recursiva de src/ procurando possíveis vazamentos de segredos de backend
  function scanDir(dir: string): string[] {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const srcFiles = scanDir(path.resolve(rootDir, 'src'));
  assert(srcFiles.length > 0, `Verificando ${srcFiles.length} arquivos fonte do frontend`);

  let secretLeaksFound = 0;
  srcFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    // Check for hardcoded private keys or service account credentials
    if (content.includes('BEGIN PRIVATE KEY') || content.includes('BEGIN RSA PRIVATE KEY')) {
      console.error(`  [LEAK]: ${file} contém chave privada hardcoded`);
      secretLeaksFound++;
    }
    // Check for client-side access to server environment secrets
    if (
      content.includes('process.env.FIREBASE_SERVICE_ACCOUNT_KEY') ||
      content.includes('process.env.SMTP_PASS') ||
      content.includes('process.env.GMAIL_APP_PASSWORD')
    ) {
      console.error(`  [LEAK]: ${file} tenta ler segredo de servidor via process.env`);
      secretLeaksFound++;
    }
    // Check for direct server package imports in frontend code
    if (
      content.match(/from\s+['"]nodemailer['"]/) ||
      content.match(/from\s+['"]firebase-admin(\/.*)?['"]/) ||
      content.match(/from\s+['"]\.\.?\/server\//)
    ) {
      console.error(`  [LEAK]: ${file} importa pacotes ou módulos exclusivos de servidor`);
      secretLeaksFound++;
    }
  });

  assert(secretLeaksFound === 0, 'Nenhum segredo de backend, credencial privada ou biblioteca restrita encontrada em src/');

  // -------------------------------------------------------------
  // Test Suite 6: Compilação das Cloud Functions (functions/lib/index.js)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 6: Verificação do Bundle Compilado das Cloud Functions ---');

  const bundlePath = path.resolve(rootDir, 'functions/lib/index.js');
  assert(fs.existsSync(bundlePath), 'Arquivo compilado functions/lib/index.js existe');

  const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
  assert(bundleContent.includes('defineSecret("SMTP_PASS")'), 'Bundle contém definição segura de SMTP_PASS');
  assert(bundleContent.includes('minInstances: 0'), 'Bundle contém minInstances: 0');
  assert(bundleContent.includes('maxInstances: 2'), 'Bundle contém maxInstances: 2');
  assert(bundleContent.includes('timeoutSeconds: 60'), 'Bundle contém timeoutSeconds: 60');
  assert(bundleContent.includes('export {'), 'Bundle exporta módulo ESM compatível com Node.js 20');

  // -------------------------------------------------------------
  // Test Suite 7: Estrutura do functions/package.json
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 7: Conformidade de functions/package.json ---');

  const funcPkgRaw = fs.readFileSync(path.resolve(rootDir, 'functions/package.json'), 'utf-8');
  const funcPkg = JSON.parse(funcPkgRaw);

  assert(funcPkg.type === 'module', 'functions/package.json utiliza ESM ("type": "module")');
  assert(funcPkg.main === 'lib/index.js', 'functions/package.json define main como lib/index.js');
  assert(funcPkg.engines?.node === '20', 'functions/package.json define Node.js 20 como runtime suportado');
  assert(funcPkg.dependencies?.['firebase-functions'] !== undefined, 'Dependência firebase-functions presente em functions/package.json');
  assert(funcPkg.dependencies?.['firebase-admin'] !== undefined, 'Dependência firebase-admin presente em functions/package.json');
  assert(funcPkg.dependencies?.['express'] !== undefined, 'Dependência express presente em functions/package.json');

  console.log('\n================================================================');
  console.log(`TODOS OS TESTES DE PREPARAÇÃO CLOUD FUNCTIONS PASSARAM! (${passedTests}/${totalTests})`);
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
