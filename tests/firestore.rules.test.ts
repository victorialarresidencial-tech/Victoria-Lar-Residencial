/**
 * Test Runner: Verification of Security Model, Access Control, and The Dirty Dozen Payloads
 * Victoria Lar Residencial — Comprehensive Positive & Negative Test Suite
 */

interface MockUserContext {
  uid: string | null;
  email?: string;
  emailVerified?: boolean;
}

interface MockStoreState {
  admins: Record<string, { uid: string; email: string; role: string; active: boolean }>;
  services: Record<string, { id: string; title: string; status: string; order: number; summary: string }>;
  content: Record<string, { key: string; title: string; body?: string }>;
  leads: Record<string, { id: string; name: string; phone: string; status: string; email?: string; notes?: string; meetingLink?: string }>;
  bootstrap: { status: string; lockedPermanently: boolean; superAdminUid: string };
  superAdminGuard: { activeSuperAdminCount: number; activeSuperAdminUids: string[]; version: number };
  auditLogs: Record<string, { id: string; action: string; performedByUid: string; timestamp: string }>;
  albums: Record<string, { id: string; title: string; topicKey: string; status: string }>;
  photos: Record<string, { id: string; albumId: string; url: string; published: boolean; order: number; altText: string }>;
}

class FirestoreRulesSimulator {
  public state: MockStoreState = {
    admins: {
      'sa_victoria': { uid: 'sa_victoria', email: 'victorialarresidencial@gmail.com', role: 'superadmin', active: true },
      'adm_normal': { uid: 'adm_normal', email: 'enfermeira@victorialar.com.br', role: 'admin', active: true },
      'admin_revoked': { uid: 'admin_revoked', email: 'ex_gestor@victorialar.com.br', role: 'admin', active: false },
    },
    services: {
      'published_care': {
        id: 'published_care',
        title: 'Assistência de Enfermagem 24 Horas',
        status: 'published',
        order: 1,
        summary: 'Equipe de enfermagem qualificada presente em tempo integral.'
      },
      'draft_project': {
        id: 'draft_project',
        title: 'Novo Pavilhão Jardim das Flores',
        status: 'draft',
        order: 99,
        summary: 'Projeto de ampliação em desenvolvimento.'
      }
    },
    content: {
      'hero': {
        key: 'hero',
        title: 'Acolhimento, Cuidado Humanizado e Dignidade para a Terceira Idade',
        body: 'Texto descritivo institucional oficial.'
      },
      'about': {
        key: 'about',
        title: 'História da Victoria Lar Residencial',
        body: 'Mais de 15 anos proporcionando conforto e carinho para a terceira idade.'
      },
      'internal_admin_notes': {
        key: 'internal_admin_notes',
        title: 'Notas Confidenciais da Diretoria',
        body: 'Documento interno reservado exclusivamente para administradores.'
      }
    },
    leads: {
      'lead_1': {
        id: 'lead_1',
        name: 'Maria Fernandes',
        phone: '(11) 98765-4321',
        status: 'unread'
      }
    },
    bootstrap: {
      status: 'COMPLETED',
      lockedPermanently: true,
      superAdminUid: 'sa_victoria'
    },
    superAdminGuard: {
      activeSuperAdminCount: 1,
      activeSuperAdminUids: ['sa_victoria'],
      version: 1
    },
    auditLogs: {
      'log_1': {
        id: 'log_1',
        action: 'BOOTSTRAP_INITIAL_SEALED',
        performedByUid: 'sa_victoria',
        timestamp: '2026-10-20T12:00:00.000Z'
      }
    },
    albums: {
      'quartos-seguros': {
        id: 'quartos-seguros',
        title: 'Quartos seguros',
        topicKey: 'quartos-seguros',
        status: 'published'
      },
      'jardins-area-verde': {
        id: 'jardins-area-verde',
        title: 'Jardins & Área Verde',
        topicKey: 'jardins-area-verde',
        status: 'published'
      },
      'album_draft': {
        id: 'album_draft',
        title: 'Nova Ala em Construção (Rascunho)',
        topicKey: 'nova-ala',
        status: 'draft'
      }
    },
    photos: {
      'photo_pub_1': {
        id: 'photo_pub_1',
        albumId: 'quartos-seguros',
        url: 'https://images.unsplash.com/photo-suite-1.jpg',
        published: true,
        order: 1,
        altText: 'Quarto com cama regulável e barras de apoio',
      },
      'photo_draft_1': {
        id: 'photo_draft_1',
        albumId: 'quartos-seguros',
        url: 'https://images.unsplash.com/photo-suite-draft.jpg',
        published: false,
        order: 2,
        altText: 'Foto em revisão técnica pela equipe médica',
      },
      'photo_in_draft_album': {
        id: 'photo_in_draft_album',
        albumId: 'album_draft',
        url: 'https://images.unsplash.com/photo-draft-album.jpg',
        published: true,
        order: 1,
        altText: 'Foto em álbum rascunho',
      }
    }
  };

  private isValidId(id: string): boolean {
    return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
  }

  // Strict database active check: NO email-only bypass!
  private isActiveAdmin(auth: MockUserContext | null): boolean {
    if (!auth || !auth.uid) return false;
    const admin = this.state.admins[auth.uid];
    return admin !== undefined && admin.active === true;
  }

  private isSuperAdmin(auth: MockUserContext | null): boolean {
    if (!this.isActiveAdmin(auth)) return false;
    return this.state.admins[auth!.uid!].role === 'superadmin';
  }

  private isPublicContentKey(key: string): boolean {
    return ['hero', 'about', 'values', 'owner_1', 'owner_2', 'scheduling'].includes(key) ||
      /^album_[a-zA-Z0-9_\-]+$/.test(key);
  }

  // Evaluate single get
  evalGet(auth: MockUserContext | null, path: string): { allowed: boolean; reason?: string } {
    const parts = path.split('/');
    const coll = parts[0];
    const docId = parts[1];

    if (!this.isValidId(docId)) {
      return { allowed: false, reason: 'INVALID_PATH_ID' };
    }

    if (coll === 'services') {
      const doc = this.state.services[docId];
      if (!doc) return { allowed: false, reason: 'NOT_FOUND' };
      if (doc.status === 'published' || this.isActiveAdmin(auth)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED_DRAFT_RESTRICTED' };
    }

    if (coll === 'content') {
      // Public visitors can only get published institutional keys; internal configs/drafts are protected!
      if (this.isPublicContentKey(docId) || this.isActiveAdmin(auth)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED_INTERNAL_CONTENT_PROTECTED' };
    }

    if (coll === 'leads') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_PII_GUARD' };
    }

    if (coll === 'admins') {
      if (auth && auth.uid === docId) return { allowed: true };
      if (this.isSuperAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_ADMIN_GUARD' };
    }

    if (coll === 'auditLogs') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_GUARD' };
    }

    if (coll === 'system') {
      if (docId === 'bootstrap') return { allowed: true };
      if (docId === 'superAdminGuard') {
        if (this.isActiveAdmin(auth)) return { allowed: true };
        return { allowed: false, reason: 'PERMISSION_DENIED_GUARD_RESTRICTED' };
      }
    }

    if (coll === 'albums') {
      if (parts.length === 2) {
        const album = this.state.albums[docId];
        if (!album) return { allowed: false, reason: 'NOT_FOUND' };
        if (album.status === 'published' || this.isActiveAdmin(auth)) return { allowed: true };
        return { allowed: false, reason: 'PERMISSION_DENIED_ALBUM_DRAFT_RESTRICTED' };
      }
      if (parts.length === 4 && parts[2] === 'photos') {
        const photoId = parts[3];
        if (!this.isValidId(photoId)) return { allowed: false, reason: 'INVALID_PATH_ID' };
        const photo = this.state.photos[photoId];
        if (!photo) return { allowed: false, reason: 'NOT_FOUND' };
        if (this.isActiveAdmin(auth)) return { allowed: true };
        // Public visitor: photo must be published AND parent album must be published!
        const parentAlbum = this.state.albums[docId];
        if (photo.published && parentAlbum && parentAlbum.status === 'published') {
          return { allowed: true };
        }
        return { allowed: false, reason: 'PERMISSION_DENIED_PHOTO_DRAFT_OR_UNPUBLISHED_ALBUM' };
      }
    }

    return { allowed: false, reason: 'PERMISSION_DENIED_DEFAULT_DENY' };
  }

  // Evaluate list queries (Rules are not filters!)
  evalList(auth: MockUserContext | null, collection: string, filters: { field: string; op: string; value: any }[]): { allowed: boolean; reason?: string } {
    if (collection === 'services') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      const hasPublishedFilter = filters.some(f => f.field === 'status' && f.op === '==' && f.value === 'published');
      if (hasPublishedFilter) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_QUERY_NOT_FILTERED' };
    }

    if (collection.startsWith('albums') && collection.endsWith('/photos')) {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      const hasPublishedFilter = filters.some(f => f.field === 'published' && f.op === '==' && f.value === true);
      if (hasPublishedFilter) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_QUERY_NOT_FILTERED' };
    }

    if (collection === 'albums') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      const hasPublishedFilter = filters.some(f => f.field === 'status' && f.op === '==' && f.value === 'published');
      if (hasPublishedFilter) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_ALBUMS_UNFILTERED' };
    }

    if (collection === 'content') {
      // List on /content is restricted to active admins to protect internal configurations
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_CONTENT_LIST_RESTRICTED' };
    }

    if (collection === 'leads' || collection === 'admins' || collection === 'auditLogs') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_LIST_RESTRICTED' };
    }

    return { allowed: false, reason: 'PERMISSION_DENIED_DEFAULT_DENY' };
  }

  // Evaluate write
  evalWrite(auth: MockUserContext | null, path: string, incomingData: Record<string, any>, operation: 'create' | 'update' | 'delete'): { allowed: boolean; reason?: string } {
    const parts = path.split('/');
    const coll = parts[0];
    const docId = parts[1];

    if (!this.isValidId(docId)) {
      return { allowed: false, reason: 'INVALID_PATH_ID' };
    }

    if (coll === 'albums') {
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_ACTIVE_ADMIN' };
      if (parts.length === 4 && parts[2] === 'photos') {
        const photoId = parts[3];
        if (!this.isValidId(photoId)) return { allowed: false, reason: 'INVALID_PATH_ID' };
        if (operation === 'delete') return { allowed: true };
        const allowedPhotoKeys = ['id', 'albumId', 'url', 'mediaType', 'storagePath', 'title', 'caption', 'altText', 'order', 'published', 'createdAt', 'updatedAt', 'updatedBy'];
        const hasGhost = Object.keys(incomingData).some(k => !allowedPhotoKeys.includes(k));
        if (hasGhost) return { allowed: false, reason: 'PERMISSION_DENIED_GHOST_FIELD' };
        if (incomingData.mediaType && !['image', 'video'].includes(incomingData.mediaType)) {
          return { allowed: false, reason: 'PERMISSION_DENIED_INVALID_MEDIA_TYPE' };
        }
        if (incomingData.title && incomingData.title.length > 150) {
          return { allowed: false, reason: 'PERMISSION_DENIED_STRING_OVERFLOW' };
        }
        return { allowed: true };
      }
      return { allowed: true };
    }

    if (coll === 'services') {
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_ACTIVE_ADMIN' };
      if (operation === 'delete') return { allowed: true };
      const allowedKeys = ['id', 'title', 'summary', 'description', 'icon', 'category', 'order', 'status', 'highlight', 'createdAt', 'updatedAt', 'updatedBy'];
      const incomingKeys = Object.keys(incomingData);
      const hasGhostField = incomingKeys.some(k => !allowedKeys.includes(k));
      if (hasGhostField) return { allowed: false, reason: 'PERMISSION_DENIED_GHOST_FIELD' };

      if (incomingData.title && incomingData.title.length > 150) {
        return { allowed: false, reason: 'PERMISSION_DENIED_STRING_OVERFLOW' };
      }
      if (operation === 'update') {
        const existing = this.state.services[docId];
        if (existing && incomingData.id && incomingData.id !== existing.id) {
          return { allowed: false, reason: 'PERMISSION_DENIED_IMMUTABLE_FIELD' };
        }
      }
      return { allowed: true };
    }

    if (coll === 'content') {
      if (operation === 'delete') return { allowed: false, reason: 'PERMISSION_DENIED_CONTENT_CANNOT_BE_DELETED' };
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_ACTIVE_ADMIN' };
      return { allowed: true };
    }

    if (coll === 'leads') {
      if (operation === 'delete') {
        if (!this.isSuperAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_DELETE_REQUIRES_SUPERADMIN' };
        return { allowed: true };
      }
      if (operation === 'update') {
        if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_LEAD_TAMPERING' };
        return { allowed: true };
      }
      // CREATE LEAD:
      if (this.isActiveAdmin(auth)) return { allowed: true };

      // Privilege escalation guards:
      if ('notes' in incomingData) {
        return { allowed: false, reason: 'PERMISSION_DENIED_PUBLIC_LEAD_CANNOT_SET_NOTES' };
      }
      if ('meetingLink' in incomingData) {
        return { allowed: false, reason: 'PERMISSION_DENIED_PUBLIC_LEAD_CANNOT_SET_MEETING_LINK' };
      }

      // Public visitor validation (isValidPublicLead):
      const allowedPublicKeys = ['id', 'name', 'phone', 'email', 'relationship', 'serviceInterest', 'message', 'status', 'type', 'createdAt', 'scheduledDate', 'scheduledTime'];
      const incomingKeys = Object.keys(incomingData);
      const hasGhost = incomingKeys.some(k => !allowedPublicKeys.includes(k));
      if (hasGhost) return { allowed: false, reason: 'PERMISSION_DENIED_PUBLIC_LEAD_FORBIDDEN_FIELDS' };
      if (incomingData.status !== 'unread') {
        return { allowed: false, reason: 'PERMISSION_DENIED_PUBLIC_LEAD_MUST_BE_UNREAD' };
      }
      if (!incomingData.name || typeof incomingData.name !== 'string' || incomingData.name.length > 120) {
        return { allowed: false, reason: 'PERMISSION_DENIED_INVALID_NAME' };
      }
      if (!incomingData.phone || typeof incomingData.phone !== 'string' || incomingData.phone.length > 30) {
        return { allowed: false, reason: 'PERMISSION_DENIED_INVALID_PHONE' };
      }
      return { allowed: true };
    }

    if (coll === 'system' && docId === 'bootstrap') {
      // Immutable to client writes: only server trusted operation can write
      return { allowed: false, reason: 'PERMISSION_DENIED_BOOTSTRAP_SEALED' };
    }

    if (coll === 'system' && docId === 'superAdminGuard') {
      if (!this.isSuperAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_SUPERADMIN' };
      if (incomingData.activeSuperAdminCount < 1) {
        return { allowed: false, reason: 'PERMISSION_DENIED_CANNOT_ZERO_SUPERADMINS' };
      }
      return { allowed: true };
    }

    if (coll === 'admins') {
      if (!this.isSuperAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_SUPERADMIN' };
      return { allowed: true };
    }

    if (coll === 'auditLogs') {
      if (operation === 'delete' || operation === 'update') {
        return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_LOG_IMMUTABLE' };
      }
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_LOG_TAMPERING' };
      if (incomingData.performedByUid !== auth?.uid) {
        return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_ACTOR_SPOOF' };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: 'PERMISSION_DENIED_DEFAULT_DENY' };
  }
}

async function runSecurityAuditTests() {
  console.log('================================================================');
  console.log('VICTORIA LAR RESIDENCIAL — AUDITORIA DE REGRAS DE SEGURANÇA');
  console.log('Executando bateria de testes negativos (Dirty Dozen) e positivos');
  console.log('================================================================\n');

  const sim = new FirestoreRulesSimulator();
  let passed = 0;
  let failed = 0;

  function assertNegative(name: string, result: { allowed: boolean; reason?: string }, expectedReasonSubstr?: string) {
    if (!result.allowed) {
      if (expectedReasonSubstr && (!result.reason || !result.reason.includes(expectedReasonSubstr))) {
        console.error(`  [FAIL] ${name} -> Rejeitado por motivo diferente do esperado. Obtido: ${result.reason}`);
        failed++;
      } else {
        console.log(`  [PASS] ${name} -> REJEITADO CORRETAMENTE (${result.reason})`);
        passed++;
      }
    } else {
      console.error(`  [FAIL] ${name} -> FALHA CRÍTICA DE SEGURANÇA! A operação foi indevidamente permitida!`);
      failed++;
    }
  }

  function assertPositive(name: string, result: { allowed: boolean; reason?: string }) {
    if (result.allowed) {
      console.log(`  [PASS] ${name} -> AUTORIZADO COM SUCESSO`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} -> BLOQUEIO LEGÍTIMO INDEVIDO! Motivo: ${result.reason}`);
      failed++;
    }
  }

  console.log('--- FASE 4.1: TESTES NEGATIVOS — GESTÃO DE ADMINISTRADORES E BOOTSTRAP ---');

  // 1. Visitante não consegue criar administrador
  assertNegative(
    '01. Visitante anônimo tenta criar documento em /admins/{uid}',
    sim.evalWrite(null, 'admins/hacker_1', { uid: 'hacker_1', email: 'hacker@evil.com', role: 'superadmin', active: true }, 'create'),
    'NOT_SUPERADMIN'
  );

  // 2. Usuário autenticado comum não consegue conceder privilégios a si mesmo
  assertNegative(
    '02. Usuário comum autenticado tenta conceder a si mesmo privilégio de superadmin',
    sim.evalWrite({ uid: 'user_regular' }, 'admins/user_regular', { uid: 'user_regular', email: 'regular@gmail.com', role: 'superadmin', active: true }, 'create'),
    'NOT_SUPERADMIN'
  );

  // 3. Administrador comum não consegue executar operações exclusivas do superadministrador
  assertNegative(
    '03. Administrador comum tenta alterar permissão de outro administrador em /admins',
    sim.evalWrite({ uid: 'adm_normal' }, 'admins/sa_victoria', { role: 'admin' }, 'update'),
    'NOT_SUPERADMIN'
  );

  // 4. Administrador comum tenta excluir outro administrador
  assertNegative(
    '04. Administrador comum tenta excluir administrador de /admins',
    sim.evalWrite({ uid: 'adm_normal' }, 'admins/admin_revoked', {}, 'delete'),
    'NOT_SUPERADMIN'
  );

  // 5. Tentativa de sobrescrita do bootstrap selado
  assertNegative(
    '05. Tentativa de sobrescrita do documento selado /system/bootstrap por usuário autenticado',
    sim.evalWrite({ uid: 'user_regular' }, 'system/bootstrap', { status: 'UNINITIALIZED', lockedPermanently: false }, 'update'),
    'BOOTSTRAP_SEALED'
  );

  // 6. Tentativa de zerar superadministradores no guard
  assertNegative(
    '06. Superadmin tenta zerar contador de superadministradores ativos no guard',
    sim.evalWrite({ uid: 'sa_victoria' }, 'system/superAdminGuard', { activeSuperAdminCount: 0, activeSuperAdminUids: [], version: 2 }, 'update'),
    'CANNOT_ZERO_SUPERADMINS'
  );

  console.log('\n--- FASE 4.2: TESTES NEGATIVOS — ADMINISTRADOR DESATIVADO E TOKEN REVOGADO ---');

  // 7. Administrador desativado tenta ler serviços em rascunho
  assertNegative(
    '07. Administrador desativado tenta ler serviço em rascunho (/services/draft_project)',
    sim.evalGet({ uid: 'admin_revoked' }, 'services/draft_project'),
    'DRAFT_RESTRICTED'
  );

  // 8. Administrador desativado tenta gravar em serviços
  assertNegative(
    '08. Administrador desativado tenta atualizar serviço institucional',
    sim.evalWrite({ uid: 'admin_revoked' }, 'services/published_care', { title: 'Alteração Indevida' }, 'update'),
    'NOT_ACTIVE_ADMIN'
  );

  // 9. Administrador desativado tenta ler lista de leads privados
  assertNegative(
    '09. Administrador desativado tenta consultar lista de leads confidenciais (/leads)',
    sim.evalList({ uid: 'admin_revoked' }, 'leads', []),
    'LIST_RESTRICTED'
  );

  // 10. Administrador desativado tenta alterar conteúdo institucional
  assertNegative(
    '10. Administrador desativado tenta alterar conteúdo institucional (/content/hero)',
    sim.evalWrite({ uid: 'admin_revoked' }, 'content/hero', { title: 'Alterado' }, 'update'),
    'NOT_ACTIVE_ADMIN'
  );

  console.log('\n--- FASE 4.3: TESTES NEGATIVOS — LEADS, PII E CONTEÚDO RESTRITO ---');

  // 11. Visitante tenta ler lead individual
  assertNegative(
    '11. Visitante anônimo tenta ler dados confidenciais de lead (/leads/lead_1)',
    sim.evalGet(null, 'leads/lead_1'),
    'PII_GUARD'
  );

  // 12. Visitante tenta listar leads confidenciais
  assertNegative(
    '12. Visitante anônimo tenta listar coleção inteira de leads (/leads)',
    sim.evalList(null, 'leads', []),
    'LIST_RESTRICTED'
  );

  // 13. Visitante tenta ler conteúdo interno restrito
  assertNegative(
    '13. Visitante anônimo tenta ler notas internas administrativas em /content/internal_admin_notes',
    sim.evalGet(null, 'content/internal_admin_notes'),
    'INTERNAL_CONTENT_PROTECTED'
  );

  // 14. Visitante tenta listar toda a coleção /content
  assertNegative(
    '14. Visitante tenta listar todos os documentos de /content sem autenticação administrativa',
    sim.evalList(null, 'content', []),
    'CONTENT_LIST_RESTRICTED'
  );

  // 15. Visitante tenta injetar campo privileged `notes` no lead público
  assertNegative(
    '15. Visitante tenta injetar campo "notes" (notas internas) no formulário público',
    sim.evalWrite(null, 'leads/lead_inj_1', {
      id: 'lead_inj_1',
      name: 'Visitante Curioso',
      phone: '11999998888',
      status: 'unread',
      notes: 'Nota interna forjada pelo cliente'
    }, 'create'),
    'CANNOT_SET_NOTES'
  );

  // 16. Visitante tenta injetar link de reunião arbitrário no lead público
  assertNegative(
    '16. Visitante tenta forjar "meetingLink" com link de phishing no lead público',
    sim.evalWrite(null, 'leads/lead_inj_2', {
      id: 'lead_inj_2',
      name: 'Visitante Phishing',
      phone: '11999998888',
      status: 'unread',
      meetingLink: 'https://site-malicioso.com/phishing'
    }, 'create'),
    'CANNOT_SET_MEETING_LINK'
  );

  // 17. Visitante tenta criar lead com status administrativo 'scheduled' ou 'contacted'
  assertNegative(
    '17. Visitante tenta definir status direto como "scheduled" sem passar pelo fluxo backend',
    sim.evalWrite(null, 'leads/lead_inj_3', {
      id: 'lead_inj_3',
      name: 'Visitante Status',
      phone: '11999998888',
      status: 'scheduled'
    }, 'create'),
    'MUST_BE_UNREAD'
  );

  console.log('\n--- FASE 4.4: TESTES NEGATIVOS — ÁLBUNS E MÍDIAS OCULTAS ---');

  // 18. Visitante tenta acessar álbum em rascunho
  assertNegative(
    '18. Visitante anônimo tenta acessar álbum não publicado (/albums/album_draft)',
    sim.evalGet(null, 'albums/album_draft'),
    'ALBUM_DRAFT_RESTRICTED'
  );

  // 19. Visitante tenta acessar foto em rascunho de álbum publicado
  assertNegative(
    '19. Visitante anônimo tenta acessar foto não publicada (/albums/quartos-seguros/photos/photo_draft_1)',
    sim.evalGet(null, 'albums/quartos-seguros/photos/photo_draft_1'),
    'PHOTO_DRAFT_OR_UNPUBLISHED_ALBUM'
  );

  // 20. Visitante tenta acessar foto mesmo publicada em álbum que está em rascunho
  assertNegative(
    '20. Visitante anônimo tenta acessar foto em álbum que está em rascunho (/albums/album_draft/photos/photo_in_draft_album)',
    sim.evalGet(null, 'albums/album_draft/photos/photo_in_draft_album'),
    'PHOTO_DRAFT_OR_UNPUBLISHED_ALBUM'
  );

  // 21. Visitante tenta listar fotos sem filtro where('published', '==', true)
  assertNegative(
    '21. Consulta pública à subcoleção de fotos sem filtro "published == true" (Rules are not filters)',
    sim.evalList(null, 'albums/quartos-seguros/photos', []),
    'QUERY_NOT_FILTERED'
  );

  // 22. Tentativa de forjar autor de registro de auditoria
  assertNegative(
    '22. Administrador tenta atribuir log de auditoria ao UID de outro administrador',
    sim.evalWrite({ uid: 'adm_normal' }, 'auditLogs/log_spoof', {
      id: 'log_spoof',
      action: 'SERVICE_DELETED',
      performedByUid: 'sa_victoria',
      timestamp: '2026-10-23T10:00:00.000Z'
    }, 'create'),
    'AUDIT_ACTOR_SPOOF'
  );

  console.log('\n--- FASE 4.5: TESTES POSITIVOS — OPERAÇÕES AUTORIZADAS LEGÍTIMAS ---');

  // 23. Visitante lê serviço publicado
  assertPositive(
    '23. Visitante lê serviço publicado com sucesso (/services/published_care)',
    sim.evalGet(null, 'services/published_care')
  );

  // 24. Visitante lê conteúdo institucional oficial
  assertPositive(
    '24. Visitante lê conteúdo institucional oficial (/content/hero)',
    sim.evalGet(null, 'content/hero')
  );

  // 25. Visitante lê álbum publicado
  assertPositive(
    '25. Visitante lê álbum oficial publicado (/albums/quartos-seguros)',
    sim.evalGet(null, 'albums/quartos-seguros')
  );

  // 26. Visitante lê foto publicada de álbum publicado
  assertPositive(
    '26. Visitante lê foto oficial publicada (/albums/quartos-seguros/photos/photo_pub_1)',
    sim.evalGet(null, 'albums/quartos-seguros/photos/photo_pub_1')
  );

  // 27. Consulta pública de fotos com filtro correto
  assertPositive(
    '27. Consulta pública à galeria com filtro "published == true" satisfazendo a regra',
    sim.evalList(null, 'albums/quartos-seguros/photos', [{ field: 'published', op: '==', value: true }])
  );

  // 28. Formulário de contato público legítimo cria lead com status 'unread'
  assertPositive(
    '28. Visitante submete formulário de contato com campos permitidos e status "unread"',
    sim.evalWrite(null, 'leads/lead_legit_1', {
      id: 'lead_legit_1',
      name: 'Beatriz Almeida',
      phone: '(11) 98765-4321',
      email: 'beatriz@exemplo.com.br',
      relationship: 'Filha',
      serviceInterest: 'Apresentação Geral e Planos',
      message: 'Gostaria de agendar uma visita presencial para conhecer o lar.',
      status: 'unread',
      type: 'form',
      createdAt: '2026-10-23T10:00:00.000Z'
    }, 'create')
  );

  // 29. Administrador ativo salva serviço
  assertPositive(
    '29. Administrador ativo salva ou edita serviço institucional',
    sim.evalWrite({ uid: 'adm_normal' }, 'services/published_care', {
      id: 'published_care',
      title: 'Assistência de Enfermagem 24 Horas Atualizada',
      summary: 'Equipe de enfermagem qualificada presente em tempo integral com escala clínica.',
      status: 'published',
      order: 1
    }, 'update')
  );

  // 30. Administrador ativo salva foto em álbum
  assertPositive(
    '30. Administrador ativo cadastra foto em álbum da estrutura',
    sim.evalWrite({ uid: 'adm_normal' }, 'albums/quartos-seguros/photos/photo_new_1', {
      id: 'photo_new_1',
      albumId: 'quartos-seguros',
      url: 'https://images.unsplash.com/nova-suite.jpg',
      altText: 'Nova suíte adaptada',
      order: 3,
      published: true
    }, 'create')
  );

  // 31. Superadministrador gerencia usuários em /admins
  assertPositive(
    '31. Superadministrador provisiona novo administrador em /admins/{uid}',
    sim.evalWrite({ uid: 'sa_victoria' }, 'admins/novo_enfermeiro', {
      uid: 'novo_enfermeiro',
      email: 'enfermeiro2@victorialar.com.br',
      role: 'admin',
      active: true
    }, 'create')
  );

  // 32. Superadministrador lê lista de leads e gerencia status
  assertPositive(
    '32. Administrador lê lista de leads para atendimento assistencial',
    sim.evalList({ uid: 'adm_normal' }, 'leads', [])
  );

  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES EXECUTADOS: ${passed + failed}`);
  console.log(`SUCESSOS: ${passed}`);
  console.log(`FALHAS: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAuditTests().catch(err => {
  console.error('Erro fatal nos testes de regras de segurança:', err);
  process.exit(1);
});
