import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BootstrapRecord, SuperAdminGuard, AdminUser, ServiceItem, InstitutionalContent } from '../types';

export const INITIAL_SERVICES: Omit<ServiceItem, 'updatedBy'>[] = [
  {
    id: 'enfermagem-24h',
    title: 'Assistência de Enfermagem 24 Horas',
    summary: 'Acompanhamento clínico contínuo, administração rigorosa de medicamentos e monitoramento constante de sinais vitais.',
    description: 'Nossa equipe de enfermagem está presente 24 horas por dia, 7 dias por semana, garantindo suporte imediato a qualquer necessidade de saúde dos residentes com carinho e precisão técnica.',
    icon: 'HeartPulse',
    category: 'saude',
    order: 1,
    status: 'published',
    highlight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'acompanhamento-medico',
    title: 'Acompanhamento Médico Periódico',
    summary: 'Visitas médicas regulares com foco em geriatria preventiva, ajuste terapêutico e manutenção da qualidade de vida.',
    description: 'Atendimento médico especializado em geriatria e clínica geral, integrando prontuário individual e plano de cuidados individualizado para cada idoso.',
    icon: 'Stethoscope',
    category: 'saude',
    order: 2,
    status: 'published',
    highlight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'nutricao-balanceada',
    title: 'Nutrição Especializada e Afetiva',
    summary: 'Cardápios desenvolvidos por nutricionistas, respeitando restrições dietéticas, texturas adaptadas e o sabor da comida caseira.',
    description: 'Oferecemos 6 refeições diárias personalizadas para necessidades como diabetes, hipertensão e disfagia, unindo nutrição de alto padrão ao prazer de comer bem.',
    icon: 'Apple',
    category: 'hotelaria',
    order: 3,
    status: 'published',
    highlight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fisioterapia-movimento',
    title: 'Fisioterapia e Manutenção da Mobilidade',
    summary: 'Sessões preventivas e reabilitadoras para fortalecimento muscular, equilíbrio e prevenção de quedas.',
    description: 'Plano de fisioterapia motor e respiratório desenhado para manter o máximo de autonomia, mobilidade e disposição funcional no dia a dia.',
    icon: 'Activity',
    category: 'saude',
    order: 4,
    status: 'published',
    highlight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'terapia-ocupacional',
    title: 'Terapia Ocupacional e Estímulo Cognitivo',
    summary: 'Oficinas de memória, dinâmicas sensoriais, artesanato e atividades lúdicas para manter a mente ativa e alegre.',
    description: 'Programas diários de estimulação cognitiva e socialização que despertam memórias afetivas, fortalecem vínculos e promovem o bem-estar psicológico.',
    icon: 'Sparkles',
    category: 'lazer',
    order: 5,
    status: 'published',
    highlight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'hotelaria-convivencia',
    title: 'Hotelaria Assistida e Convivência Afetuosa',
    summary: 'Suítes arejadas, serviço diário de higienização, lavanderia e amplas áreas verdes de lazer e descanso.',
    description: 'Ambiente aconchegante que preserva a sensação de um verdadeiro lar, cercado por jardins, varandas acolhedoras e segurança 24 horas.',
    icon: 'Home',
    category: 'hotelaria',
    order: 6,
    status: 'published',
    highlight: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'musicoterapia-integrativa',
    title: 'Musicoterapia e Integração Familiar',
    summary: 'Encontros musicais ao vivo e acolhimento contínuo para familiares em visitas sem restrições de carinho.',
    description: 'Serviço em fase de ampliação para fortalecimento emocional através de melodias consagradas e momentos de celebração entre residentes e famílias.',
    icon: 'Music',
    category: 'lazer',
    order: 7,
    status: 'draft', // Draft service to prove separation between public and administrative views
    highlight: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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
    title: 'Olá, sou a Regina.',
    imageCaption: 'Regina',
    role: 'Sócia-Proprietária & Gestora Humanizada',
    tag: 'Atendimento direto, humano e sem intermediários',
    imageUrl: '',
    body: 'Eu sempre gostei de entender como as coisas funcionam — e, principalmente, de descobrir como poderiam funcionar com mais afeto e empatia.\n\nForam mais de 25 anos vivendo a gestão com foco em pessoas, processos e acolhimento humano. Nesse caminho, aprendi a olhar para cada residente em sua singularidade: entender a sua história de vida, acolher a família e transformar o cuidado em um verdadeiro abraço diário.\n\nEstar presente todos os dias no Victoria Lar, acompanhando cada rotina e ouvindo com atenção cada idoso, é a nossa maior realização.',
    quote: 'O Victoria Lar Residencial nasceu daí. Da vontade de usar toda essa experiência para criar um espaço onde o acolhimento humano, a segurança e o carinho aconteçam de verdade, sem intermediários.',
  },
  owner_2: {
    key: 'owner_2',
    title: 'Olá, sou o Roberto.',
    imageCaption: 'Roberto',
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
): Promise<{ success: boolean; message: string }> {
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

/**
 * Seeds initial content and services if they don't already exist
 */
export async function seedInitialContentIfEmpty(): Promise<void> {
  try {
    // Seed content
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

    // Seed services
    for (const serv of INITIAL_SERVICES) {
      const servRef = doc(db, 'services', serv.id);
      const snap = await getDoc(servRef);
      if (!snap.exists()) {
        await setDoc(servRef, {
          ...serv,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('[Seed Content Notice]', err);
  }
}
