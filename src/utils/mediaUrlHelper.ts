/**
 * Helper para validação, detecção e resolução segura de URLs de mídia (fotos e vídeos)
 * Suporta:
 * - Imagens diretas (JPG, PNG, WebP, SVG, AVIF, Firebase Storage, Google Cloud Storage)
 * - Google Drive (fotos via thumbnail/lh3 e vídeos via /preview com aviso de compartilhamento público)
 * - YouTube (links comuns, youtu.be, shorts, embed)
 * - Vimeo (vimeo.com, player.vimeo.com)
 * - Vídeos diretos HTML5 (MP4, WebM, OGG, MOV, M4V)
 */

export type MediaType = 'image' | 'video';

export type MediaProvider =
  | 'youtube'
  | 'vimeo'
  | 'google-drive'
  | 'direct-video'
  | 'direct-image'
  | 'unknown';

export interface ParsedMedia {
  isValid: boolean;
  rawUrl: string;
  mediaType: MediaType;
  provider: MediaProvider;
  providerLabel: string;
  embedUrl?: string;
  streamUrl?: string;
  directUrl: string;
  thumbnailUrl?: string;
  isDirectVideo?: boolean;
  warning?: string;
  errorMessage?: string;
}

const YOUTUBE_REGEXES = [
  /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
];

const VIMEO_REGEX = /(?:vimeo\.com\/(?:video\/|channels\/(?:\w+\/)?|groups\/[^\/]+\/videos\/|album\/(?:\d+)\/video\/|))(\d+)/i;

const GOOGLE_DRIVE_REGEXES = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
  /drive\.google\.com\/(?:uc|open)\?.*id=([a-zA-Z0-9_-]+)/i,
];

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.avif', '.bmp'];

/**
 * Verifica se a URL aponta diretamente para um arquivo de vídeo suportado
 */
export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    const pathname = parsed.pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Verifica se a URL aponta diretamente para um arquivo de imagem suportado
 */
export function isDirectImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    const pathname = parsed.pathname.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.includes('firebasestorage.googleapis.com') || hostname.includes('storage.googleapis.com')) {
      return true;
    }
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Retorna uma URL segura de incorporação (YouTube/Vimeo/Google Drive) ou null
 */
export function getSafeEmbedUrl(url: string): string | null {
  const parsed = parseMediaUrl(url, 'video');
  return parsed.isValid && parsed.embedUrl ? parsed.embedUrl : null;
}

/**
 * Analisa e valida uma URL de mídia, detectando provedor e formato adequado de exibição.
 */
export function parseMediaUrl(inputUrl: string, manualType?: MediaType): ParsedMedia {
  const trimmed = (inputUrl || '').trim();

  if (!trimmed) {
    return {
      isValid: false,
      rawUrl: '',
      mediaType: manualType || 'image',
      provider: 'unknown',
      providerLabel: 'Desconhecido',
      embedUrl: undefined,
      streamUrl: undefined,
      directUrl: '',
      errorMessage: 'Por favor, informe a URL da foto ou vídeo.',
    };
  }

  // Previne injeção de esquemas inseguros (javascript:, data:, vbscript:)
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return {
      isValid: false,
      rawUrl: trimmed,
      mediaType: manualType || 'image',
      provider: 'unknown',
      providerLabel: 'Inseguro',
      directUrl: '',
      errorMessage: 'Protocolo não permitido por razões de segurança.',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      rawUrl: trimmed,
      mediaType: manualType || 'image',
      provider: 'unknown',
      providerLabel: 'URL Inválida',
      directUrl: '',
      errorMessage: 'URL inválida. Certifique-se de incluir "https://" no início do endereço.',
    };
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return {
      isValid: false,
      rawUrl: trimmed,
      mediaType: manualType || 'image',
      provider: 'unknown',
      providerLabel: 'Protocolo Não Suportado',
      directUrl: '',
      errorMessage: 'Protocolo não suportado. Apenas URLs com "https://" são aceitas.',
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  // 1. YouTube
  for (const regex of YOUTUBE_REGEXES) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      const videoId = match[1];
      const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return {
        isValid: true,
        rawUrl: trimmed,
        mediaType: 'video',
        provider: 'youtube',
        providerLabel: 'YouTube',
        embedUrl,
        streamUrl: embedUrl,
        directUrl: trimmed,
        thumbnailUrl,
        isDirectVideo: false,
        warning:
          manualType === 'image'
            ? 'Este link é de um vídeo do YouTube. O tipo foi ajustado automaticamente para "Vídeo".'
            : undefined,
      };
    }
  }

  // 2. Vimeo
  const vimeoMatch = trimmed.match(VIMEO_REGEX);
  if (vimeoMatch && vimeoMatch[1]) {
    const videoId = vimeoMatch[1];
    const embedUrl = `https://player.vimeo.com/video/${videoId}`;
    return {
      isValid: true,
      rawUrl: trimmed,
      mediaType: 'video',
      provider: 'vimeo',
      providerLabel: 'Vimeo',
      embedUrl,
      streamUrl: embedUrl,
      directUrl: trimmed,
      isDirectVideo: false,
      warning:
        manualType === 'image'
          ? 'Este link é de um vídeo do Vimeo. O tipo foi ajustado para "Vídeo".'
          : undefined,
    };
  }

  // 3. Google Drive
  for (const regex of GOOGLE_DRIVE_REGEXES) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      const fileId = match[1];
      const isVideo = manualType === 'video';

      if (isVideo) {
        return {
          isValid: true,
          rawUrl: trimmed,
          mediaType: 'video',
          provider: 'google-drive',
          providerLabel: 'Google Drive (Vídeo)',
          embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          streamUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          directUrl: trimmed,
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`,
          isDirectVideo: false,
          warning:
            'Atenção ao Google Drive: Certifique-se de que o arquivo esteja compartilhado publicamente ("Qualquer pessoa com o link pode ver").',
        };
      }

      // Imagem do Google Drive: usa serviço de thumbnail de alta resolução e visualizador direto
      return {
        isValid: true,
        rawUrl: trimmed,
        mediaType: 'image',
        provider: 'google-drive',
        providerLabel: 'Google Drive (Foto)',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        streamUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
        directUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`,
        isDirectVideo: false,
        warning:
          'Atenção ao Google Drive: O arquivo precisa estar configurado como público ("Qualquer pessoa com o link pode ver") para ser exibido aos visitantes.',
      };
    }
  }

  // 4. Arquivos de Vídeo Diretos (HTML5)
  const isVideoFile = VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  if (isVideoFile || manualType === 'video') {
    return {
      isValid: true,
      rawUrl: trimmed,
      mediaType: 'video',
      provider: isVideoFile ? 'direct-video' : 'unknown',
      providerLabel: isVideoFile ? 'Vídeo Direto (HTML5)' : 'Vídeo Externo',
      embedUrl: undefined,
      streamUrl: trimmed,
      directUrl: trimmed,
      isDirectVideo: true,
      warning:
        'Vídeo direto: O servidor de hospedagem precisa permitir reprodução externa e requisições CORS.',
    };
  }

  // 5. Arquivos de Imagem Diretos / Firebase Storage
  const isImageFile = IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  const isFirebaseStorage =
    hostname.includes('firebasestorage.googleapis.com') ||
    hostname.includes('storage.googleapis.com');

  if (isImageFile || isFirebaseStorage || manualType === 'image') {
    return {
      isValid: true,
      rawUrl: trimmed,
      mediaType: 'image',
      provider: isFirebaseStorage ? 'direct-image' : isImageFile ? 'direct-image' : 'unknown',
      providerLabel: isFirebaseStorage ? 'Firebase Storage' : isImageFile ? 'Imagem Direta' : 'Imagem Externa',
      embedUrl: undefined,
      streamUrl: trimmed,
      directUrl: trimmed,
      thumbnailUrl: trimmed,
      isDirectVideo: false,
    };
  }

  // 6. Provedores não recomendados (páginas genéricas de redes sociais sem entrega direta)
  if (
    hostname.includes('facebook.com') ||
    hostname.includes('instagram.com') ||
    hostname.includes('tiktok.com') ||
    hostname.includes('twitter.com') ||
    hostname.includes('x.com')
  ) {
    return {
      isValid: false,
      rawUrl: trimmed,
      mediaType: manualType || 'image',
      provider: 'unknown',
      providerLabel: 'Rede Social',
      embedUrl: undefined,
      streamUrl: undefined,
      directUrl: '',
      isDirectVideo: false,
      errorMessage:
        'Páginas de redes sociais não entregam o arquivo de foto ou vídeo diretamente. Use YouTube, Vimeo, Google Drive ou link direto.',
    };
  }

  // Fallback permissivo para URLs HTTPS genéricas: assume o tipo selecionado ou 'image'
  return {
    isValid: true,
    rawUrl: trimmed,
    mediaType: manualType || 'image',
    provider: 'unknown',
    providerLabel: manualType === 'video' ? 'Vídeo Web' : 'Imagem Web',
    embedUrl: manualType === 'video' ? trimmed : undefined,
    streamUrl: trimmed,
    directUrl: trimmed,
    thumbnailUrl: trimmed,
    isDirectVideo: manualType === 'video',
    warning:
      'Link externo genérico: Verifique se o endereço entrega o arquivo de mídia diretamente aos navegadores.',
  };
}

/**
 * Retorna o endereço otimizado para exibição (incorporação ou imagem direta)
 */
export function resolveMediaDisplayUrl(url: string, mediaType?: MediaType): {
  type: MediaType;
  displayUrl: string;
  provider: MediaProvider;
  thumbnailUrl?: string;
} {
  const parsed = parseMediaUrl(url, mediaType);
  return {
    type: parsed.mediaType,
    displayUrl: parsed.streamUrl || parsed.embedUrl || parsed.directUrl || url,
    provider: parsed.provider,
    thumbnailUrl: parsed.thumbnailUrl,
  };
}
