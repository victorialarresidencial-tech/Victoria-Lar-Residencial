import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with the exact provisioned database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth with built-in popup redirect resolver support
export const auth = getAuth(app);

// Operation types matching the Firebase Integration specification
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
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Standardized error handler throwing FirestoreErrorInfo context
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };

  console.error('[Firestore Security Error]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Tests live connection to Firestore using getDocFromServer without local cache
 */
export async function testFirestoreConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const testDocRef = doc(db, 'system', 'bootstrap');
    await getDocFromServer(testDocRef);
    return { connected: true, message: 'Conectado ao Cloud Firestore com sucesso' };
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error('Verifique a conexão de rede e configuração do Firebase.');
      return { connected: false, message: 'Cliente Firestore offline' };
    }
    // If document is not found or empty, the server responded!
    return { connected: true, message: 'Conexão ativa com o servidor Firestore' };
  }
}
