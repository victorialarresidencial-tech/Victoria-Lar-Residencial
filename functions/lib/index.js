var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../firebase-applet-config.json
var require_firebase_applet_config = __commonJS({
  "../firebase-applet-config.json"(exports, module) {
    module.exports = {
      projectId: "victoria-lar-residencial",
      appId: "1:256370289094:web:fcbd36c3e6a78580c3eac7",
      apiKey: "AIzaSyByJ6j2JrhWcesTDPw9OLvoq7-5Zmz_pAc",
      authDomain: "victoria-lar-residencial.firebaseapp.com",
      firestoreDatabaseId: "(default)",
      storageBucket: "victoria-lar-residencial.firebasestorage.app",
      messagingSenderId: "256370289094",
      measurementId: "",
      oAuthClientId: "256370289094-cr47q9lkt1gh9o2eggds1012495rebge.apps.googleusercontent.com",
      recaptchaSiteKey: ""
    };
  }
});

// ../server/firebaseAdmin.ts
var firebaseAdmin_exports = {};
__export(firebaseAdmin_exports, {
  InMemoryFirestoreMock: () => InMemoryFirestoreMock,
  MockCollectionReference: () => MockCollectionReference,
  MockDocumentReference: () => MockDocumentReference,
  MockQuery: () => MockQuery,
  activeFirebaseDatabaseId: () => activeFirebaseDatabaseId,
  activeFirebaseProjectId: () => activeFirebaseProjectId,
  createInMemoryFirestoreMock: () => createInMemoryFirestoreMock,
  getFirebaseAdminApp: () => getFirebaseAdminApp,
  getFirebaseAdminStatus: () => getFirebaseAdminStatus,
  getServerAuth: () => getServerAuth,
  getServerFirestore: () => getServerFirestore,
  resetServerAuthInstanceForTesting: () => resetServerAuthInstanceForTesting,
  resetServerFirestoreInstanceForTesting: () => resetServerFirestoreInstanceForTesting,
  setServerAuthInstanceForTesting: () => setServerAuthInstanceForTesting,
  setServerFirestoreInstanceForTesting: () => setServerFirestoreInstanceForTesting
});
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
function getFirebaseAdminStatus() {
  const hasSecret = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim());
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL || rawConfig?.clientEmail || "").trim();
  return {
    configured: resolvedCredentialSource !== "NONE",
    credentialSource: resolvedCredentialSource,
    hasSecretKey: hasSecret,
    clientEmailConfigured: Boolean(clientEmail),
    projectId: activeFirebaseProjectId,
    databaseId: activeFirebaseDatabaseId,
    isProductionReady: resolvedCredentialSource === "SERVICE_ACCOUNT_JSON" || resolvedCredentialSource === "SERVICE_ACCOUNT_PEM" || resolvedCredentialSource === "SERVICE_ACCOUNT_BASE64" || resolvedCredentialSource === "APPLICATION_DEFAULT",
    errorReason: credentialParsingError
  };
}
function getFirebaseAdminApp() {
  if (adminApp) {
    return adminApp;
  }
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }
  let credential = null;
  resolvedCredentialSource = "NONE";
  credentialParsingError = null;
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountRaw && serviceAccountRaw.trim()) {
    try {
      let trimmed = serviceAccountRaw.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
        trimmed = trimmed.slice(1, -1).trim();
      }
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          const sanitized = trimmed.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n");
          parsed = JSON.parse(sanitized);
        }
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
          }
        }
        if (parsed.private_key && typeof parsed.private_key === "string") {
          parsed.private_key = parsed.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
          if (parsed.private_key.length < 50) {
            credentialParsingError = "INVALID_PRIVATE_KEY: A chave privada informada em FIREBASE_SERVICE_ACCOUNT_KEY \xE9 insuficiente (poss\xEDvel placeholder).";
            console.warn("[Firebase Admin Warning]: Chave privada em FIREBASE_SERVICE_ACCOUNT_KEY possui tamanho insuficiente (poss\xEDvel placeholder).");
          } else {
            credential = cert(parsed);
            resolvedCredentialSource = "SERVICE_ACCOUNT_JSON";
          }
        } else {
          credentialParsingError = "MISSING_PRIVATE_KEY: Campo private_key ausente no JSON da conta de servi\xE7o.";
          console.warn("[Firebase Admin Warning]: Propriedade private_key ausente no JSON de FIREBASE_SERVICE_ACCOUNT_KEY.");
        }
      } else if (trimmed.includes("BEGIN PRIVATE KEY") || trimmed.includes("BEGIN RSA PRIVATE KEY")) {
        const normalizedKey = trimmed.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL || rawConfig?.clientEmail || `firebase-adminsdk@${activeFirebaseProjectId}.iam.gserviceaccount.com`).trim();
        if (normalizedKey.length < 50) {
          credentialParsingError = "INVALID_PEM_KEY: Chave PEM incompleta em FIREBASE_SERVICE_ACCOUNT_KEY.";
        } else {
          credential = cert({
            projectId: activeFirebaseProjectId,
            clientEmail,
            privateKey: normalizedKey
          });
          resolvedCredentialSource = "SERVICE_ACCOUNT_PEM";
        }
      } else {
        let decoded = "";
        try {
          decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
        } catch {
          decoded = "";
        }
        if (decoded.startsWith("{") && decoded.endsWith("}")) {
          const parsed = JSON.parse(decoded);
          if (parsed.private_key && typeof parsed.private_key === "string") {
            parsed.private_key = parsed.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
          }
          if (parsed.private_key && parsed.private_key.length >= 50) {
            credential = cert(parsed);
            resolvedCredentialSource = "SERVICE_ACCOUNT_BASE64";
          } else {
            credentialParsingError = "INVALID_BASE64_KEY: Chave privada base64 incompleta.";
          }
        } else if (decoded.includes("BEGIN PRIVATE KEY")) {
          const normalizedKey = decoded.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
          const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL || rawConfig?.clientEmail || `firebase-adminsdk@${activeFirebaseProjectId}.iam.gserviceaccount.com`).trim();
          if (normalizedKey.length >= 50) {
            credential = cert({
              projectId: activeFirebaseProjectId,
              clientEmail,
              privateKey: normalizedKey
            });
            resolvedCredentialSource = "SERVICE_ACCOUNT_BASE64";
          } else {
            credentialParsingError = "INVALID_BASE64_PEM: Chave PEM base64 incompleta.";
          }
        } else {
          credentialParsingError = "INVALID_FORMAT: Secret FIREBASE_SERVICE_ACCOUNT_KEY n\xE3o corresponde a JSON nem chave PEM.";
          console.warn("[Firebase Admin Warning]: Formato de FIREBASE_SERVICE_ACCOUNT_KEY n\xE3o reconhecido (deve ser JSON da conta de servi\xE7o ou chave privada PEM).");
        }
      }
    } catch {
      credentialParsingError = "PARSE_ERROR: Falha ao interpretar a credencial fornecida.";
      console.warn("[Firebase Admin Warning]: Falha na interpreta\xE7\xE3o sint\xE1tica de FIREBASE_SERVICE_ACCOUNT_KEY. Nenhum detalhe confidencial foi gravado em log.");
    }
  }
  if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credential = applicationDefault();
      resolvedCredentialSource = "APPLICATION_DEFAULT";
    } catch {
      console.warn("[Firebase Admin Warning]: Falha ao carregar credenciais de GOOGLE_APPLICATION_CREDENTIALS.");
    }
  }
  if (!credential) {
    try {
      credential = applicationDefault();
      resolvedCredentialSource = "APPLICATION_DEFAULT";
    } catch {
      credential = void 0;
      resolvedCredentialSource = "NONE";
    }
  }
  adminApp = initializeApp({
    projectId: activeFirebaseProjectId,
    ...credential ? { credential } : {}
  });
  return adminApp;
}
function setServerFirestoreInstanceForTesting(mockInstance) {
  serverFirestoreInstance = mockInstance;
}
function getServerFirestore() {
  if (serverFirestoreInstance) {
    return serverFirestoreInstance;
  }
  if (process.env.NODE_ENV === "test" && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "SEGURAN\xC7A DE TESTES: Tentativa de acessar o Firestore de produ\xE7\xE3o bloqueada. Nenhum teste pode acessar o Firestore de produ\xE7\xE3o sem o emulador local configurado (FIRESTORE_EMULATOR_HOST)."
    );
  }
  const app2 = getFirebaseAdminApp();
  serverFirestoreInstance = getFirestore(app2);
  return serverFirestoreInstance;
}
function setServerAuthInstanceForTesting(mockInstance) {
  serverAuthInstance = mockInstance;
}
function resetServerAuthInstanceForTesting() {
  serverAuthInstance = null;
}
function getServerAuth() {
  if (serverAuthInstance) {
    return serverAuthInstance;
  }
  if (process.env.NODE_ENV === "test" && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      "SEGURAN\xC7A DE TESTES: Tentativa de acessar o Firebase Auth de produ\xE7\xE3o bloqueada. Utilize setServerAuthInstanceForTesting() durante os testes unit\xE1rios."
    );
  }
  const app2 = getFirebaseAdminApp();
  return getAuth(app2);
}
function resetServerFirestoreInstanceForTesting() {
  serverFirestoreInstance = null;
  serverAuthInstance = null;
  adminApp = null;
  defaultTestMock = null;
}
function createInMemoryFirestoreMock() {
  return new InMemoryFirestoreMock();
}
var __filename, __dirname, rawConfig, gcloudProjectId, activeFirebaseProjectId, activeFirebaseDatabaseId, adminApp, serverFirestoreInstance, resolvedCredentialSource, credentialParsingError, defaultTestMock, serverAuthInstance, MockDocumentReference, MockQuery, MockCollectionReference, InMemoryFirestoreMock;
var init_firebaseAdmin = __esm({
  "../server/firebaseAdmin.ts"() {
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    rawConfig = null;
    try {
      const cwdPath = path.resolve(process.cwd(), "firebase-applet-config.json");
      const relPath = path.resolve(__dirname, "..", "firebase-applet-config.json");
      const directPath = path.resolve(__dirname, "firebase-applet-config.json");
      const finalPath = [cwdPath, relPath, directPath].find((p) => fs.existsSync(p));
      if (finalPath) {
        rawConfig = JSON.parse(fs.readFileSync(finalPath, "utf8"));
      }
    } catch {
    }
    if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT.trim()) {
      gcloudProjectId = process.env.GCLOUD_PROJECT.trim();
    } else if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT.trim()) {
      gcloudProjectId = process.env.GOOGLE_CLOUD_PROJECT.trim();
    } else if (process.env.FIREBASE_CONFIG) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_CONFIG);
        if (parsed.projectId) gcloudProjectId = parsed.projectId.trim();
      } catch {
      }
    }
    activeFirebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_PROJECT_ID.trim() || process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim() || gcloudProjectId || rawConfig?.projectId || "victoria-lar-residencial";
    activeFirebaseDatabaseId = "(default)";
    adminApp = null;
    serverFirestoreInstance = null;
    resolvedCredentialSource = "NONE";
    credentialParsingError = null;
    defaultTestMock = null;
    serverAuthInstance = null;
    MockDocumentReference = class {
      constructor(mockDb, collectionName, id) {
        this.mockDb = mockDb;
        this.collectionName = collectionName;
        this.id = id;
      }
      get path() {
        return `${this.collectionName}/${this.id}`;
      }
      async get() {
        const colMap = this.mockDb.data.get(this.collectionName);
        const docData = colMap ? colMap.get(this.id) : void 0;
        return {
          exists: docData !== void 0,
          data: () => docData !== void 0 ? JSON.parse(JSON.stringify(docData)) : void 0,
          id: this.id,
          ref: this
        };
      }
      async set(data, options) {
        this._rawSet(data, options);
      }
      async update(data) {
        this._rawUpdate(data);
      }
      async delete() {
        this._rawDelete();
      }
      _rawSet(data, options) {
        let colMap = this.mockDb.data.get(this.collectionName);
        if (!colMap) {
          colMap = /* @__PURE__ */ new Map();
          this.mockDb.data.set(this.collectionName, colMap);
        }
        const current = colMap.get(this.id) || {};
        const finalData = options?.merge ? { ...current, ...JSON.parse(JSON.stringify(data)) } : JSON.parse(JSON.stringify(data));
        colMap.set(this.id, finalData);
      }
      _rawUpdate(data) {
        const colMap = this.mockDb.data.get(this.collectionName);
        if (!colMap || !colMap.has(this.id)) {
          throw new Error(`DOCUMENT_NOT_FOUND: ${this.path}`);
        }
        const current = colMap.get(this.id) || {};
        colMap.set(this.id, { ...current, ...JSON.parse(JSON.stringify(data)) });
      }
      _rawDelete() {
        const colMap = this.mockDb.data.get(this.collectionName);
        if (colMap) {
          colMap.delete(this.id);
        }
      }
    };
    MockQuery = class _MockQuery {
      constructor(mockDb, collectionName, filters = [], orderSpecs = [], limitCount) {
        this.mockDb = mockDb;
        this.collectionName = collectionName;
        this.filters = filters;
        this.orderSpecs = orderSpecs;
        this.limitCount = limitCount;
      }
      where(field, op, val) {
        return new _MockQuery(
          this.mockDb,
          this.collectionName,
          [...this.filters, { field, op, val }],
          this.orderSpecs,
          this.limitCount
        );
      }
      orderBy(field, direction = "asc") {
        return new _MockQuery(
          this.mockDb,
          this.collectionName,
          this.filters,
          [...this.orderSpecs, { field, direction }],
          this.limitCount
        );
      }
      limit(count) {
        return new _MockQuery(
          this.mockDb,
          this.collectionName,
          this.filters,
          this.orderSpecs,
          count
        );
      }
      async get() {
        const colMap = this.mockDb.data.get(this.collectionName);
        let docs = [];
        if (colMap) {
          colMap.forEach((val, key) => {
            let matches = true;
            for (const f of this.filters) {
              if (f.op === "==" && val[f.field] !== f.val) matches = false;
              if (f.op === "!=" && val[f.field] === f.val) matches = false;
            }
            if (matches) {
              docs.push({
                id: key,
                ref: this.mockDb.collection(this.collectionName).doc(key),
                data: () => JSON.parse(JSON.stringify(val)),
                exists: true
              });
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
              if (valA < valB) return spec.direction === "asc" ? -1 : 1;
              if (valA > valB) return spec.direction === "asc" ? 1 : -1;
            }
            return 0;
          });
        }
        if (typeof this.limitCount === "number" && this.limitCount >= 0) {
          docs = docs.slice(0, this.limitCount);
        }
        return {
          docs,
          forEach: (cb) => docs.forEach(cb),
          empty: docs.length === 0,
          size: docs.length
        };
      }
    };
    MockCollectionReference = class {
      constructor(mockDb, collectionName) {
        this.mockDb = mockDb;
        this.collectionName = collectionName;
      }
      doc(id) {
        const resolvedId = id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        return new MockDocumentReference(this.mockDb, this.collectionName, resolvedId);
      }
      where(field, op, val) {
        return new MockQuery(this.mockDb, this.collectionName, [{ field, op, val }]);
      }
      orderBy(field, direction = "asc") {
        return new MockQuery(this.mockDb, this.collectionName, [], [{ field, direction }]);
      }
      limit(count) {
        return new MockQuery(this.mockDb, this.collectionName, [], [], count);
      }
      async get() {
        return new MockQuery(this.mockDb, this.collectionName).get();
      }
    };
    InMemoryFirestoreMock = class {
      constructor() {
        this.data = /* @__PURE__ */ new Map();
        this.transactionLock = Promise.resolve();
        this.clear();
      }
      collection(collectionName) {
        return new MockCollectionReference(this, collectionName);
      }
      async runTransaction(updateFunction) {
        let releaseLock;
        const previousLock = this.transactionLock;
        this.transactionLock = new Promise((resolve) => {
          releaseLock = resolve;
        });
        await previousLock;
        try {
          const stagedWrites = [];
          const tx = {
            get: async (refOrQuery) => {
              return await refOrQuery.get();
            },
            set: (docRef, data, options) => {
              stagedWrites.push(() => {
                docRef._rawSet(data, options);
              });
            },
            update: (docRef, data) => {
              stagedWrites.push(() => {
                docRef._rawUpdate(data);
              });
            },
            delete: (docRef) => {
              stagedWrites.push(() => {
                docRef._rawDelete();
              });
            }
          };
          const result = await updateFunction(tx);
          for (const write of stagedWrites) {
            write();
          }
          return result;
        } finally {
          releaseLock();
        }
      }
      clear() {
        this.data.clear();
        this.data.set("admins", /* @__PURE__ */ new Map());
        this.data.set("content", /* @__PURE__ */ new Map());
        this.data.set("leads", /* @__PURE__ */ new Map());
        this.data.set("system", /* @__PURE__ */ new Map());
        this.data.set("auditLogs", /* @__PURE__ */ new Map());
        this.data.set("services", /* @__PURE__ */ new Map());
        this.data.set("albums", /* @__PURE__ */ new Map());
        this.data.set("accessRequests", /* @__PURE__ */ new Map());
        this.data.set("usuariosAutorizados", /* @__PURE__ */ new Map());
        this.data.set("accessRequestLocks", /* @__PURE__ */ new Map());
        this.data.set("funcionarios", /* @__PURE__ */ new Map());
        this.data.set("pacientes", /* @__PURE__ */ new Map());
      }
    };
  }
});

// src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// ../server/app.ts
import express from "express";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import fs2 from "fs";
import dotenv from "dotenv";

// ../server/mailer.ts
import nodemailer from "nodemailer";
var OFFICIAL_GMAIL = "victorialarresidencial@gmail.com";
var OFFICIAL_SENDER_NAME = "Victoria Lar Residencial";
function sanitizeLog(data) {
  if (data === null || data === void 0) return data;
  if (typeof data === "string") {
    return data.replace(/(password|pass|secret|token|auth)\s*[:=]\s*["']?[^"',\s]+["']?/gi, '$1: "[REDACTED]"').replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]");
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLog(item));
  }
  if (typeof data === "object") {
    const clean = {};
    for (const [key, val] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if (val !== null && typeof val === "object") {
        clean[key] = sanitizeLog(val);
      } else if (lower.includes("pass") || lower.includes("secret") || lower.includes("token") || lower.includes("auth") || lower.includes("credentials")) {
        clean[key] = val ? "[REDACTED]" : null;
      } else {
        clean[key] = sanitizeLog(val);
      }
    }
    return clean;
  }
  return data;
}
function buildSmtpConfig(env = process.env) {
  const customHost = (env.SMTP_HOST || "").trim();
  const rawPort = env.SMTP_PORT ? parseInt(env.SMTP_PORT.trim(), 10) : void 0;
  const rawSecure = env.SMTP_SECURE !== void 0 ? env.SMTP_SECURE.trim().toLowerCase() : void 0;
  const rawPass = (env.SMTP_PASS || env.GMAIL_APP_PASSWORD || env.GMAIL_PASSWORD || "").replace(/\s+/g, "");
  const rawUser = (env.SMTP_USER || env.GMAIL_USER || OFFICIAL_GMAIL).trim();
  const isVercel = !!(env.VERCEL || process.env.VERCEL);
  const defaultConnTimeout = isVercel ? 5e3 : 1e4;
  const defaultGreetTimeout = isVercel ? 5e3 : 1e4;
  const defaultSockTimeout = isVercel ? 8e3 : 15e3;
  const connectionTimeout = env.SMTP_CONNECTION_TIMEOUT ? parseInt(env.SMTP_CONNECTION_TIMEOUT.trim(), 10) : defaultConnTimeout;
  const greetingTimeout = env.SMTP_GREETING_TIMEOUT ? parseInt(env.SMTP_GREETING_TIMEOUT.trim(), 10) : defaultGreetTimeout;
  const socketTimeout = env.SMTP_SOCKET_TIMEOUT ? parseInt(env.SMTP_SOCKET_TIMEOUT.trim(), 10) : defaultSockTimeout;
  if (customHost) {
    let port = rawPort;
    let secure;
    let requireTLS = false;
    if (!port) {
      if (customHost.toLowerCase() === "smtp.gmail.com") {
        port = rawSecure === "false" ? 587 : 465;
      } else {
        port = rawSecure === "true" ? 465 : 587;
      }
    }
    if (port === 465) {
      if (rawSecure === "false") {
        console.warn(
          "[Victoria Lar Mailer] Aviso de compatibilidade: Porta 465 opera com TLS impl\xEDcito (secure: true). Corrigindo automaticamente para evitar falha de conex\xE3o."
        );
      }
      secure = true;
    } else if (port === 587 || port === 2525) {
      if (rawSecure === "true") {
        console.warn(
          `[Victoria Lar Mailer] Aviso de compatibilidade: Porta ${port} opera com STARTTLS (secure: false). 'secure: true' causa ETIMEDOUT imediato. Corrigindo automaticamente.`
        );
      }
      secure = false;
      requireTLS = true;
    } else {
      secure = rawSecure === "true";
    }
    if (port === 25) {
      console.warn(
        "[Victoria Lar Mailer] Alerta cr\xEDtico: O provedor Render bloqueia conex\xF5es de sa\xEDda na porta 25. Utilize a porta 465 (com secure: true) ou 587 (com STARTTLS)."
      );
    }
    return {
      host: customHost,
      port,
      secure,
      requireTLS,
      user: rawUser,
      pass: rawPass,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      isCustomHost: true,
      isDirectGmail: customHost.toLowerCase().includes("gmail"),
      isFallback: !rawPass
    };
  }
  if (rawPass) {
    let port = rawPort || 465;
    let secure = port === 465;
    let requireTLS = port === 587;
    if (port === 465 && rawSecure === "false") {
      secure = true;
    } else if (port === 587 && rawSecure === "true") {
      console.warn(
        "[Victoria Lar Mailer] Aviso: Porta 587 requer secure: false. Corrigindo automaticamente para evitar timeout."
      );
      secure = false;
      requireTLS = true;
    }
    return {
      host: "smtp.gmail.com",
      port,
      secure,
      requireTLS,
      user: rawUser,
      pass: rawPass,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      isCustomHost: false,
      isDirectGmail: true,
      isFallback: false
    };
  }
  return {
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    requireTLS: false,
    user: "",
    pass: "",
    connectionTimeout: 5e3,
    greetingTimeout: 5e3,
    socketTimeout: 5e3,
    isCustomHost: false,
    isDirectGmail: false,
    isFallback: true
  };
}
var cachedTransporter = null;
var mockTransporterForTests = null;
async function getTransporter() {
  if (mockTransporterForTests) {
    return mockTransporterForTests;
  }
  if (cachedTransporter) {
    return cachedTransporter;
  }
  const config = buildSmtpConfig();
  if (!config.isFallback && config.pass) {
    const maskedUser = config.user.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
      return `${first}${"*".repeat(Math.min(middle.length, 4))}${domain}`;
    });
    console.log(
      `[Victoria Lar Mailer] Inicializando transporte SMTP: host=${config.host}, port=${config.port}, secure=${config.secure}, user=${maskedUser}, timeouts(conn=${config.connectionTimeout}ms, greet=${config.greetingTimeout}ms, sock=${config.socketTimeout}ms)`
    );
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      auth: {
        user: config.user,
        pass: config.pass
      },
      connectionTimeout: config.connectionTimeout,
      greetingTimeout: config.greetingTimeout,
      socketTimeout: config.socketTimeout,
      tls: {
        // Enforce TLSv1.2+ for maximum compatibility and security
        minVersion: "TLSv1.2",
        rejectUnauthorized: true
      }
    });
    return cachedTransporter;
  }
  console.warn(
    `[Victoria Lar Mailer] Nenhuma credencial SMTP ou GMAIL_APP_PASSWORD configurada no ambiente. Utilizando transporte simulado de desenvolvimento.`
  );
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      },
      connectionTimeout: 5e3,
      greetingTimeout: 5e3,
      socketTimeout: 5e3
    });
    return cachedTransporter;
  } catch (_etherealErr) {
    cachedTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true
    });
    return cachedTransporter;
  }
}
async function verifySmtpConnection() {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    const safeError = sanitizeLog(err?.message || "Falha na verifica\xE7\xE3o SMTP");
    console.warn("[Victoria Lar Mailer] Falha na verifica\xE7\xE3o SMTP:", safeError);
    return { ok: false, error: safeError };
  }
}
function buildCalendarDetails(params) {
  let formattedDate = params.scheduledDate;
  if (params.scheduledDate.includes("-")) {
    const [y, m, d] = params.scheduledDate.split("-");
    formattedDate = `${d}/${m}/${y}`;
  }
  const [yearStr, monthStr, dayStr] = params.scheduledDate.split("-");
  const [hourStr, minStr] = params.scheduledTime.split(":");
  const year = parseInt(yearStr, 10) || (/* @__PURE__ */ new Date()).getFullYear();
  const month = parseInt(monthStr, 10) || 1;
  const day = parseInt(dayStr, 10) || 1;
  const hour = parseInt(hourStr, 10) || 9;
  const minute = parseInt(minStr, 10) || 0;
  const duration = params.durationMinutes || 45;
  const startUtc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
  const endUtc = new Date(startUtc.getTime() + duration * 60 * 1e3);
  const nowUtc = /* @__PURE__ */ new Date();
  const toCompactIso = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const startIso = toCompactIso(startUtc);
  const endIso = toCompactIso(endUtc);
  const dtStamp = toCompactIso(nowUtc);
  const title = "Reuni\xE3o Online - Victoria Lar Residencial";
  const description = [
    `Reuni\xE3o com a dire\xE7\xE3o da Victoria Lar Residencial (Olga & Robson).`,
    ``,
    `\u{1F4F9} Link do Google Meet: ${params.meetingLink}`,
    `\u{1F4C5} Data: ${formattedDate}`,
    `\u23F0 Hor\xE1rio: ${params.scheduledTime} (Hor\xE1rio de Bras\xEDlia)`,
    `\u{1FA7A} Assunto: ${params.serviceInterest || "Reuni\xE3o de Apresenta\xE7\xE3o e Planos"}`,
    `\u{1F464} Participante: ${params.name}`,
    `\u2709\uFE0F Remetente Oficial: ${OFFICIAL_GMAIL}`,
    `\u{1F4DE} WhatsApp da Dire\xE7\xE3o: (11) 98765-4321`,
    `\u{1F4CD} Endere\xE7o: Alameda das Rosas, 450 - S\xE3o Paulo, SP`,
    ``,
    `Instru\xE7\xF5es: Conecte-se com 5 minutos de anteced\xEAncia. Reuni\xE3o acess\xEDvel pelo celular ou computador.`
  ].join("\n");
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startIso}/${endIso}&details=${encodeURIComponent(
    description
  )}&location=${encodeURIComponent(params.meetingLink)}&ctz=America/Sao_Paulo`;
  const uid = `meet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@victorialar.com.br`;
  const cleanDesc = description.replace(/\n/g, "\\n");
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Victoria Lar Residencial//Agendamento Google Meet//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${cleanDesc}`,
    `LOCATION:${params.meetingLink}`,
    `ORGANIZER;CN="Victoria Lar Residencial":mailto:${OFFICIAL_GMAIL}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${params.name.replace(/[",\r\n]/g, "")}":mailto:${params.email}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  const icsContent = icsLines.join("\r\n");
  return {
    title,
    formattedDate,
    startIso,
    endIso,
    googleCalendarUrl,
    icsContent
  };
}
async function sendMeetingConfirmationEmail(params) {
  const calendarDetails = buildCalendarDetails({
    name: params.name,
    email: params.to,
    scheduledDate: params.scheduledDate,
    scheduledTime: params.scheduledTime,
    meetingLink: params.meetingLink,
    serviceInterest: params.serviceInterest
  });
  const mailSubject = params.subject || "Confirma\xE7\xE3o de Agendamento: Reuni\xE3o - Victoria Lar Residencial";
  const htmlBody = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${mailSubject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF9F5; margin: 0; padding: 24px; color: #1c2b22;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #B8954A; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <tr>
          <td style="background-color: #173D2B; padding: 32px 28px; text-align: center; border-bottom: 3px solid #B8954A;">
            <h1 style="margin: 0; color: #FAF9F5; font-size: 24px; font-family: Georgia, serif; letter-spacing: 2px;">VICTORIA</h1>
            <p style="margin: 6px 0 0 0; color: #B8954A; font-size: 11px; letter-spacing: 3px; font-weight: 600;">LAR RESIDENCIAL</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 28px;">
            <div style="display: inline-block; background-color: #FAF9F5; border: 1px solid #B8954A; border-radius: 9999px; padding: 4px 14px; font-size: 12px; font-weight: bold; color: #173D2B; margin-bottom: 16px;">
              \u2713 AGENDAMENTO CONFIRMADO \u2022 GOOGLE MEET
            </div>
            <h2 style="margin: 0 0 16px 0; color: #173D2B; font-size: 20px; font-family: Georgia, serif;">
              Ol\xE1, ${params.name}!
            </h2>
            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #4a5568;">
              Recebemos com muito carinho a sua solicita\xE7\xE3o. Sua reuni\xE3o online com a dire\xE7\xE3o da <strong>Victoria Lar Residencial</strong> est\xE1 confirmada:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F5; border-left: 4px solid #B8954A; border-radius: 12px; margin: 20px 0; padding: 20px;">
              <tr>
                <td style="font-size: 14px; line-height: 1.8;">
                  <strong style="color: #173D2B;">\u{1F4C5} Data:</strong> ${calendarDetails.formattedDate}<br />
                  <strong style="color: #173D2B;">\u23F0 Hor\xE1rio:</strong> ${params.scheduledTime} (Hor\xE1rio de Bras\xEDlia)<br />
                  <strong style="color: #173D2B;">\u{1F4F9} Formato:</strong> Reuni\xE3o Online via Google Meet<br />
                  ${params.serviceInterest ? `<strong style="color: #173D2B;">\u{1FA7A} Assunto:</strong> ${params.serviceInterest}<br />` : ""}
                  <strong style="color: #173D2B;">\u{1F465} Atendimento:</strong> Olga & Robson (S\xF3cios-Propriet\xE1rios)<br />
                  <strong style="color: #173D2B;">\u2709\uFE0F E-mail Oficial:</strong> ${OFFICIAL_GMAIL}
                </td>
              </tr>
            </table>
            <div style="text-align: center; margin: 28px 0 20px 0;">
              <a href="${params.meetingLink}" target="_blank" style="display: inline-block; background-color: #173D2B; color: #FAF9F5; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 9999px; border: 2px solid #B8954A; box-shadow: 0 4px 14px rgba(23,61,43,0.3);">
                \u{1F4F9} Entrar na Sala do Google Meet
              </a>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #718096;">
                Link direto: <a href="${params.meetingLink}" style="color: #173D2B; font-weight: 600;">${params.meetingLink}</a>
              </p>
            </div>
            <div style="background-color: #FAF9F5; border: 1.5px solid #B8954A; border-radius: 16px; padding: 20px; margin: 24px 0; text-align: center;">
              <div style="font-size: 13px; font-weight: bold; color: #173D2B; margin-bottom: 6px;">
                \u{1F5D3}\uFE0F Registro no Google Calendar
              </div>
              <p style="margin: 0 0 14px 0; font-size: 12px; line-height: 1.5; color: #4a5568;">
                Adicione este compromisso diretamente \xE0 sua agenda do Google:
              </p>
              <a href="${calendarDetails.googleCalendarUrl}" target="_blank" style="display: inline-block; background-color: #B8954A; color: #173D2B; font-size: 13px; font-weight: bold; text-decoration: none; padding: 11px 24px; border-radius: 9999px; box-shadow: 0 3px 10px rgba(184,149,74,0.3);">
                \u{1F4C5} Adicionar ao Google Calendar
              </a>
            </div>
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 12px; line-height: 1.6; color: #4a5568;">
              <strong style="color: #173D2B; display: block; margin-bottom: 6px;">\u{1F4A1} Informa\xE7\xF5es Importantes:</strong>
              \u2022 Recomendamos acessar o link com 5 minutos de anteced\xEAncia.<br />
              \u2022 D\xFAvidas ou reagendamento: WhatsApp <strong>(11) 98765-4321</strong> ou e-mail <a href="mailto:${OFFICIAL_GMAIL}" style="color: #173D2B;">${OFFICIAL_GMAIL}</a>.<br />
              ${params.instructions ? `<br /><em>Nota: ${params.instructions}</em>` : ""}
            </div>
            <p style="margin: 28px 0 0 0; font-size: 13px; line-height: 1.6; color: #4a5568;">
              Estamos muito felizes em poder conversar com voc\xEA e apresentar o Victoria Lar Residencial.
            </p>
            <p style="margin: 16px 0 0 0; font-size: 13px; font-weight: bold; color: #173D2B;">
              Com carinho,<br />
              Olga & Robson \u2014 Dire\xE7\xE3o da Victoria Lar Residencial
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #FAF9F5; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #718096;">
            <strong>Victoria Lar Residencial</strong><br />
            Alameda das Rosas, 450 - S\xE3o Paulo, SP \u2022 WhatsApp: (11) 98765-4321 \u2022 E-mail: ${OFFICIAL_GMAIL}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"${OFFICIAL_SENDER_NAME}" <${OFFICIAL_GMAIL}>`,
      replyTo: OFFICIAL_GMAIL,
      to: params.to,
      bcc: OFFICIAL_GMAIL,
      subject: mailSubject,
      html: htmlBody,
      icalEvent: {
        filename: "agendamento-victoria-lar.ics",
        method: "REQUEST",
        content: calendarDetails.icsContent
      },
      alternatives: [
        {
          contentType: 'text/calendar; charset="utf-8"; method=REQUEST',
          content: calendarDetails.icsContent
        }
      ]
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    console.log(
      `[Victoria Lar Mailer] E-mail enviado com sucesso para ${params.to} (MessageId: ${info?.messageId || "ok"})`
    );
    return {
      success: true,
      messageId: info?.messageId || `msg_${Date.now()}`,
      previewUrl,
      googleCalendarUrl: calendarDetails.googleCalendarUrl
    };
  } catch (err) {
    const errorCode = err?.code || "SEND_FAILED";
    const rawErrorMessage = err?.message || "Erro desconhecido no envio";
    const safeError = sanitizeLog(rawErrorMessage);
    console.warn(`[Victoria Lar Mailer] Falha no envio de e-mail (${errorCode}):`, safeError);
    return {
      success: false,
      error: safeError,
      errorCode,
      googleCalendarUrl: calendarDetails.googleCalendarUrl
    };
  }
}

// ../server/auth.ts
import crypto from "crypto";
var cachedCerts = null;
async function getGooglePublicCertificates() {
  const now = Date.now();
  if (cachedCerts && cachedCerts.expiresAt > now) {
    return cachedCerts.certs;
  }
  try {
    const response = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (!response.ok) {
      throw new Error(`Falha ao obter chaves p\xFAblicas do Google (HTTP ${response.status})`);
    }
    const certs = await response.json();
    let ttlMs = 3600 * 1e3;
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/);
      if (match && match[1]) {
        ttlMs = parseInt(match[1], 10) * 1e3;
      }
    }
    cachedCerts = {
      certs,
      expiresAt: now + ttlMs
    };
    return certs;
  } catch (err) {
    if (cachedCerts && Object.keys(cachedCerts.certs).length > 0) {
      return cachedCerts.certs;
    }
    throw new Error(`N\xE3o foi poss\xEDvel carregar as chaves de verifica\xE7\xE3o do Google: ${err?.message || err}`);
  }
}
var mockTokenVerifier = null;
async function verifyFirebaseIdToken(token, expectedProjectId) {
  if (mockTokenVerifier) {
    const mockResult = await mockTokenVerifier(token, expectedProjectId);
    if (mockResult) {
      return mockResult;
    }
  }
  if (!token || typeof token !== "string") {
    throw new Error("TOKEN_MISSING: Token de autentica\xE7\xE3o Firebase n\xE3o fornecido.");
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("TOKEN_MALFORMED: Formato do token JWT inv\xE1lido (esperado 3 partes separadas por ponto).");
  }
  const [rawHeader, rawPayload, rawSignature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(rawHeader, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(rawPayload, "base64url").toString("utf8"));
  } catch {
    throw new Error("TOKEN_DECODE_ERROR: N\xE3o foi poss\xEDvel decodificar o cabe\xE7alho ou payload do token JWT.");
  }
  if (header.alg !== "RS256") {
    throw new Error(`TOKEN_ALGORITHM_INVALID: Algoritmo esperado RS256, obtido "${header.alg}".`);
  }
  if (!header.kid || typeof header.kid !== "string") {
    throw new Error("TOKEN_KID_MISSING: Identificador de chave p\xFAblica (kid) ausente no cabe\xE7alho do token.");
  }
  let certs = await getGooglePublicCertificates();
  let cert2 = certs[header.kid];
  if (!cert2) {
    cachedCerts = null;
    certs = await getGooglePublicCertificates();
    cert2 = certs[header.kid];
  }
  if (!cert2) {
    throw new Error(`TOKEN_KEY_UNKNOWN: Chave p\xFAblica com kid "${header.kid}" n\xE3o encontrada entre os certificados v\xE1lidos do Google.`);
  }
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${rawHeader}.${rawPayload}`);
  const isSignatureValid = verifier.verify(cert2, rawSignature, "base64url");
  if (!isSignatureValid) {
    throw new Error("TOKEN_SIGNATURE_INVALID: Assinatura criptogr\xE1fica do token Firebase inv\xE1lida ou corrompida.");
  }
  const nowInSeconds = Math.floor(Date.now() / 1e3);
  if (!payload.exp || typeof payload.exp !== "number" || payload.exp < nowInSeconds) {
    throw new Error("TOKEN_EXPIRED: O token Firebase expirou. \xC9 necess\xE1rio renovar a autentica\xE7\xE3o.");
  }
  if (!payload.iat || typeof payload.iat !== "number") {
    throw new Error("TOKEN_IAT_MISSING: O token n\xE3o possui o carimbo de emiss\xE3o (iat) num\xE9rico obrigat\xF3rio.");
  }
  const maxClockSkew = 300;
  if (payload.iat > nowInSeconds + maxClockSkew) {
    throw new Error("TOKEN_NOT_YET_VALID: O token foi emitido em data futura incompat\xEDvel.");
  }
  if (payload.exp <= payload.iat) {
    throw new Error("TOKEN_EXPIRATION_INVALID: A data de expira\xE7\xE3o do token deve ser posterior \xE0 data de emiss\xE3o.");
  }
  if (payload.auth_time !== void 0) {
    if (typeof payload.auth_time !== "number" || payload.auth_time > nowInSeconds + maxClockSkew) {
      throw new Error("TOKEN_AUTH_TIME_INVALID: Hor\xE1rio de autentica\xE7\xE3o informado \xE9 inv\xE1lido.");
    }
  }
  let targetProjectId = expectedProjectId || process.env.VITE_FIREBASE_PROJECT_ID?.trim() || process.env.FIREBASE_PROJECT_ID?.trim();
  if (!targetProjectId) {
    try {
      const config = await Promise.resolve().then(() => __toESM(require_firebase_applet_config(), 1));
      targetProjectId = config.default?.projectId || config.projectId;
    } catch {
    }
  }
  if (!targetProjectId) {
    targetProjectId = "victoria-lar-residencial";
  }
  if (targetProjectId) {
    if (payload.aud !== targetProjectId) {
      throw new Error(`TOKEN_AUDIENCE_MISMATCH: O token pertence ao projeto "${payload.aud}", mas o servidor espera "${targetProjectId}".`);
    }
    const expectedIssuer = `https://securetoken.google.com/${targetProjectId}`;
    if (payload.iss !== expectedIssuer) {
      throw new Error(`TOKEN_ISSUER_MISMATCH: O emissor do token "${payload.iss}" \xE9 diferente do esperado "${expectedIssuer}".`);
    }
  } else {
    throw new Error("CONFIG_ERROR: ID do projeto Firebase n\xE3o definido para verifica\xE7\xE3o de audi\xEAncia e emissor do token.");
  }
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0 || payload.sub.length > 128) {
    throw new Error("TOKEN_SUBJECT_INVALID: Identificador de usu\xE1rio (sub/uid) inv\xE1lido no token.");
  }
  payload.uid = payload.sub;
  return payload;
}
async function requireVerifiedOwner(token, expectedProjectId) {
  const payload = await verifyFirebaseIdToken(token, expectedProjectId);
  const cleanEmail = (payload.email || "").trim().toLowerCase();
  const authorizedOwnerEmail = "victorialarresidencial@gmail.com";
  if (!payload.email_verified) {
    throw new Error("EMAIL_NOT_VERIFIED: A conta conectada n\xE3o possui e-mail verificado junto ao Google.");
  }
  if (cleanEmail !== authorizedOwnerEmail) {
    throw new Error(`UNAUTHORIZED_OWNER: O e-mail autenticado ("${cleanEmail}") n\xE3o \xE9 a conta institucional propriet\xE1ria oficial ("${authorizedOwnerEmail}").`);
  }
  return {
    uid: payload.sub,
    email: cleanEmail
  };
}
async function requireActiveAdmin(token, expectedProjectId) {
  const payload = await verifyFirebaseIdToken(token, expectedProjectId);
  if (!payload.email_verified) {
    throw new Error("EMAIL_NOT_VERIFIED: A conta conectada n\xE3o possui e-mail verificado.");
  }
  const cleanEmail = (payload.email || "").trim().toLowerCase();
  const uid = payload.sub || payload.uid;
  const { getServerFirestore: getServerFirestore2 } = await Promise.resolve().then(() => (init_firebaseAdmin(), firebaseAdmin_exports));
  const serverDb = getServerFirestore2();
  const adminSnap = await serverDb.collection("admins").doc(uid).get();
  if (!adminSnap.exists) {
    throw new Error("FORBIDDEN_NOT_ADMIN: Conta n\xE3o cadastrada no diret\xF3rio de administradores.");
  }
  const data = adminSnap.data();
  if (data?.active !== true) {
    throw new Error("FORBIDDEN_ADMIN_DEACTIVATED: Conta administrativa est\xE1 inativa ou foi desativada.");
  }
  return {
    uid,
    email: cleanEmail,
    role: data.role === "superadmin" ? "superadmin" : "admin"
  };
}
async function requireActiveSuperAdmin(token, expectedProjectId) {
  const admin = await requireActiveAdmin(token, expectedProjectId);
  if (admin.role !== "superadmin") {
    throw new Error("FORBIDDEN_NOT_SUPERADMIN: Opera\xE7\xE3o reservada exclusivamente para superadministradores ativos.");
  }
  return {
    uid: admin.uid,
    email: admin.email
  };
}
async function recordServerAuditLog(params) {
  try {
    const { getServerFirestore: getServerFirestore2 } = await Promise.resolve().then(() => (init_firebaseAdmin(), firebaseAdmin_exports));
    const serverDb = getServerFirestore2();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logRef = serverDb.collection("auditLogs").doc(logId);
    await logRef.set({
      id: logId,
      action: params.action,
      performedByUid: params.performedByUid,
      performedByEmail: params.performedByEmail,
      targetResource: params.targetResource,
      details: params.details,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("[Server Audit Logger Error]:", err?.message || err);
  }
}

// ../server/app.ts
init_firebaseAdmin();

// ../server/rateLimiter.ts
init_firebaseAdmin();
import crypto2 from "crypto";
var localMemoryBuckets = /* @__PURE__ */ new Map();
var emergencyFallbackBuckets = /* @__PURE__ */ new Map();
var CLEANUP_INTERVAL = 5 * 60 * 1e3;
var lastCleanup = Date.now();
function purgeExpiredLocalBuckets() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of localMemoryBuckets.entries()) {
    if (bucket.expiresAt <= now) {
      localMemoryBuckets.delete(key);
    }
  }
  for (const [key, bucket] of emergencyFallbackBuckets.entries()) {
    if (bucket.expiresAt <= now) {
      emergencyFallbackBuckets.delete(key);
    }
  }
}
function getAnonymizedClientHash(req) {
  const headers = req?.headers || {};
  let rawIp = "";
  if (typeof headers["x-appengine-user-ip"] === "string" && headers["x-appengine-user-ip"].trim()) {
    rawIp = headers["x-appengine-user-ip"].trim();
  } else if (req?.ip && typeof req.ip === "string" && req.ip.trim() && req.ip !== "::1" && req.ip !== "127.0.0.1") {
    rawIp = String(req.ip).trim();
  } else if (typeof headers["fastly-client-ip"] === "string" && headers["fastly-client-ip"].trim()) {
    rawIp = headers["fastly-client-ip"].trim();
  } else if (typeof headers["cf-connecting-ip"] === "string" && headers["cf-connecting-ip"].trim()) {
    rawIp = headers["cf-connecting-ip"].trim();
  } else if (headers["x-forwarded-for"]) {
    const forwarded = headers["x-forwarded-for"];
    const parts = (typeof forwarded === "string" ? forwarded.split(",") : Array.isArray(forwarded) ? forwarded : []).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      rawIp = parts[0];
    }
  } else if (typeof headers["x-real-ip"] === "string" && headers["x-real-ip"].trim()) {
    rawIp = headers["x-real-ip"].trim();
  } else if (req?.ip && typeof req.ip === "string" && req.ip.trim()) {
    rawIp = String(req.ip).trim();
  } else if (req?.socket && req.socket.remoteAddress) {
    rawIp = req.socket.remoteAddress.trim();
  }
  if (!rawIp) {
    rawIp = "unknown_client";
  }
  const salt = process.env.RATE_LIMIT_SALT && process.env.RATE_LIMIT_SALT.trim() || "vlr_institution_rate_limiter_2026";
  return crypto2.createHash("sha256").update(`${salt}:${rawIp}`).digest("hex").substring(0, 16);
}
async function checkRateLimit(req, action, options) {
  purgeExpiredLocalBuckets();
  const { maxRequests, windowMs } = options;
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const clientHash = getAnonymizedClientHash(req);
  const bucketKey = `rl_${action}_${clientHash}_${windowIndex}`;
  const expiresAtEpoch = (windowIndex + 1) * windowMs;
  const resetInSeconds = Math.max(1, Math.ceil((expiresAtEpoch - now) / 1e3));
  const localEntry = localMemoryBuckets.get(bucketKey);
  if (localEntry && localEntry.count >= maxRequests) {
    return {
      allowed: false,
      currentCount: localEntry.count,
      maxRequests,
      remaining: 0,
      resetInSeconds,
      clientHash
    };
  }
  let currentCount = 0;
  let persistenceSucceeded = false;
  try {
    const serverDb = getServerFirestore();
    const rateLimitRef = serverDb.collection("rateLimits").doc(bucketKey);
    const txResult = await serverDb.runTransaction(async (tx) => {
      const docSnap = await tx.get(rateLimitRef);
      let count = 0;
      if (docSnap.exists) {
        const data = docSnap.data() || {};
        count = typeof data.count === "number" ? data.count : 0;
      }
      if (count >= maxRequests) {
        return { allowed: false, count };
      }
      const nextCount = count + 1;
      tx.set(
        rateLimitRef,
        {
          id: bucketKey,
          action,
          clientHash,
          // Only anonymized hash, zero PII
          count: nextCount,
          expiresAt: new Date(expiresAtEpoch).toISOString(),
          expiresAtDate: new Date(expiresAtEpoch),
          // Native Date (Timestamp) for Cloud Firestore TTL Policy ($0.00 auto-deletion)
          updatedAt: new Date(now).toISOString()
        },
        { merge: true }
      );
      return { allowed: true, count: nextCount };
    });
    currentCount = txResult.count;
    persistenceSucceeded = true;
    localMemoryBuckets.set(bucketKey, {
      count: currentCount,
      expiresAt: expiresAtEpoch
    });
    if (!txResult.allowed) {
      return {
        allowed: false,
        currentCount,
        maxRequests,
        remaining: 0,
        resetInSeconds,
        clientHash
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[RateLimiter Warning] Fallback para mem\xF3ria local (${action}):`,
        sanitizeLog(err?.message || err)
      );
    }
  }
  if (!persistenceSucceeded) {
    const memBucket = localMemoryBuckets.get(bucketKey) || { count: 0, expiresAt: expiresAtEpoch };
    memBucket.count += 1;
    localMemoryBuckets.set(bucketKey, memBucket);
    currentCount = memBucket.count;
    if (currentCount > maxRequests) {
      return {
        allowed: false,
        currentCount,
        maxRequests,
        remaining: 0,
        resetInSeconds,
        clientHash
      };
    }
    if (action === "contact" || action === "schedule_meeting") {
      const emergencyKey = `emg_${action}_${windowIndex}`;
      const emergencyEntry = emergencyFallbackBuckets.get(emergencyKey) || { count: 0, expiresAt: expiresAtEpoch };
      emergencyEntry.count += 1;
      emergencyFallbackBuckets.set(emergencyKey, emergencyEntry);
      const emergencyCap = Math.max(maxRequests, 10);
      if (emergencyEntry.count > emergencyCap) {
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            `[RateLimiter Emergency Circuit-Breaker] Limite emergencial atingido para ${action} durante indisponibilidade do Firestore.`
          );
        }
        return {
          allowed: false,
          currentCount: emergencyEntry.count,
          maxRequests,
          remaining: 0,
          resetInSeconds,
          clientHash
        };
      }
    }
  }
  const remaining = Math.max(0, maxRequests - currentCount);
  return {
    allowed: true,
    currentCount,
    maxRequests,
    remaining,
    resetInSeconds,
    clientHash
  };
}

// ../server/app.ts
dotenv.config();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
var rawFirebaseConfig = null;
try {
  const cwdPath = path2.resolve(process.cwd(), "firebase-applet-config.json");
  const parentPath = path2.resolve(__dirname2, "..", "firebase-applet-config.json");
  const directPath = path2.resolve(__dirname2, "firebase-applet-config.json");
  const resolvedPath = [cwdPath, parentPath, directPath].find((p) => fs2.existsSync(p));
  if (resolvedPath) {
    rawFirebaseConfig = JSON.parse(fs2.readFileSync(resolvedPath, "utf8"));
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json:", e);
}
var activeFirebaseProjectId2 = process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_PROJECT_ID.trim() || process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim() || rawFirebaseConfig?.projectId || "victoria-lar-residencial";
var activeFirebaseDatabaseId2 = "(default)";
var activeStorageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET && process.env.VITE_FIREBASE_STORAGE_BUCKET.trim() || process.env.FIREBASE_STORAGE_BUCKET && process.env.FIREBASE_STORAGE_BUCKET.trim() || rawFirebaseConfig?.storageBucket || "victoria-lar-residencial.firebasestorage.app";
var isConfiguredFromSecrets = !!(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY);
function registerRoute(method, apiPath, handler) {
  app[method](apiPath, handler);
  const strippedPath = apiPath.startsWith("/api") ? apiPath.substring(4) : apiPath;
  if (strippedPath && strippedPath !== apiPath) {
    app[method](strippedPath, handler);
  }
}
registerRoute("get", "/api/health", (_req, res) => {
  res.json({
    status: "online",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    firebase: {
      configured: !!activeFirebaseProjectId2,
      projectId: activeFirebaseProjectId2,
      databaseId: activeFirebaseDatabaseId2,
      storageBucket: activeStorageBucket,
      source: isConfiguredFromSecrets ? "SECRETS_ENV" : "APPLET_CONFIG_JSON",
      admin: getFirebaseAdminStatus()
    },
    institution: "Victoria Lar Residencial",
    platform: process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG ? "FIREBASE_CLOUD_FUNCTIONS_2GEN" : process.env.VERCEL ? "VERCEL_SERVERLESS" : "NODE_EXPRESS"
  });
});
registerRoute("get", "/api/bootstrap/status", async (_req, res) => {
  try {
    const serverDb = getServerFirestore();
    const bootstrapRef = serverDb.collection("system").doc("bootstrap");
    const bootstrapSnap = await bootstrapRef.get();
    let isCompleted = false;
    if (bootstrapSnap.exists) {
      const data = bootstrapSnap.data();
      isCompleted = Boolean(data && (data.lockedPermanently === true || data.status === "COMPLETED"));
    }
    res.json({
      success: true,
      initialized: isCompleted,
      status: isCompleted ? "COMPLETED" : "UNINITIALIZED",
      lockedPermanently: isCompleted
    });
  } catch {
    res.json({
      success: true,
      initialized: false,
      status: "UNINITIALIZED",
      lockedPermanently: false
    });
  }
});
registerRoute("post", "/api/bootstrap/initiate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    let token = "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.body && typeof req.body.idToken === "string") {
      token = req.body.idToken.trim();
    } else if (req.body && typeof req.body.token === "string") {
      token = req.body.token.trim();
    }
    if (!token) {
      return res.status(401).json({
        error: "TOKEN_REQUIRED: O token de autentica\xE7\xE3o Firebase ID Token \xE9 obrigat\xF3rio para inicializar o sistema."
      });
    }
    const verifiedOwner = await requireVerifiedOwner(token, activeFirebaseProjectId2);
    const ownerUid = verifiedOwner.uid;
    const ownerEmail = verifiedOwner.email;
    const serverDb = getServerFirestore();
    const bootstrapRef = serverDb.collection("system").doc("bootstrap");
    const guardRef = serverDb.collection("system").doc("superAdminGuard");
    const adminRef = serverDb.collection("admins").doc(ownerUid);
    const logId = `log_boot_${Date.now()}`;
    const auditRef = serverDb.collection("auditLogs").doc(logId);
    const result = await serverDb.runTransaction(async (tx) => {
      const bootstrapSnap = await tx.get(bootstrapRef);
      const guardSnap = await tx.get(guardRef);
      if (bootstrapSnap.exists) {
        const data = bootstrapSnap.data();
        if (data && (data.lockedPermanently === true || data.status === "COMPLETED")) {
          if (data.superAdminUid === ownerUid) {
            return {
              success: true,
              message: "Sistema j\xE1 inicializado para este superadministrador.",
              alreadyInitialized: true
            };
          }
          throw new Error("SISTEMA_JA_INICIALIZADO: O bootstrap inicial j\xE1 foi executado e permanentemente selado. Novas contas de administrador devem ser convidadas exclusivamente pelo painel interno.");
        }
      }
      if (guardSnap.exists) {
        const gData = guardSnap.data();
        if (gData && typeof gData.activeSuperAdminCount === "number" && gData.activeSuperAdminCount >= 1) {
          throw new Error("SISTEMA_JA_INICIALIZADO: O sistema j\xE1 possui superadministrador ativo configurado.");
        }
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      tx.set(adminRef, {
        uid: ownerUid,
        email: ownerEmail,
        role: "superadmin",
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: "SERVER_TRUSTED_BOOTSTRAP",
        bootstrapStatus: "COMPLETED"
      });
      tx.set(guardRef, {
        activeSuperAdminCount: 1,
        activeSuperAdminUids: [ownerUid],
        version: 1,
        updatedAt: nowIso
      });
      tx.set(bootstrapRef, {
        status: "COMPLETED",
        superAdminUid: ownerUid,
        completedAt: nowIso,
        lockedPermanently: true
      });
      tx.set(auditRef, {
        id: logId,
        action: "BOOTSTRAP_INITIAL_SEALED",
        performedByUid: ownerUid,
        performedByEmail: ownerEmail,
        targetResource: `/admins/${ownerUid}`,
        details: "Initial superadmin account provisioned and permanent system bootstrap lock sealed by cryptographic server authority.",
        timestamp: nowIso
      });
      return {
        success: true,
        message: "Superadministrador inicial provisionado com sucesso e sistema selado.",
        alreadyInitialized: false
      };
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err?.message?.includes("SISTEMA_JA_INICIALIZADO")) {
      return res.status(409).json({ error: err.message });
    }
    if (err?.message?.includes("TOKEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED") || err?.message?.includes("UNAUTHORIZED_OWNER")) {
      return res.status(403).json({ error: err.message });
    }
    console.error("[Server Bootstrap Initiation Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: "Falha ao executar bootstrap no servidor." });
  }
});
registerRoute("post", "/api/admin/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const superAdmin = await requireActiveSuperAdmin(token, activeFirebaseProjectId2);
    const { uid, email, role } = req.body || {};
    if (!email || typeof email !== "string" || email.trim().length === 0 || email.length > 160 || !email.includes("@")) {
      return res.status(400).json({ error: "E-mail inv\xE1lido fornecido para o administrador." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "E-mail inv\xE1lido fornecido para o administrador." });
    }
    if (role !== "admin" && role !== "superadmin") {
      return res.status(400).json({ error: 'Fun\xE7\xE3o deve ser "admin" ou "superadmin".' });
    }
    let resolvedUid = typeof uid === "string" && uid.trim() ? uid.trim() : "";
    if (!resolvedUid) {
      try {
        const serverAuth = getServerAuth();
        const userLookupPromise = serverAuth.getUserByEmail(cleanEmail);
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("AUTH_TIMEOUT: Tempo limite esgotado ao consultar Firebase Authentication.")), 5e3)
        );
        const userRecord = await Promise.race([userLookupPromise, timeoutPromise]);
        if (!userRecord || !userRecord.uid) {
          throw new Error("USER_NOT_FOUND");
        }
        resolvedUid = userRecord.uid;
      } catch (authErr) {
        try {
          const serverDb2 = getServerFirestore();
          const staffQuery = await serverDb2.collection("usuariosAutorizados").where("email", "==", cleanEmail).limit(1).get().catch(() => null);
          if (staffQuery && !staffQuery.empty) {
            resolvedUid = staffQuery.docs[0].id;
          } else {
            const reqQuery = await serverDb2.collection("accessRequests").where("email", "==", cleanEmail).limit(1).get().catch(() => null);
            if (reqQuery && !reqQuery.empty) {
              resolvedUid = reqQuery.docs[0].data().uid;
            }
          }
        } catch {
        }
        if (!resolvedUid) {
          if (authErr?.code === "auth/user-not-found" || authErr?.message?.includes("user-not-found") || authErr?.message?.includes("No user record found") || authErr?.message?.includes("USER_NOT_FOUND")) {
            return res.status(404).json({
              error: "USER_NOT_FOUND: Nenhum usu\xE1rio encontrado com este e-mail no Firebase Authentication. Solicite que o usu\xE1rio crie sua conta atrav\xE9s do login da plataforma antes de conceder acesso administrativo."
            });
          }
          console.error("[Firebase Admin Auth Lookup Error]:", sanitizeLog(authErr?.message || authErr));
          return res.status(503).json({
            error: "FIREBASE_AUTH_UNAVAILABLE: O servi\xE7o de autentica\xE7\xE3o do Firebase Admin n\xE3o respondeu a tempo ou n\xE3o est\xE1 acess\xEDvel no servidor. Verifique as credenciais no servidor."
          });
        }
      }
    }
    if (!resolvedUid || resolvedUid.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(resolvedUid)) {
      return res.status(400).json({ error: "UID inv\xE1lido fornecido para o administrador." });
    }
    const serverDb = getServerFirestore();
    const adminRef = serverDb.collection("admins").doc(resolvedUid);
    const guardRef = serverDb.collection("system").doc("superAdminGuard");
    await serverDb.runTransaction(async (tx) => {
      const existingDoc = await tx.get(adminRef);
      if (existingDoc.exists) {
        throw new Error("ADMIN_EXISTS: J\xE1 existe um administrador cadastrado com este e-mail.");
      }
      const guardSnap = await tx.get(guardRef);
      const guardData = guardSnap.exists ? guardSnap.data() : null;
      const adminsSnap = await tx.get(serverDb.collection("admins"));
      let emailAlreadyInUse = false;
      const activeSuperAdminUids = [];
      adminsSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role === "superadmin" && d.active === true) {
          activeSuperAdminUids.push(doc.id);
        }
        if (d.email && d.email.toLowerCase() === cleanEmail) {
          emailAlreadyInUse = true;
        }
      });
      if (emailAlreadyInUse) {
        throw new Error("ADMIN_EXISTS: J\xE1 existe um administrador cadastrado com este e-mail.");
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const adminData = {
        uid: resolvedUid,
        email: cleanEmail,
        role,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: superAdmin.uid,
        bootstrapStatus: "COMPLETED"
      };
      tx.set(adminRef, adminData);
      if (role === "superadmin") {
        const updatedList = Array.from(/* @__PURE__ */ new Set([...activeSuperAdminUids, resolvedUid]));
        tx.set(guardRef, {
          activeSuperAdminCount: updatedList.length,
          activeSuperAdminUids: updatedList,
          version: (guardData?.version || 1) + 1,
          updatedAt: nowIso
        }, { merge: true });
      }
    });
    await recordServerAuditLog({
      action: "ADMIN_CREATED",
      performedByUid: superAdmin.uid,
      performedByEmail: superAdmin.email,
      targetResource: `/admins/${resolvedUid}`,
      details: `Novo administrador (${cleanEmail}, fun\xE7\xE3o: ${role}) provisionado com autoridade at\xF4mica do servidor.`
    });
    return res.status(201).json({
      success: true,
      message: "Administrador cadastrado com sucesso.",
      user: {
        uid: resolvedUid,
        email: cleanEmail,
        role
      }
    });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes("ADMIN_EXISTS")) {
      return res.status(409).json({ error: err.message });
    }
    console.error("[Create Admin Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao cadastrar administrador." });
  }
});
registerRoute("patch", "/api/admin/users/:uid", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const superAdmin = await requireActiveSuperAdmin(token, activeFirebaseProjectId2);
    const targetUid = req.params.uid;
    if (!targetUid || typeof targetUid !== "string" || targetUid.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(targetUid)) {
      return res.status(400).json({ error: "UID inv\xE1lido de administrador." });
    }
    const { role, active } = req.body || {};
    if (role !== void 0 && role !== "admin" && role !== "superadmin") {
      return res.status(400).json({ error: 'Fun\xE7\xE3o deve ser "admin" ou "superadmin".' });
    }
    if (active !== void 0 && typeof active !== "boolean") {
      return res.status(400).json({ error: "Campo active deve ser booleano." });
    }
    if (role === void 0 && active === void 0) {
      return res.status(400).json({ error: "Nenhum campo para atualiza\xE7\xE3o fornecido." });
    }
    const serverDb = getServerFirestore();
    const adminRef = serverDb.collection("admins").doc(targetUid);
    const guardRef = serverDb.collection("system").doc("superAdminGuard");
    await serverDb.runTransaction(async (tx) => {
      const targetSnap = await tx.get(adminRef);
      if (!targetSnap.exists) {
        throw new Error("ADMIN_NOT_FOUND: Administrador n\xE3o encontrado.");
      }
      const currentAdmin = targetSnap.data() || {};
      const isCurrentlyActiveSuperAdmin = currentAdmin.role === "superadmin" && currentAdmin.active === true;
      const targetRole = role !== void 0 ? role : currentAdmin.role;
      const targetActive = active !== void 0 ? active : currentAdmin.active;
      const willBeActiveSuperAdmin = targetRole === "superadmin" && targetActive === true;
      const guardSnap = await tx.get(guardRef);
      const guardData = guardSnap.exists ? guardSnap.data() : null;
      const adminsSnap = await tx.get(serverDb.collection("admins"));
      const activeSuperAdminUids = [];
      adminsSnap.forEach((doc) => {
        const d = doc.data();
        if (d.role === "superadmin" && d.active === true) {
          activeSuperAdminUids.push(doc.id);
        }
      });
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      if (isCurrentlyActiveSuperAdmin && !willBeActiveSuperAdmin) {
        if (activeSuperAdminUids.length <= 1) {
          throw new Error("PROTECAO_BLOQUEADA: Imposs\xEDvel desativar ou rebaixar o \xFAnico superadministrador ativo remanescente. O sistema ficaria sem superadministrador.");
        }
        const remainingUids = activeSuperAdminUids.filter((u) => u !== targetUid);
        tx.set(guardRef, {
          activeSuperAdminCount: remainingUids.length,
          activeSuperAdminUids: remainingUids,
          version: (guardData?.version || 1) + 1,
          updatedAt: nowIso
        }, { merge: true });
      } else if (!isCurrentlyActiveSuperAdmin && willBeActiveSuperAdmin) {
        const updatedUids = Array.from(/* @__PURE__ */ new Set([...activeSuperAdminUids, targetUid]));
        tx.set(guardRef, {
          activeSuperAdminCount: updatedUids.length,
          activeSuperAdminUids: updatedUids,
          version: (guardData?.version || 1) + 1,
          updatedAt: nowIso
        }, { merge: true });
      }
      const updateData = { updatedAt: nowIso };
      if (role !== void 0) updateData.role = role;
      if (active !== void 0) updateData.active = active;
      tx.update(adminRef, updateData);
    });
    await recordServerAuditLog({
      action: "ADMIN_UPDATED",
      performedByUid: superAdmin.uid,
      performedByEmail: superAdmin.email,
      targetResource: `/admins/${targetUid}`,
      details: `Administrador ${targetUid} atualizado: ${JSON.stringify({ role, active })}.`
    });
    return res.status(200).json({ success: true, message: "Administrador atualizado com sucesso." });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes("ADMIN_NOT_FOUND")) {
      return res.status(404).json({ error: err.message });
    }
    if (err?.message?.includes("PROTECAO_BLOQUEADA")) {
      return res.status(409).json({ error: err.message });
    }
    console.error("[Update Admin Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao atualizar administrador." });
  }
});
registerRoute("get", "/api/admin/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    await requireActiveAdmin(token, activeFirebaseProjectId2);
    const serverDb = getServerFirestore();
    const snap = await serverDb.collection("admins").get();
    const users = snap.docs.map((d) => d.data());
    return res.json({ success: true, users });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: "Falha ao consultar administradores." });
  }
});
registerRoute("post", "/api/audit/log", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
    const { action, targetResource, details } = req.body || {};
    if (!action || typeof action !== "string" || action.length > 80) {
      return res.status(400).json({ error: "A\xE7\xE3o de auditoria inv\xE1lida." });
    }
    await recordServerAuditLog({
      action: action.trim(),
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: typeof targetResource === "string" ? targetResource.slice(0, 200) : "general",
      details: typeof details === "string" ? details.slice(0, 1e3) : ""
    });
    return res.status(201).json({ success: true, message: "Evento de auditoria registrado pelo servidor." });
  } catch (err) {
    return res.status(403).json({ error: "Falha na valida\xE7\xE3o de auditoria." });
  }
});
registerRoute("post", "/api/access-requests", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria para solicitar acesso." });
    }
    const verifiedUser = await verifyFirebaseIdToken(token, activeFirebaseProjectId2);
    if (!verifiedUser.email_verified) {
      return res.status(403).json({ error: "EMAIL_NOT_VERIFIED: E-mail da conta Google deve ser verificado." });
    }
    const uid = verifiedUser.uid;
    const email = (verifiedUser.email || "").trim().toLowerCase();
    const { nome, departamento, cargo, motivo, modulosSolicitados } = req.body || {};
    if (!nome || typeof nome !== "string" || nome.trim().length === 0 || nome.length > 120) {
      return res.status(400).json({ error: "Nome completo \xE9 obrigat\xF3rio (at\xE9 120 caracteres)." });
    }
    if (!motivo || typeof motivo !== "string" || motivo.trim().length === 0 || motivo.length > 1e3) {
      return res.status(400).json({ error: "Justificativa do pedido \xE9 obrigat\xF3ria (at\xE9 1000 caracteres)." });
    }
    const validModules = ["residentes", "colaboradores", "landing_page", "solicitacoes", "usuarios", "seguranca"];
    const sanitizedModules = Array.isArray(modulosSolicitados) ? modulosSolicitados.filter((m) => typeof m === "string" && validModules.includes(m)) : ["residentes"];
    if (sanitizedModules.length === 0) {
      sanitizedModules.push("residentes");
    }
    const serverDb = getServerFirestore();
    const requestId = `req_${uid}_${Date.now()}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const userLockRef = serverDb.collection("accessRequestLocks").doc(uid);
    const requestRef = serverDb.collection("accessRequests").doc(requestId);
    const requestRecord = {
      id: requestId,
      uid,
      email,
      nome: nome.trim(),
      departamento: typeof departamento === "string" ? departamento.slice(0, 100) : "Equipe",
      cargo: typeof cargo === "string" ? cargo.slice(0, 100) : "Colaborador",
      motivo: motivo.trim(),
      modulosSolicitados: sanitizedModules,
      status: "pendente",
      // STRICT: Initial state is ALWAYS pendente; client cannot self-approve!
      criadoEm: nowIso
    };
    await serverDb.runTransaction(async (tx) => {
      const lockSnap = await tx.get(userLockRef);
      if (lockSnap.exists) {
        const lockData = lockSnap.data();
        if (lockData?.hasPending === true) {
          throw new Error("SOLICITACAO_PENDENTE_EXISTENTE: J\xE1 existe uma solicita\xE7\xE3o de acesso pendente em an\xE1lise para este usu\xE1rio.");
        }
      } else {
        const existingSnap = await tx.get(
          serverDb.collection("accessRequests").where("uid", "==", uid).where("status", "==", "pendente")
        );
        if (!existingSnap.empty) {
          tx.set(userLockRef, {
            uid,
            hasPending: true,
            activeRequestId: existingSnap.docs[0].id,
            updatedAt: nowIso
          }, { merge: true });
          throw new Error("SOLICITACAO_PENDENTE_EXISTENTE: J\xE1 existe uma solicita\xE7\xE3o de acesso pendente em an\xE1lise para este usu\xE1rio.");
        }
      }
      tx.set(requestRef, requestRecord);
      tx.set(userLockRef, {
        uid,
        hasPending: true,
        activeRequestId: requestId,
        updatedAt: nowIso
      }, { merge: true });
    });
    await recordServerAuditLog({
      action: "ACCESS_REQUEST_SUBMITTED",
      performedByUid: uid,
      performedByEmail: email,
      targetResource: `/accessRequests/${requestId}`,
      details: `Solicita\xE7\xE3o de acesso criada por ${email} para os m\xF3dulos: ${sanitizedModules.join(", ")}.`
    });
    return res.status(201).json({
      success: true,
      message: "Solicita\xE7\xE3o de acesso enviada com sucesso para a diretoria da Victoria Lar Residencial.",
      request: requestRecord
    });
  } catch (err) {
    if (err?.message?.includes("SOLICITACAO_PENDENTE_EXISTENTE")) {
      return res.status(409).json({ error: err.message });
    }
    if (err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes("TOKEN_")) {
      return res.status(401).json({ error: err.message });
    }
    console.error("[Create Access Request Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao registrar solicita\xE7\xE3o de acesso." });
  }
});
registerRoute("get", "/api/access-requests", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    await requireActiveAdmin(token, activeFirebaseProjectId2);
    const serverDb = getServerFirestore();
    const snap = await serverDb.collection("accessRequests").orderBy("criadoEm", "desc").get();
    const requests = snap.docs.map((d) => d.data());
    return res.json({ success: true, requests });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: "Falha ao buscar solicita\xE7\xF5es de acesso." });
  }
});
registerRoute("post", "/api/access-requests/:id/review", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
    const requestId = req.params.id;
    if (!requestId || typeof requestId !== "string" || requestId.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(requestId)) {
      return res.status(400).json({ error: "Identificador de solicita\xE7\xE3o inv\xE1lido." });
    }
    const allowedBodyKeys = ["status", "justificativa", "modulos", "role"];
    const bodyKeys = Object.keys(req.body || {});
    const forbiddenKeys = bodyKeys.filter((k) => !allowedBodyKeys.includes(k));
    if (forbiddenKeys.length > 0) {
      return res.status(400).json({
        error: `PROTECTED_FIELDS_MODIFICATION: Payload cont\xE9m campos proibidos: ${forbiddenKeys.join(", ")}.`
      });
    }
    const { status, justificativa, modulos, role } = req.body || {};
    if (status !== "aprovada" && status !== "rejeitada") {
      return res.status(400).json({ error: 'Status da revis\xE3o deve ser "aprovada" ou "rejeitada".' });
    }
    if (justificativa !== void 0 && (typeof justificativa !== "string" || justificativa.length > 500)) {
      return res.status(400).json({ error: "Justificativa deve ser um texto de at\xE9 500 caracteres." });
    }
    const validModules = ["residentes", "colaboradores", "landing_page", "solicitacoes", "usuarios", "seguranca"];
    if (modulos !== void 0) {
      if (!Array.isArray(modulos) || modulos.length === 0 || !modulos.every((m) => typeof m === "string" && validModules.includes(m))) {
        return res.status(400).json({ error: "M\xF3dulos fornecidos cont\xEAm valores inv\xE1lidos." });
      }
    }
    if (role !== void 0 && role !== "admin" && role !== "colaborador") {
      return res.status(400).json({ error: 'Papel solicitado deve ser "admin" ou "colaborador".' });
    }
    if (role === "admin" && activeAdmin.role !== "superadmin") {
      return res.status(403).json({
        error: "FORBIDDEN_SUPERADMIN_REQUIRED: Apenas superadministradores ativos podem conceder privil\xE9gios administrativos."
      });
    }
    const serverDb = getServerFirestore();
    const requestRef = serverDb.collection("accessRequests").doc(requestId);
    const callerAdminRef = serverDb.collection("admins").doc(activeAdmin.uid);
    const result = await serverDb.runTransaction(async (tx) => {
      const callerSnap = await tx.get(callerAdminRef);
      if (!callerSnap.exists) {
        throw new Error("FORBIDDEN_NOT_ADMIN: Conta n\xE3o cadastrada no diret\xF3rio de administradores.");
      }
      const callerData = callerSnap.data() || {};
      if (callerData.active !== true) {
        throw new Error("FORBIDDEN_ADMIN_DEACTIVATED: Conta administrativa est\xE1 inativa ou foi desativada.");
      }
      const liveCallerRole = callerData.role === "superadmin" ? "superadmin" : "admin";
      if (role === "admin" && liveCallerRole !== "superadmin") {
        throw new Error("FORBIDDEN_SUPERADMIN_REQUIRED: Apenas superadministradores ativos podem conceder privil\xE9gios administrativos.");
      }
      const snap = await tx.get(requestRef);
      if (!snap.exists) {
        throw new Error("NOT_FOUND: Solicita\xE7\xE3o de acesso n\xE3o encontrada.");
      }
      const reqData = snap.data() || {};
      if (reqData.uid === activeAdmin.uid) {
        throw new Error("CANNOT_REVIEW_OWN_REQUEST: Administradores n\xE3o podem revisar ou aprovar a pr\xF3pria solicita\xE7\xE3o de acesso.");
      }
      if (reqData.status !== "pendente") {
        throw new Error("ALREADY_REVIEWED: Esta solicita\xE7\xE3o j\xE1 foi revisada anteriormente.");
      }
      const userLockRef = serverDb.collection("accessRequestLocks").doc(reqData.uid);
      await tx.get(userLockRef);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const updatedRequest = {
        status,
        revisadoEm: nowIso,
        revisadoPorUid: activeAdmin.uid,
        revisadoPorEmail: activeAdmin.email,
        justificativaRevisao: typeof justificativa === "string" ? justificativa.slice(0, 500) : ""
      };
      tx.update(requestRef, updatedRequest);
      tx.set(userLockRef, {
        uid: reqData.uid,
        hasPending: false,
        lastReviewedRequestId: requestId,
        updatedAt: nowIso
      }, { merge: true });
      if (status === "aprovada") {
        const staffRef = serverDb.collection("usuariosAutorizados").doc(reqData.uid);
        const grantedModules = Array.isArray(modulos) && modulos.length > 0 ? modulos.filter((m) => typeof m === "string" && validModules.includes(m)) : reqData.modulosSolicitados || ["residentes"];
        const grantedRole = role === "admin" && liveCallerRole === "superadmin" ? "admin" : "colaborador";
        tx.set(staffRef, {
          uid: reqData.uid,
          email: reqData.email,
          nome: reqData.nome || "",
          departamento: reqData.departamento || "",
          cargo: reqData.cargo || "",
          role: grantedRole,
          modulos: grantedModules,
          ativo: true,
          concedidoEm: nowIso,
          concedidoPorUid: activeAdmin.uid,
          concedidoPorEmail: activeAdmin.email,
          atualizadoEm: nowIso
        }, { merge: true });
      }
      return {
        success: true,
        message: status === "aprovada" ? `Solicita\xE7\xE3o aprovada com sucesso. Acesso concedido para ${reqData.email}.` : `Solicita\xE7\xE3o de acesso rejeitada para ${reqData.email}.`
      };
    });
    await recordServerAuditLog({
      action: status === "aprovada" ? "ACCESS_REQUEST_APPROVED" : "ACCESS_REQUEST_REJECTED",
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: `/accessRequests/${requestId}`,
      details: `Revis\xE3o de solicita\xE7\xE3o por ${activeAdmin.email}: resultado ${status}, concedido papel: ${role || "colaborador"}.`
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err?.message?.includes("CANNOT_REVIEW_OWN_REQUEST") || err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes("NOT_FOUND")) {
      return res.status(404).json({ error: err.message });
    }
    if (err?.message?.includes("ALREADY_REVIEWED")) {
      return res.status(409).json({ error: err.message });
    }
    console.error("[Review Access Request Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao revisar solicita\xE7\xE3o de acesso." });
  }
});
registerRoute("get", "/api/user/permissions", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const verifiedUser = await verifyFirebaseIdToken(token, activeFirebaseProjectId2);
    const uid = verifiedUser.uid;
    const email = (verifiedUser.email || "").trim().toLowerCase();
    const isEmailVerified = !!verifiedUser.email_verified;
    const serverDb = getServerFirestore();
    const adminSnap = await serverDb.collection("admins").doc(uid).get();
    if (adminSnap.exists && isEmailVerified) {
      const adminData = adminSnap.data() || {};
      if (adminData.active === true) {
        return res.json({
          success: true,
          permissions: {
            uid,
            email,
            emailVerified: true,
            isAdmin: true,
            isSuperAdmin: adminData.role === "superadmin",
            isStaff: true,
            ativo: true,
            modulos: ["residentes", "colaboradores", "landing_page", "solicitacoes", "usuarios", "seguranca"]
          }
        });
      }
    }
    const staffSnap = await serverDb.collection("usuariosAutorizados").doc(uid).get();
    if (staffSnap.exists && isEmailVerified) {
      const staffData = staffSnap.data() || {};
      if (staffData.ativo === true) {
        return res.json({
          success: true,
          permissions: {
            uid,
            email,
            emailVerified: true,
            isAdmin: staffData.role === "admin",
            isSuperAdmin: false,
            isStaff: true,
            ativo: true,
            modulos: Array.isArray(staffData.modulos) ? staffData.modulos : ["residentes"]
          }
        });
      }
    }
    let pendingRequest = null;
    const requestsSnap = await serverDb.collection("accessRequests").where("uid", "==", uid).orderBy("criadoEm", "desc").limit(1).get().catch(() => null);
    if (requestsSnap && !requestsSnap.empty) {
      pendingRequest = requestsSnap.docs[0].data();
    }
    return res.json({
      success: true,
      permissions: {
        uid,
        email,
        emailVerified: isEmailVerified,
        isAdmin: false,
        isSuperAdmin: false,
        isStaff: false,
        ativo: false,
        modulos: [],
        pendingRequest
      }
    });
  } catch (err) {
    return res.status(401).json({ error: "Falha ao autenticar usu\xE1rio para consulta de permiss\xF5es." });
  }
});
registerRoute("post", "/api/staff-authorizations/prepare", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
    const { matricula, funcionarioId, modulos } = req.body || {};
    if (!matricula || typeof matricula !== "string" || matricula.trim().length === 0 || matricula.length > 50) {
      return res.status(400).json({ error: "Matr\xEDcula funcional obrigat\xF3ria para preparar autoriza\xE7\xE3o." });
    }
    const cleanMatricula = matricula.trim().toUpperCase();
    const serverDb = getServerFirestore();
    let targetFuncionario = null;
    let targetFuncionarioId = typeof funcionarioId === "string" && funcionarioId.trim() ? funcionarioId.trim() : "";
    if (targetFuncionarioId) {
      const funcDoc = await serverDb.collection("funcionarios").doc(targetFuncionarioId).get();
      if (funcDoc.exists) {
        targetFuncionario = funcDoc.data();
      }
    }
    if (!targetFuncionario) {
      const snap = await serverDb.collection("funcionarios").where("matricula", "==", cleanMatricula).limit(1).get();
      if (!snap.empty) {
        targetFuncionario = snap.docs[0].data();
        targetFuncionarioId = snap.docs[0].id;
      }
    }
    if (!targetFuncionario) {
      return res.status(404).json({
        error: `FUNCIONARIO_NAO_ENCONTRADO: Nenhum colaborador cadastrado com a matr\xEDcula "${cleanMatricula}".`
      });
    }
    if (targetFuncionario.matricula?.trim().toUpperCase() !== cleanMatricula) {
      return res.status(400).json({
        error: "INCONSISTENCIA_DADOS: A matr\xEDcula informada diverge do cadastro funcional do colaborador."
      });
    }
    const validModules = ["residentes", "colaboradores", "landing_page", "solicitacoes", "usuarios", "seguranca"];
    const sanitizedModules = Array.isArray(modulos) && modulos.length > 0 ? modulos.filter((m) => typeof m === "string" && validModules.includes(m)) : ["residentes"];
    if (sanitizedModules.length === 0) {
      sanitizedModules.push("residentes");
    }
    const staffQuery = await serverDb.collection("usuariosAutorizados").where("matricula", "==", cleanMatricula).get();
    for (const docSnap of staffQuery.docs) {
      const existing = docSnap.data();
      if (existing.ativo === true && existing.statusAcesso === "ativo") {
        return res.status(409).json({
          code: "MATRICULA_JA_VINCULADA",
          error: `MATRICULA_JA_VINCULADA: A matr\xEDcula "${cleanMatricula}" j\xE1 est\xE1 vinculada e ativa para o usu\xE1rio ${existing.email || docSnap.id}. Revogue o acesso anterior antes de preparar nova vincula\xE7\xE3o.`
        });
      }
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const docId = `pending_${cleanMatricula.replace(/[^a-zA-Z0-9_\-]/g, "_")}`;
    const staffRef = serverDb.collection("usuariosAutorizados").doc(docId);
    const authorizationRecord = {
      id: docId,
      matricula: cleanMatricula,
      funcionarioId: targetFuncionarioId,
      nome: targetFuncionario.nomeCompleto || "",
      cargo: targetFuncionario.cargo || "",
      departamento: targetFuncionario.departamento || "",
      email: (targetFuncionario.email || "").trim().toLowerCase(),
      situacaoFuncional: targetFuncionario.status || "ativo",
      role: "colaborador",
      // PRINCÍPIO: colaborador nunca recebe papel de admin automaticamente
      modulos: sanitizedModules,
      statusAcesso: "pendente",
      ativo: false,
      // CRÍTICO: ativo permanece false até a validação da identidade
      preparadoEm: nowIso,
      preparadoPorUid: activeAdmin.uid,
      preparadoPorEmail: activeAdmin.email,
      atualizadoEm: nowIso
    };
    await serverDb.runTransaction(async (tx) => {
      tx.set(staffRef, authorizationRecord, { merge: true });
    });
    await recordServerAuditLog({
      action: "STAFF_AUTHORIZATION_PREPARED",
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: `/usuariosAutorizados/${docId}`,
      details: `Autoriza\xE7\xE3o pendente preparada para matr\xEDcula ${cleanMatricula} (${targetFuncionario.nomeCompleto}) para os m\xF3dulos: ${sanitizedModules.join(", ")}.`
    });
    return res.status(201).json({
      success: true,
      message: `Autoriza\xE7\xE3o para o colaborador "${targetFuncionario.nomeCompleto}" (Matr\xEDcula: ${cleanMatricula}) preparada com sucesso com status PENDENTE.`,
      authorization: authorizationRecord
    });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    console.error("[Prepare Staff Authorization Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao preparar autoriza\xE7\xE3o de colaborador." });
  }
});
registerRoute("post", "/api/staff-authorizations/revoke", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
    const { matricula, uid, id } = req.body || {};
    const serverDb = getServerFirestore();
    let targetDocRef = null;
    let targetData = null;
    if (id) {
      const snap = await serverDb.collection("usuariosAutorizados").doc(id).get();
      if (snap.exists) {
        targetDocRef = snap.ref || serverDb.collection("usuariosAutorizados").doc(id);
        targetData = snap.data();
      }
    }
    if (!targetDocRef && uid) {
      const snap = await serverDb.collection("usuariosAutorizados").doc(uid).get();
      if (snap.exists) {
        targetDocRef = snap.ref || serverDb.collection("usuariosAutorizados").doc(uid);
        targetData = snap.data();
      }
    }
    if (!targetDocRef && matricula) {
      const cleanMatricula = matricula.trim().toUpperCase();
      const snap = await serverDb.collection("usuariosAutorizados").where("matricula", "==", cleanMatricula).limit(1).get();
      if (!snap.empty) {
        targetDocRef = snap.docs[0].ref || serverDb.collection("usuariosAutorizados").doc(snap.docs[0].id);
        targetData = snap.docs[0].data();
      } else {
        const docId = `pending_${cleanMatricula.replace(/[^a-zA-Z0-9_\-]/g, "_")}`;
        const pSnap = await serverDb.collection("usuariosAutorizados").doc(docId).get();
        if (pSnap.exists) {
          targetDocRef = pSnap.ref || serverDb.collection("usuariosAutorizados").doc(docId);
          targetData = pSnap.data();
        }
      }
    }
    if (!targetDocRef || !targetData) {
      return res.status(404).json({ error: "Autoriza\xE7\xE3o n\xE3o encontrada para revoga\xE7\xE3o." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await serverDb.runTransaction(async (tx) => {
      tx.update(targetDocRef, {
        ativo: false,
        statusAcesso: "revogado",
        revogadoEm: nowIso,
        revogadoPorUid: activeAdmin.uid,
        revogadoPorEmail: activeAdmin.email,
        atualizadoEm: nowIso
      });
    });
    await recordServerAuditLog({
      action: "STAFF_AUTHORIZATION_REVOKED",
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: `/usuariosAutorizados/${targetDocRef.id}`,
      details: `Acesso do colaborador (${targetData.nome || targetData.matricula || targetDocRef.id}) revogado com sucesso. Cadastro funcional preservado integralmente.`
    });
    return res.status(200).json({
      success: true,
      message: `Acesso revogado com sucesso. O cadastro funcional do colaborador foi 100% preservado no sistema.`
    });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    console.error("[Revoke Staff Authorization Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao revogar autoriza\xE7\xE3o de colaborador." });
  }
});
registerRoute("get", "/api/staff-users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    await requireActiveAdmin(token, activeFirebaseProjectId2);
    const serverDb = getServerFirestore();
    const snap = await serverDb.collection("usuariosAutorizados").get();
    const staff = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, staff });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: "Falha ao buscar colaboradores autorizados." });
  }
});
registerRoute("patch", "/api/staff-users/:uid", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "TOKEN_REQUIRED: Autentica\xE7\xE3o necess\xE1ria." });
    }
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
    const targetUid = req.params.uid;
    if (!targetUid || typeof targetUid !== "string" || targetUid.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(targetUid)) {
      return res.status(400).json({ error: "Identificador de colaborador inv\xE1lido." });
    }
    const allowedKeys = ["ativo", "modulos", "role", "statusAcesso"];
    const bodyKeys = Object.keys(req.body || {});
    const forbiddenKeys = bodyKeys.filter((k) => !allowedKeys.includes(k));
    if (forbiddenKeys.length > 0) {
      return res.status(400).json({
        error: `PROTECTED_FIELDS_MODIFICATION: Modifica\xE7\xE3o dos seguintes campos protegidos \xE9 proibida: ${forbiddenKeys.join(", ")}.`
      });
    }
    const { ativo, modulos, role, statusAcesso } = req.body || {};
    if (ativo !== void 0 && typeof ativo !== "boolean") {
      return res.status(400).json({ error: 'Campo "ativo" deve ser booleano.' });
    }
    if (statusAcesso !== void 0 && !["sem_acesso", "pendente", "ativo", "revogado"].includes(statusAcesso)) {
      return res.status(400).json({ error: 'Campo "statusAcesso" inv\xE1lido.' });
    }
    const validModules = ["residentes", "colaboradores", "landing_page", "solicitacoes", "usuarios", "seguranca"];
    if (modulos !== void 0) {
      if (!Array.isArray(modulos) || modulos.length === 0 || !modulos.every((m) => typeof m === "string" && validModules.includes(m))) {
        return res.status(400).json({ error: "M\xF3dulos fornecidos s\xE3o inv\xE1lidos." });
      }
    }
    if (role !== void 0 && role !== "admin" && role !== "colaborador") {
      return res.status(400).json({ error: 'Papel (role) deve ser "admin" ou "colaborador".' });
    }
    if (ativo === void 0 && modulos === void 0 && role === void 0 && statusAcesso === void 0) {
      return res.status(400).json({ error: "Nenhum campo v\xE1lido para atualiza\xE7\xE3o fornecido." });
    }
    if (role !== void 0 && activeAdmin.role !== "superadmin") {
      return res.status(403).json({
        error: "FORBIDDEN_SUPERADMIN_REQUIRED: Apenas superadministradores ativos podem alterar pap\xE9is administrativos de usu\xE1rios."
      });
    }
    const serverDb = getServerFirestore();
    const callerAdminRef = serverDb.collection("admins").doc(activeAdmin.uid);
    const staffRef = serverDb.collection("usuariosAutorizados").doc(targetUid);
    await serverDb.runTransaction(async (tx) => {
      const callerSnap = await tx.get(callerAdminRef);
      if (!callerSnap.exists) {
        throw new Error("FORBIDDEN_NOT_ADMIN: Conta n\xE3o cadastrada no diret\xF3rio de administradores.");
      }
      const callerData = callerSnap.data() || {};
      if (callerData.active !== true) {
        throw new Error("FORBIDDEN_ADMIN_DEACTIVATED: Conta administrativa est\xE1 inativa ou foi desativada.");
      }
      const liveCallerRole = callerData.role === "superadmin" ? "superadmin" : "admin";
      const snap = await tx.get(staffRef);
      if (!snap.exists) {
        throw new Error("NOT_FOUND: Colaborador n\xE3o encontrado.");
      }
      const currentStaff = snap.data() || {};
      if (currentStaff.role === "admin" && liveCallerRole !== "superadmin") {
        throw new Error("FORBIDDEN_SUPERADMIN_REQUIRED: Apenas superadministradores ativos podem modificar contas com papel de administrador.");
      }
      if (role !== void 0 && role !== currentStaff.role && liveCallerRole !== "superadmin") {
        throw new Error("FORBIDDEN_SUPERADMIN_REQUIRED: Apenas superadministradores ativos podem alterar pap\xE9is de usu\xE1rios.");
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const updateData = { atualizadoEm: nowIso };
      if (typeof ativo === "boolean") updateData.ativo = ativo;
      if (Array.isArray(modulos)) updateData.modulos = modulos;
      if (role === "admin" || role === "colaborador") updateData.role = role;
      if (statusAcesso !== void 0) updateData.statusAcesso = statusAcesso;
      tx.update(staffRef, updateData);
    });
    await recordServerAuditLog({
      action: "STAFF_USER_UPDATED",
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: `/usuariosAutorizados/${targetUid}`,
      details: `Permiss\xF5es de colaborador atualizadas por ${activeAdmin.email}: ${JSON.stringify({ ativo, modulos, role })}.`
    });
    return res.json({ success: true, message: "Colaborador atualizado com sucesso." });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes("NOT_FOUND")) {
      return res.status(404).json({ error: err.message });
    }
    console.error("[Update Staff User Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: err?.message || "Falha ao atualizar colaborador." });
  }
});
var DEFAULT_AVAILABILITY = {
  dailyTimeSlots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"],
  activeDays: [1, 2, 3, 4, 5],
  blockedSlots: [],
  meetingDuration: "30 a 45 minutos",
  meetingLink: "https://meet.google.com/vic-tori-lar"
};
var bookedAppointments = [];
var serverAvailabilityConfig = { ...DEFAULT_AVAILABILITY };
registerRoute("get", "/api/schedule/availability", async (_req, res) => {
  try {
    const serverDb = getServerFirestore();
    const snap = await serverDb.collection("content").doc("scheduling").get();
    if (snap.exists) {
      const data = snap.data() || {};
      let slots = DEFAULT_AVAILABILITY.dailyTimeSlots;
      if (data.availableHours && typeof data.availableHours === "string") {
        const parsed = data.availableHours.split(",").map((s) => s.trim()).filter(Boolean);
        if (parsed.length > 0) {
          slots = parsed;
        }
      }
      let activeDays = DEFAULT_AVAILABILITY.activeDays;
      let blockedSlots = DEFAULT_AVAILABILITY.blockedSlots;
      if (data.body && typeof data.body === "string") {
        try {
          const parsedBody = JSON.parse(data.body);
          if (Array.isArray(parsedBody.activeDays)) activeDays = parsedBody.activeDays;
          if (Array.isArray(parsedBody.blockedSlots)) blockedSlots = parsedBody.blockedSlots;
          if (Array.isArray(parsedBody.dailyTimeSlots) && parsedBody.dailyTimeSlots.length > 0) {
            slots = parsedBody.dailyTimeSlots;
          }
        } catch {
        }
      }
      const resolved = {
        dailyTimeSlots: slots,
        activeDays,
        blockedSlots,
        meetingDuration: data.meetingDuration || DEFAULT_AVAILABILITY.meetingDuration,
        meetingLink: data.meetingLink || DEFAULT_AVAILABILITY.meetingLink
      };
      serverAvailabilityConfig = resolved;
      return res.json({
        success: true,
        availability: resolved
      });
    }
  } catch (err) {
    console.warn("[Get Availability Firestore Warning]:", sanitizeLog(err?.message || err));
  }
  return res.json({
    success: true,
    availability: serverAvailabilityConfig
  });
});
registerRoute("post", "/api/schedule/availability", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!token) {
      return res.status(401).json({
        error: "TOKEN_REQUIRED: Autentica\xE7\xE3o de administrador necess\xE1ria para alterar a disponibilidade."
      });
    }
    const activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
    const { availability } = req.body || {};
    if (!availability || typeof availability !== "object") {
      return res.status(400).json({ error: "Dados de disponibilidade inv\xE1lidos." });
    }
    const serverDb = getServerFirestore();
    const schedulingRef = serverDb.collection("content").doc("scheduling");
    const existingSnap = await schedulingRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : {};
    const slots = Array.isArray(availability.dailyTimeSlots) ? availability.dailyTimeSlots.map((s) => String(s).trim()).filter(Boolean) : existingData.availableHours ? existingData.availableHours.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_AVAILABILITY.dailyTimeSlots;
    const activeDays = Array.isArray(availability.activeDays) ? availability.activeDays : DEFAULT_AVAILABILITY.activeDays;
    const blockedSlots = Array.isArray(availability.blockedSlots) ? availability.blockedSlots : DEFAULT_AVAILABILITY.blockedSlots;
    const meetingDuration = typeof availability.meetingDuration === "string" ? availability.meetingDuration.slice(0, 100) : existingData.meetingDuration || DEFAULT_AVAILABILITY.meetingDuration;
    const meetingLink = typeof availability.meetingLink === "string" ? availability.meetingLink.slice(0, 500) : existingData.meetingLink || DEFAULT_AVAILABILITY.meetingLink;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const payload = {
      key: "scheduling",
      title: existingData.title || "Agende uma Conversa ou Visita Guiada",
      subtitle: existingData.subtitle || "Escolha o canal mais pr\xE1tico para voc\xEA. Atendimento direto com os propriet\xE1rios e equipe de sa\xFAde, sem burocracia.",
      availableHours: slots.join(", "),
      meetingDuration,
      meetingLink,
      body: JSON.stringify({ activeDays, blockedSlots, dailyTimeSlots: slots }),
      updatedAt: nowIso,
      updatedBy: activeAdmin.uid
    };
    await schedulingRef.set(payload, { merge: true });
    serverAvailabilityConfig = {
      dailyTimeSlots: slots,
      activeDays,
      blockedSlots,
      meetingDuration,
      meetingLink
    };
    await recordServerAuditLog({
      action: "AVAILABILITY_CONFIG_UPDATED",
      performedByUid: activeAdmin.uid,
      performedByEmail: activeAdmin.email,
      targetResource: "/content/scheduling",
      details: `Disponibilidade atualizada por ${activeAdmin.email}: ${slots.length} hor\xE1rios configurados.`
    });
    return res.status(200).json({
      success: true,
      message: "Disponibilidade atualizada com sucesso no Firestore.",
      availability: serverAvailabilityConfig
    });
  } catch (err) {
    if (err?.message?.includes("FORBIDDEN_") || err?.message?.includes("EMAIL_NOT_VERIFIED")) {
      return res.status(403).json({ error: err.message });
    }
    if (err?.message?.includes("TOKEN_")) {
      return res.status(401).json({ error: err.message });
    }
    console.error("[Update Availability Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: "Falha ao salvar configura\xE7\xE3o de disponibilidade no servidor." });
  }
});
registerRoute("get", "/api/schedule/booked-slots", async (req, res) => {
  const dateQuery = typeof req.query.date === "string" ? req.query.date.trim() : "";
  const bookedSlotsSet = /* @__PURE__ */ new Set();
  if (dateQuery) {
    try {
      const serverDb = getServerFirestore();
      const snap = await serverDb.collection("leads").where("scheduledDate", "==", dateQuery).get();
      snap.forEach((doc) => {
        const d = doc.data();
        if (d && d.scheduledTime && d.status !== "archived") {
          bookedSlotsSet.add(d.scheduledTime);
        }
      });
    } catch (err) {
      console.warn("[Booked Slots Query Warning]:", sanitizeLog(err?.message || err));
    }
  }
  bookedAppointments.filter((a) => a.date === dateQuery).forEach((a) => bookedSlotsSet.add(a.time));
  res.json({
    success: true,
    date: dateQuery,
    bookedSlots: Array.from(bookedSlotsSet)
  });
});
registerRoute("post", "/api/schedule-meeting", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      scheduledDate,
      scheduledTime,
      meetingLink,
      relationship,
      serviceInterest,
      message,
      honeypot,
      emailSubject,
      emailInstructions
    } = req.body || {};
    if (honeypot) {
      return res.status(200).json({ success: true, message: "Agendamento recebido." });
    }
    const rateCheck = await checkRateLimit(req, "schedule_meeting", {
      maxRequests: 8,
      windowMs: 15 * 60 * 1e3
    });
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        appointmentScheduled: false,
        error: "Muitas tentativas de agendamento em curto per\xEDodo. Por favor, aguarde alguns minutos antes de tentar novamente ou fale com nossa equipe pelo WhatsApp oficial (11) 98765-4321.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 120) {
      return res.status(400).json({ error: "Nome completo \xE9 obrigat\xF3rio e deve ter at\xE9 120 caracteres." });
    }
    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 160) {
      return res.status(400).json({ error: "E-mail v\xE1lido \xE9 obrigat\xF3rio para envio da confirma\xE7\xE3o." });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length < 8 || phone.length > 30) {
      return res.status(400).json({ error: "Telefone ou WhatsApp \xE9 obrigat\xF3rio (m\xEDnimo 8 d\xEDgitos)." });
    }
    if (!scheduledDate || typeof scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate.trim())) {
      return res.status(400).json({ error: "Selecione uma data v\xE1lida para a reuni\xE3o (formato AAAA-MM-DD)." });
    }
    if (!scheduledTime || typeof scheduledTime !== "string" || !/^\d{2}:\d{2}$/.test(scheduledTime.trim())) {
      return res.status(400).json({ error: "Selecione um hor\xE1rio v\xE1lido para a reuni\xE3o (formato HH:MM)." });
    }
    const cleanDate = scheduledDate.trim();
    const cleanTime = scheduledTime.trim();
    const normalizedTime = cleanTime.replace(":", "-");
    const appointmentDocId = `meet_${cleanDate}_${normalizedTime}`;
    const [y, m, d] = cleanDate.split("-");
    const formattedDate = `${d}/${m}/${y}`;
    const resolvedMeetingLink = meetingLink || "https://meet.google.com/vic-tori-lar";
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const appointmentRecord = {
      id: appointmentDocId,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      scheduledDate: cleanDate,
      scheduledTime: cleanTime,
      meetingLink: resolvedMeetingLink,
      relationship: relationship ? String(relationship).slice(0, 60) : "Familiar",
      serviceInterest: serviceInterest ? String(serviceInterest).slice(0, 100) : "Reuni\xE3o de Apresenta\xE7\xE3o",
      message: message ? String(message).trim().slice(0, 2e3) : "",
      status: "unread",
      type: "meeting",
      createdAt: nowIso
    };
    const serverDb = getServerFirestore();
    const leadRef = serverDb.collection("leads").doc(appointmentDocId);
    try {
      await serverDb.runTransaction(async (tx) => {
        const existingSlotDoc = await tx.get(leadRef);
        if (existingSlotDoc.exists) {
          const slotData = existingSlotDoc.data();
          if (slotData && slotData.status !== "archived") {
            throw new Error("SLOT_ALREADY_BOOKED");
          }
        }
        const activeLeadsSnap = await tx.get(
          serverDb.collection("leads").where("scheduledDate", "==", cleanDate).where("scheduledTime", "==", cleanTime)
        );
        let hasActiveBooking = false;
        activeLeadsSnap.forEach((docSnap) => {
          if (docSnap.id !== appointmentDocId) {
            const data = docSnap.data();
            if (data && data.status !== "archived") {
              hasActiveBooking = true;
            }
          }
        });
        if (hasActiveBooking) {
          throw new Error("SLOT_ALREADY_BOOKED");
        }
        tx.set(leadRef, appointmentRecord);
      });
    } catch (dbErr) {
      if (dbErr?.message === "SLOT_ALREADY_BOOKED") {
        return res.status(409).json({
          success: false,
          appointmentScheduled: false,
          error: "Este hor\xE1rio j\xE1 est\xE1 reservado. Por favor, escolha outro hor\xE1rio dispon\xEDvel.",
          code: "SLOT_ALREADY_BOOKED"
        });
      }
      console.error("[Schedule Meeting Database Persistence Error]:", sanitizeLog(dbErr?.message || dbErr));
      return res.status(500).json({
        success: false,
        appointmentScheduled: false,
        error: "Falha ao salvar agendamento no banco de dados. A reserva n\xE3o foi confirmada. Tente novamente mais tarde.",
        code: "PERSISTENCE_FAILED"
      });
    }
    if (!bookedAppointments.some((a) => a.date === cleanDate && a.time === cleanTime)) {
      bookedAppointments.push({ date: cleanDate, time: cleanTime });
    }
    let emailResult = {
      success: false,
      error: "Envio de e-mail n\xE3o iniciado",
      errorCode: "SEND_FAILED",
      googleCalendarUrl: null,
      previewUrl: null
    };
    try {
      emailResult = await sendMeetingConfirmationEmail({
        to: email.trim(),
        name: name.trim(),
        scheduledDate: cleanDate,
        scheduledTime: cleanTime,
        meetingLink: resolvedMeetingLink,
        serviceInterest,
        phone,
        subject: emailSubject,
        instructions: emailInstructions
      });
    } catch (mailErr) {
      console.warn("[Schedule Meeting Email Dispatch Warning]:", sanitizeLog(mailErr?.message || mailErr));
      emailResult = {
        success: false,
        error: mailErr?.message || "Falha no despacho SMTP",
        errorCode: mailErr?.code || "SEND_FAILED",
        googleCalendarUrl: null,
        previewUrl: null
      };
    }
    const emailSent = emailResult.success === true;
    const userMessage = emailSent ? `Reuni\xE3o agendada com sucesso para ${formattedDate} \xE0s ${cleanTime}! Um e-mail de confirma\xE7\xE3o com a sala do Google Meet e bot\xE3o para registro no Google Calendar foi enviado para ${email.trim()} a partir de ${OFFICIAL_GMAIL}.` : `Reuni\xE3o agendada com sucesso para ${formattedDate} \xE0s ${cleanTime}! N\xE3o foi poss\xEDvel despachar o e-mail de confirma\xE7\xE3o automaticamente (${emailResult.error || "instabilidade na conex\xE3o SMTP"}), mas seu hor\xE1rio com a dire\xE7\xE3o est\xE1 confirmado. Salve o link do Google Meet e adicione o compromisso ao seu calend\xE1rio pelos bot\xF5es abaixo.`;
    return res.status(201).json({
      success: true,
      appointmentScheduled: true,
      emailSent,
      emailError: emailSent ? null : emailResult.error || "Falha no envio de e-mail",
      errorCode: emailSent ? null : emailResult.errorCode || "SEND_FAILED",
      message: userMessage,
      data: appointmentRecord,
      meetingLink: resolvedMeetingLink,
      googleCalendarUrl: emailResult?.googleCalendarUrl || null,
      sender: OFFICIAL_GMAIL,
      previewUrl: emailResult?.previewUrl || null
    });
  } catch (err) {
    console.error("Erro no agendamento de reuni\xE3o:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: "Falha ao processar agendamento. Tente novamente mais tarde." });
  }
});
registerRoute("get", "/api/mail/status", async (req, res) => {
  try {
    const shouldVerify = req.query.verify === "true";
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    let activeAdmin = null;
    if (token) {
      try {
        activeAdmin = await requireActiveAdmin(token, activeFirebaseProjectId2);
      } catch (_authErr) {
        if (shouldVerify) {
          return res.status(403).json({
            error: "FORBIDDEN: Credenciais de administrador inv\xE1lidas ou n\xE3o autorizadas para verifica\xE7\xE3o SMTP ativa."
          });
        }
      }
    }
    if (shouldVerify && !activeAdmin) {
      return res.status(401).json({
        error: "TOKEN_REQUIRED: Autentica\xE7\xE3o de administrador necess\xE1ria para executar verifica\xE7\xE3o SMTP ativa."
      });
    }
    if (activeAdmin) {
      const config = buildSmtpConfig();
      let verificationResult = null;
      if (shouldVerify) {
        verificationResult = await verifySmtpConnection();
      }
      return res.json({
        success: true,
        senderEmail: OFFICIAL_GMAIL,
        senderName: OFFICIAL_SENDER_NAME,
        configured: !config.isFallback,
        mode: config.isCustomHost ? "CUSTOM_SMTP" : config.isDirectGmail ? "GMAIL_OFFICIAL" : "DEVELOPMENT_FALLBACK",
        connection: {
          host: config.host,
          port: config.port,
          secure: config.secure,
          requireTLS: config.requireTLS,
          hasAuth: !!config.pass,
          timeouts: {
            connection: config.connectionTimeout,
            greeting: config.greetingTimeout,
            socket: config.socketTimeout
          }
        },
        verification: verificationResult,
        platform: process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG ? "FIREBASE_CLOUD_FUNCTIONS_2GEN" : process.env.VERCEL ? "VERCEL_SERVERLESS" : "NODE_CONTAINER",
        authenticatedAdmin: activeAdmin.email,
        serverlessTips: [
          "Vercel bloqueia conex\xF5es SMTP na porta 25.",
          "Para Gmail no Vercel, recomenda-se porta 465 com SSL/TLS (SMTP_PORT=465 e SMTP_SECURE=true).",
          "Para porta 587, use STARTTLS (SMTP_PORT=587 e SMTP_SECURE=false).",
          "Timeouts ajustados para execu\xE7\xE3o serverless (5s conex\xE3o / 5s sauda\xE7\xE3o / 8s socket)."
        ]
      });
    }
    return res.json({
      success: true,
      service: "Victoria Lar Residencial - Mail Service",
      status: "online"
    });
  } catch (err) {
    console.error("[Mail Status Error]:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: "Falha ao consultar status do servi\xE7o de e-mail." });
  }
});
registerRoute("post", "/api/contact", async (req, res) => {
  try {
    const { name, email, phone, relationship, serviceInterest, message, honeypot } = req.body || {};
    if (honeypot) {
      return res.status(200).json({ success: true, message: "Solicita\xE7\xE3o recebida com sucesso." });
    }
    const rateCheck = await checkRateLimit(req, "contact", {
      maxRequests: 5,
      windowMs: 15 * 60 * 1e3
    });
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Muitas mensagens enviadas em curto per\xEDodo. Por favor, aguarde alguns minutos antes de tentar novamente ou entre em contato pelo nosso WhatsApp oficial (11) 98765-4321.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 120) {
      return res.status(400).json({ error: "Nome \xE9 obrigat\xF3rio e deve ter at\xE9 120 caracteres." });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length < 8 || phone.length > 30) {
      return res.status(400).json({ error: "Telefone de contato v\xE1lido \xE9 obrigat\xF3rio." });
    }
    if (email && (typeof email !== "string" || email.length > 160 || !email.includes("@"))) {
      return res.status(400).json({ error: "E-mail fornecido \xE9 inv\xE1lido." });
    }
    if (message && (typeof message !== "string" || message.length > 2e3)) {
      return res.status(400).json({ error: "Mensagem excede o limite de 2000 caracteres." });
    }
    if (email && email.includes("@")) {
      try {
        const transporter = await getTransporter();
        await transporter.sendMail({
          from: `"${OFFICIAL_SENDER_NAME}" <${OFFICIAL_GMAIL}>`,
          replyTo: OFFICIAL_GMAIL,
          to: email.trim(),
          bcc: OFFICIAL_GMAIL,
          subject: "Recebemos sua mensagem - Victoria Lar Residencial",
          html: `
            <div style="font-family: sans-serif; background-color: #FAF9F5; padding: 24px; color: #173D2B;">
              <div style="max-width: 550px; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #B8954A; margin: 0 auto;">
                <h2 style="color: #173D2B; font-family: Georgia, serif;">Ol\xE1, ${name.trim()}!</h2>
                <p>Recebemos sua solicita\xE7\xE3o de contato e interesse em <strong>${serviceInterest || "nossos cuidados"}</strong>.</p>
                <p>Nossa equipe entrar\xE1 em contato prontamente pelo telefone <strong>${phone.trim()}</strong> para tirar todas as suas d\xFAvidas e acolher sua fam\xEDlia.</p>
                <p style="margin-top: 20px; font-weight: bold; color: #173D2B;">Victoria Lar Residencial</p>
                <p style="font-size: 11px; color: #718096; margin-top: 10px;">E-mail oficial: ${OFFICIAL_GMAIL}</p>
              </div>
            </div>
          `
        });
      } catch (e) {
        console.warn("[Victoria Lar Mailer] Aviso no envio de e-mail de contato simples:", sanitizeLog(e?.message || e));
      }
    }
    const leadRecord = {
      name: name.trim(),
      email: email ? email.trim() : null,
      phone: phone.trim(),
      relationship: relationship ? String(relationship).slice(0, 60) : "Familiar",
      serviceInterest: serviceInterest ? String(serviceInterest).slice(0, 100) : "Geral",
      message: message ? message.trim() : "",
      status: "unread",
      type: "form",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      origin: "landing_page_form"
    };
    return res.status(201).json({
      success: true,
      message: "Mensagem enviada com sucesso! Um e-mail de confirma\xE7\xE3o foi encaminhado e nossa equipe retornar\xE1 rapidamente.",
      data: leadRecord
    });
  } catch (err) {
    console.error("Erro no processamento de contato:", sanitizeLog(err?.message || err));
    return res.status(500).json({ error: "Falha no envio da mensagem. Tente novamente mais tarde." });
  }
});
app.use((err, _req, res, _next) => {
  console.error("[Unhandled Express Error]:", sanitizeLog(err?.message || err));
  if (!res.headersSent) {
    res.status(500).json({ error: "Erro interno no servidor de aplica\xE7\xE3o." });
  }
});

// src/index.ts
var smtpPass = defineSecret("SMTP_PASS");
var gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
var smtpUser = defineSecret("SMTP_USER");
var firebaseServiceAccountKey = defineSecret("FIREBASE_SERVICE_ACCOUNT_KEY");
var FUNCTION_REGION = process.env.FUNCTION_REGION || "southamerica-east1";
var api = onRequest(
  {
    region: FUNCTION_REGION,
    minInstances: 0,
    maxInstances: 2,
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [smtpPass, gmailAppPassword, smtpUser, firebaseServiceAccountKey],
    cors: true
  },
  app
);
var index_default = api;
export {
  FUNCTION_REGION,
  api,
  index_default as default,
  firebaseServiceAccountKey,
  gmailAppPassword,
  smtpPass,
  smtpUser
};
