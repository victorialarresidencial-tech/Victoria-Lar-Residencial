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
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServiceItem, InstitutionalContent, AdminUser, ContactLead, SuperAdminGuard } from '../types';

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
