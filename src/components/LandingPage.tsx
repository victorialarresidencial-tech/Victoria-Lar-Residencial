import React, { useState, useEffect } from 'react';
import {
  getPublishedServices,
  getInstitutionalContent,
  submitContactLead,
  scheduleOnlineMeeting,
} from '../services/firestoreService';
import { INITIAL_INSTITUTIONAL_CONTENT } from '../services/bootstrapService';
import { ServiceItem, InstitutionalContent } from '../types';
import { useAuth } from '../context/AuthContext';
import { VictoriaLogo, VictoriaEmblem } from './VictoriaLogo';
import { ContactLeadModal } from './ContactLeadModal';
import {
  HeartPulse,
  Heart,
  Stethoscope,
  Apple,
  Activity,
  Sparkles,
  Home,
  Music,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  ArrowRight,
  X,
  Send,
  Users,
  Sun,
  Shield,
  HelpCircle,
  Camera,
  Edit2,
  FileText,
  Video,
  MessageSquare,
  PhoneCall,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAdminLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAdminLogin }) => {
  const { isAdmin } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [content, setContent] = useState<Record<string, InstitutionalContent>>({});
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [activeServiceModal, setActiveServiceModal] = useState<ServiceItem | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadModalService, setLeadModalService] = useState('Assistência de Enfermagem 24 Horas');

  // 3-Option Channel state: 'meeting' | 'form' | 'whatsapp'
  const [activeContactTab, setActiveContactTab] = useState<'meeting' | 'form' | 'whatsapp'>('meeting');

  // Form state (Classic lead form)
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: 'Filho(a)',
    serviceInterest: 'Assistência de Enfermagem 24 Horas',
    message: '',
    honeypot: '',
  });
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadFeedback, setLeadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Meeting Form state (Reunião via Google Meet)
  const [meetingForm, setMeetingForm] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    relationship: 'Filho(a)',
    serviceInterest: 'Reunião de Apresentação e Planos',
    message: '',
    honeypot: '',
  });
  const [submittingMeeting, setSubmittingMeeting] = useState(false);
  const [meetingFeedback, setMeetingFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    meetingLink?: string;
    date?: string;
    time?: string;
    email?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customWhatsappMsg, setCustomWhatsappMsg] = useState('');

  useEffect(() => {
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    try {
      setLoadingServices(true);
      // Strictly public query: where('status', '==', 'published')
      const [servicesData, contentData] = await Promise.all([
        getPublishedServices(),
        getInstitutionalContent().catch(() => ({})),
      ]);
      setServices(servicesData || []);
      setContent(contentData || {});
    } catch (err) {
      console.warn('Erro ao carregar dados públicos:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadFeedback(null);

    if (!leadForm.name || !leadForm.phone) {
      setLeadFeedback({ type: 'error', message: 'Por favor, preencha nome e telefone de contato.' });
      return;
    }

    try {
      setSubmittingLead(true);
      const res = await submitContactLead(leadForm);
      setLeadFeedback({
        type: 'success',
        message: res.message || 'Sua solicitação de visita foi recebida! Nossa equipe entrará em contato prontamente.',
      });
      // Reset form
      setLeadForm({
        name: '',
        email: '',
        phone: '',
        relationship: 'Filho(a)',
        serviceInterest: 'Assistência de Enfermagem 24 Horas',
        message: '',
        honeypot: '',
      });
    } catch (err: any) {
      setLeadFeedback({
        type: 'error',
        message: err.message || 'Falha ao enviar mensagem. Por favor, tente novamente ou ligue para nós.',
      });
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMeetingFeedback(null);

    if (!meetingForm.name || !meetingForm.email || !meetingForm.phone) {
      setMeetingFeedback({
        type: 'error',
        message: 'Por favor, preencha nome, e-mail e telefone para receber a confirmação.',
      });
      return;
    }

    if (!meetingForm.date || !meetingForm.time) {
      setMeetingFeedback({
        type: 'error',
        message: 'Por favor, selecione uma data e um horário para a reunião.',
      });
      return;
    }

    try {
      setSubmittingMeeting(true);
      const schedulingConfig = content['scheduling'] || INITIAL_INSTITUTIONAL_CONTENT['scheduling'];
      const res = await scheduleOnlineMeeting({
        name: meetingForm.name,
        email: meetingForm.email,
        phone: meetingForm.phone,
        scheduledDate: meetingForm.date,
        scheduledTime: meetingForm.time,
        meetingLink: schedulingConfig?.meetingLink || 'https://meet.google.com/vic-tori-lar',
        relationship: meetingForm.relationship,
        serviceInterest: meetingForm.serviceInterest,
        message: meetingForm.message,
        emailSubject: schedulingConfig?.emailSubject,
        emailInstructions: schedulingConfig?.emailInstructions,
        honeypot: meetingForm.honeypot,
      });

      setMeetingFeedback({
        type: 'success',
        message: res.message || 'Reunião agendada com sucesso! Um e-mail com data, horário e link do Google Meet foi enviado.',
        meetingLink: res.meetingLink,
        date: meetingForm.date,
        time: meetingForm.time,
        email: meetingForm.email,
      });

      setMeetingForm({
        name: '',
        email: '',
        phone: '',
        date: '',
        time: '',
        relationship: 'Filho(a)',
        serviceInterest: 'Reunião de Apresentação e Planos',
        message: '',
        honeypot: '',
      });
    } catch (err: any) {
      setMeetingFeedback({
        type: 'error',
        message: err.message || 'Falha ao agendar reunião. Tente novamente ou nos chame no WhatsApp.',
      });
    } finally {
      setSubmittingMeeting(false);
    }
  };

  const renderIcon = (iconName?: string) => {
    const props = { className: 'w-6 h-6 text-[#B8954A]' };
    switch (iconName) {
      case 'Stethoscope':
        return <Stethoscope {...props} />;
      case 'Apple':
        return <Apple {...props} />;
      case 'Activity':
        return <Activity {...props} />;
      case 'Sparkles':
        return <Sparkles {...props} />;
      case 'Home':
        return <Home {...props} />;
      case 'Music':
        return <Music {...props} />;
      case 'ShieldCheck':
        return <ShieldCheck {...props} />;
      case 'HeartPulse':
      default:
        return <HeartPulse {...props} />;
    }
  };

  const filteredServices = services.filter((s) => {
    if (selectedCategory === 'todos') return true;
    return s.category === selectedCategory;
  });

  const heroContent = content['hero'];
  const aboutContent = content['about'];

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-neutral-800">
      {/* ----------------------------------------------------------- */}
      {/* 1. HERO SECTION */}
      {/* ----------------------------------------------------------- */}
      <section id="hero" className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
        {/* Decorative background aura with brand colors */}
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 rounded-full bg-[#E5A2AB]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-0 -ml-40 w-96 h-96 rounded-full bg-[#B8954A]/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Editorial Headline & Copy */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#173D2B]/8 border border-[#173D2B]/15 rounded-full text-[#173D2B] text-xs font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#B8954A] animate-pulse" />
                <span>Residencial Geriátrico de Alto Padrão</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-[#173D2B] leading-tight tracking-tight">
                {heroContent?.title || 'Acolhimento, Cuidado Humanizado e Dignidade para a Terceira Idade'}
              </h1>

              <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl">
                {heroContent?.subtitle ||
                  'No Victoria Lar Residencial, cada detalhe foi concebido para oferecer excelência em saúde, conforto de alto padrão e o calor de uma verdadeira família.'}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {/*<button
                  type="button"
                  onClick={() => setIsLeadModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-[#E5A2AB] hover:bg-[#DC939D] text-[#173D2B] font-semibold text-sm rounded-full shadow-md transition-all border border-[#DC939D] hover:scale-[1.02] cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[#173D2B]" />
                  <span>Agendar uma Visita Guiada</span>
                </button>*/}

                <a
                  href="#servicos"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-[#FAF9F5] text-[#173D2B] font-semibold text-sm rounded-full shadow-xs border border-[#173D2B]/20 transition-all hover:border-[#B8954A]"
                >
                  <span>Conhecer Nossos Cuidados</span>
                  <ArrowRight className="w-4 h-4 text-[#B8954A]" />
                </a>
              </div>

              {/* Quick Info Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-[#173D2B]/10 text-xs">
                <div className="flex items-center gap-2.5 text-neutral-700">
                  <div className="p-2 bg-[#E5A2AB]/30 text-[#173D2B] rounded-lg">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  
                    <div className="font-bold text-[#173D2B]">Enfermagem Especializada</div>
                    
                </div>

                <div className="flex items-center gap-2.5 text-neutral-700">
                  <div className="p-2 bg-[#B8954A]/20 text-[#B8954A] rounded-lg">
                    <Apple className="w-4 h-4 text-[#B8954A]" />
                  </div>
                  
                    <div className="font-bold text-[#173D2B]">Nutrição</div>
                  
                </div>

                <div className="flex items-center gap-2.5 text-neutral-700 col-span-2 sm:col-span-1">
                  <div className="p-2 bg-[#173D2B]/10 text-[#173D2B] rounded-lg">
                    <Sun className="w-4 h-4" />
                  </div>
                  
                    <div className="font-bold text-[#173D2B]">Áreas Verdes</div>
                  
                </div>
              </div>
            </div>

            {/* Right Column: Visual Showcase Frame (Foto inserida pelo ADM) */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Decorative aura glow */}
                <div className="absolute -top-6 -right-6 w-72 h-72 rounded-full bg-[#B8954A]/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-72 h-72 rounded-full bg-[#173D2B]/15 blur-3xl pointer-events-none" />

                {/* Main Showcase Card: Foto Inserida pelo ADM */}
                <div className="relative rounded-3xl overflow-hidden shadow-xl border-2 border-[#B8954A]/40 bg-white group">
                  {/* Photo frame container */}
                  <div className="relative w-full h-[380px] sm:h-[450px] overflow-hidden bg-neutral-100">
                    <img
                      src={
                        heroContent?.imageUrl ||
                        'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80'
                      }
                      alt={heroContent?.imageCaption || 'Victoria Lar Residencial - Estrutura e Jardins'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      onError={(e) => {
                        // Fallback image in case the custom URL cannot be loaded
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80';
                      }}
                    />

                    {/* Efeito sutil ensolarado/dourado sem qualquer sombra ou tom acinzentado */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/10 via-amber-200/5 to-transparent pointer-events-none mix-blend-screen" />
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-100/10 via-transparent to-transparent pointer-events-none" />

                    {/* Top right luxury brand badge */}
                    <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-[#173D2B]/85 backdrop-blur-md rounded-full border border-[#B8954A]/60 flex items-center gap-2 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-[#B8954A] animate-pulse" />
                      <span className="text-[11px] font-semibold text-[#FAF9F5] tracking-wide">
                        Ambiente Humanizado
                      </span>
                    </div>

                    {/* If Admin is logged in, show quick edit button */}
                    {isAdmin && (
                      <button
                        onClick={onOpenAdminLogin}
                        className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#173D2B]/90 hover:bg-[#173D2B] text-white rounded-full text-xs font-semibold shadow-lg border border-[#B8954A]/80 backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
                        title="Alterar esta foto no Painel ADM"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#B8954A]" />
                        <span>Editar foto no ADM</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Overlapping Warm Accent Tag */}
                <div className="absolute -bottom-5 -left-3 sm:-bottom-6 sm:-left-4 bg-[#FAF9F5] border-2 border-[#173D2B]/15 rounded-2xl p-3.5 sm:p-4 shadow-xl flex items-center gap-3 max-w-xs z-20">
                  <div className="w-10 h-10 rounded-full bg-[#E5A2AB] border border-[#DC939D] flex items-center justify-center text-[#173D2B] flex-shrink-0">
                    <HeartPulse className="w-5 h-5 text-[#173D2B]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-[#173D2B]">Cuidado Especializado 24h</div>
                    <div className="text-[10px] text-neutral-500">Excelência e carinho em cada detalhe</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- */}
      {/* 2. SOBRE NÓS SECTION */}
      {/* ----------------------------------------------------------- */}
      <section id="sobre" className="py-20 bg-white border-y border-[#173D2B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E5A2AB]/25 border border-[#E5A2AB] rounded-full text-[#173D2B] text-xs font-semibold">
                <span>Nossa História e Princípios</span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#173D2B]">
                {aboutContent?.title || 'Nossa Vocação é o Cuidado com Amor'}
              </h2>

              <p className="text-base text-neutral-600 leading-relaxed">
                {aboutContent?.subtitle ||
                  'Uma história construída sobre respeito à trajetória e à dignidade de cada residente.'}
              </p>

              <div className="text-sm text-neutral-700 leading-relaxed space-y-4">
                <p>
                  {aboutContent?.body ||
                    'O Victoria Lar Residencial nasceu do desejo genuíno de redefinir a experiência de moradia para a terceira idade. Mais do que uma estrutura médica de ponta, oferecemos um ecossistema de afeto, acolhimento integral e valorização contínua da individualidade. Nossa arquitetura favorece a iluminação natural, a convivência e a segurança, enquanto nossa equipe multiprofissional atua com empatia e dedicação.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 text-xs">
                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-neutral-200">
                  <div className="font-serif font-bold text-[#173D2B] text-lg mb-1">+15 Anos</div>
                  <div className="text-neutral-600">De dedicação e assistência de alto padrão à terceira idade.</div>
                </div>

                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-neutral-200">
                  <div className="font-serif font-bold text-[#173D2B] text-lg mb-1">100% Adaptado</div>
                  <div className="text-neutral-600">Acessibilidade total, elevadores e áreas de segurança física.</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-[#FAF9F5] rounded-3xl p-8 border border-[#173D2B]/10 shadow-sm space-y-6">
                <h3 className="font-serif font-bold text-[#173D2B] text-xl">
                  O que torna o Victoria Lar Residencial singular?
                </h3>

                <div className="space-y-4 text-xs">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 bg-[#173D2B] text-white rounded-lg flex-shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4 text-[#B8954A]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">Segurança Clínica Rígida</h4>
                      <p className="text-neutral-600 mt-0.5">
                        Armazenamento rigoroso de prontuários, dupla checagem na administração de remédios e suporte de emergência ágil.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="p-2 bg-[#B8954A] text-white rounded-lg flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">Estímulo Cognitivo e Lazer</h4>
                      <p className="text-neutral-600 mt-0.5">
                        Oficinas semanais de arteterapia, rodas de conversa, jogos de raciocínio e celebrações temáticas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="p-2 bg-[#E5A2AB] text-[#173D2B] rounded-lg flex-shrink-0 mt-0.5">
                      <HeartPulse className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">Acolhimento Familiar</h4>
                      <p className="text-neutral-600 mt-0.5">
                        Espaços confortáveis para receber netos, filhos e amigos sem pressa e com café sempre fresco.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* QUEM ESTÁ POR TRÁS (Dois Proprietários / Painéis Lado a Lado) */}
          {/* ======================================================= */}
          <div className="mt-20 pt-16 border-t border-[#173D2B]/10">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FAF9F5] border border-[#B8954A]/40 rounded-full text-[#173D2B] text-xs font-semibold shadow-2xs">
                <Users className="w-3.5 h-3.5 text-[#B8954A]" />
                <span className="uppercase tracking-wider font-bold text-[11px] text-[#173D2B]">Quem Está Por Trás</span>
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#173D2B]">
                Presença Diária, Cuidado Próximo e Acolhimento sem Intermediários
              </h3>
              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                No Victoria Lar Residencial, os proprietários participam ativamente do dia a dia, garantindo atenção pessoal a cada residente e acolhimento contínuo para cada família.
              </p>
            </div>

            {/* Dois painéis lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* PAINEL PROPRIETÁRIO 1 */}
              {(() => {
                const defaults = INITIAL_INSTITUTIONAL_CONTENT['owner_1'];
                const owner = content['owner_1'] || defaults;
                const title = owner?.title || defaults?.title || 'Olá, sou a Regina.';
                const name = owner?.imageCaption || defaults?.imageCaption || 'Regina';
                const role = owner?.role || defaults?.role || 'Sócia-Proprietária & Gestora';
                const tag = owner?.tag || defaults?.tag || 'Atendimento direto, humano e sem intermediários';
                const imageUrl = owner?.imageUrl || defaults?.imageUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80';
                const bodyText = owner?.body || defaults?.body || '';
                const quote = owner?.quote || defaults?.quote || '';

                const paragraphs = bodyText.split('\n\n').filter(Boolean);
                const firstParagraph = paragraphs[0] || '';
                const otherParagraphs = paragraphs.slice(1);

                return (
                  <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-md hover:shadow-xl transition-all duration-300 p-6 sm:p-8 flex flex-col justify-between relative group text-left">
                    <div>
                      {/* Top Badges / Pills */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 border border-neutral-200 rounded-full text-neutral-800 text-[11px] font-bold uppercase tracking-wider">
                          <Users className="w-3.5 h-3.5 text-[#B8954A]" />
                          <span>QUEM ESTÁ POR TRÁS</span>
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#FAF9F5] border border-neutral-200 rounded-full text-neutral-600 text-[11px] font-medium">
                          <Heart className="w-3.5 h-3.5 text-[#E5A2AB]" />
                          <span>{tag}</span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="w-full h-px bg-neutral-100 my-5" />

                      {/* Top Split: Photo + Greeting/Intro */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                        {/* Portrait Photo with Overlay */}
                        <div className="sm:col-span-5 relative w-full aspect-square sm:aspect-[4/5] rounded-2xl overflow-hidden shadow-sm border border-neutral-200 bg-neutral-100">
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                          <div className="absolute bottom-3 left-3 right-3 text-left">
                            <div className="font-serif font-bold text-white text-base sm:text-lg leading-tight drop-shadow-md">
                              {name}
                            </div>
                            <div className="text-[11px] font-medium text-[#DFC282] leading-tight mt-0.5 drop-shadow-xs">
                              {role}
                            </div>
                          </div>
                        </div>

                        {/* Title & First Paragraph */}
                        <div className="sm:col-span-7 space-y-3">
                          <h4 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 leading-snug">
                            {title}
                          </h4>
                          <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                            {firstParagraph}
                          </p>
                        </div>
                      </div>

                      {/* Other Paragraphs */}
                      {otherParagraphs.length > 0 && (
                        <div className="space-y-3 mt-4 text-xs sm:text-sm text-neutral-700 leading-relaxed">
                          {otherParagraphs.map((para, idx) => (
                            <p key={idx} className="whitespace-pre-line">
                              {para}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Highlight Callout Box with Gold Accent */}
                    {quote && (
                      <div className="mt-6 bg-[#FAF9F5] border-l-4 border-[#B8954A] rounded-r-2xl p-4 sm:p-5 text-xs sm:text-sm text-neutral-800 leading-relaxed shadow-2xs">
                        <p className="italic">{quote}</p>
                      </div>
                    )}

                    {/* Admin Quick Edit Button */}
                    {isAdmin && (
                      <button
                        onClick={onOpenAdminLogin}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1 bg-[#173D2B] text-white rounded-full text-[10px] font-semibold border border-[#B8954A] shadow-md hover:bg-[#123022] cursor-pointer"
                        title="Editar dados deste proprietário no Painel ADM"
                      >
                        <Edit2 className="w-3 h-3 text-[#B8954A]" />
                        <span>Editar no ADM</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* PAINEL PROPRIETÁRIO 2 */}
              {(() => {
                const defaults = INITIAL_INSTITUTIONAL_CONTENT['owner_2'];
                const owner = content['owner_2'] || defaults;
                const title = owner?.title || defaults?.title || 'Olá, sou o Roberto.';
                const name = owner?.imageCaption || defaults?.imageCaption || 'Roberto';
                const role = owner?.role || defaults?.role || 'Sócio-Proprietário & Diretor de Cuidados';
                const tag = owner?.tag || defaults?.tag || 'Presença diária e compromisso com a excelência';
                const imageUrl = owner?.imageUrl || defaults?.imageUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80';
                const bodyText = owner?.body || defaults?.body || '';
                const quote = owner?.quote || defaults?.quote || '';

                const paragraphs = bodyText.split('\n\n').filter(Boolean);
                const firstParagraph = paragraphs[0] || '';
                const otherParagraphs = paragraphs.slice(1);

                return (
                  <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-md hover:shadow-xl transition-all duration-300 p-6 sm:p-8 flex flex-col justify-between relative group text-left">
                    <div>
                      {/* Top Badges / Pills */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 border border-neutral-200 rounded-full text-neutral-800 text-[11px] font-bold uppercase tracking-wider">
                          <Users className="w-3.5 h-3.5 text-[#B8954A]" />
                          <span>QUEM ESTÁ POR TRÁS</span>
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#FAF9F5] border border-neutral-200 rounded-full text-neutral-600 text-[11px] font-medium">
                          <Heart className="w-3.5 h-3.5 text-[#E5A2AB]" />
                          <span>{tag}</span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="w-full h-px bg-neutral-100 my-5" />

                      {/* Top Split: Photo + Greeting/Intro */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                        {/* Portrait Photo with Overlay */}
                        <div className="sm:col-span-5 relative w-full aspect-square sm:aspect-[4/5] rounded-2xl overflow-hidden shadow-sm border border-neutral-200 bg-neutral-100">
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                          <div className="absolute bottom-3 left-3 right-3 text-left">
                            <div className="font-serif font-bold text-white text-base sm:text-lg leading-tight drop-shadow-md">
                              {name}
                            </div>
                            <div className="text-[11px] font-medium text-[#DFC282] leading-tight mt-0.5 drop-shadow-xs">
                              {role}
                            </div>
                          </div>
                        </div>

                        {/* Title & First Paragraph */}
                        <div className="sm:col-span-7 space-y-3">
                          <h4 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 leading-snug">
                            {title}
                          </h4>
                          <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                            {firstParagraph}
                          </p>
                        </div>
                      </div>

                      {/* Other Paragraphs */}
                      {otherParagraphs.length > 0 && (
                        <div className="space-y-3 mt-4 text-xs sm:text-sm text-neutral-700 leading-relaxed">
                          {otherParagraphs.map((para, idx) => (
                            <p key={idx} className="whitespace-pre-line">
                              {para}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Highlight Callout Box with Gold Accent */}
                    {quote && (
                      <div className="mt-6 bg-[#FAF9F5] border-l-4 border-[#B8954A] rounded-r-2xl p-4 sm:p-5 text-xs sm:text-sm text-neutral-800 leading-relaxed shadow-2xs">
                        <p className="italic">{quote}</p>
                      </div>
                    )}

                    {/* Admin Quick Edit Button */}
                    {isAdmin && (
                      <button
                        onClick={onOpenAdminLogin}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1 bg-[#173D2B] text-white rounded-full text-[10px] font-semibold border border-[#B8954A] shadow-md hover:bg-[#123022] cursor-pointer"
                        title="Editar dados deste proprietário no Painel ADM"
                      >
                        <Edit2 className="w-3 h-3 text-[#B8954A]" />
                        <span>Editar no ADM</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- */}
      {/* 3. NOSSOS SERVIÇOS (Dinamismo com Firestore) */}
      {/* ----------------------------------------------------------- */}
      <section id="servicos" className="py-24 bg-[#FAF9F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#173D2B]/8 border border-[#173D2B]/15 rounded-full text-[#173D2B] text-xs font-semibold">
              <HeartPulse className="w-3.5 h-3.5 text-[#B8954A]" />
              <span>Cuidado Integral & Multidisciplinar</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#173D2B]">
              Nossos Serviços Especializados
            </h2>

            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
              Planos de assistência desenhados para promover bem-estar físico, psicológico e social com acompanhamento humanizado 24 horas por dia.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              {[
                { id: 'todos', label: 'Todos os Cuidados' },
                { id: 'saude', label: 'Saúde & Enfermagem' },
                { id: 'hotelaria', label: 'Hotelaria & Nutrição' },
                { id: 'lazer', label: 'Estímulo & Convivência' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#173D2B] text-[#FAF9F5] shadow-xs border border-[#B8954A]/50'
                      : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Services Grid */}
          {loadingServices ? (
            <div className="py-16 text-center text-xs text-neutral-500">
              Carregando serviços atualizados do Victoria Lar...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:border-[#B8954A]/40"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-[#FAF9F5] border border-neutral-200 rounded-xl group-hover:bg-[#E5A2AB]/20 transition-colors">
                        {renderIcon(service.icon)}
                      </div>

                      {service.highlight && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#173D2B] bg-[#E5A2AB] px-2.5 py-0.5 rounded-full border border-[#DC939D]">
                          Destaque
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-serif font-bold text-neutral-900 text-lg group-hover:text-[#173D2B] transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                        {service.summary}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 mt-4 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-neutral-400 capitalize">
                      {service.category || 'Assistencial'}
                    </span>

                    <button
                      onClick={() => setActiveServiceModal(service)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#173D2B] group-hover:text-[#B8954A] transition-colors"
                    >
                      <span>Ver Detalhes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Service Detail Modal */}
      {activeServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FAF9F5] border border-[#173D2B]/20 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in">
            <div className="bg-[#173D2B] p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  {renderIcon(activeServiceModal.icon)}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg">{activeServiceModal.title}</h3>
                  <span className="text-[11px] text-[#B8954A] font-semibold uppercase tracking-wider">
                    {activeServiceModal.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveServiceModal(null)}
                className="text-white/70 hover:text-white p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-neutral-700 leading-relaxed">
              <div className="bg-white p-4 rounded-xl border border-neutral-200">
                <h4 className="font-semibold text-neutral-900 mb-1">Resumo Executivo:</h4>
                <p>{activeServiceModal.summary}</p>
              </div>

              {activeServiceModal.description && (
                <div>
                  <h4 className="font-semibold text-neutral-900 mb-1">Como Funciona o Cuidado:</h4>
                  <p className="whitespace-pre-line text-neutral-600">{activeServiceModal.description}</p>
                </div>
              )}

              <div className="pt-4 border-t border-neutral-200 flex justify-end gap-3">
                <button
                  onClick={() => setActiveServiceModal(null)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const serviceTitle = activeServiceModal.title;
                    setActiveServiceModal(null);
                    setLeadModalService(serviceTitle);
                    setIsLeadModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-[#E5A2AB] hover:bg-[#DC939D] text-[#173D2B] font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  Agendar Visita para Este Serviço
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* 4. ESTRUTURA E DIFERENCIAIS */}
      {/* ----------------------------------------------------------- */}
      <section id="diferenciais" className="py-20 bg-white border-y border-[#173D2B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="text-xs uppercase font-bold tracking-widest text-[#B8954A]">
              Ambiente Seguro e Inspirador
            </span>
            <h2 className="text-3xl font-serif font-bold text-[#173D2B]">
              Estrutura Projetada para o Bem-Estar
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600">
              Cada espaço foi pensado para oferecer autonomia, acessibilidade integral e conforto térmico e acústico.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-neutral-200 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#173D2B] text-white flex items-center justify-center">
                <Home className="w-5 h-5 text-[#B8954A]" />
              </div>
              <h3 className="font-serif font-bold text-neutral-900 text-sm">Suítes Adaptadas</h3>
              <p className="text-neutral-600 leading-relaxed">
                Quartos com campainha de emergência ao lado do leito, barras de apoio ergonômicas e banheiros com acessibilidade total.
              </p>
            </div>

            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-neutral-200 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#173D2B] text-white flex items-center justify-center">
                <Sun className="w-5 h-5 text-[#B8954A]" />
              </div>
              <h3 className="font-serif font-bold text-neutral-900 text-sm">Jardins & Banho de Sol</h3>
              <p className="text-neutral-600 leading-relaxed">
                Áreas externas arborizadas com caminhos planos para caminhadas seguras e convivência ao ar livre.
              </p>
            </div>

            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-neutral-200 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#173D2B] text-white flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#B8954A]" />
              </div>
              <h3 className="font-serif font-bold text-neutral-900 text-sm">Monitoramento 24h</h3>
              <p className="text-neutral-600 leading-relaxed">
                Circuito interno de câmeras em áreas comuns e controle rigoroso de portaria para tranquilidade de todos.
              </p>
            </div>

            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-neutral-200 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#173D2B] text-white flex items-center justify-center">
                <Users className="w-5 h-5 text-[#B8954A]" />
              </div>
              <h3 className="font-serif font-bold text-neutral-900 text-sm">Salas de Atividades</h3>
              <p className="text-neutral-600 leading-relaxed">
                Ambientes multifuncionais equipados para fisioterapia motora, música, jogos cognitivos e cinema.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- */}
      {/* 5. AGENDAMENTO & 3 OPÇÕES DE CONTATO (Estilo Beeginning 4 You) */}
      {/* ----------------------------------------------------------- */}
      {(() => {
        const schedulingDefaults = INITIAL_INSTITUTIONAL_CONTENT['scheduling'];
        const schedulingConfig = content['scheduling'] || schedulingDefaults;
        const owner1 = content['owner_1'] || INITIAL_INSTITUTIONAL_CONTENT['owner_1'];
        const owner2 = content['owner_2'] || INITIAL_INSTITUTIONAL_CONTENT['owner_2'];

        const rawHours = schedulingConfig?.availableHours || '09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00';
        const availableSlots = rawHours
          .split(',')
          .map((h: string) => h.trim())
          .filter(Boolean);

        const todayStr = new Date().toISOString().split('T')[0];

        const formatDateBR = (d: string) => {
          if (!d) return '';
          if (d.includes('-')) {
            const [y, m, day] = d.split('-');
            return `${day}/${m}/${y}`;
          }
          return d;
        };

        const rawWhatsapp = schedulingConfig?.whatsapp || heroContent?.whatsapp || '11987654321';
        const cleanWhatsapp = rawWhatsapp.replace(/\D/g, '');
        const defaultWhatsappMsg =
          schedulingConfig?.whatsappMessage ||
          'Olá! Gostaria de conversar com os diretores e saber mais sobre os cuidados e acomodações do Victoria Lar Residencial.';
        const activeWhatsappMsg = customWhatsappMsg || defaultWhatsappMsg;

        return (
          <section id="contato" className="py-24 bg-[#FAF9F5] border-t border-[#173D2B]/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section Header */}
              <div className="text-center max-w-3xl mx-auto space-y-4 mb-14 relative">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#173D2B]/8 border border-[#173D2B]/15 rounded-full text-[#173D2B] text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-[#B8954A]" />
                  <span>Canais de Atendimento & Agendamentos</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#173D2B]">
                  {schedulingConfig?.title || 'Como você prefere conversar?'}
                </h2>

                <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                  {schedulingConfig?.subtitle ||
                    'Escolha o canal mais prático para você. Atendimento direto com os sócios-proprietários e equipe clínica, com total transparência e acolhimento humano.'}
                </p>

                {/* Admin Quick Edit Button */}
                {isAdmin && (
                  <div className="pt-2">
                    <button
                      onClick={onOpenAdminLogin}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#173D2B] text-white rounded-full text-[11px] font-semibold border border-[#B8954A] shadow-xs hover:bg-[#123022] cursor-pointer"
                      title="Editar configurações de agendamento no Painel ADM"
                    >
                      <Edit2 className="w-3 h-3 text-[#B8954A]" />
                      <span>Editar Agendamento no Painel ADM</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* 3 Interactive Option Cards / Switcher (Idêntico ao Beeginning 4 You) */}
              {/* ========================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
                {/* Option 1: Meeting */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveContactTab('meeting');
                    setMeetingFeedback(null);
                  }}
                  className={`relative p-6 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    activeContactTab === 'meeting'
                      ? 'bg-[#173D2B] text-white border-[#B8954A] shadow-xl ring-2 ring-[#B8954A]/30 scale-[1.02]'
                      : 'bg-white text-neutral-800 border-neutral-200 hover:border-[#B8954A]/60 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                          activeContactTab === 'meeting'
                            ? 'bg-[#B8954A] text-[#173D2B]'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        <Video className="w-6 h-6" />
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          activeContactTab === 'meeting'
                            ? 'bg-white/15 text-[#DFC282]'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        Google Meet
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`font-serif font-bold text-lg leading-tight ${
                          activeContactTab === 'meeting' ? 'text-white' : 'text-[#173D2B]'
                        }`}
                      >
                        Reunião via Meeting
                      </h3>
                      <p
                        className={`text-xs mt-1.5 leading-relaxed ${
                          activeContactTab === 'meeting' ? 'text-white/80' : 'text-neutral-600'
                        }`}
                      >
                        Agende uma conversa por vídeo com Regina & Roberto. Escolha o dia e horário e receba o link da sala no seu e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-current/15 flex items-center justify-between text-xs font-semibold">
                    <span className={activeContactTab === 'meeting' ? 'text-[#DFC282]' : 'text-[#B8954A]'}>
                      {activeContactTab === 'meeting' ? '✓ Opção Selecionada' : 'Selecionar Reunião Online'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Option 2: Formulário */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveContactTab('form');
                    setLeadFeedback(null);
                    setIsLeadModalOpen(true);
                  }}
                  className={`relative p-6 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    activeContactTab === 'form'
                      ? 'bg-[#173D2B] text-white border-[#B8954A] shadow-xl ring-2 ring-[#B8954A]/30 scale-[1.02]'
                      : 'bg-white text-neutral-800 border-neutral-200 hover:border-[#B8954A]/60 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                          activeContactTab === 'form'
                            ? 'bg-[#B8954A] text-[#173D2B]'
                            : 'bg-[#173D2B]/10 text-[#173D2B]'
                        }`}
                      >
                        <FileText className="w-6 h-6 text-[#173D2B]" />
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          activeContactTab === 'form'
                            ? 'bg-white/15 text-[#DFC282]'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        Mensagem Detalhada
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`font-serif font-bold text-lg leading-tight ${
                          activeContactTab === 'form' ? 'text-white' : 'text-[#173D2B]'
                        }`}
                      >
                        Formulário de Contato
                      </h3>
                      <p
                        className={`text-xs mt-1.5 leading-relaxed ${
                          activeContactTab === 'form' ? 'text-white/80' : 'text-neutral-600'
                        }`}
                      >
                        Envie suas dúvidas específicas e histórico do familiar para receber retorno completo e personalizado por telefone ou e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-current/15 flex items-center justify-between text-xs font-semibold">
                    <span className={activeContactTab === 'form' ? 'text-[#DFC282]' : 'text-[#B8954A]'}>
                      {activeContactTab === 'form' ? '✓ Clique para Abrir Formulário' : 'Preencher Formulário'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Option 3: WhatsApp */}
                <button
                  type="button"
                  onClick={() => setActiveContactTab('whatsapp')}
                  className={`relative p-6 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    activeContactTab === 'whatsapp'
                      ? 'bg-[#173D2B] text-white border-[#B8954A] shadow-xl ring-2 ring-[#B8954A]/30 scale-[1.02]'
                      : 'bg-white text-neutral-800 border-neutral-200 hover:border-[#B8954A]/60 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                          activeContactTab === 'whatsapp'
                            ? 'bg-[#B8954A] text-[#173D2B]'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        <MessageCircle className="w-6 h-6" />
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                          activeContactTab === 'whatsapp'
                            ? 'bg-white/15 text-[#DFC282]'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online Agora
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`font-serif font-bold text-lg leading-tight ${
                          activeContactTab === 'whatsapp' ? 'text-white' : 'text-[#173D2B]'
                        }`}
                      >
                        WhatsApp Direto
                      </h3>
                      <p
                        className={`text-xs mt-1.5 leading-relaxed ${
                          activeContactTab === 'whatsapp' ? 'text-white/80' : 'text-neutral-600'
                        }`}
                      >
                        Converse em tempo real diretamente com os proprietários. Sem robôs, filas ou intermediários para tirar suas dúvidas imediatas.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-current/15 flex items-center justify-between text-xs font-semibold">
                    <span className={activeContactTab === 'whatsapp' ? 'text-[#DFC282]' : 'text-[#B8954A]'}>
                      {activeContactTab === 'whatsapp' ? '✓ Opção Selecionada' : 'Conversar no WhatsApp'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              </div>

              {/* ========================================================= */}
              {/* Dynamic Content Panel by Active Option */}
              {/* ========================================================= */}

              {/* ------------------------------------------------------- */}
              {/* ABA 1: REUNIÃO VIA GOOGLE MEET (Com envio de e-mail) */}
              {/* ------------------------------------------------------- */}
              {activeContactTab === 'meeting' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                  {/* Left Column: Meeting Details & Info */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-md space-y-6 text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-purple-800 text-xs font-bold">
                        <Video className="w-3.5 h-3.5" />
                        <span>Reunião Online via Google Meet</span>
                      </div>

                      <h3 className="text-2xl font-serif font-bold text-[#173D2B] leading-tight">
                        Conversa por Vídeo com Regina & Roberto
                      </h3>

                      <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                        Sua família terá um momento reservado diretamente com quem idealizou e cuida pessoalmente do Victoria Lar Residencial. Tire dúvidas clínicas, converse sobre planos personalizados e conheça nossa filosofia de acolhimento.
                      </p>

                      <div className="space-y-3.5 pt-2 text-xs">
                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Clock className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Duração Estimada:</strong>
                            <span className="text-neutral-600">{schedulingConfig?.meetingDuration || '30 a 45 minutos'}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Video className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Plataforma Google Meet:</strong>
                            <span className="text-neutral-600">Acesse facilmente pelo celular ou computador sem precisar instalar nada.</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Mail className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Disparo Automático de Confirmação:</strong>
                            <span className="text-neutral-600">Ao confirmar seu agendamento, um e-mail oficial com o link da sala, data e horário é enviado instantaneamente.</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Users className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Atendimento Direto:</strong>
                            <span className="text-neutral-600">Presença confirmada dos sócios-proprietários na videochamada.</span>
                          </div>
                        </div>
                      </div>

                      {/* Owners Mini Photo Callout */}
                      <div className="pt-4 border-t border-neutral-100 flex items-center gap-3">
                        <div className="flex -space-x-3 overflow-hidden">
                          <img
                            src={owner1?.imageUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80'}
                            alt="Regina"
                            className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover"
                          />
                          <img
                            src={owner2?.imageUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80'}
                            alt="Roberto"
                            className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover"
                          />
                        </div>
                        <div className="text-left text-xs">
                          <span className="font-serif font-bold text-neutral-900 block">Regina & Roberto</span>
                          <span className="text-neutral-500 text-[11px]">Sócios-Proprietários à sua disposição</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interactive Meeting Form or Confirmation Card */}
                  <div className="lg:col-span-7">
                    {meetingFeedback?.type === 'success' ? (
                      /* Success Confirmation Box */
                      <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-[#B8954A] shadow-xl text-center space-y-6">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                          <CheckCircle2 className="w-9 h-9" />
                        </div>

                        <div className="space-y-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-full text-emerald-800 text-xs font-bold">
                            ✓ AGENDAMENTO CONFIRMADO
                          </span>
                          <h3 className="font-serif font-bold text-2xl text-[#173D2B]">
                            Sua Reunião foi Agendada com Sucesso!
                          </h3>
                          <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto">
                            {meetingFeedback.message}
                          </p>
                        </div>

                        {/* Meeting summary card */}
                        <div className="bg-[#FAF9F5] border-l-4 border-[#B8954A] rounded-2xl p-6 text-left space-y-3 max-w-lg mx-auto text-xs sm:text-sm">
                          <div>
                            <strong className="text-neutral-900">📅 Data Selecionada:</strong>{' '}
                            <span className="text-[#173D2B] font-bold">{formatDateBR(meetingFeedback.date || '')}</span>
                          </div>
                          <div>
                            <strong className="text-neutral-900">⏰ Horário da Reunião:</strong>{' '}
                            <span className="text-[#173D2B] font-bold">{meetingFeedback.time} (Horário de Brasília)</span>
                          </div>
                          <div>
                            <strong className="text-neutral-900">📹 Sala Virtual:</strong>{' '}
                            <span className="font-mono text-purple-900 font-bold break-all">{meetingFeedback.meetingLink}</span>
                          </div>
                          <div>
                            <strong className="text-neutral-900">✉️ Confirmação Enviada Para:</strong>{' '}
                            <span className="text-neutral-700 font-medium">{meetingFeedback.email}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                          {meetingFeedback.meetingLink && (
                            <a
                              href={meetingFeedback.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 bg-[#173D2B] hover:bg-[#123022] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                            >
                              <Video className="w-4 h-4 text-[#B8954A]" />
                              <span>Entrar na Sala do Google Meet</span>
                              <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (meetingFeedback.meetingLink) {
                                navigator.clipboard.writeText(meetingFeedback.meetingLink);
                                setCopiedLink(true);
                                setTimeout(() => setCopiedLink(false), 3000);
                              }
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-3 px-5 bg-white border border-neutral-300 hover:border-[#B8954A] text-neutral-800 font-semibold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                          >
                            {copiedLink ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="text-emerald-700">Link Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 text-neutral-600" />
                                <span>Copiar Link da Reunião</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setMeetingFeedback(null)}
                            className="text-neutral-500 hover:text-neutral-900 text-xs underline cursor-pointer"
                          >
                            Agendar Outro Horário
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Meeting Intake Form */
                      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-lg text-left">
                        <div className="border-b border-neutral-100 pb-4 mb-6">
                          <h3 className="font-serif font-bold text-[#173D2B] text-xl">
                            Agendar Reunião via Google Meet
                          </h3>
                          <p className="text-xs text-neutral-500 mt-1">
                            Escolha o melhor dia e horário. Ao finalizar, nosso sistema disparará a confirmação diretamente para o seu e-mail com o link de acesso.
                          </p>
                        </div>

                        {meetingFeedback && meetingFeedback.type === 'error' && (
                          <div className="mb-6 p-4 rounded-xl text-xs bg-red-50 border border-red-300 text-red-800 flex items-start gap-2.5">
                            <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                            <span>{meetingFeedback.message}</span>
                          </div>
                        )}

                        <form onSubmit={handleMeetingSubmit} className="space-y-5 text-xs">
                          {/* Honeypot anti-bot protection */}
                          <input
                            type="text"
                            name="honeypot"
                            tabIndex={-1}
                            value={meetingForm.honeypot}
                            onChange={(e) => setMeetingForm({ ...meetingForm, honeypot: e.target.value })}
                            className="hidden"
                            autoComplete="off"
                          />

                          {/* Step 1: Date & Time Selection */}
                          <div className="bg-[#FAF9F5] p-4 sm:p-5 rounded-2xl border border-neutral-200 space-y-4">
                            <span className="font-serif font-bold text-[#173D2B] block text-sm">
                              1. Escolha a Data e o Horário da Reunião
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block font-semibold text-neutral-700 mb-1">
                                  Data Desejada *
                                </label>
                                <input
                                  type="date"
                                  min={todayStr}
                                  required
                                  value={meetingForm.date}
                                  onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#173D2B] text-xs font-medium"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-neutral-700 mb-1">
                                  Horário Selecionado *
                                </label>
                                <input
                                  type="text"
                                  required
                                  readOnly
                                  value={meetingForm.time ? `${meetingForm.time} (Brasília)` : ''}
                                  placeholder="Selecione um dos horários abaixo"
                                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-bold text-[#173D2B] text-xs"
                                />
                              </div>
                            </div>

                            {/* Clickable available time slot chips */}
                            <div>
                              <span className="block font-semibold text-neutral-600 text-[11px] mb-2">
                                Horários Disponíveis para Atendimento:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {availableSlots.map((slot) => {
                                  const isSelected = meetingForm.time === slot;
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => setMeetingForm({ ...meetingForm, time: slot })}
                                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                        isSelected
                                          ? 'bg-[#173D2B] text-white border-[#B8954A] shadow-xs scale-105 ring-2 ring-[#B8954A]/30'
                                          : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#B8954A] hover:bg-neutral-50'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Step 2: Personal and Contact Details */}
                          <div className="space-y-4">
                            <span className="font-serif font-bold text-[#173D2B] block text-sm">
                              2. Seus Dados para Envio do Link por E-mail
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block font-semibold text-neutral-700 mb-1">
                                  Seu Nome Completo *
                                </label>
                                <input
                                  type="text"
                                  required
                                  maxLength={120}
                                  value={meetingForm.name}
                                  onChange={(e) => setMeetingForm({ ...meetingForm, name: e.target.value })}
                                  placeholder="Ex: Carlos Eduardo da Silva"
                                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#173D2B]"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-neutral-700 mb-1">
                                  E-mail para Receber o Link da Reunião *
                                </label>
                                <input
                                  type="email"
                                  required
                                  maxLength={160}
                                  value={meetingForm.email}
                                  onChange={(e) => setMeetingForm({ ...meetingForm, email: e.target.value })}
                                  placeholder="carlos@exemplo.com"
                                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#173D2B]"
                                />
                                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                  A confirmação oficial com o Google Meet será enviada para este endereço.
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block font-semibold text-neutral-700 mb-1">
                                  Telefone / WhatsApp com DDD *
                                </label>
                                <input
                                  type="tel"
                                  required
                                  maxLength={30}
                                  value={meetingForm.phone}
                                  onChange={(e) => setMeetingForm({ ...meetingForm, phone: e.target.value })}
                                  placeholder="(11) 99999-9999"
                                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#173D2B]"
                                />
                              </div>

                              <div>
                                <label className="block font-semibold text-neutral-700 mb-1">
                                  Grau de Parentesco com o Residente
                                </label>
                                <select
                                  value={meetingForm.relationship}
                                  onChange={(e) => setMeetingForm({ ...meetingForm, relationship: e.target.value })}
                                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl"
                                >
                                  <option value="Filho(a)">Filho(a)</option>
                                  <option value="Neto(a)">Neto(a)</option>
                                  <option value="Cônjuge">Cônjuge</option>
                                  <option value="Próprio Residente">Próprio Residente</option>
                                  <option value="Irmão / Irmã">Irmão / Irmã</option>
                                  <option value="Outro">Outro Familiar / Cuidador</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block font-semibold text-neutral-700 mb-1">
                                Assunto Principal da Conversa
                              </label>
                              <select
                                value={meetingForm.serviceInterest}
                                onChange={(e) => setMeetingForm({ ...meetingForm, serviceInterest: e.target.value })}
                                className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl"
                              >
                                <option value="Reunião de Apresentação e Planos">Reunião de Apresentação Geral e Planos</option>
                                <option value="Assistência de Enfermagem 24 Horas">Assistência Clínica e Cuidados de Enfermagem 24 Horas</option>
                                <option value="Hotelaria e Acomodações">Hotelaria, Nutrição e Quartos Adaptados</option>
                                <option value="Fisioterapia e Mobilidade">Reabilitação, Fisioterapia e Mobilidade</option>
                                <option value="Visita Presencial Posterior">Alinhamento Prévio para Visita Presencial</option>
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-neutral-700 mb-1">
                                Observações ou Histórico do Familiar (Opcional)
                              </label>
                              <textarea
                                rows={2}
                                maxLength={1000}
                                value={meetingForm.message}
                                onChange={(e) => setMeetingForm({ ...meetingForm, message: e.target.value })}
                                placeholder="Conte brevemente sobre a rotina ou necessidades especiais do seu familiar para nos prepararmos melhor..."
                                className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-[#173D2B]"
                              />
                            </div>
                          </div>

                          {/* Submit Button */}
                          <button
                            type="submit"
                            disabled={submittingMeeting}
                            className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 bg-[#173D2B] hover:bg-[#123022] text-white font-bold text-xs rounded-xl shadow-md transition-all border border-[#B8954A] hover:scale-[1.01] cursor-pointer disabled:opacity-60"
                          >
                            <Video className="w-4 h-4 text-[#B8954A]" />
                            <span>
                              {submittingMeeting
                                ? 'Processando e Disparando E-mail de Confirmação...'
                                : 'Confirmar Agendamento & Receber E-mail com Link do Google Meet'}
                            </span>
                          </button>

                          <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
                            ✓ Regra do sistema: ao confirmar, um e-mail é disparado imediatamente para o seu e-mail cadastrado contendo data, horário, orientações e o link de acesso ao Google Meet.
                          </p>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------- */}
              {/* ABA 2: FORMULÁRIO DE CONTATO */}
              {/* ------------------------------------------------------- */}
              {activeContactTab === 'form' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                  {/* Left: Contact Info */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-md space-y-6 text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#173D2B]/8 border border-[#173D2B]/15 rounded-full text-[#173D2B] text-xs font-semibold">
                        <span>Canais Institucionais</span>
                      </div>

                      <h3 className="text-2xl font-serif font-bold text-[#173D2B]">
                        Venha Conhecer o Lar de Perto
                      </h3>

                      <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                        Agende uma visita guiada para conhecer nossas instalações, conversar com a equipe clínica e tirar todas as suas dúvidas. Estaremos honrados em recebê-lo.
                      </p>

                      <div className="space-y-3.5 pt-2 text-xs">
                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <MapPin className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Endereço:</strong>
                            <span className="text-neutral-600">{heroContent?.address || 'Alameda das Rosas, 450 - Jardim das Palmeiras, São Paulo - SP'}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Phone className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Telefone Fixo & WhatsApp:</strong>
                            <span className="text-neutral-600">{heroContent?.phone || '(11) 3456-7890'} / {heroContent?.whatsapp || '(11) 98765-4321'}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Clock className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Horário de Visitação Livre:</strong>
                            <span className="text-neutral-600">{heroContent?.visitingHours || 'Segunda a Domingo: 09h00 às 18h00'}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Mail className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">E-mail Institucional:</strong>
                            <span className="text-neutral-600">{heroContent?.email || 'contato@victorialar.com.br'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Clean Action Card to Open Form (Not exposed directly on the page) */}
                  <div className="lg:col-span-7">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-lg text-left space-y-6">
                      <div className="border-b border-neutral-100 pb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#173D2B]/8 border border-[#173D2B]/15 rounded-full text-[#173D2B] text-xs font-semibold mb-3">
                          <FileText className="w-3.5 h-3.5 text-[#B8954A]" />
                          <span>Atendimento & Agendamento</span>
                        </div>
                        <h3 className="font-serif font-bold text-[#173D2B] text-xl sm:text-2xl">
                          Solicitar Informações ou Agendar Visita Presencial
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                          Para maior comodidade e privacidade, nosso formulário completo é aberto ao clicar na opção abaixo. Nossa equipe clínica e os proprietários responderão com prioridade para tirar suas dúvidas e planejar sua visita.
                        </p>
                      </div>

                      {/* Benefits & highlights */}
                      <div className="space-y-3.5 text-xs">
                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Atendimento Humano e Direto:</strong>
                            <span className="text-neutral-600">Sem robôs ou menus complexos. Conversa direta com quem cuida pessoalmente do lar.</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Clock className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Retorno Rápido:</strong>
                            <span className="text-neutral-600">Entramos em contato no mesmo dia por WhatsApp ou ligação telefônica.</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <ShieldCheck className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Privacidade e Sigilo Clínico:</strong>
                            <span className="text-neutral-600">Dados do idoso armazenados com segurança e proteção sob rigoroso sigilo.</span>
                          </div>
                        </div>
                      </div>

                      {/* Prominent Button to Open Form */}
                      <div className="pt-2 space-y-3">
                        <button
                          type="button"
                          onClick={() => setIsLeadModalOpen(true)}
                          className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 bg-[#173D2B] hover:bg-[#123022] text-white font-bold text-sm rounded-2xl shadow-lg transition-all border border-[#B8954A] hover:scale-[1.01] cursor-pointer"
                        >
                          <FileText className="w-5 h-5 text-[#B8954A]" />
                          <span>Preencher Formulário de Contato e Agendamento</span>
                          <ArrowRight className="w-4 h-4 text-[#DFC282]" />
                        </button>

                        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveContactTab('whatsapp')}
                            className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Prefere falar agora? Chame no WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------- */}
              {/* ABA 3: WHATSAPP DIRETO */}
              {/* ------------------------------------------------------- */}
              {activeContactTab === 'whatsapp' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                  {/* Left Column: Direct WhatsApp Presentation */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-md space-y-6 text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-full text-emerald-800 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Atendimento Direto no WhatsApp</span>
                      </div>

                      <h3 className="text-2xl font-serif font-bold text-[#173D2B] leading-tight">
                        Fale Diretamente com Regina & Roberto
                      </h3>

                      <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                        No Victoria Lar, acreditamos no contato próximo e humanizado desde o primeiro momento. Você fala diretamente com quem está no lar todos os dias, sem menus eletrônicos ou robôs.
                      </p>

                      <div className="space-y-3.5 pt-2 text-xs">
                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <MessageCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">WhatsApp Oficial:</strong>
                            <span className="text-neutral-800 font-mono text-sm font-bold">
                              {schedulingConfig?.whatsapp || heroContent?.whatsapp || '(11) 98765-4321'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <Clock className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Horário de Atendimento no WhatsApp:</strong>
                            <span className="text-neutral-600">Segunda a Domingo: 08h00 às 20h00</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF9F5] p-3.5 rounded-2xl border border-neutral-200">
                          <PhoneCall className="w-4 h-4 text-[#B8954A] flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-neutral-900 block">Prefere Ligar no Telefone Fixo?</strong>
                            <span className="text-neutral-600">{heroContent?.phone || '(11) 3456-7890'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Owners Presence */}
                      <div className="pt-4 border-t border-neutral-100 flex items-center gap-3">
                        <div className="flex -space-x-3 overflow-hidden">
                          <img
                            src={owner1?.imageUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80'}
                            alt="Regina"
                            className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover"
                          />
                          <img
                            src={owner2?.imageUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80'}
                            alt="Roberto"
                            className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover"
                          />
                        </div>
                        <div className="text-left text-xs">
                          <span className="font-serif font-bold text-neutral-900 block">Atendimento Pessoal</span>
                          <span className="text-neutral-500 text-[11px]">Regina & Roberto respondem prontamente</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: WhatsApp Interactive Chat Launcher */}
                  <div className="lg:col-span-7">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-lg text-left space-y-6">
                      <div className="border-b border-neutral-100 pb-4">
                        <h3 className="font-serif font-bold text-[#173D2B] text-xl">
                          Iniciar Conversa Imediata no WhatsApp
                        </h3>
                        <p className="text-xs text-neutral-500 mt-1">
                          Você pode personalizar a mensagem inicial abaixo ou enviar o texto pré-configurado com 1 clique.
                        </p>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1.5">
                            Mensagem Inicial Pré-preenchida (editável):
                          </label>
                          <textarea
                            rows={4}
                            value={activeWhatsappMsg}
                            onChange={(e) => setCustomWhatsappMsg(e.target.value)}
                            className="w-full p-3.5 bg-neutral-50 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-[#173D2B] text-xs leading-relaxed"
                          />
                        </div>

                        {/* Quick preset message buttons */}
                        <div>
                          <span className="block font-semibold text-neutral-600 text-[11px] mb-2">
                            Sugestões de Mensagens Rápidas:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {[
                              'Gostaria de agendar uma visita guiada para conhecer a casa.',
                              'Gostaria de saber os valores e planos de acolhimento para idoso.',
                              'Preciso de informações sobre cuidados de enfermagem 24 horas.',
                              'Tenho dúvidas sobre reabilitação e fisioterapia.',
                            ].map((msg, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setCustomWhatsappMsg(msg)}
                                className="text-[11px] p-2 bg-[#FAF9F5] hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-700 transition-colors text-left"
                              >
                                {msg}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Big WhatsApp Action Button */}
                        <div className="pt-4 space-y-3">
                          <a
                            href={`https://wa.me/55${cleanWhatsapp}?text=${encodeURIComponent(activeWhatsappMsg)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all hover:scale-[1.01] cursor-pointer"
                          >
                            <MessageCircle className="w-5 h-5 text-white" />
                            <span>Abrir Conversa no WhatsApp Agora</span>
                            <ExternalLink className="w-4 h-4 text-white/80" />
                          </a>

                          <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
                            <a
                              href={`tel:${(heroContent?.phone || '(11) 3456-7890').replace(/\D/g, '')}`}
                              className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-[#173D2B] font-medium"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#B8954A]" />
                              <span>Ligar para Telefone Fixo</span>
                            </a>
                            <span>•</span>
                            <span className="text-neutral-500 font-mono">
                              WhatsApp: +55 {rawWhatsapp}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ----------------------------------------------------------- */}
      {/* 6. FOOTER */}
      {/* ----------------------------------------------------------- */}
      <footer className="bg-[#173D2B] text-white border-t-2 border-[#B8954A] pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/10 text-xs">
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <VictoriaLogo variant="light" size="md" layout="horizontal" />
              <p className="text-white/70 max-w-sm leading-relaxed">
                Residencial para a terceira idade dedicado a oferecer saúde integrada, conforto de alto padrão e acolhimento humano com dignidade e carinho.
              </p>
              <div className="inline-flex items-center gap-2 text-[11px] text-[#B8954A] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-[#B8954A]" />
                <span>Cuidado Humanizado & Assistência Multidisciplinar</span>
              </div>
            </div>

            {/* Quick links */}
            <div className="space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#B8954A] uppercase tracking-wider">
                Navegação
              </h4>
              <ul className="space-y-2 text-white/80">
                <li>
                  <a href="#hero" className="hover:text-[#B8954A] transition-colors">
                    Início
                  </a>
                </li>
                <li>
                  <a href="#sobre" className="hover:text-[#B8954A] transition-colors">
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#servicos" className="hover:text-[#B8954A] transition-colors">
                    Nossos Serviços
                  </a>
                </li>
                <li>
                  <a href="#diferenciais" className="hover:text-[#B8954A] transition-colors">
                    Estrutura & Cuidado
                  </a>
                </li>
                <li>
                  <a href="#contato" className="hover:text-[#B8954A] transition-colors">
                    Agende uma Visita
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact & Hours */}
            <div className="space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#B8954A] uppercase tracking-wider">
                Atendimento
              </h4>
              <div className="space-y-2 text-white/80">
                <p>
                  <strong className="text-white block font-medium">Horário de Visitas:</strong>
                  {heroContent?.visitingHours || 'Segunda a Domingo: 09h00 às 18h00'}
                </p>
                <p>
                  <strong className="text-white block font-medium">Telefone & WhatsApp:</strong>
                  {heroContent?.phone || '(11) 3456-7890'} / {heroContent?.whatsapp || '(11) 98765-4321'}
                </p>
                <p>
                  <strong className="text-white block font-medium">Localização:</strong>
                  {heroContent?.address || 'Alameda das Rosas, 450 - SP'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-white/60 gap-4">
            <div>
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="hover:text-[#B8954A] cursor-pointer transition-colors inline-block select-none font-sans font-semibold px-0.5"
                title="Acesso Administrativo (Atalho: Ctrl+Shift+A ou clique no ©)"
                aria-label="Acesso Administrativo (Atalho: Ctrl+Shift+A ou clique no ©)"
              >
                ©
              </button>{' '}
              {new Date().getFullYear()} Victoria Lar Residencial. Todos os direitos reservados.
            </div>
            <div className="flex items-center gap-4">
              <span>Acolhimento, dignidade e respeito em cada detalhe.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Dedicated Contact & Visit Lead Modal */}
      <ContactLeadModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        initialServiceInterest={leadModalService}
        institutionalContent={content}
      />
    </div>
  );
};
