import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Paciente } from '../types/patient';

const COLLECTION_NAME = 'pacientes';

/**
 * Escuta em tempo real a coleção de residentes (pacientes).
 * Persistência 100% direta no Cloud Firestore — zero localStorage.
 */
export function ouvirPacientes(
  onSuccess: (pacientes: Paciente[]) => void,
  onError: (error: Error) => void
): () => void {
  try {
    const colRef = collection(db, COLLECTION_NAME);

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const lista: Paciente[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Paciente, 'id'>),
          });
        });

        // Ordenação decrescente pela data mais recente
        lista.sort((a, b) => {
          const tA = a.atualizadoEm || a.criadoEm ? new Date(a.atualizadoEm || a.criadoEm || '').getTime() : 0;
          const tB = b.atualizadoEm || b.criadoEm ? new Date(b.atualizadoEm || b.criadoEm || '').getTime() : 0;
          return tB - tA;
        });

        onSuccess(lista);
      },
      (error) => {
        console.error('[Firestore Residentes Snapshot Error]:', error);
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    );

    return unsubscribe;
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

/**
 * Cadastra um novo residente no Firestore.
 */
export async function cadastrarPacienteNoFirebase(
  paciente: Omit<Paciente, 'id'>
): Promise<{ id: string }> {
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado. É necessário entrar com uma conta autorizada.');
  }

  const timestampIso = new Date().toISOString();
  const payload = {
    ...paciente,
    criadoEm: timestampIso,
    atualizadoEm: timestampIso,
    servidorTimestamp: serverTimestamp(),
  };

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

/**
 * Atualiza um prontuário de residente no Firestore.
 */
export async function atualizarPacienteNoFirebase(
  id: string,
  dados: Partial<Paciente>
): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('Identificador de residente inválido para atualização.');
  }
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado.');
  }

  const timestampIso = new Date().toISOString();
  const payload = {
    ...dados,
    atualizadoEm: timestampIso,
    servidorAtualizadoEm: serverTimestamp(),
  };

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Exclui um prontuário de residente no Firestore.
 * Apenas administradores ativos da instituição possuem autorização.
 */
export async function excluirPacienteNoFirebase(id: string): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('Identificador de residente inválido para exclusão.');
  }
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado.');
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}
