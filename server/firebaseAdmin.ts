import { initializeApp, getApps, getApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read applet config if present (checks cwd for serverless and relative path for local)
let rawConfig: any = null;
try {
  const cwdPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const relPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  const directPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const finalPath = [cwdPath, relPath, directPath].find((p) => fs.existsSync(p));
  if (finalPath) {
    rawConfig = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
  }
} catch {
  // Ignore
}

export const activeFirebaseProjectId: string =
  (process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_PROJECT_ID.trim()) ||
  (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim()) ||
  rawConfig?.projectId ||
  'victoria-lar-residencial';

export const activeFirebaseDatabaseId: string = '(default)';

let adminApp: App | null = null;
let serverFirestoreInstance: Firestore | null = null;
let resolvedCredentialSource: 'SERVICE_ACCOUNT_JSON' | 'SERVICE_ACCOUNT_PEM' | 'SERVICE_ACCOUNT_BASE64' | 'APPLICATION_DEFAULT' | 'NONE' = 'NONE';
let credentialParsingError: string | null = null;

/**
 * Retorna o status de configuração e integridade das credenciais do Firebase Admin SDK
 * sem expor nenhuma informação sensível ou valor de chave privada.
 */
export function getFirebaseAdminStatus() {
  const hasSecret = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim());
  const clientEmail = (
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL ||
    rawConfig?.clientEmail ||
    ''
  ).trim();

  return {
    configured: resolvedCredentialSource !== 'NONE',
    credentialSource: resolvedCredentialSource,
    hasSecretKey: hasSecret,
    clientEmailConfigured: Boolean(clientEmail),
    projectId: activeFirebaseProjectId,
    databaseId: activeFirebaseDatabaseId,
    isProductionReady: resolvedCredentialSource === 'SERVICE_ACCOUNT_JSON' || resolvedCredentialSource === 'SERVICE_ACCOUNT_PEM' || resolvedCredentialSource === 'SERVICE_ACCOUNT_BASE64' || resolvedCredentialSource === 'APPLICATION_DEFAULT',
    errorReason: credentialParsingError,
  };
}

/**
 * Initializes and returns the Firebase Admin App instance.
 * Credentials hierarchy:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY (supports Full JSON, Base64 JSON, or raw PEM private key)
 * 2. GOOGLE_APPLICATION_CREDENTIALS (env var file path)
 * 3. Application Default Credentials (Cloud Run, GCP metadata server)
 * 4. Fallback projectId-only app (for emulator or read-only public token verification)
 */
export function getFirebaseAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  let credential: any = null;
  resolvedCredentialSource = 'NONE';
  credentialParsingError = null;

  // 1. Check for service account in FIREBASE_SERVICE_ACCOUNT_KEY
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountRaw && serviceAccountRaw.trim()) {
    try {
      let trimmed = serviceAccountRaw.trim();

      // Unwrap quotes if secret was saved wrapped in single or double quotes
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        trimmed = trimmed.slice(1, -1).trim();
      }

      // Case A: Full Service Account JSON object
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          // If JSON contains unescaped newlines or escaped quotes, try lenient parse
          const sanitized = trimmed.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n');
          parsed = JSON.parse(sanitized);
        }

        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // keep as-is
          }
        }

        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
          if (parsed.private_key.length < 50) {
            credentialParsingError = 'INVALID_PRIVATE_KEY: A chave privada informada em FIREBASE_SERVICE_ACCOUNT_KEY é insuficiente (possível placeholder).';
            console.warn('[Firebase Admin Warning]: Chave privada em FIREBASE_SERVICE_ACCOUNT_KEY possui tamanho insuficiente (possível placeholder).');
          } else {
            credential = cert(parsed);
            resolvedCredentialSource = 'SERVICE_ACCOUNT_JSON';
          }
        } else {
          credentialParsingError = 'MISSING_PRIVATE_KEY: Campo private_key ausente no JSON da conta de serviço.';
          console.warn('[Firebase Admin Warning]: Propriedade private_key ausente no JSON de FIREBASE_SERVICE_ACCOUNT_KEY.');
        }
      }
      // Case B: Raw PEM Private Key string directly (common when pasting PEM in Secret manager)
      else if (trimmed.includes('BEGIN PRIVATE KEY') || trimmed.includes('BEGIN RSA PRIVATE KEY')) {
        const normalizedKey = trimmed.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
        const clientEmail = (
          process.env.FIREBASE_CLIENT_EMAIL ||
          process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL ||
          rawConfig?.clientEmail ||
          `firebase-adminsdk@${activeFirebaseProjectId}.iam.gserviceaccount.com`
        ).trim();

        if (normalizedKey.length < 50) {
          credentialParsingError = 'INVALID_PEM_KEY: Chave PEM incompleta em FIREBASE_SERVICE_ACCOUNT_KEY.';
        } else {
          credential = cert({
            projectId: activeFirebaseProjectId,
            clientEmail,
            privateKey: normalizedKey,
          });
          resolvedCredentialSource = 'SERVICE_ACCOUNT_PEM';
        }
      }
      // Case C: Base64-encoded string
      else {
        let decoded = '';
        try {
          decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
        } catch {
          decoded = '';
        }

        if (decoded.startsWith('{') && decoded.endsWith('}')) {
          const parsed = JSON.parse(decoded);
          if (parsed.private_key && typeof parsed.private_key === 'string') {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
          }
          if (parsed.private_key && parsed.private_key.length >= 50) {
            credential = cert(parsed);
            resolvedCredentialSource = 'SERVICE_ACCOUNT_BASE64';
          } else {
            credentialParsingError = 'INVALID_BASE64_KEY: Chave privada base64 incompleta.';
          }
        } else if (decoded.includes('BEGIN PRIVATE KEY')) {
          const normalizedKey = decoded.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
          const clientEmail = (
            process.env.FIREBASE_CLIENT_EMAIL ||
            process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL ||
            rawConfig?.clientEmail ||
            `firebase-adminsdk@${activeFirebaseProjectId}.iam.gserviceaccount.com`
          ).trim();

          if (normalizedKey.length >= 50) {
            credential = cert({
              projectId: activeFirebaseProjectId,
              clientEmail,
              privateKey: normalizedKey,
            });
            resolvedCredentialSource = 'SERVICE_ACCOUNT_BASE64';
          } else {
            credentialParsingError = 'INVALID_BASE64_PEM: Chave PEM base64 incompleta.';
          }
        } else {
          credentialParsingError = 'INVALID_FORMAT: Secret FIREBASE_SERVICE_ACCOUNT_KEY não corresponde a JSON nem chave PEM.';
          console.warn('[Firebase Admin Warning]: Formato de FIREBASE_SERVICE_ACCOUNT_KEY não reconhecido (deve ser JSON da conta de serviço ou chave privada PEM).');
        }
      }
    } catch {
      // STRICT ZERO-LEAKAGE: Never log e.message as JSON.parse could include secret characters in error snippets
      credentialParsingError = 'PARSE_ERROR: Falha ao interpretar a credencial fornecida.';
      console.warn('[Firebase Admin Warning]: Falha na interpretação sintática de FIREBASE_SERVICE_ACCOUNT_KEY. Nenhum detalhe confidencial foi gravado em log.');
    }
  }

  // 2. Check for GOOGLE_APPLICATION_CREDENTIALS file path
  if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credential = applicationDefault();
      resolvedCredentialSource = 'APPLICATION_DEFAULT';
    } catch {
      console.warn('[Firebase Admin Warning]: Falha ao carregar credenciais de GOOGLE_APPLICATION_CREDENTIALS.');
    }
  }

  // 3. Fallback to applicationDefault() if in GCP / Cloud Run environment
  if (!credential) {
    try {
      credential = applicationDefault();
      resolvedCredentialSource = 'APPLICATION_DEFAULT';
    } catch {
      // Running locally without service account credentials
      credential = undefined;
      resolvedCredentialSource = 'NONE';
    }
  }

  adminApp = initializeApp({
    projectId: activeFirebaseProjectId,
    ...(credential ? { credential } : {}),
  });

  return adminApp;
}

let defaultTestMock: any = null;

/**
 * Define uma instância simulada do Firestore para isolamento de testes unitários.
 */
export function setServerFirestoreInstanceForTesting(mockInstance: any): void {
  serverFirestoreInstance = mockInstance;
}

/**
 * Retorna a instância do Cloud Firestore gerenciada pelo Firebase Admin SDK.
 * - Garante que o Admin SDK utilize getFirestore(app) quando o banco for `(default)` ou omitido.
 * - Utiliza getFirestore(app, activeFirebaseDatabaseId) apenas quando um banco customizado diferente de `(default)` for especificado.
 * - SEGURANÇA DE TESTES: Quando em ambiente de teste (NODE_ENV=test) sem emulador nem instância injetada, utiliza mock seguro em memória.
 */
export function getServerFirestore(): Firestore {
  if (serverFirestoreInstance) {
    return serverFirestoreInstance;
  }

  if (process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'SEGURANÇA DE TESTES: Tentativa de acessar o Firestore de produção bloqueada. Nenhum teste pode acessar o Firestore de produção sem o emulador local configurado (FIRESTORE_EMULATOR_HOST).'
    );
  }

  const app = getFirebaseAdminApp();
  serverFirestoreInstance = getFirestore(app);
  return serverFirestoreInstance;
}

let serverAuthInstance: any = null;

/**
 * Define uma instância simulada do Firebase Auth para isolamento de testes unitários.
 */
export function setServerAuthInstanceForTesting(mockInstance: any): void {
  serverAuthInstance = mockInstance;
}

/**
 * Reseta a instância interna de Auth para isolamento de testes unitários/integração.
 */
export function resetServerAuthInstanceForTesting(): void {
  serverAuthInstance = null;
}

/**
 * Retorna a instância do Firebase Auth gerenciada pelo Firebase Admin SDK.
 * - Em ambiente de teste (NODE_ENV=test), requer mock injetado ou emulador configurado.
 */
export function getServerAuth(): Auth {
  if (serverAuthInstance) {
    return serverAuthInstance;
  }

  if (process.env.NODE_ENV === 'test' && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'SEGURANÇA DE TESTES: Tentativa de acessar o Firebase Auth de produção bloqueada. Utilize setServerAuthInstanceForTesting() durante os testes unitários.'
    );
  }

  const app = getFirebaseAdminApp();
  return getAuth(app);
}

/**
 * Reseta a instância interna de Firestore e Auth para isolamento de testes unitários/integração.
 */
export function resetServerFirestoreInstanceForTesting(): void {
  serverFirestoreInstance = null;
  serverAuthInstance = null;
  adminApp = null;
  defaultTestMock = null;
}

// -------------------------------------------------------------
// In-Memory Firestore Mock for Test Isolation & Concurrency Verification
// -------------------------------------------------------------

export class MockDocumentReference {
  constructor(
    public readonly mockDb: InMemoryFirestoreMock,
    public readonly collectionName: string,
    public readonly id: string
  ) {}

  get path(): string {
    return `${this.collectionName}/${this.id}`;
  }

  async get(): Promise<{ exists: boolean; data: () => any; id: string; ref: MockDocumentReference }> {
    const colMap = this.mockDb.data.get(this.collectionName);
    const docData = colMap ? colMap.get(this.id) : undefined;
    return {
      exists: docData !== undefined,
      data: () => (docData !== undefined ? JSON.parse(JSON.stringify(docData)) : undefined),
      id: this.id,
      ref: this,
    };
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    this._rawSet(data, options);
  }

  async update(data: any): Promise<void> {
    this._rawUpdate(data);
  }

  async delete(): Promise<void> {
    this._rawDelete();
  }

  _rawSet(data: any, options?: { merge?: boolean }): void {
    let colMap = this.mockDb.data.get(this.collectionName);
    if (!colMap) {
      colMap = new Map();
      this.mockDb.data.set(this.collectionName, colMap);
    }
    const current = colMap.get(this.id) || {};
    const finalData = options?.merge
      ? { ...current, ...JSON.parse(JSON.stringify(data)) }
      : JSON.parse(JSON.stringify(data));
    colMap.set(this.id, finalData);
  }

  _rawUpdate(data: any): void {
    const colMap = this.mockDb.data.get(this.collectionName);
    if (!colMap || !colMap.has(this.id)) {
      throw new Error(`DOCUMENT_NOT_FOUND: ${this.path}`);
    }
    const current = colMap.get(this.id) || {};
    colMap.set(this.id, { ...current, ...JSON.parse(JSON.stringify(data)) });
  }

  _rawDelete(): void {
    const colMap = this.mockDb.data.get(this.collectionName);
    if (colMap) {
      colMap.delete(this.id);
    }
  }
}

export class MockQuery {
  constructor(
    public readonly mockDb: InMemoryFirestoreMock,
    public readonly collectionName: string,
    public readonly filters: Array<{ field: string; op: string; val: any }> = [],
    public readonly orderSpecs: Array<{ field: string; direction: 'asc' | 'desc' }> = [],
    public readonly limitCount?: number
  ) {}

  where(field: string, op: string, val: any): MockQuery {
    return new MockQuery(
      this.mockDb,
      this.collectionName,
      [...this.filters, { field, op, val }],
      this.orderSpecs,
      this.limitCount
    );
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): MockQuery {
    return new MockQuery(
      this.mockDb,
      this.collectionName,
      this.filters,
      [...this.orderSpecs, { field, direction }],
      this.limitCount
    );
  }

  limit(count: number): MockQuery {
    return new MockQuery(
      this.mockDb,
      this.collectionName,
      this.filters,
      this.orderSpecs,
      count
    );
  }

  async get(): Promise<{
    docs: Array<{ id: string; data: () => any; exists: true }>;
    forEach: (cb: (doc: { id: string; data: () => any; exists: true }) => void) => void;
    empty: boolean;
    size: number;
  }> {
    const colMap = this.mockDb.data.get(this.collectionName);
    let docs: Array<{ id: string; data: () => any; exists: true }> = [];

    if (colMap) {
      colMap.forEach((val, key) => {
        let matches = true;
        for (const f of this.filters) {
          if (f.op === '==' && val[f.field] !== f.val) matches = false;
          if (f.op === '!=' && val[f.field] === f.val) matches = false;
        }
        if (matches) {
          docs.push({
            id: key,
            ref: this.mockDb.collection(this.collectionName).doc(key),
            data: () => JSON.parse(JSON.stringify(val)),
            exists: true,
          } as any);
        }
      });
    }

    if (this.orderSpecs.length > 0) {
      docs.sort((a, b) => {
        const dataA = a.data();
        const dataB = b.data();
        for (const spec of this.orderSpecs) {
          const valA = dataA[spec.field];
          const valB = dataB[spec.field];
          if (valA < valB) return spec.direction === 'asc' ? -1 : 1;
          if (valA > valB) return spec.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    if (typeof this.limitCount === 'number' && this.limitCount >= 0) {
      docs = docs.slice(0, this.limitCount);
    }

    return {
      docs,
      forEach: (cb) => docs.forEach(cb),
      empty: docs.length === 0,
      size: docs.length,
    };
  }
}

export class MockCollectionReference {
  constructor(
    public readonly mockDb: InMemoryFirestoreMock,
    public readonly collectionName: string
  ) {}

  doc(id?: string): MockDocumentReference {
    const resolvedId = id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new MockDocumentReference(this.mockDb, this.collectionName, resolvedId);
  }

  where(field: string, op: string, val: any): MockQuery {
    return new MockQuery(this.mockDb, this.collectionName, [{ field, op, val }]);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): MockQuery {
    return new MockQuery(this.mockDb, this.collectionName, [], [{ field, direction }]);
  }

  limit(count: number): MockQuery {
    return new MockQuery(this.mockDb, this.collectionName, [], [], count);
  }

  async get() {
    return new MockQuery(this.mockDb, this.collectionName).get();
  }
}

export class InMemoryFirestoreMock {
  public data: Map<string, Map<string, any>> = new Map();
  private transactionLock: Promise<void> = Promise.resolve();

  constructor() {
    this.clear();
  }

  collection(collectionName: string): MockCollectionReference {
    return new MockCollectionReference(this, collectionName);
  }

  async runTransaction<T>(updateFunction: (tx: any) => Promise<T>): Promise<T> {
    let releaseLock: () => void;
    const previousLock = this.transactionLock;
    this.transactionLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previousLock;

    try {
      const stagedWrites: Array<() => void> = [];

      const tx = {
        get: async (refOrQuery: any) => {
          return await refOrQuery.get();
        },
        set: (docRef: any, data: any, options?: { merge?: boolean }) => {
          stagedWrites.push(() => {
            docRef._rawSet(data, options);
          });
        },
        update: (docRef: any, data: any) => {
          stagedWrites.push(() => {
            docRef._rawUpdate(data);
          });
        },
        delete: (docRef: any) => {
          stagedWrites.push(() => {
            docRef._rawDelete();
          });
        },
      };

      const result = await updateFunction(tx);

      // Commit staged writes atomically
      for (const write of stagedWrites) {
        write();
      }

      return result;
    } finally {
      releaseLock!();
    }
  }

  clear(): void {
    this.data.clear();
    this.data.set('admins', new Map());
    this.data.set('content', new Map());
    this.data.set('leads', new Map());
    this.data.set('system', new Map());
    this.data.set('auditLogs', new Map());
    this.data.set('services', new Map());
    this.data.set('albums', new Map());
    this.data.set('accessRequests', new Map());
    this.data.set('usuariosAutorizados', new Map());
    this.data.set('accessRequestLocks', new Map());
    this.data.set('funcionarios', new Map());
    this.data.set('pacientes', new Map());
  }
}

export function createInMemoryFirestoreMock(): any {
  return new InMemoryFirestoreMock();
}

