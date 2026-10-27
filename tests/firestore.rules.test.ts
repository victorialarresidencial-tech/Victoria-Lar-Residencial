/**
 * Test Runner: Verification of Security Model, Access Control, and The Dirty Dozen Payloads
 * Victoria Lar Residencial — Comprehensive Positive & Negative Test Suite
 * Updated for Fase 3.2B: RBAC Modular, Prontuários (Pacientes), Colaboradores (Funcionários)
 * e Governança de Solicitações de Acesso.
 */

interface MockUserContext {
  uid: string | null;
  email?: string;
  emailVerified?: boolean;
}

interface MockStoreState {
  admins: Record<string, { uid: string; email: string; role: string; active: boolean }>;
  usuariosAutorizados: Record<string, { uid: string; email: string; nome: string; role: string; modulos: string[]; ativo: boolean }>;
  accessRequests: Record<string, { id: string; uid: string; email: string; status: string }>;
  accessRequestLocks: Record<string, { uid: string; locked: boolean }>;
  pacientes: Record<string, any>;
  funcionarios: Record<string, any>;
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
      'adm_unverified': { uid: 'adm_unverified', email: 'medica@victorialar.com.br', role: 'admin', active: true },
      'admin_revoked': { uid: 'admin_revoked', email: 'ex_gestor@victorialar.com.br', role: 'admin', active: false },
    },
    usuariosAutorizados: {
      'staff_residentes': {
        uid: 'staff_residentes',
        email: 'cuidador@victorialar.com.br',
        nome: 'Carlos Cuidador',
        role: 'colaborador',
        modulos: ['residentes'],
        ativo: true,
      },
      'staff_colaboradores': {
        uid: 'staff_colaboradores',
        email: 'rh@victorialar.com.br',
        nome: 'Renata RH',
        role: 'colaborador',
        modulos: ['colaboradores'],
        ativo: true,
      },
      'staff_multi': {
        uid: 'staff_multi',
        email: 'coordenacao@victorialar.com.br',
        nome: 'Clara Coordenadora',
        role: 'colaborador',
        modulos: ['residentes', 'colaboradores'],
        ativo: true,
      },
      'staff_deactivated': {
        uid: 'staff_deactivated',
        email: 'ex_cuidador@victorialar.com.br',
        nome: 'Ex Cuidador',
        role: 'colaborador',
        modulos: ['residentes'],
        ativo: false,
      },
    },
    accessRequests: {
      'req_1': {
        id: 'req_1',
        uid: 'user_applicant_1',
        email: 'novo_funcionario@gmail.com',
        status: 'pendente',
      },
    },
    accessRequestLocks: {
      'user_applicant_1': {
        uid: 'user_applicant_1',
        locked: true,
      },
    },
    pacientes: {
      'paciente_1': {
        id: 'paciente_1',
        nomeCompleto: 'Dona Helena Silveira',
        dataNascimento: '1940-05-12',
        cpf: '123.456.789-00',
        sexo: 'feminino',
        quarto: 'Suíte 102 - Ala Lótus',
        dataAdmissao: '2025-02-10',
        status: 'ativo',
        grauDependencia: 'grau2',
        mobilidade: 'bengala_andador',
        tipoSanguineo: 'O+',
        alergias: ['Dipirona'],
        diagnosticos: ['Hipertensão', 'Artrite leve'],
        medicamentosContinuos: [
          { id: 'm1', nome: 'Losartana', dosagem: '50mg', horario: '08:00' }
        ],
        dieta: 'Pastosa branda, hipossódica',
        responsavel: {
          nome: 'Roberto Silveira',
          parentesco: 'Filho',
          telefonePrincipal: '(11) 98765-4321'
        },
        criadoEm: '2025-02-10T10:00:00.000Z',
      },
    },
    funcionarios: {
      'func_1': {
        id: 'func_1',
        nomeCompleto: 'Mariana Souza Dias',
        cpf: '321.654.987-11',
        rg: '44.555.666-7',
        dataNascimento: '1988-08-20',
        sexo: 'feminino',
        estadoCivil: 'Casada',
        cargo: 'Técnico(a) de Enfermagem',
        departamento: 'Cuidados & Enfermagem',
        tipoContrato: 'clt_integral',
        escalaTrabalho: '12x36_diurno',
        dataAdmissao: '2024-03-01',
        status: 'ativo',
        matricula: 'MAT-2024-042',
        celularWhatsApp: '(11) 97777-6666',
        email: 'mariana.souza@victorialar.com.br',
        cep: '04567-000',
        logradouro: 'Rua das Camélias',
        numero: '120',
        bairro: 'Jardins',
        cidade: 'São Paulo',
        estado: 'SP',
        nomeContatoEmergencia: 'Paulo Dias',
        parentescoEmergencia: 'Cônjuge',
        telefoneEmergencia: '(11) 98888-5555',
        criadoEm: '2024-03-01T08:00:00.000Z',
      },
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

  private isVerified(auth: MockUserContext | null): boolean {
    return !!auth && !!auth.uid && auth.emailVerified === true;
  }

  private isActiveAdmin(auth: MockUserContext | null): boolean {
    if (!this.isVerified(auth)) return false;
    const admin = this.state.admins[auth!.uid!];
    return admin !== undefined && admin.active === true;
  }

  private isSuperAdmin(auth: MockUserContext | null): boolean {
    if (!this.isActiveAdmin(auth)) return false;
    return this.state.admins[auth!.uid!].role === 'superadmin';
  }

  private isStaffMember(auth: MockUserContext | null): boolean {
    if (!this.isVerified(auth)) return false;
    const staff = this.state.usuariosAutorizados[auth!.uid!];
    return staff !== undefined && staff.ativo === true;
  }

  private hasModule(auth: MockUserContext | null, mod: string): boolean {
    if (!this.isStaffMember(auth)) return false;
    const staff = this.state.usuariosAutorizados[auth!.uid!];
    return Array.isArray(staff.modulos) && staff.modulos.includes(mod);
  }

  private canAccessResidentes(auth: MockUserContext | null): boolean {
    return this.isActiveAdmin(auth) || this.hasModule(auth, 'residentes');
  }

  private canAccessColaboradores(auth: MockUserContext | null): boolean {
    return this.isActiveAdmin(auth) || this.hasModule(auth, 'colaboradores');
  }

  private isPublicContentKey(key: string): boolean {
    return ['hero', 'about', 'values', 'owner_1', 'owner_2', 'scheduling'].includes(key) ||
      /^album_[a-zA-Z0-9_\-]+$/.test(key);
  }

  private isValidPaciente(data: Record<string, any>): { valid: boolean; reason?: string } {
    const requiredKeys = [
      'nomeCompleto', 'dataNascimento', 'cpf', 'sexo',
      'quarto', 'dataAdmissao', 'status', 'grauDependencia',
      'mobilidade', 'tipoSanguineo', 'alergias', 'diagnosticos',
      'medicamentosContinuos', 'dieta', 'responsavel'
    ];
    for (const rk of requiredKeys) {
      if (!(rk in data)) {
        return { valid: false, reason: `MISSING_REQUIRED_FIELD_${rk}` };
      }
    }

    const allowedKeys = [
      'id', 'nomeCompleto', 'nomeSocial', 'dataNascimento', 'cpf', 'rg',
      'sexo', 'estadoCivil', 'quarto', 'dataAdmissao', 'status',
      'grauDependencia', 'mobilidade', 'tipoSanguineo', 'convenioMedico',
      'numeroCarteirinha', 'hospitalReferencia', 'alergias', 'diagnosticos',
      'medicamentosContinuos', 'dieta', 'responsavel', 'observacoesGerais',
      'preferenciasHabitos', 'criadoEm', 'atualizadoEm', 'servidorTimestamp', 'servidorAtualizadoEm'
    ];
    for (const k of Object.keys(data)) {
      if (!allowedKeys.includes(k)) {
        return { valid: false, reason: `GHOST_FIELD_DETECTED_${k}` };
      }
    }

    if (typeof data.nomeCompleto !== 'string' || data.nomeCompleto.length === 0 || data.nomeCompleto.length > 150) {
      return { valid: false, reason: 'INVALID_NOME_COMPLETO' };
    }
    if (typeof data.cpf !== 'string' || data.cpf.length < 11 || data.cpf.length > 20) {
      return { valid: false, reason: 'INVALID_CPF' };
    }
    if (!['feminino', 'masculino', 'outro'].includes(data.sexo)) {
      return { valid: false, reason: 'INVALID_SEXO' };
    }
    if (!['ativo', 'avaliacao', 'temporario', 'alta'].includes(data.status)) {
      return { valid: false, reason: 'INVALID_STATUS' };
    }
    if (!['grau1', 'grau2', 'grau3'].includes(data.grauDependencia)) {
      return { valid: false, reason: 'INVALID_GRAU_DEPENDENCIA' };
    }
    if (!['independente', 'bengala_andador', 'cadeira_rodas', 'acamado'].includes(data.mobilidade)) {
      return { valid: false, reason: 'INVALID_MOBILIDADE' };
    }
    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'desconhecido'].includes(data.tipoSanguineo)) {
      return { valid: false, reason: 'INVALID_TIPO_SANGUINEO' };
    }
    if (!Array.isArray(data.alergias) || !Array.isArray(data.diagnosticos) || !Array.isArray(data.medicamentosContinuos)) {
      return { valid: false, reason: 'INVALID_LIST_FIELDS' };
    }
    if (typeof data.responsavel !== 'object' || !data.responsavel || !data.responsavel.nome || !data.responsavel.telefonePrincipal) {
      return { valid: false, reason: 'INVALID_RESPONSAVEL_OBJECT' };
    }

    return { valid: true };
  }

  private isValidFuncionario(data: Record<string, any>): { valid: boolean; reason?: string } {
    const requiredKeys = [
      'nomeCompleto', 'cpf', 'rg', 'dataNascimento', 'sexo', 'estadoCivil',
      'cargo', 'departamento', 'tipoContrato', 'escalaTrabalho', 'dataAdmissao',
      'status', 'matricula', 'celularWhatsApp', 'email', 'cep', 'logradouro',
      'numero', 'bairro', 'cidade', 'estado', 'nomeContatoEmergencia',
      'parentescoEmergencia', 'telefoneEmergencia'
    ];
    for (const rk of requiredKeys) {
      if (!(rk in data)) {
        return { valid: false, reason: `MISSING_REQUIRED_FIELD_${rk}` };
      }
    }

    const allowedKeys = [
      'id', 'nomeCompleto', 'nomeSocial', 'cpf', 'rg', 'orgaoEmissor',
      'dataNascimento', 'idade', 'sexo', 'estadoCivil', 'nacionalidade',
      'naturalidade', 'nomeMae', 'nomePai', 'fotoUrl', 'cargo',
      'cargoPersonalizado', 'departamento', 'registroConselho', 'tipoContrato',
      'escalaTrabalho', 'turno', 'dataAdmissao', 'status', 'matricula',
      'salarioBase', 'celularWhatsApp', 'telefoneFixo', 'email', 'cep',
      'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
      'nomeContatoEmergencia', 'parentescoEmergencia', 'telefoneEmergencia',
      'pisPasep', 'ctpsNumero', 'ctpsSerie', 'banco', 'agencia', 'conta',
      'tipoChavePix', 'chavePix', 'dataExameAdmissional', 'dataValidadeASO',
      'vacinasEmDia', 'alergiasRestricoes', 'tipoSanguineo', 'qualificacoesCursos',
      'observacoesGerais', 'criadoEm', 'atualizadoEm', 'servidorTimestamp', 'servidorAtualizadoEm'
    ];
    for (const k of Object.keys(data)) {
      if (!allowedKeys.includes(k)) {
        return { valid: false, reason: `GHOST_FIELD_DETECTED_${k}` };
      }
    }

    if (typeof data.nomeCompleto !== 'string' || data.nomeCompleto.length === 0 || data.nomeCompleto.length > 150) {
      return { valid: false, reason: 'INVALID_NOME_COMPLETO' };
    }
    if (typeof data.cpf !== 'string' || data.cpf.length < 11 || data.cpf.length > 20) {
      return { valid: false, reason: 'INVALID_CPF' };
    }
    if (typeof data.rg !== 'string' || data.rg.length === 0 || data.rg.length > 30) {
      return { valid: false, reason: 'INVALID_RG' };
    }
    if (!['ativo', 'ferias', 'afastado', 'desligado'].includes(data.status)) {
      return { valid: false, reason: 'INVALID_STATUS' };
    }
    if (!['feminino', 'masculino', 'outro'].includes(data.sexo)) {
      return { valid: false, reason: 'INVALID_SEXO' };
    }
    if (typeof data.email !== 'string' || !data.email.includes('@') || data.email.length > 160) {
      return { valid: false, reason: 'INVALID_EMAIL' };
    }
    if (typeof data.matricula !== 'string' || data.matricula.length === 0) {
      return { valid: false, reason: 'INVALID_MATRICULA' };
    }

    return { valid: true };
  }

  // Evaluate single get
  evalGet(auth: MockUserContext | null, path: string): { allowed: boolean; reason?: string } {
    const parts = path.split('/');
    const coll = parts[0];
    const docId = parts[1];

    if (!this.isValidId(docId)) {
      return { allowed: false, reason: 'INVALID_PATH_ID' };
    }

    // 1. Pacientes (Residentes)
    if (coll === 'pacientes') {
      if (!this.isVerified(auth)) {
        return { allowed: false, reason: 'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS' };
      }
      if (this.canAccessResidentes(auth)) {
        const doc = this.state.pacientes[docId];
        return doc ? { allowed: true } : { allowed: false, reason: 'NOT_FOUND' };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED_MODULE_RESTRICTED' };
    }

    // 2. Funcionários (Colaboradores)
    if (coll === 'funcionarios') {
      if (!this.isVerified(auth)) {
        return { allowed: false, reason: 'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS' };
      }
      if (this.canAccessColaboradores(auth)) {
        const doc = this.state.funcionarios[docId];
        return doc ? { allowed: true } : { allowed: false, reason: 'NOT_FOUND' };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED_MODULE_RESTRICTED' };
    }

    // 3. Access Requests
    if (coll === 'accessRequests') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_ADMIN_RESTRICTED' };
    }

    // 4. Usuários Autorizados
    if (coll === 'usuariosAutorizados') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      if (this.isVerified(auth) && auth!.uid === docId) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_USER_PERMISSIONS_RESTRICTED' };
    }

    // 5. Access Request Locks
    if (coll === 'accessRequestLocks') {
      return { allowed: false, reason: 'PERMISSION_DENIED_LOCK_RESTRICTED' };
    }

    // 6. Services
    if (coll === 'services') {
      const doc = this.state.services[docId];
      if (!doc) return { allowed: false, reason: 'NOT_FOUND' };
      if (doc.status === 'published' || this.isActiveAdmin(auth)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED_DRAFT_RESTRICTED' };
    }

    // 7. Content
    if (coll === 'content') {
      if (this.isPublicContentKey(docId) || this.isActiveAdmin(auth)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED_INTERNAL_CONTENT_PROTECTED' };
    }

    // 8. Leads
    if (coll === 'leads') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_PII_GUARD' };
    }

    // 9. Admins
    if (coll === 'admins') {
      if (auth && auth.emailVerified === true && auth.uid === docId) return { allowed: true };
      if (this.isSuperAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_ADMIN_GUARD' };
    }

    // 10. AuditLogs
    if (coll === 'auditLogs') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_GUARD' };
    }

    // 11. System
    if (coll === 'system') {
      if (docId === 'bootstrap') {
        if (this.isActiveAdmin(auth)) return { allowed: true };
        return { allowed: false, reason: 'PERMISSION_DENIED_BOOTSTRAP_CONFIDENTIAL' };
      }
      if (docId === 'superAdminGuard') {
        if (this.isActiveAdmin(auth)) return { allowed: true };
        return { allowed: false, reason: 'PERMISSION_DENIED_GUARD_RESTRICTED' };
      }
    }

    // 12. Albums
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

        const parentAlbum = this.state.albums[docId];
        if (!parentAlbum) {
          return { allowed: false, reason: 'PERMISSION_DENIED_PARENT_ALBUM_NOT_FOUND' };
        }
        if (parentAlbum.status !== 'published') {
          return { allowed: false, reason: 'PERMISSION_DENIED_PARENT_ALBUM_NOT_PUBLISHED' };
        }
        if (photo.published !== true) {
          return { allowed: false, reason: 'PERMISSION_DENIED_PHOTO_DRAFT_RESTRICTED' };
        }
        return { allowed: true };
      }
    }

    return { allowed: false, reason: 'PERMISSION_DENIED_DEFAULT_DENY' };
  }

  // Evaluate list queries
  evalList(auth: MockUserContext | null, collection: string, filters: { field: string; op: string; value: any }[] = []): { allowed: boolean; reason?: string } {
    if (collection === 'pacientes') {
      if (!this.isVerified(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS' };
      if (this.canAccessResidentes(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_MODULE_RESTRICTED' };
    }

    if (collection === 'funcionarios') {
      if (!this.isVerified(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS' };
      if (this.canAccessColaboradores(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_MODULE_RESTRICTED' };
    }

    if (collection === 'accessRequests' || collection === 'usuariosAutorizados') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_ADMIN_RESTRICTED' };
    }

    if (collection === 'accessRequestLocks') {
      return { allowed: false, reason: 'PERMISSION_DENIED_LOCK_RESTRICTED' };
    }

    if (collection === 'services') {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      const hasPublishedFilter = filters.some(f => f.field === 'status' && f.op === '==' && f.value === 'published');
      if (hasPublishedFilter) return { allowed: true };
      return { allowed: false, reason: 'PERMISSION_DENIED_QUERY_NOT_FILTERED' };
    }

    if (collection.startsWith('albums/') && collection.endsWith('/photos')) {
      if (this.isActiveAdmin(auth)) return { allowed: true };
      const albumId = collection.split('/')[1];
      const parentAlbum = this.state.albums[albumId];
      if (!parentAlbum) {
        return { allowed: false, reason: 'PERMISSION_DENIED_PARENT_ALBUM_NOT_FOUND' };
      }
      if (parentAlbum.status !== 'published') {
        return { allowed: false, reason: 'PERMISSION_DENIED_PARENT_ALBUM_NOT_PUBLISHED' };
      }
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

    // 1. Pacientes (Residentes)
    if (coll === 'pacientes') {
      if (!this.isVerified(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_UNVERIFIED' };
      if (operation === 'delete') {
        if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_DELETE_REQUIRES_ADMIN' };
        return { allowed: true };
      }
      if (!this.canAccessResidentes(auth)) {
        return { allowed: false, reason: 'PERMISSION_DENIED_MODULE_RESTRICTED' };
      }
      const check = this.isValidPaciente(incomingData);
      if (!check.valid) {
        return { allowed: false, reason: check.reason };
      }
      if (operation === 'update') {
        const existing = this.state.pacientes[docId];
        if (existing && existing.criadoEm && incomingData.criadoEm && incomingData.criadoEm !== existing.criadoEm) {
          return { allowed: false, reason: 'PERMISSION_DENIED_IMMUTABLE_CRIADO_EM' };
        }
      }
      return { allowed: true };
    }

    // 2. Funcionários (Colaboradores)
    if (coll === 'funcionarios') {
      if (!this.isVerified(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_UNVERIFIED' };
      if (operation === 'delete') {
        if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_DELETE_REQUIRES_ADMIN' };
        return { allowed: true };
      }
      if (!this.canAccessColaboradores(auth)) {
        return { allowed: false, reason: 'PERMISSION_DENIED_MODULE_RESTRICTED' };
      }
      const check = this.isValidFuncionario(incomingData);
      if (!check.valid) {
        return { allowed: false, reason: check.reason };
      }
      if (operation === 'update') {
        const existing = this.state.funcionarios[docId];
        if (existing && existing.criadoEm && incomingData.criadoEm && incomingData.criadoEm !== existing.criadoEm) {
          return { allowed: false, reason: 'PERMISSION_DENIED_IMMUTABLE_CRIADO_EM' };
        }
      }
      return { allowed: true };
    }

    // 3. Access Requests
    if (coll === 'accessRequests') {
      return { allowed: false, reason: 'PERMISSION_DENIED_ACCESS_REQUEST_CLIENT_WRITE_BLOCKED' };
    }

    // 4. Usuários Autorizados
    if (coll === 'usuariosAutorizados') {
      return { allowed: false, reason: 'PERMISSION_DENIED_STAFF_CLIENT_WRITE_BLOCKED' };
    }

    // 5. Access Request Locks
    if (coll === 'accessRequestLocks') {
      return { allowed: false, reason: 'PERMISSION_DENIED_LOCK_CLIENT_WRITE_BLOCKED' };
    }

    // 6. Albums
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

    // 7. Services
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

    // 8. Content
    if (coll === 'content') {
      if (operation === 'delete') return { allowed: false, reason: 'PERMISSION_DENIED_CONTENT_CANNOT_BE_DELETED' };
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_ACTIVE_ADMIN' };
      return { allowed: true };
    }

    // 9. Leads
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

      if ('notes' in incomingData) {
        return { allowed: false, reason: 'PERMISSION_DENIED_PUBLIC_LEAD_CANNOT_SET_NOTES' };
      }
      if ('meetingLink' in incomingData) {
        return { allowed: false, reason: 'PERMISSION_DENIED_PUBLIC_LEAD_CANNOT_SET_MEETING_LINK' };
      }

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

    // 10. System
    if (coll === 'system' && docId === 'bootstrap') {
      return { allowed: false, reason: 'PERMISSION_DENIED_BOOTSTRAP_SEALED' };
    }

    if (coll === 'system' && docId === 'superAdminGuard') {
      return { allowed: false, reason: 'PERMISSION_DENIED_GUARD_CLIENT_WRITE_BLOCKED' };
    }

    // 11. Admins
    if (coll === 'admins') {
      return { allowed: false, reason: 'PERMISSION_DENIED_ADMIN_CLIENT_WRITE_BLOCKED' };
    }

    // 12. AuditLogs
    if (coll === 'auditLogs') {
      return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_LOG_CLIENT_WRITE_BLOCKED' };
    }

    return { allowed: false, reason: 'PERMISSION_DENIED_DEFAULT_DENY' };
  }
}

async function runSecurityAuditTests() {
  console.log('================================================================');
  console.log('VICTORIA LAR RESIDENCIAL — AUDITORIA DE REGRAS DE SEGURANÇA (FASE 3.2B)');
  console.log('Executando bateria de testes: Modular RBAC, Prontuários, RH e Governança');
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

  console.log('--- SEÇÃO 1: AUDITORIA MODULAR DE RESIDENTES (/pacientes) ---');

  // 1. Visitante anônimo tenta ler paciente
  assertNegative(
    '01. Visitante anônimo tenta ler prontuário de residente (/pacientes/paciente_1)',
    sim.evalGet(null, 'pacientes/paciente_1'),
    'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS'
  );

  // 2. Visitante anônimo tenta listar pacientes
  assertNegative(
    '02. Visitante anônimo tenta listar prontuários (/pacientes)',
    sim.evalList(null, 'pacientes'),
    'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS'
  );

  // 3. Usuário autenticado comum tenta ler paciente
  assertNegative(
    '03. Usuário comum autenticado sem módulos tenta ler residente',
    sim.evalGet({ uid: 'common_user', emailVerified: true }, 'pacientes/paciente_1'),
    'PERMISSION_DENIED_MODULE_RESTRICTED'
  );

  // 4. Usuário com e-mail não verificado tenta acessar residentes
  assertNegative(
    '04. Colaborador cadastrado porém com emailVerified: false tenta ler paciente',
    sim.evalGet({ uid: 'staff_residentes', emailVerified: false }, 'pacientes/paciente_1'),
    'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS'
  );

  // 5. Colaborador do módulo colaboradores tenta ler paciente (Cross-Module Isolation)
  assertNegative(
    '05. [ISOLAMENTO] Colaborador exclusivo de RH tenta ler residente (/pacientes/paciente_1)',
    sim.evalGet({ uid: 'staff_colaboradores', emailVerified: true }, 'pacientes/paciente_1'),
    'PERMISSION_DENIED_MODULE_RESTRICTED'
  );

  // 6. Colaborador desativado tenta ler residente
  assertNegative(
    '06. Colaborador desativado tenta ler prontuário de paciente',
    sim.evalGet({ uid: 'staff_deactivated', emailVerified: true }, 'pacientes/paciente_1'),
    'PERMISSION_DENIED_MODULE_RESTRICTED'
  );

  // 7. Colaborador do módulo residentes tenta EXCLUIR paciente (Exclusão restrita a admin)
  assertNegative(
    '07. Colaborador do módulo residentes tenta excluir prontuário (bloqueado para colaboradores)',
    sim.evalWrite({ uid: 'staff_residentes', emailVerified: true }, 'pacientes/paciente_1', {}, 'delete'),
    'PERMISSION_DENIED_DELETE_REQUIRES_ADMIN'
  );

  // 8. Colaborador autorizado para residentes lê prontuário com sucesso
  assertPositive(
    '08. Colaborador ativo com módulo residentes lê prontuário com sucesso',
    sim.evalGet({ uid: 'staff_residentes', emailVerified: true }, 'pacientes/paciente_1')
  );

  // 9. Colaborador ativo com módulo residentes lista prontuários com sucesso
  assertPositive(
    '09. Colaborador ativo com módulo residentes lista prontuários (/pacientes)',
    sim.evalList({ uid: 'staff_residentes', emailVerified: true }, 'pacientes')
  );

  // 10. Administrador ativo lê e lista prontuários
  assertPositive(
    '10. Administrador ativo lê prontuário de residente',
    sim.evalGet({ uid: 'adm_normal', emailVerified: true }, 'pacientes/paciente_1')
  );

  // 11. Validação de esquema na criação de paciente: Ghost Field rejeitado
  assertNegative(
    '11. Tentativa de cadastrar paciente com Ghost Field (campo privilegiado forjado)',
    sim.evalWrite({ uid: 'staff_residentes', emailVerified: true }, 'pacientes/paciente_new_ghost', {
      id: 'paciente_new_ghost',
      nomeCompleto: 'Sr. João da Silva',
      dataNascimento: '1945-04-10',
      cpf: '222.333.444-55',
      sexo: 'masculino',
      quarto: 'Quarto 10',
      dataAdmissao: '2026-01-01',
      status: 'ativo',
      grauDependencia: 'grau1',
      mobilidade: 'independente',
      tipoSanguineo: 'A+',
      alergias: [],
      diagnosticos: [],
      medicamentosContinuos: [],
      dieta: 'Livre',
      responsavel: { nome: 'Maria', parentesco: 'Esposa', telefonePrincipal: '11999998888' },
      ghostSecurityBypassField: true, // Ghost field!
    }, 'create'),
    'GHOST_FIELD_DETECTED'
  );

  // 12. Validação de esquema na criação de paciente: Criação legítima autorizada
  assertPositive(
    '12. Colaborador de residentes cadastra novo paciente com payload estritamente válido',
    sim.evalWrite({ uid: 'staff_residentes', emailVerified: true }, 'pacientes/paciente_legit', {
      id: 'paciente_legit',
      nomeCompleto: 'Dona Carmem Miranda',
      dataNascimento: '1938-11-20',
      cpf: '555.666.777-88',
      sexo: 'feminino',
      quarto: 'Suíte 204 - Ala Orquídeas',
      dataAdmissao: '2026-03-15',
      status: 'ativo',
      grauDependencia: 'grau2',
      mobilidade: 'cadeira_rodas',
      tipoSanguineo: 'B+',
      alergias: ['Penicilina'],
      diagnosticos: ['Diabetes Tipo 2'],
      medicamentosContinuos: [{ id: 'med_1', nome: 'Metformina', dosagem: '850mg', horario: '09:00' }],
      dieta: 'Hipoglicídica e hipossódica',
      responsavel: {
        nome: 'Carlos Miranda',
        parentesco: 'Filho',
        telefonePrincipal: '(11) 98765-1122'
      },
      criadoEm: '2026-03-15T09:00:00.000Z',
    }, 'create')
  );

  // 13. Administrador ativo exclui prontuário com sucesso
  assertPositive(
    '13. Administrador ativo tem permissão para excluir prontuário',
    sim.evalWrite({ uid: 'adm_normal', emailVerified: true }, 'pacientes/paciente_1', {}, 'delete')
  );

  console.log('\n--- SEÇÃO 2: AUDITORIA MODULAR DE COLABORADORES (/funcionarios) ---');

  // 14. Visitante anônimo tenta ler funcionário
  assertNegative(
    '14. Visitante anônimo tenta ler dados trabalhistas de colaborador (/funcionarios/func_1)',
    sim.evalGet(null, 'funcionarios/func_1'),
    'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS'
  );

  // 15. Visitante anônimo tenta listar funcionários
  assertNegative(
    '15. Visitante anônimo tenta listar quadro de colaboradores (/funcionarios)',
    sim.evalList(null, 'funcionarios'),
    'PERMISSION_DENIED_UNVERIFIED_OR_ANONYMOUS'
  );

  // 16. Colaborador do módulo residentes tenta ler funcionários (Cross-Module Isolation)
  assertNegative(
    '16. [ISOLAMENTO] Colaborador de residentes tenta ler cadastro de RH (/funcionarios/func_1)',
    sim.evalGet({ uid: 'staff_residentes', emailVerified: true }, 'funcionarios/func_1'),
    'PERMISSION_DENIED_MODULE_RESTRICTED'
  );

  // 17. Colaborador do módulo colaboradores lê funcionário com sucesso
  assertPositive(
    '17. Colaborador ativo com módulo colaboradores lê funcionário com sucesso',
    sim.evalGet({ uid: 'staff_colaboradores', emailVerified: true }, 'funcionarios/func_1')
  );

  // 18. Colaborador ativo com módulo colaboradores lista funcionários com sucesso
  assertPositive(
    '18. Colaborador ativo com módulo colaboradores lista funcionários (/funcionarios)',
    sim.evalList({ uid: 'staff_colaboradores', emailVerified: true }, 'funcionarios')
  );

  // 19. Colaborador de RH tenta EXCLUIR colaborador (Exclusão restrita a admin)
  assertNegative(
    '19. Colaborador de RH tenta excluir funcionário (bloqueado para colaboradores)',
    sim.evalWrite({ uid: 'staff_colaboradores', emailVerified: true }, 'funcionarios/func_1', {}, 'delete'),
    'PERMISSION_DENIED_DELETE_REQUIRES_ADMIN'
  );

  // 20. Administrador ativo exclui funcionário com sucesso
  assertPositive(
    '20. Administrador ativo tem permissão para excluir funcionário',
    sim.evalWrite({ uid: 'adm_normal', emailVerified: true }, 'funcionarios/func_1', {}, 'delete')
  );

  // 21. Tentativa de cadastrar colaborador com Ghost Field
  assertNegative(
    '21. Tentativa de cadastrar colaborador com Ghost Field rejeitada pelo esquema',
    sim.evalWrite({ uid: 'staff_colaboradores', emailVerified: true }, 'funcionarios/func_ghost', {
      id: 'func_ghost',
      nomeCompleto: 'Enfermeiro Teste',
      cpf: '111.222.333-44',
      rg: '12.345.678-9',
      dataNascimento: '1990-01-01',
      sexo: 'masculino',
      estadoCivil: 'Solteiro',
      cargo: 'Auxiliar de Enfermagem',
      departamento: 'Cuidados & Enfermagem',
      tipoContrato: 'clt_integral',
      escalaTrabalho: '12x36_diurno',
      dataAdmissao: '2026-02-01',
      status: 'ativo',
      matricula: 'MAT-999',
      celularWhatsApp: '(11) 98888-7777',
      email: 'teste@victorialar.com.br',
      cep: '04000-000',
      logradouro: 'Rua Central',
      numero: '100',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      nomeContatoEmergencia: 'Ana',
      parentescoEmergencia: 'Irmã',
      telefoneEmergencia: '11988887777',
      isAdminSuperRoleOverride: true, // Ghost field!
    }, 'create'),
    'GHOST_FIELD_DETECTED'
  );

  console.log('\n--- SEÇÃO 3: AUDITORIA DE SOLICITAÇÕES, USUÁRIOS AUTORIZADOS E LOCKS ---');

  // 22. Usuário tenta criar diretamente documento em /usuariosAutorizados via client SDK
  assertNegative(
    '22. Tentativa de escrita direta em /usuariosAutorizados via SDK cliente bloqueada',
    sim.evalWrite({ uid: 'attacker', emailVerified: true }, 'usuariosAutorizados/attacker', {
      uid: 'attacker',
      role: 'admin',
      modulos: ['residentes', 'colaboradores'],
      ativo: true
    }, 'create'),
    'PERMISSION_DENIED_STAFF_CLIENT_WRITE_BLOCKED'
  );

  // 23. Usuário tenta autoaprovar solicitação diretamente em /accessRequests
  assertNegative(
    '23. Tentativa de escrita direta em /accessRequests via SDK cliente bloqueada',
    sim.evalWrite({ uid: 'attacker', emailVerified: true }, 'accessRequests/req_1', {
      status: 'aprovada'
    }, 'update'),
    'PERMISSION_DENIED_ACCESS_REQUEST_CLIENT_WRITE_BLOCKED'
  );

  // 24. Usuário tenta manipular locks em /accessRequestLocks
  assertNegative(
    '24. Tentativa de escrita direta em /accessRequestLocks via SDK cliente bloqueada',
    sim.evalWrite({ uid: 'attacker', emailVerified: true }, 'accessRequestLocks/attacker', {
      locked: false
    }, 'create'),
    'PERMISSION_DENIED_LOCK_CLIENT_WRITE_BLOCKED'
  );

  // 25. Usuário tenta ler locks em /accessRequestLocks
  assertNegative(
    '25. Tentativa de leitura em /accessRequestLocks via SDK cliente bloqueada',
    sim.evalGet({ uid: 'attacker', emailVerified: true }, 'accessRequestLocks/attacker'),
    'PERMISSION_DENIED_LOCK_RESTRICTED'
  );

  // 26. Usuário comum tenta listar /accessRequests
  assertNegative(
    '26. Usuário comum tentando listar solicitações de acesso (/accessRequests) é bloqueado',
    sim.evalList({ uid: 'common_user', emailVerified: true }, 'accessRequests'),
    'PERMISSION_DENIED_ADMIN_RESTRICTED'
  );

  // 27. Administrador ativo lê e lista solicitações de acesso
  assertPositive(
    '27. Administrador ativo lista solicitações de acesso (/accessRequests)',
    sim.evalList({ uid: 'adm_normal', emailVerified: true }, 'accessRequests')
  );

  // 28. Usuário lê seu próprio documento de permissões em /usuariosAutorizados
  assertPositive(
    '28. Colaborador lê seu próprio documento em /usuariosAutorizados/{uid}',
    sim.evalGet({ uid: 'staff_residentes', emailVerified: true }, 'usuariosAutorizados/staff_residentes')
  );

  // 29. Colaborador tenta inspecionar permissões de outro usuário
  assertNegative(
    '29. Colaborador tentando inspecionar permissões de outro usuário em /usuariosAutorizados',
    sim.evalGet({ uid: 'staff_residentes', emailVerified: true }, 'usuariosAutorizados/staff_colaboradores'),
    'PERMISSION_DENIED_USER_PERMISSIONS_RESTRICTED'
  );

  console.log('\n--- SEÇÃO 4: CONTINUIDADE E INTEGRIDADE DAS REGRAS EXISTENTES (Fases 1, 2 e 3.1) ---');

  // 30. Visitante não consegue criar administrador em /admins
  assertNegative(
    '30. Visitante anônimo tenta criar administrador em /admins',
    sim.evalWrite(null, 'admins/hacker_1', { uid: 'hacker_1', role: 'admin' }, 'create'),
    'ADMIN_CLIENT_WRITE_BLOCKED'
  );

  // 31. Superadmin não consegue gravar direto em /admins (deve usar backend com transação)
  assertNegative(
    '31. Superadmin tenta escrever direto em /admins via client SDK (exclusivo do backend)',
    sim.evalWrite({ uid: 'sa_victoria', emailVerified: true }, 'admins/novo_adm', { role: 'admin' }, 'create'),
    'ADMIN_CLIENT_WRITE_BLOCKED'
  );

  // 32. Visitante lê serviço publicado
  assertPositive(
    '32. Visitante lê serviço publicado (/services/published_care)',
    sim.evalGet(null, 'services/published_care')
  );

  // 33. Visitante tenta ler serviço em rascunho
  assertNegative(
    '33. Visitante anônimo tenta ler serviço em rascunho (/services/draft_project)',
    sim.evalGet(null, 'services/draft_project'),
    'DRAFT_RESTRICTED'
  );

  // 34. Visitante lê conteúdo institucional hero
  assertPositive(
    '34. Visitante lê conteúdo institucional hero (/content/hero)',
    sim.evalGet(null, 'content/hero')
  );

  // 35. Visitante tenta ler notas internas administrativas em /content
  assertNegative(
    '35. Visitante tenta ler notas confidenciais em /content/internal_admin_notes',
    sim.evalGet(null, 'content/internal_admin_notes'),
    'INTERNAL_CONTENT_PROTECTED'
  );

  // 36. Visitante cria lead legítimo (status: unread)
  assertPositive(
    '36. Visitante submete lead público legítimo',
    sim.evalWrite(null, 'leads/lead_novo', {
      id: 'lead_novo',
      name: 'Família Souza',
      phone: '(11) 98888-2222',
      status: 'unread',
    }, 'create')
  );

  // 37. Visitante tenta ler leads privados
  assertNegative(
    '37. Visitante tenta ler lead confidencial em /leads/lead_1',
    sim.evalGet(null, 'leads/lead_1'),
    'PII_GUARD'
  );

  // 38. Visitante tenta forjar link de reunião em lead
  assertNegative(
    '38. Visitante tenta forjar meetingLink em lead público',
    sim.evalWrite(null, 'leads/lead_phish', {
      id: 'lead_phish',
      name: 'Hacker',
      phone: '11999998888',
      status: 'unread',
      meetingLink: 'https://malicious.link'
    }, 'create'),
    'CANNOT_SET_MEETING_LINK'
  );

  // 39. Visitante lê álbum publicado
  assertPositive(
    '39. Visitante lê álbum publicado (/albums/quartos-seguros)',
    sim.evalGet(null, 'albums/quartos-seguros')
  );

  // 40. Visitante tenta ler foto em álbum que está em rascunho
  assertNegative(
    '40. Visitante tenta ler foto dentro de álbum em rascunho',
    sim.evalGet(null, 'albums/album_draft/photos/photo_in_draft_album'),
    'PARENT_ALBUM_NOT_PUBLISHED'
  );

  // 41. Cliente tenta forjar log de auditoria em /auditLogs
  assertNegative(
    '41. Cliente tenta forjar registro em /auditLogs diretamente',
    sim.evalWrite({ uid: 'adm_normal', emailVerified: true }, 'auditLogs/log_fake', { action: 'TEST' }, 'create'),
    'AUDIT_LOG_CLIENT_WRITE_BLOCKED'
  );

  // 42. Cliente tenta alterar bootstrap selado
  assertNegative(
    '42. Cliente tenta alterar /system/bootstrap selado',
    sim.evalWrite({ uid: 'sa_victoria', emailVerified: true }, 'system/bootstrap', {}, 'update'),
    'BOOTSTRAP_SEALED'
  );

  // 43. Cliente tenta alterar /system/superAdminGuard
  assertNegative(
    '43. Cliente tenta alterar /system/superAdminGuard via client SDK',
    sim.evalWrite({ uid: 'sa_victoria', emailVerified: true }, 'system/superAdminGuard', {}, 'update'),
    'GUARD_CLIENT_WRITE_BLOCKED'
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
