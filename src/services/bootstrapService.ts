import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BootstrapRecord, SuperAdminGuard, AdminUser, ServiceItem, InstitutionalContent } from '../types';

export const INITIAL_SERVICES: Omit<ServiceItem, 'updatedBy'>[] = [];


export const INITIAL_INSTITUTIONAL_CONTENT: Record<string, InstitutionalContent> = {
  hero: {
    key: 'hero',
    title: 'Acolhimento, Cuidado Humanizado e Dignidade para a Terceira Idade',
    subtitle: 'No Victoria Lar Residencial, cada detalhe foi concebido para oferecer excelência em saúde, conforto de alto padrão e o calor de uma verdadeira família.',
    phone: '(11) 3456-7890',
    whatsapp: '(11) 98765-4321',
    email: 'contato@victorialar.com.br',
    address: 'Alameda das Rosas, 450 - Jardim das Palmeiras, São Paulo - SP',
    visitingHours: 'Segunda a Domingo: 09h00 às 18h00',
  },
  about: {
    key: 'about',
    title: 'Nossa Vocação é o Cuidado com Amor',
    subtitle: 'Uma história construída sobre respeito à trajetória e à dignidade de cada residente.',
    body: 'O Victoria Lar Residencial nasceu do desejo genuíno de redefinir a experiência de moradia para a terceira idade. Mais do que uma estrutura médica de ponta, oferecemos um ecossistema de afeto, acolhimento integral e valorização contínua da individualidade. Nossa arquitetura favorece a iluminação natural, a convivência e a segurança, enquanto nossa equipe multiprofissional atua com empatia e dedicação.',
  },
  values: {
    key: 'values',
    title: 'Princípios que Guiam Nossas Ações Diárias',
    subtitle: 'Humanização, transparência, segurança clínica e respeito absoluto à vida.',
    body: 'Acreditamos que envelhecer com dignidade é um direito fundamental. Por isso, aliamos rigor científico nas condutas de enfermagem e geriatria a um ambiente sereno e caloroso, onde famílias têm livre acesso e os residentes encontram um novo lar repleto de sorrisos e tranquilidade.',
  },
  owner_1: {
    key: 'owner_1',
    title: 'Olá, sou a Olga.',
    imageCaption: 'Olga',
    role: 'Sócia-Proprietária & Gestora Humanizada',
    tag: 'Atendimento direto, humano e sem intermediários',
    imageUrl: '',
    body: 'Eu sempre gostei de entender como as coisas funcionam — e, principalmente, de descobrir como poderiam funcionar com mais afeto e empatia.\n\nForam mais de 25 anos vivendo a gestão com foco em pessoas, processos e acolhimento humano. Nesse caminho, aprendi a olhar para cada residente em sua singularidade: entender a sua história de vida, acolher a família e transformar o cuidado em um verdadeiro abraço diário.\n\nEstar presente todos os dias no Victoria Lar, acompanhando cada rotina e ouvindo com atenção cada idoso, é a nossa maior realização.',
    quote: 'O Victoria Lar Residencial nasceu daí. Da vontade de usar toda essa experiência para criar um espaço onde o acolhimento humano, a segurança e o carinho aconteçam de verdade, sem intermediários.',
  },
  owner_2: {
    key: 'owner_2',
    title: 'Olá, sou o Robson.',
    imageCaption: 'Robson',
    role: 'Sócio-Proprietário & Diretor de Cuidados',
    tag: 'Presença diária e compromisso com a excelência',
    imageUrl: '',
    body: 'Minha trajetória foi construída na dedicação à saúde integrada, ao bem-estar e ao respeito irrestrito à vida dos nossos idosos.\n\nAo longo de mais de 20 anos na área da saúde e operações assistenciais, vi de perto como uma estrutura acolhedora e uma equipe atenta fazem toda a diferença na longevidade com qualidade.\n\nAqui, cada protocolo médico e cada plano nutricional é acompanhado rigorosamente, mantendo a serenidade das famílias e a vitalidade de quem escolheu viver conosco.',
    quote: 'Cuidar de quem já cuidou tanto de nós é um compromisso sagrado. No Victoria Lar, unimos técnica, dignidade e afeto para que cada residente viva seus melhores dias.',
  },
  scheduling: {
    key: 'scheduling',
    title: 'Agende uma Conversa ou Visita Guiada',
    subtitle: 'Escolha o canal mais prático para você. Atendimento direto com os proprietários e equipe de saúde, sem burocracia.',
    meetingLink: 'https://meet.google.com/vic-tori-lar',
    meetingDuration: '30 a 45 minutos',
    availableHours: '09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00',
    whatsapp: '11987654321',
    whatsappMessage: 'Olá! Gostaria de agendar uma conversa sobre os planos e cuidados da Victoria Lar Residencial.',
    phone: '(11) 3456-7890',
    email: 'contato@victorialar.com.br',
    emailSubject: 'Confirmação de Agendamento - Victoria Lar Residencial',
    emailInstructions: 'Seu agendamento foi registrado com sucesso. Nossa equipe e os diretores estarão conectados no link informado no horário reservado.',
  },
};

/**
 * Checks current bootstrap status in Firestore
 */
export async function getBootstrapStatus(): Promise<BootstrapRecord> {
  try {
    const bootstrapRef = doc(db, 'system', 'bootstrap');
    const snap = await getDoc(bootstrapRef);
    if (!snap.exists()) {
      return {
        status: 'UNINITIALIZED',
        lockedPermanently: false,
      };
    }
    return snap.data() as BootstrapRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'system/bootstrap');
  }
}

/**
 * Executes idempotent, concurrency-safe first superadmin provisioning and seals bootstrap
 */
export async function executeFirstSuperAdminBootstrap(
  uid: string,
  email: string
): Promise<{ success: boolean; message: string; alreadyInitialized?: boolean }> {
  const bootstrapRef = doc(db, 'system', 'bootstrap');
  const guardRef = doc(db, 'system', 'superAdminGuard');
  const adminRef = doc(db, 'admins', uid);

  try {
    return await runTransaction(db, async (tx) => {
      const bootstrapSnap = await tx.get(bootstrapRef);

      if (bootstrapSnap.exists()) {
        const data = bootstrapSnap.data() as BootstrapRecord;
        if (data.lockedPermanently || data.status === 'COMPLETED') {
          // If the calling user is already the recorded superadmin, return idempotent success
          if (data.superAdminUid === uid) {
            return {
              success: true,
              message: 'Sistema já inicializado para este superadministrador.',
              alreadyInitialized: true,
            };
          }
          throw new Error('SISTEMA_JA_INICIALIZADO: O bootstrap inicial já foi executado e permanentemente selado.');
        }
      }

      const now = Date.now();
      const nowIso = new Date().toISOString();

      // 1. Create or update admin record with superadmin role and active: true
      const adminData: AdminUser = {
        uid,
        email,
        role: 'superadmin',
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: 'SYSTEM_BOOTSTRAP',
        bootstrapStatus: 'COMPLETED',
      };
      tx.set(adminRef, adminData);

      // 2. Set SuperAdminGuard with initial count = 1
      const guardData: SuperAdminGuard = {
        activeSuperAdminCount: 1,
        activeSuperAdminUids: [uid],
        version: 1,
        updatedAt: nowIso,
      };
      tx.set(guardRef, guardData);

      // 3. Permanently lock bootstrap
      const bootstrapData: BootstrapRecord = {
        status: 'COMPLETED',
        bootstrapId: `boot_${Math.random().toString(36).substring(2, 9)}`,
        superAdminUid: uid,
        startedAt: now,
        completedAt: now,
        lockedPermanently: true,
      };
      tx.set(bootstrapRef, bootstrapData);

      return {
        success: true,
        message: 'Superadministrador inicial provisionado com sucesso e sistema selado.',
      };
    });
  } catch (err: any) {
    console.error('Falha no bootstrap inicial:', err);
    throw err;
  }
}

export const DEFAULT_STRUCTURE_ALBUMS: Record<
  string,
  {
    topicKey: string;
    cardTitle: string;
    cardSummary: string;
    title: string;
    description: string;
  }
> = {
  'quartos-seguros': {
    topicKey: 'quartos-seguros',
    cardTitle: 'Quartos seguros',
    cardSummary: 'Quartos adaptados conforme necessidade do paciente.',
    title: 'Quartos Seguros & Adaptados',
    description:
      'Acomodações acolhedoras com barras de apoio, campainha de emergência, piso antiderrapante, ventilação e iluminação natural para máxima segurança e conforto.',
  },
  'jardins-area-verde': {
    topicKey: 'jardins-area-verde',
    cardTitle: 'Jardins & Area Verde',
    cardSummary: 'Área externa segura e convivência ao ar livre.',
    title: 'Jardins & Área Verde',
    description:
      'Área externa arborizada, segura e com caminhos planos, solário e bancos confortáveis para convivência saudável e contato diário com a natureza.',
  },
  'monitoramento-24h': {
    topicKey: 'monitoramento-24h',
    cardTitle: 'Monitoramento 24h',
    cardSummary: 'Circuito interno de câmeras em áreas comuns e controle rigoroso para tranquilidade de todos.',
    title: 'Monitoramento & Segurança 24h',
    description:
      'Circuito interno de monitoramento em áreas de convivência e controle rigoroso de acesso 24 horas por dia para tranquilidade de todos os residentes e famílias.',
  },
  'salas-de-atividades': {
    topicKey: 'salas-de-atividades',
    cardTitle: 'Salas de Atividades',
    cardSummary: 'Ambientes multifuncionais convivência, música, jogos cognitivos e cinema.',
    title: 'Salas de Atividades & Convivência',
    description:
      'Ambientes multifuncionais projetados para oficinas de estimulação cognitiva, musicoterapia, leitura, artesanato, sessões de cinema e encontros festivos.',
  },
};

/**
 * Seeds initial content and services ONLY during first uninitialized bootstrap.
 * STRICT DATA PRESERVATION INVARIANTS:
 * 1. If system/bootstrap is already COMPLETED or lockedPermanently, seeding is completely aborted.
 * 2. If a collection already has any documents, seeding does NOT run for that collection.
 * 3. Read failures or network errors are NEVER interpreted as an empty database.
 * 4. Never resurrects items deleted by an administrator.
 */
export async function seedInitialContentIfEmpty(): Promise<void> {
  try {
    // Invariant 1: Check if system bootstrap was already sealed
    const bootstrapRef = doc(db, 'system', 'bootstrap');
    const bootstrapSnap = await getDoc(bootstrapRef);
    if (bootstrapSnap.exists()) {
      const bData = bootstrapSnap.data() as BootstrapRecord;
      if (bData.status === 'COMPLETED' || bData.lockedPermanently) {
        // System is already initialized; do not run automatic seeds or recreate deleted records
        return;
      }
    }

    // Invariant 2: Check content collection. If hero exists, data is already populated.
    // Strictly refuse to seed or overwrite any administrative content or albums!
    const heroRef = doc(db, 'content', 'hero');
    const heroSnap = await getDoc(heroRef);
    if (heroSnap.exists()) {
      return;
    }

    // Only seed default content on an entirely empty /content collection
    for (const [key, content] of Object.entries(INITIAL_INSTITUTIONAL_CONTENT)) {
      const contentRef = doc(db, 'content', key);
      const snap = await getDoc(contentRef);
      if (!snap.exists()) {
        await setDoc(contentRef, {
          ...content,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Invariant 3: Services are strictly inserted by the ADM through the Admin Panel.
    // No demo/test services are automatically seeded.

    // Invariant 4: Seed structure albums metadata into /content/album_{albumId} only during initial empty seed
    for (const [albumId, albumData] of Object.entries(DEFAULT_STRUCTURE_ALBUMS)) {
      const albumContentRef = doc(db, 'content', `album_${albumId}`);
      const snap = await getDoc(albumContentRef);
      if (!snap.exists()) {
        await setDoc(albumContentRef, {
          key: `album_${albumId}`,
          title: albumData.title,
          subtitle: albumData.description,
          body: '[]',
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        });
      }
    }
  } catch (err) {
    // Read failures or network errors MUST NOT cause any blind fallback seeding
    console.warn('[Seed Content Safe Guard - Seeding aborted to preserve data integrity]:', err);
  }
}
