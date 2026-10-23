/**
 * Test Runner: Verification of The "Dirty Dozen" Payloads against Victoria Lar Security Model
 */

interface MockUserContext {
  uid: string | null;
  email?: string;
  emailVerified?: boolean;
}

interface MockStoreState {
  admins: Record<string, { role: string; active: boolean }>;
  services: Record<string, { id: string; title: string; status: string; order: number; summary: string }>;
  content: Record<string, { key: string; title: string; body?: string }>;
  leads: Record<string, { id: string; name: string; phone: string; status: string }>;
  bootstrap: { status: string; lockedPermanently: boolean };
  auditLogs: Record<string, { id: string; action: string; performedByUid: string }>;
  albums: Record<string, { id: string; title: string; topicKey: string }>;
  photos: Record<string, { id: string; albumId: string; url: string; published: boolean; order: number; altText: string }>;
}

class FirestoreRulesSimulator {
  public state: MockStoreState = {
    admins: {
      'sa_victoria': { role: 'superadmin', active: true },
      'admin_revoked': { role: 'admin', active: false },
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
      'about': {
        key: 'about',
        title: 'História da Victoria Lar Residencial',
        body: 'Mais de 15 anos proporcionando conforto e carinho para a terceira idade.'
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
      lockedPermanently: true
    },
    auditLogs: {
      'log_1': {
        id: 'log_1',
        action: 'BOOTSTRAP_COMPLETED',
        performedByUid: 'sa_victoria'
      }
    },
    albums: {
      'quartos-seguros': {
        id: 'quartos-seguros',
        title: 'Quartos seguros',
        topicKey: 'quartos-seguros',
      },
      'jardins-area-verde': {
        id: 'jardins-area-verde',
        title: 'Jardins & Área Verde',
        topicKey: 'jardins-area-verde',
      },
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
    }
  };

  private isValidId(id: string): boolean {
    return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
  }

  private isActiveAdmin(auth: MockUserContext | null): boolean {
    if (!auth || !auth.uid) return false;
    const admin = this.state.admins[auth.uid];
    return admin !== undefined && admin.active === true;
  }

  private isSuperAdmin(auth: MockUserContext | null): boolean {
    if (!this.isActiveAdmin(auth)) return false;
    return this.state.admins[auth!.uid!].role === 'superadmin';
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
      return { allowed: true }; // Public readable
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

    if (coll === 'albums') {
      if (parts.length === 2) {
        return { allowed: true };
      }
      if (parts.length === 4 && parts[2] === 'photos') {
        const photoId = parts[3];
        if (!this.isValidId(photoId)) return { allowed: false, reason: 'INVALID_PATH_ID' };
        const photo = this.state.photos[photoId];
        if (!photo) return { allowed: false, reason: 'NOT_FOUND' };
        if (photo.published || this.isActiveAdmin(auth)) return { allowed: true };
        return { allowed: false, reason: 'PERMISSION_DENIED_DRAFT_RESTRICTED' };
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
      return { allowed: true };
    }

    if (collection === 'content') {
      return { allowed: true };
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

    // Default deny for unauthenticated or non-admin on protected tables
    if (coll === 'services') {
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_ACTIVE_ADMIN' };
      // Check allowed keys
      const allowedKeys = ['id', 'title', 'summary', 'description', 'icon', 'category', 'order', 'status', 'highlight', 'createdAt', 'updatedAt', 'updatedBy'];
      const incomingKeys = Object.keys(incomingData);
      const hasGhostField = incomingKeys.some(k => !allowedKeys.includes(k));
      if (hasGhostField) return { allowed: false, reason: 'PERMISSION_DENIED_GHOST_FIELD' };

      // String lengths
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
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_ACTIVE_ADMIN' };
      return { allowed: true };
    }

    if (coll === 'leads') {
      // Writing or updating leads: only active admin can modify existing leads
      if (operation === 'update' || operation === 'delete') {
        if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_LEAD_TAMPERING' };
        return { allowed: true };
      }
      // Creation of lead via direct write without active admin is blocked in Firestore
      // (Intake must be processed via secure backend endpoint)
      if (!this.isActiveAdmin(auth)) {
        return { allowed: false, reason: 'PERMISSION_DENIED_DIRECT_CLIENT_WRITE_TO_LEADS' };
      }
      return { allowed: true };
    }

    if (coll === 'system' && docId === 'bootstrap') {
      if (this.state.bootstrap.lockedPermanently) {
        return { allowed: false, reason: 'PERMISSION_DENIED_BOOTSTRAP_SEALED' };
      }
      return { allowed: true };
    }

    if (coll === 'admins') {
      if (!this.isSuperAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_NOT_SUPERADMIN' };
      return { allowed: true };
    }

    if (coll === 'auditLogs') {
      // Audit logs are append-only via trusted backend, deletions or updates never allowed
      if (operation === 'delete' || operation === 'update') {
        return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_LOG_IMMUTABLE' };
      }
      if (!this.isActiveAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED_AUDIT_LOG_TAMPERING' };
      return { allowed: true };
    }

    return { allowed: false, reason: 'PERMISSION_DENIED_DEFAULT_DENY' };
  }
}

async function runDirtyDozenTests() {
  console.log('--- EXECUTING DIRTY DOZEN PAYLOAD SECURITY TESTS ---');
  const sim = new FirestoreRulesSimulator();
  let passed = 0;
  let failed = 0;

  function testPayload(name: string, result: { allowed: boolean; reason?: string }) {
    if (!result.allowed) {
      console.log(`  [PASS] ${name} -> REJECTED: ${result.reason}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} -> CRITICAL VULNERABILITY! Operation was allowed!`);
      failed++;
    }
  }

  // 1. Ghost Field Injection
  testPayload(
    'Dirty 01: Ghost Field Injection in Service',
    sim.evalWrite({ uid: 'sa_victoria' }, 'services/serv_1', {
      title: 'Médico 24h',
      status: 'published',
      order: 1,
      hackedRoot: true
    }, 'create')
  );

  // 2. Public Draft Snooping
  testPayload(
    'Dirty 02: Public Draft Snooping',
    sim.evalGet(null, 'services/draft_project')
  );

  // 3. Unconstrained List Query
  testPayload(
    'Dirty 03: Unconstrained Public List Query (No Status Filter)',
    sim.evalList(null, 'services', [])
  );

  // 4. Revoked Admin Tampering
  testPayload(
    'Dirty 04: Revoked Admin Tampering on Content',
    sim.evalWrite({ uid: 'admin_revoked' }, 'content/about', { title: 'Corrompido' }, 'update')
  );

  // 5. Public Lead Exfiltration
  testPayload(
    'Dirty 05: Public Lead Exfiltration (get)',
    sim.evalGet(null, 'leads/lead_1')
  );

  // 6. Self-Promotion to SuperAdmin
  testPayload(
    'Dirty 06: Visitor Self-Promotion to SuperAdmin in /admins',
    sim.evalWrite({ uid: 'visitor_uid' }, 'admins/visitor_uid', { role: 'superadmin', active: true }, 'create')
  );

  // 7. Bootstrap Replay Attack
  testPayload(
    'Dirty 07: Bootstrap Replay Attack (Overwriting Sealed Bootstrap)',
    sim.evalWrite({ uid: 'hacker' }, 'system/bootstrap', { status: 'UNINITIALIZED', lockedPermanently: false }, 'update')
  );

  // 8. ID Poisoning
  testPayload(
    'Dirty 08: ID Poisoning Attack with Special Characters',
    sim.evalGet(null, 'services/invalid$$chars!!--##')
  );

  // 9. String Overflow Exploit
  testPayload(
    'Dirty 09: String Overflow Exploit (10k char title)',
    sim.evalWrite({ uid: 'sa_victoria' }, 'services/serv_2', {
      title: 'A'.repeat(10000),
      summary: 'Normal',
      status: 'published',
      order: 1
    }, 'create')
  );

  // 10. Direct Public Lead Modification
  testPayload(
    'Dirty 10: Direct Public Modification of Contact Lead',
    sim.evalWrite(null, 'leads/lead_1', { status: 'archived' }, 'update')
  );

  // 11. Audit Log Tampering / Deletion
  testPayload(
    'Dirty 11: Audit Log Deletion Attempt',
    sim.evalWrite({ uid: 'sa_victoria' }, 'auditLogs/log_1', {}, 'delete')
  );

  // 12. Immutable Field Mutation
  testPayload(
    'Dirty 12: Immutable Field Mutation (Attempting to mutate doc ID)',
    sim.evalWrite({ uid: 'sa_victoria' }, 'services/published_care', {
      id: 'mutated_id_attempt',
      title: 'Alterado'
    }, 'update')
  );

  // 13. Direct Visitor Write to Structure Albums
  testPayload(
    'Dirty 13: Visitor Direct Write to Structure Album (/albums)',
    sim.evalWrite(null, 'albums/quartos-seguros', {
      id: 'quartos-seguros',
      title: 'Hacked Album',
      topicKey: 'quartos-seguros'
    }, 'update')
  );

  // 14. Visitor Snooping on Draft Photo
  testPayload(
    'Dirty 14: Visitor Snooping on Draft Photo (/albums/.../photos/draft)',
    sim.evalGet(null, 'albums/quartos-seguros/photos/photo_draft_1')
  );

  // 15. Unconstrained Public Photo Query
  testPayload(
    'Dirty 15: Unconstrained Public Photo List Query (Missing published==true)',
    sim.evalList(null, 'albums/quartos-seguros/photos', [])
  );

  // 16. Ghost Field Injection in Structure Photo
  testPayload(
    'Dirty 16: Ghost Field Injection in Structure Photo',
    sim.evalWrite({ uid: 'sa_victoria' }, 'albums/quartos-seguros/photos/photo_ghost', {
      id: 'photo_ghost',
      albumId: 'quartos-seguros',
      url: 'https://exemplo.com/foto.jpg',
      altText: 'Quarto seguro',
      order: 1,
      published: true,
      maliciousBackdoor: true
    }, 'create')
  );

  // 17. Invalid Media Type Injection in Structure Photo
  testPayload(
    'Dirty 17: Invalid Media Type Injection in Structure Photo',
    sim.evalWrite({ uid: 'sa_victoria' }, 'albums/quartos-seguros/photos/photo_bad_type', {
      id: 'photo_bad_type',
      albumId: 'quartos-seguros',
      url: 'https://exemplo.com/foto.jpg',
      altText: 'Quarto seguro',
      mediaType: 'unsupported_executable_type',
      order: 1,
      published: true
    }, 'create')
  );

  console.log(`\nSecurity Rules Tests: ${passed}/${passed + failed} Payloads Successfully Blocked (${failed} Leaks)`);
  if (failed > 0) process.exit(1);
}

runDirtyDozenTests().catch(err => {
  console.error(err);
  process.exit(1);
});

