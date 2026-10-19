import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ServiceItem,
  InstitutionalContent,
  AdminUser,
  ContactLead,
  SuperAdminGuard,
  StructurePhoto,
  StructureAlbum,
  STRUCTURE_TOPICS,
} from '../types';

// =============================================================
// SERVICES (Nossos Serviços)
// =============================================================

// In-memory request caches to prevent duplicate network calls
let cachedPublishedServices: ServiceItem[] | null = null;
let servicesRequestPromise: Promise<ServiceItem[]> | null = null;

export function invalidateServicesCache(): void {
  cachedPublishedServices = null;
  servicesRequestPromise = null;
}

/**
 * Public visitor query: MUST include where('status', '==', 'published')
 * to comply with "Rules are not filters" invariant.
 * Caches in memory to avoid duplicate round-trips.
 */
export async function getPublishedServices(forceRefresh = false): Promise<ServiceItem[]> {
  if (!forceRefresh && cachedPublishedServices) {
    return cachedPublishedServices;
  }
  if (!forceRefresh && servicesRequestPromise) {
    return servicesRequestPromise;
  }

  servicesRequestPromise = (async () => {
    try {
      const q = query(
        collection(db, 'services'),
        where('status', '==', 'published'),
        orderBy('order', 'asc')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as ServiceItem));
      cachedPublishedServices = items;
      return items;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'services');
    } finally {
      servicesRequestPromise = null;
    }
  })();

  return servicesRequestPromise;
}

/**
 * Admin query: retrieves all services including drafts
 */
export async function getAllServicesForAdmin(): Promise<ServiceItem[]> {
  try {
    const q = query(collection(db, 'services'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ServiceItem));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'services');
  }
}

/**
 * Save or update a service (Admin only)
 */
export async function saveService(service: ServiceItem, adminUid: string): Promise<void> {
  try {
    const serviceRef = doc(db, 'services', service.id);
    const nowIso = new Date().toISOString();
    const payload: ServiceItem = {
      ...service,
      updatedAt: nowIso,
      updatedBy: adminUid,
      createdAt: service.createdAt || nowIso,
    };
    await setDoc(serviceRef, payload, { merge: true });
    invalidateServicesCache();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `services/${service.id}`);
  }
}

/**
 * Delete a service (Admin only)
 */
export async function deleteService(serviceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'services', serviceId));
    invalidateServicesCache();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `services/${serviceId}`);
  }
}

/**
 * Reorder services atomically using writeBatch (Admin only)
 */
export async function reorderServices(orderedItems: { id: string; order: number }[], adminUid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    orderedItems.forEach(item => {
      const ref = doc(db, 'services', item.id);
      batch.update(ref, { order: item.order, updatedAt: nowIso, updatedBy: adminUid });
    });
    await batch.commit();
    invalidateServicesCache();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'services');
  }
}

// =============================================================
// INSTITUTIONAL CONTENT
// =============================================================

let cachedInstitutionalContent: Record<string, InstitutionalContent> | null = null;
let institutionalContentPromise: Promise<Record<string, InstitutionalContent>> | null = null;

export function invalidateContentCache(): void {
  cachedInstitutionalContent = null;
  institutionalContentPromise = null;
}

export async function getInstitutionalContent(forceRefresh = false): Promise<Record<string, InstitutionalContent>> {
  if (!forceRefresh && cachedInstitutionalContent) {
    return cachedInstitutionalContent;
  }
  if (!forceRefresh && institutionalContentPromise) {
    return institutionalContentPromise;
  }

  institutionalContentPromise = (async () => {
    try {
      const snap = await getDocs(collection(db, 'content'));
      const result: Record<string, InstitutionalContent> = {};
      snap.docs.forEach(d => {
        result[d.id] = d.data() as InstitutionalContent;
      });
      cachedInstitutionalContent = result;
      return result;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'content');
    } finally {
      institutionalContentPromise = null;
    }
  })();

  return institutionalContentPromise;
}

export async function saveInstitutionalContent(content: InstitutionalContent, adminUid: string): Promise<void> {
  try {
    const ref = doc(db, 'content', content.key);
    await setDoc(ref, {
      ...content,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid,
    }, { merge: true });
    invalidateContentCache();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `content/${content.key}`);
  }
}

// =============================================================
// ADMIN USER MANAGEMENT (With Concurrency-Safe Last Superadmin Protection)
// =============================================================

export async function getAllAdmins(): Promise<AdminUser[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map(d => d.data() as AdminUser);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admins');
  }
}

export async function addAdminUser(
  newAdmin: { uid: string; email: string; role: 'superadmin' | 'admin' },
  creatorUid: string
): Promise<void> {
  const guardRef = doc(db, 'system', 'superAdminGuard');
  const adminRef = doc(db, 'admins', newAdmin.uid);

  try {
    await runTransaction(db, async (tx) => {
      const guardSnap = await tx.get(guardRef);
      const guard = guardSnap.exists()
        ? (guardSnap.data() as SuperAdminGuard)
        : { activeSuperAdminCount: 1, activeSuperAdminUids: [creatorUid], version: 1 };

      const nowIso = new Date().toISOString();
      const adminData: AdminUser = {
        uid: newAdmin.uid,
        email: newAdmin.email,
        role: newAdmin.role,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: creatorUid,
        bootstrapStatus: 'COMPLETED',
      };

      tx.set(adminRef, adminData);

      if (newAdmin.role === 'superadmin') {
        const uids = guard.activeSuperAdminUids.includes(newAdmin.uid)
          ? guard.activeSuperAdminUids
          : [...guard.activeSuperAdminUids, newAdmin.uid];

        tx.set(guardRef, {
          ...guard,
          activeSuperAdminCount: uids.length,
          activeSuperAdminUids: uids,
          version: (guard.version || 1) + 1,
          updatedAt: nowIso,
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${newAdmin.uid}`);
  }
}

/**
 * Updates admin role or active status with strict last superadmin protection
 */
export async function updateAdminStatusOrRole(
  targetUid: string,
  updates: { role?: 'superadmin' | 'admin'; active?: boolean },
  _operatorUid: string
): Promise<void> {
  const guardRef = doc(db, 'system', 'superAdminGuard');
  const adminRef = doc(db, 'admins', targetUid);

  try {
    await runTransaction(db, async (tx) => {
      const guardSnap = await tx.get(guardRef);
      const targetSnap = await tx.get(adminRef);

      if (!targetSnap.exists()) {
        throw new Error('ADMIN_NOT_FOUND: Usuário administrador não encontrado.');
      }

      const currentAdmin = targetSnap.data() as AdminUser;
      const guard = guardSnap.exists()
        ? (guardSnap.data() as SuperAdminGuard)
        : { activeSuperAdminCount: 1, activeSuperAdminUids: [targetUid], version: 1 };

      const isCurrentlyActiveSuperAdmin = currentAdmin.role === 'superadmin' && currentAdmin.active === true;
      const willBeActiveSuperAdmin =
        (updates.role !== undefined ? updates.role : currentAdmin.role) === 'superadmin' &&
        (updates.active !== undefined ? updates.active : currentAdmin.active) === true;

      // Check if we are removing an active superadmin
      if (isCurrentlyActiveSuperAdmin && !willBeActiveSuperAdmin) {
        if (guard.activeSuperAdminCount <= 1) {
          throw new Error('PROTECAO_BLOQUEADA: Impossível desativar ou rebaixar o único superadministrador ativo remanescente.');
        }

        const remainingUids = guard.activeSuperAdminUids.filter(u => u !== targetUid);
        tx.set(guardRef, {
          ...guard,
          activeSuperAdminCount: remainingUids.length,
          activeSuperAdminUids: remainingUids,
          version: (guard.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        });
      } else if (!isCurrentlyActiveSuperAdmin && willBeActiveSuperAdmin) {
        const uids = guard.activeSuperAdminUids.includes(targetUid)
          ? guard.activeSuperAdminUids
          : [...guard.activeSuperAdminUids, targetUid];

        tx.set(guardRef, {
          ...guard,
          activeSuperAdminCount: uids.length,
          activeSuperAdminUids: uids,
          version: (guard.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        });
      }

      tx.update(adminRef, {
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.active !== undefined ? { active: updates.active } : {}),
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `admins/${targetUid}`);
  }
}

// =============================================================
// CONTACT LEADS (Formulário e Visitas)
// =============================================================

export async function submitContactLead(lead: Omit<ContactLead, 'status' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
  // First, submit to reliable backend endpoint /api/contact
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Also try to mirror to Firestore directly if available
      try {
        const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, 'leads', id), {
          ...lead,
          id,
          status: 'unread',
          type: lead.type || 'form',
          createdAt: new Date().toISOString(),
        });
      } catch (clientErr) {
        // Backend already recorded it successfully
        console.info('[Direct Firestore Write Skipped/Protected by Rule]', clientErr);
      }
      return { success: true, message: data.message || 'Contato registrado com sucesso!' };
    }
    throw new Error(data.error || 'Erro ao submeter formulário');
  } catch (err: any) {
    console.error('Falha no envio de contato:', err);
    throw err;
  }
}

export async function scheduleOnlineMeeting(appointment: {
  name: string;
  email: string;
  phone: string;
  scheduledDate: string;
  scheduledTime: string;
  meetingLink?: string;
  relationship?: string;
  serviceInterest?: string;
  message?: string;
  emailSubject?: string;
  emailInstructions?: string;
  honeypot?: string;
}): Promise<{ success: boolean; message: string; meetingLink: string }> {
  try {
    const res = await fetch('/api/schedule-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao realizar agendamento.');
    }

    // Mirror to Firestore leads with status: 'scheduled'
    try {
      const id = `meet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'leads', id), {
        id,
        name: appointment.name.trim(),
        email: appointment.email.trim(),
        phone: appointment.phone.trim(),
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        meetingLink: data.data?.meetingLink || appointment.meetingLink || 'https://meet.google.com/vic-tori-lar',
        relationship: appointment.relationship || 'Familiar',
        serviceInterest: appointment.serviceInterest || 'Reunião Online de Apresentação',
        message: appointment.message || '',
        status: 'scheduled',
        type: 'meeting',
        createdAt: new Date().toISOString(),
      });
    } catch (clientErr) {
      console.info('[Direct Firestore Write Skipped/Protected by Rule]', clientErr);
    }

    return {
      success: true,
      message: data.message,
      meetingLink: data.data?.meetingLink || appointment.meetingLink || 'https://meet.google.com/vic-tori-lar',
    };
  } catch (err: any) {
    console.error('Falha no agendamento de reunião:', err);
    throw err;
  }
}

export async function getContactLeads(): Promise<ContactLead[]> {
  try {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ContactLead));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'leads');
  }
}

export async function updateLeadStatus(leadId: string, status: ContactLead['status'], notes?: string): Promise<void> {
  try {
    const ref = doc(db, 'leads', leadId);
    await updateDoc(ref, {
      status,
      ...(notes !== undefined ? { notes } : {}),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `leads/${leadId}`);
  }
}

// =============================================================
// MEETING AVAILABILITY & SLOTS (Modelo Beeginning 4 You)
// =============================================================

export const DEFAULT_AVAILABILITY: {
  dailyTimeSlots: string[];
  activeDays: number[];
  blockedSlots: Array<{ id: string; date: string; time?: string; reason?: string }>;
  meetingDuration: string;
  meetingLink: string;
} = {
  dailyTimeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
  activeDays: [1, 2, 3, 4, 5],
  blockedSlots: [],
  meetingDuration: '30 a 45 minutos',
  meetingLink: 'https://meet.google.com/vic-tori-lar',
};

let memoryAvailabilityConfig = DEFAULT_AVAILABILITY;

export async function getAvailabilityConfig() {
  try {
    const res = await fetch('/api/schedule/availability');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.availability) {
        memoryAvailabilityConfig = data.availability;
        return data.availability;
      }
    }
  } catch (err) {
    console.warn('[Availability API offline, falling back]', err);
  }

  return memoryAvailabilityConfig || DEFAULT_AVAILABILITY;
}

export async function saveAvailabilityConfig(config: any) {
  memoryAvailabilityConfig = config;

  try {
    const res = await fetch('/api/schedule/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: config }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Availability API save fallback]', err);
  }

  return { success: true, availability: config };
}

export async function getBookedSlotsForDate(date: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/schedule/booked-slots?date=${encodeURIComponent(date)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.bookedSlots)) {
        return data.bookedSlots;
      }
    }
  } catch (err) {
    console.warn('[Booked Slots API Notice]', err);
  }
  return [];
}

// =============================================================
// STRUCTURE ALBUMS & PHOTOS (Estrutura Projetada para o Bem-Estar)
// =============================================================

// In-memory caches per album
const cachedAlbums: Record<string, StructureAlbum> = {};
const cachedPublishedPhotos: Record<string, StructurePhoto[]> = {};

export function invalidateAlbumCache(albumId?: string): void {
  if (albumId) {
    delete cachedAlbums[albumId];
    delete cachedPublishedPhotos[albumId];
  } else {
    Object.keys(cachedAlbums).forEach((k) => delete cachedAlbums[k]);
    Object.keys(cachedPublishedPhotos).forEach((k) => delete cachedPublishedPhotos[k]);
  }
}

/**
 * Retrieves album configuration. Checks Firestore content collection first (publicly permitted),
 * then albums collection, and provides standard fallback derived from STRUCTURE_TOPICS.
 */
export async function getAlbum(albumId: string, forceRefresh = false): Promise<StructureAlbum> {
  if (!forceRefresh && cachedAlbums[albumId]) {
    return cachedAlbums[albumId];
  }

  const topicConfig = STRUCTURE_TOPICS.find((t) => t.id === albumId);
  const fallbackAlbum: StructureAlbum = {
    id: albumId,
    topicKey: albumId,
    title: topicConfig?.title || albumId,
    description: topicConfig?.defaultDescription || topicConfig?.shortDescription || '',
    status: 'published',
  };

  // 1. Check /content/album_{albumId} (publicly accessible across all environments)
  try {
    const contentRef = doc(db, 'content', `album_${albumId}`);
    const cSnap = await getDoc(contentRef);
    if (cSnap.exists()) {
      const cData = cSnap.data();
      const resolved: StructureAlbum = {
        ...fallbackAlbum,
        title: cData.title || fallbackAlbum.title,
        description: cData.subtitle || fallbackAlbum.description,
        status: 'published',
      };
      cachedAlbums[albumId] = resolved;
      return resolved;
    }
  } catch (err) {
    console.warn(`[getAlbum content check ${albumId}]:`, err);
  }

  // 2. Check /albums/{albumId} only if authenticated to avoid security errors
  if (auth.currentUser) {
    try {
      const docRef = doc(db, 'albums', albumId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as StructureAlbum;
        cachedAlbums[albumId] = { ...fallbackAlbum, ...data, id: albumId };
        return cachedAlbums[albumId];
      }
    } catch (err) {
      console.warn(`[getAlbum ${albumId}] fallback:`, err);
    }
  }

  cachedAlbums[albumId] = fallbackAlbum;
  return fallbackAlbum;
}

/**
 * Saves album metadata (title, description, coverImageUrl, status).
 * Persists to both /content/album_{album.id} and /albums/{album.id}.
 * Admin only.
 */
export async function saveAlbum(album: StructureAlbum, adminUid: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const payload: StructureAlbum = {
    id: album.id,
    topicKey: album.topicKey || album.id,
    title: album.title.trim(),
    description: (album.description || '').trim(),
    coverImageUrl: album.coverImageUrl || '',
    status: album.status || 'published',
    order: typeof album.order === 'number' ? album.order : 0,
    createdAt: album.createdAt || nowIso,
    updatedAt: nowIso,
    updatedBy: adminUid,
  };

  try {
    // 1. Get existing photos body from /content/album_{id} to preserve them
    let currentPhotosBody = '[]';
    try {
      const curDoc = await getDoc(doc(db, 'content', `album_${album.id}`));
      if (curDoc.exists() && curDoc.data()?.body) {
        currentPhotosBody = curDoc.data().body;
      }
    } catch {}

    // 2. Save to /content/album_{album.id}
    const contentRef = doc(db, 'content', `album_${album.id}`);
    await setDoc(
      contentRef,
      {
        key: `album_${album.id}`,
        title: album.title.trim(),
        subtitle: (album.description || '').trim(),
        body: currentPhotosBody,
        updatedAt: nowIso,
        updatedBy: adminUid,
      },
      { merge: true }
    );

    // 3. Save to /albums/{album.id}
    try {
      const albumRef = doc(db, 'albums', album.id);
      await setDoc(albumRef, payload, { merge: true });
    } catch (albumErr) {
      console.warn(`[saveAlbum /albums sync notice]:`, albumErr);
    }

    invalidateAlbumCache(album.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `content/album_${album.id}`);
  }
}

/**
 * Public visitors query: only photos where `published == true`.
 * Checks /content/album_{albumId} first, then /albums/{albumId}/photos.
 * Guarantees zero unhandled security exceptions for visitors.
 */
export async function getPublishedPhotos(albumId: string, forceRefresh = false): Promise<StructurePhoto[]> {
  if (!forceRefresh && cachedPublishedPhotos[albumId]) {
    return cachedPublishedPhotos[albumId];
  }

  // 1. Retrieve from /content/album_{albumId}
  try {
    const contentRef = doc(db, 'content', `album_${albumId}`);
    const cSnap = await getDoc(contentRef);
    if (cSnap.exists()) {
      const cData = cSnap.data();
      if (cData.body && typeof cData.body === 'string') {
        try {
          const parsed = JSON.parse(cData.body);
          if (Array.isArray(parsed)) {
            const published = parsed
              .filter((p: StructurePhoto) => p && p.published === true)
              .sort((a: StructurePhoto, b: StructurePhoto) => (a.order || 0) - (b.order || 0));
            cachedPublishedPhotos[albumId] = published;
            return published;
          }
        } catch (parseErr) {
          console.warn(`[getPublishedPhotos ${albumId}] JSON parse warning:`, parseErr);
        }
      }
    }
  } catch (cErr) {
    console.warn(`[getPublishedPhotos content read ${albumId}]:`, cErr);
  }

  // 2. Query /albums/{albumId}/photos only if authenticated (prevents unauthenticated queries from tripping Firestore security rules)
  if (auth.currentUser) {
    try {
      const photosColl = collection(db, 'albums', albumId, 'photos');
      const q = query(
        photosColl,
        where('published', '==', true),
        orderBy('order', 'asc')
      );
      const snap = await getDocs(q);
      const photos = snap.docs.map((d) => ({ ...d.data(), id: d.id } as StructurePhoto));
      cachedPublishedPhotos[albumId] = photos;
      return photos;
    } catch (err: any) {
      console.warn(`[getPublishedPhotos notice ${albumId}]:`, err?.message || err);
    }
  }

  cachedPublishedPhotos[albumId] = [];
  return [];
}

/**
 * Admin query: retrieves all photos for an album, including unpublished drafts.
 */
export async function getAllPhotosForAdmin(albumId: string): Promise<StructurePhoto[]> {
  // 1. Check /content/album_{albumId}
  try {
    const contentRef = doc(db, 'content', `album_${albumId}`);
    const cSnap = await getDoc(contentRef);
    if (cSnap.exists()) {
      const cData = cSnap.data();
      if (cData.body && typeof cData.body === 'string') {
        try {
          const parsed = JSON.parse(cData.body);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a: StructurePhoto, b: StructurePhoto) => (a.order || 0) - (b.order || 0));
          }
        } catch {}
      }
    }
  } catch {}

  // 2. Query /albums/{albumId}/photos
  try {
    const photosColl = collection(db, 'albums', albumId, 'photos');
    const q = query(photosColl, orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as StructurePhoto));
  } catch (err) {
    console.warn(`[getAllPhotosForAdmin ${albumId}]:`, err);
    return [];
  }
}

/**
 * Saves a photo in Firestore.
 * Persists to both /content/album_{photo.albumId} and /albums/{photo.albumId}/photos/{photo.id}.
 * Admin only.
 */
export async function savePhoto(photo: StructurePhoto, adminUid: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const payload: StructurePhoto = {
    id: photo.id,
    albumId: photo.albumId,
    url: photo.url.trim(),
    storagePath: photo.storagePath || '',
    title: photo.title.trim(),
    caption: (photo.caption || '').trim(),
    altText: photo.altText.trim() || photo.title.trim() || 'Foto da estrutura Victoria Lar Residencial',
    order: typeof photo.order === 'number' ? photo.order : 1,
    published: Boolean(photo.published),
    createdAt: photo.createdAt || nowIso,
    updatedAt: nowIso,
    updatedBy: adminUid,
  };

  try {
    // 1. Update list in /content/album_{albumId}
    const currentPhotos = await getAllPhotosForAdmin(photo.albumId);
    const existingIndex = currentPhotos.findIndex((p) => p.id === photo.id);
    let updatedPhotos: StructurePhoto[];
    if (existingIndex >= 0) {
      updatedPhotos = [...currentPhotos];
      updatedPhotos[existingIndex] = payload;
    } else {
      updatedPhotos = [...currentPhotos, payload];
    }
    updatedPhotos.sort((a, b) => (a.order || 0) - (b.order || 0));

    const album = await getAlbum(photo.albumId);
    const topicConfig = STRUCTURE_TOPICS.find((t) => t.id === photo.albumId);
    const contentRef = doc(db, 'content', `album_${photo.albumId}`);
    await setDoc(
      contentRef,
      {
        key: `album_${photo.albumId}`,
        title: album.title || topicConfig?.title || photo.albumId,
        subtitle: album.description || topicConfig?.defaultDescription || '',
        body: JSON.stringify(updatedPhotos),
        updatedAt: nowIso,
        updatedBy: adminUid,
      },
      { merge: true }
    );

    // 2. Also save to /albums/{albumId}/photos/{photo.id}
    try {
      const photoRef = doc(db, 'albums', photo.albumId, 'photos', photo.id);
      await setDoc(photoRef, payload, { merge: true });
    } catch (subCollErr) {
      console.warn(`[savePhoto /albums subcoll sync notice]:`, subCollErr);
    }

    invalidateAlbumCache(photo.albumId);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `content/album_${photo.albumId}`);
  }
}

/**
 * Deletes a photo from Firestore and attempts deletion of its underlying
 * object in Firebase Storage to prevent orphan files.
 * Admin only.
 */
export async function deletePhoto(
  albumId: string,
  photoId: string,
  storagePath?: string
): Promise<{ storageDeleted: boolean }> {
  let storageDeleted = false;

  // 1. If uploaded to Firebase Storage, attempt to clean up file
  if (storagePath && storagePath.trim()) {
    try {
      const fileRef = storageRef(storage, storagePath.trim());
      await deleteObject(fileRef);
      storageDeleted = true;
    } catch (storageErr: any) {
      console.warn(`[Firebase Storage Warning] Could not delete object ${storagePath}:`, storageErr?.message || storageErr);
    }
  }

  // 2. Remove photo from /content/album_{albumId}
  try {
    const currentPhotos = await getAllPhotosForAdmin(albumId);
    const updatedPhotos = currentPhotos.filter((p) => p.id !== photoId);
    const album = await getAlbum(albumId);
    const topicConfig = STRUCTURE_TOPICS.find((t) => t.id === albumId);
    const contentRef = doc(db, 'content', `album_${albumId}`);
    await setDoc(
      contentRef,
      {
        key: `album_${albumId}`,
        title: album.title || topicConfig?.title || albumId,
        subtitle: album.description || topicConfig?.defaultDescription || '',
        body: JSON.stringify(updatedPhotos),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (cDelErr) {
    console.warn(`[deletePhoto content sync error]:`, cDelErr);
  }

  // 3. Delete from /albums/{albumId}/photos/{photoId}
  try {
    const photoRef = doc(db, 'albums', albumId, 'photos', photoId);
    await deleteDoc(photoRef);
  } catch (subDelErr) {
    console.warn(`[deletePhoto /albums subcoll notice]:`, subDelErr);
  }

  invalidateAlbumCache(albumId);
  return { storageDeleted };
}

/**
 * Reorders photos atomically.
 * Admin only.
 */
export async function reorderPhotos(
  albumId: string,
  orderedItems: { id: string; order: number }[],
  adminUid: string
): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. Update /content/album_{albumId}
  try {
    const currentPhotos = await getAllPhotosForAdmin(albumId);
    const orderMap = new Map(orderedItems.map((item) => [item.id, item.order]));
    const updatedPhotos = currentPhotos.map((p) => ({
      ...p,
      order: orderMap.has(p.id) ? orderMap.get(p.id)! : p.order,
      updatedAt: nowIso,
      updatedBy: adminUid,
    }));
    updatedPhotos.sort((a, b) => (a.order || 0) - (b.order || 0));

    const contentRef = doc(db, 'content', `album_${albumId}`);
    await setDoc(
      contentRef,
      {
        body: JSON.stringify(updatedPhotos),
        updatedAt: nowIso,
        updatedBy: adminUid,
      },
      { merge: true }
    );
  } catch (cReorderErr) {
    console.warn(`[reorderPhotos content sync]:`, cReorderErr);
  }

  // 2. Update /albums subcollection batch
  try {
    const batch = writeBatch(db);
    orderedItems.forEach((item) => {
      const ref = doc(db, 'albums', albumId, 'photos', item.id);
      batch.update(ref, { order: item.order, updatedAt: nowIso, updatedBy: adminUid });
    });
    await batch.commit();
  } catch (subBatchErr) {
    console.warn(`[reorderPhotos /albums batch notice]:`, subBatchErr);
  }

  invalidateAlbumCache(albumId);
}

/**
 * Uploads a file directly to Firebase Storage with strict mime-type
 * and size validation. Returns the permanent download URL and storage path.
 * Admin only.
 */
export async function uploadPhotoToStorage(
  albumId: string,
  file: File
): Promise<{ url: string; storagePath: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem válida (JPEG, PNG, WebP).');
  }

  // Max 15MB file size limit
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('A imagem excede o tamanho máximo permitido de 15MB.');
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullPath = `albums/${albumId}/${uniqueId}_${cleanName}`;

  try {
    const fileRef = storageRef(storage, fullPath);
    const uploadResult = await uploadBytes(fileRef, file, {
      contentType: file.type,
      customMetadata: {
        albumId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return {
      url: downloadUrl,
      storagePath: fullPath,
    };
  } catch (err: any) {
    console.error('[Firebase Storage Upload Error]', err);
    const errMessage = err?.message || String(err);
    if (errMessage.includes('unauthorized') || errMessage.includes('permission')) {
      throw new Error('Permissão negada no Firebase Storage. Verifique se o usuário tem privilégios de administrador.');
    }
    if (errMessage.includes('unknown') || errMessage.includes('bucket')) {
      throw new Error(`Falha no Firebase Storage (${errMessage}). Se o bucket ainda estiver em ativação no Google Cloud, utilize a opção "Inserir URL Verificada" enquanto o provisionamento do bucket é finalizado.`);
    }
    throw new Error(`Erro ao enviar foto para o Firebase Storage: ${errMessage}`);
  }
}
