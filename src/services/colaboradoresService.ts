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
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Funcionario } from '../types/employee';

const COLLECTION_NAME = 'funcionarios';

/**
 * Escuta em tempo real a coleção de funcionários/colaboradores.
 * Persistência 100% direta no Cloud Firestore — exclusivamente nuvem.
 */
export function ouvirFuncionarios(
  onSuccess: (funcionarios: Funcionario[]) => void,
  onError: (error: Error) => void
): () => void {
  try {
    const colRef = collection(db, COLLECTION_NAME);

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const lista: Funcionario[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Funcionario, 'id'>),
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
        console.error('[Firestore Colaboradores Snapshot Error]:', error);
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
 * Converte qualquer erro do Firestore ou da camada de rede em uma mensagem
 * amigável e compreensível para o usuário, eliminando objetos JSON internos,
 * tokens, dados de autenticação sensíveis ou stack traces.
 */
export function formatarErroAmigavel(error: unknown): string {
  if (!error) {
    return 'Não foi possível salvar o colaborador. Tente novamente.';
  }

  const raw = error instanceof Error ? error.message : String(error);

  // Se o erro foi gerado por handleFirestoreError, a mensagem é um JSON contendo authInfo
  try {
    if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
      const parsed = JSON.parse(raw);
      const inner = typeof parsed.error === 'string' ? parsed.error : '';

      if (inner.includes('Missing or insufficient permissions') || inner.includes('permission-denied')) {
        return 'Permissão insuficiente para cadastrar colaboradores no Firestore. Verifique se o seu usuário possui permissões ativas.';
      }
      if (inner.includes('Unsupported field value: undefined') || inner.includes('invalid data')) {
        return 'Erro de validação: um dos campos do formulário está com formato indefinido.';
      }
      if (inner.includes('the client is offline') || inner.includes('unavailable')) {
        return 'Falha de conexão com a nuvem do Firestore. Verifique sua conexão com a internet e tente novamente.';
      }
      if (inner.includes('Quota exceeded')) {
        return 'Limite de operações temporariamente excedido no banco de dados. Tente novamente mais tarde.';
      }
      if (inner) {
        return `Atenção: ${inner.slice(0, 160)}`;
      }
    }
  } catch {
    // Prossegue com mensagens padrão se não for JSON
  }

  if (raw.includes('Unsupported field value: undefined') || raw.includes('invalid data')) {
    return 'Erro de validação: um dos campos do formulário está com formato indefinido.';
  }
  if (raw.includes('Usuário não autenticado')) {
    return 'Usuário não autenticado. Faça login com uma conta autorizada para salvar colaboradores.';
  }
  if (raw.includes('Missing or insufficient permissions') || raw.includes('permission-denied')) {
    return 'Permissão insuficiente para salvar o colaborador no banco de dados.';
  }
  if (raw.includes('the client is offline') || raw.includes('offline') || raw.includes('unavailable')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  if (raw.includes('authInfo') || raw.includes('providerInfo') || raw.includes('userId')) {
    return 'Operação não autorizada. Verifique seus privilégios de acesso.';
  }

  return raw.slice(0, 160);
}

/**
 * Sanitiza e serializa os dados de um colaborador para envio seguro ao Cloud Firestore.
 * - Remove rigorosamente qualquer propriedade com valor `undefined`.
 * - Garante que campos opcionais vazios sejam omitidos do payload em vez de persistidos como `undefined` ou strings vazias,
 *   preservando estritamente a conformidade com `!('campo' in data)` de firestore.rules.
 * - Preserva tipos primitivos corretos (números como `idade`, listas como `vacinasEmDia` e `qualificacoesCursos`).
 */
export function sanitizarPayloadFuncionario(
  dados: Record<string, any>
): Record<string, any> {
  const CAMPOS_OBRIGATORIOS = new Set([
    'nomeCompleto', 'cpf', 'rg', 'dataNascimento', 'sexo', 'estadoCivil',
    'cargo', 'departamento', 'tipoContrato', 'escalaTrabalho', 'dataAdmissao',
    'status', 'matricula', 'celularWhatsApp', 'email', 'cep', 'logradouro',
    'numero', 'bairro', 'cidade', 'estado', 'nomeContatoEmergencia',
    'parentescoEmergencia', 'telefoneEmergencia'
  ]);

  const payloadLimpo: Record<string, any> = {};

  for (const [chave, valor] of Object.entries(dados)) {
    // 1. Descartar completamente qualquer valor undefined
    if (valor === undefined) {
      continue;
    }

    // 2. Tratar Strings
    if (typeof valor === 'string') {
      const valorTrim = valor.trim();
      if (valorTrim === '') {
        // Se for obrigatório, preservamos para permitir que a validação de regras/schema acuse erro se faltar
        if (CAMPOS_OBRIGATORIOS.has(chave)) {
          payloadLimpo[chave] = '';
        }
        // Se for opcional e vazio, NÃO incluímos a chave no documento (evita undefined no Firestore)
        continue;
      }
      payloadLimpo[chave] = valorTrim;
      continue;
    }

    // 3. Tratar Números (ex: idade)
    if (typeof valor === 'number') {
      if (Number.isFinite(valor) && valor > 0) {
        payloadLimpo[chave] = valor;
      }
      continue;
    }

    // 4. Tratar Booleanos
    if (typeof valor === 'boolean') {
      payloadLimpo[chave] = valor;
      continue;
    }

    // 5. Tratar Listas/Arrays (ex: vacinasEmDia, qualificacoesCursos)
    if (Array.isArray(valor)) {
      const listaLimpa = valor
        .filter((item) => item !== undefined && item !== null)
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => typeof item !== 'string' || item.length > 0);
      payloadLimpo[chave] = listaLimpa;
      continue;
    }

    // 6. Outros valores válidos (ex: serverTimestamp)
    if (valor !== null) {
      payloadLimpo[chave] = valor;
    }
  }

  // Garantia absoluta contra propriedades undefined
  for (const k of Object.keys(payloadLimpo)) {
    if (payloadLimpo[k] === undefined) {
      delete payloadLimpo[k];
    }
  }

  return payloadLimpo;
}

/**
 * Gera a próxima matrícula estável e sequencial para colaboradores no padrão VLR-AAAA-NNN.
 * Analisa os colaboradores existentes para evitar qualquer sobreposição ou colisão.
 */
export function gerarProximaMatricula(funcionariosExistentes: Funcionario[] = []): string {
  const anoAtual = new Date().getFullYear();
  const prefixoAno = `VLR-${anoAtual}-`;

  let maiorSeq = 0;
  for (const f of funcionariosExistentes) {
    if (f.matricula && f.matricula.startsWith(prefixoAno)) {
      const parteNum = f.matricula.substring(prefixoAno.length);
      const num = parseInt(parteNum, 10);
      if (!isNaN(num) && num > maiorSeq) {
        maiorSeq = num;
      }
    }
  }

  const proximoNum = maiorSeq + 1;
  const seqFormatada = String(proximoNum).padStart(3, '0');
  return `${prefixoAno}${seqFormatada}`;
}

/**
 * Verifica se uma matrícula já está em uso por outro colaborador no Firestore.
 */
export async function verificarMatriculaEmUso(
  matricula: string,
  excludeId?: string,
  listaEmMemoria?: Funcionario[]
): Promise<boolean> {
  const cleanMatricula = matricula.trim().toUpperCase();
  if (!cleanMatricula) return false;

  // 1. Verificação rápida em memória caso a lista seja fornecida
  if (Array.isArray(listaEmMemoria)) {
    const emMemoria = listaEmMemoria.some(
      (f) => f.matricula?.trim().toUpperCase() === cleanMatricula && f.id !== excludeId
    );
    if (emMemoria) return true;
  }

  // 2. Consulta autoritativa no Firestore
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('matricula', '==', cleanMatricula));
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      if (docSnap.id !== excludeId) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Verificar Matricula Firestore Check Notice]:', err);
  }

  return false;
}

/**
 * Cadastra um novo colaborador diretamente no Firestore.
 * Valida a unicidade da matrícula antes da inserção.
 */
export async function cadastrarFuncionarioNoFirebase(
  funcionario: Omit<Funcionario, 'id'>,
  funcionariosExistentes?: Funcionario[]
): Promise<{ id: string }> {
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado. Faça login com uma conta autorizada.');
  }

  const cleanMatricula = (funcionario.matricula || '').trim().toUpperCase();
  if (!cleanMatricula) {
    throw new Error('A matrícula do colaborador é obrigatória.');
  }

  // Garantia estrita de unicidade da matrícula
  const jaExiste = await verificarMatriculaEmUso(cleanMatricula, undefined, funcionariosExistentes);
  if (jaExiste) {
    throw new Error(`MATRICULA_DUPLICADA: A matrícula "${cleanMatricula}" já está em uso por outro colaborador.`);
  }

  const timestampIso = new Date().toISOString();
  const rawPayload = {
    ...funcionario,
    matricula: cleanMatricula,
    criadoEm: timestampIso,
    atualizadoEm: timestampIso,
    servidorTimestamp: serverTimestamp(),
  };

  const payload = sanitizarPayloadFuncionario(rawPayload);

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

/**
 * Atualiza os dados de um colaborador no Firestore.
 * Valida unicidade da matrícula caso tenha sido alterada.
 */
export async function atualizarFuncionarioNoFirebase(
  id: string,
  dados: Partial<Funcionario>,
  funcionariosExistentes?: Funcionario[]
): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('Identificador de colaborador inválido para atualização.');
  }
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado.');
  }

  if (dados.matricula) {
    const cleanMatricula = dados.matricula.trim().toUpperCase();
    const jaExiste = await verificarMatriculaEmUso(cleanMatricula, id, funcionariosExistentes);
    if (jaExiste) {
      throw new Error(`MATRICULA_DUPLICADA: A matrícula "${cleanMatricula}" já está em uso por outro colaborador.`);
    }
    dados.matricula = cleanMatricula;
  }

  const timestampIso = new Date().toISOString();
  const rawPayload = {
    ...dados,
    atualizadoEm: timestampIso,
    servidorAtualizadoEm: serverTimestamp(),
  };

  const payload = sanitizarPayloadFuncionario(rawPayload);

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Exclui o cadastro de um colaborador no Firestore.
 * Apenas administradores ativos possuem autorização.
 */
export async function excluirFuncionarioNoFirebase(id: string): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('Identificador de colaborador inválido para exclusão.');
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
