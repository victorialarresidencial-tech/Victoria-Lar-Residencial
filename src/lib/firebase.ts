
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicializa o Firebase uma única vez.
export const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

// Utiliza o ID do banco configurado para este projeto.
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId
);

// Inicializa autenticação.
export const auth = getAuth(app);

// Inicializa o Storage usando o bucket configurado.
export const storage = getStorage(
  app,
  firebaseConfig.storageBucket
    ? `gs://${firebaseConfig.storageBucket}`
    : undefined
);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string;
      email?: string | null;
    }[];
  };
}

/**
 * Registra informações de diagnóstico e propaga o erro.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error:
      error instanceof Error
        ? error.message
        : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };

  console.error(
    '[Firestore Security Error]',
    JSON.stringify(errInfo)
  );

  throw new Error(JSON.stringify(errInfo));
}

/**
 * Testa a conexão com o servidor Firestore.
 */
export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  try {
    const testDocRef = doc(db, 'system', 'bootstrap');

    await getDocFromServer(testDocRef);

    return {
      connected: true,
      message: 'Conectado ao Cloud Firestore com sucesso',
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (
      message.toLowerCase().includes('client is offline') ||
      message.toLowerCase().includes('client is offline.')
    ) {
      return {
        connected: false,
        message: 'Cliente Firestore offline',
      };
    }

    // Erros de permissão indicam que o servidor respondeu,
    // mas não comprovam que a aplicação está autorizada.
    if (
      message.includes('permission-denied') ||
      message.includes('Missing or insufficient permissions')
    ) {
      return {
        connected: true,
        message:
          'Servidor Firestore acessível, mas a leitura foi negada pelas regras de segurança.',
      };
    }

    console.error('[Firestore Connection Error]', message);

    return {
      connected: false,
      message: 'Não foi possível confirmar a conexão com o Firestore.',
    };
  }
}
