"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import crypto from "node:crypto";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getLinkByToken(rawToken: string) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);
  const { data } = await supabase
    .from("patient_portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

// ── Update patient contact info ───────────────────────────────────────────────

export async function updatePatientContactAction(
  rawToken: string,
  updates: {
    full_name?: string;
    phone?: string;
    email?: string;
    date_of_birth?: string;
    address_line?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  },
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const supabase = createSupabaseAdminClient();
  const cleanUpdates: Record<string, string> = {};
  if (updates.full_name?.trim()) cleanUpdates.full_name = updates.full_name.trim();
  if (updates.phone?.trim()) cleanUpdates.phone = updates.phone.trim();
  if (updates.email?.trim()) cleanUpdates.email = updates.email.trim().toLowerCase();
  if (updates.date_of_birth?.trim()) cleanUpdates.date_of_birth = updates.date_of_birth.trim();
  if (updates.address_line !== undefined) cleanUpdates.address_line = updates.address_line.trim();
  if (updates.city !== undefined) cleanUpdates.city = updates.city.trim();
  if (updates.state !== undefined) cleanUpdates.state = updates.state.trim();
  if (updates.zip_code !== undefined) cleanUpdates.zip_code = updates.zip_code.trim();
  if (updates.country !== undefined) cleanUpdates.country = updates.country.trim();

  if (Object.keys(cleanUpdates).length === 0) return { ok: true, error: null };

  const { error } = await supabase
    .from("patients")
    .update(cleanUpdates)
    .eq("id", link.patient_id)
    .eq("clinic_id", link.clinic_id);

  if (error) return { ok: false, error: "Erro ao salvar. Tente novamente." };
  return { ok: true, error: null };
}

// ── Upload patient document ───────────────────────────────────────────────────

export async function uploadPortalDocumentAction(
  rawToken: string,
  formData: FormData,
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Nenhum arquivo selecionado." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Arquivo muito grande (máx. 10 MB)." };

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Tipo de arquivo não suportado. Use PDF, imagem ou texto." };
  }

  const { uploadPatientDocument } = await import("@/services/patient-document-service");
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadPatientDocument(
      buffer,
      file.name,
      file.type,
      file.size,
      link.patient_id,
      link.clinic_id,
      "portal",
      null,
    );
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Erro ao enviar arquivo. Tente novamente." };
  }
}

// ── Cancel upcoming appointment ───────────────────────────────────────────────

export async function cancelPortalAppointmentAction(
  rawToken: string,
  appointmentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const supabase = createSupabaseAdminClient();

  // Verify the appointment belongs to this patient/clinic and is in the future
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, starts_at, status, zoom_meeting_id")
    .eq("id", appointmentId)
    .eq("patient_id", link.patient_id)
    .eq("clinic_id", link.clinic_id)
    .maybeSingle();

  if (!appt) return { ok: false, error: "Agendamento não encontrado." };
  if (appt.status === "cancelled") return { ok: false, error: "Sessão já cancelada." };

  const startsAt = new Date(appt.starts_at);
  const now = new Date();
  const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil < 24) {
    return { ok: false, error: "Cancelamentos devem ser feitos com pelo menos 24h de antecedência." };
  }

  // Cancel the appointment
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) return { ok: false, error: "Erro ao cancelar. Tente novamente." };

  // Delete Zoom meeting if exists (non-blocking)
  if (appt.zoom_meeting_id) {
    import("@/services/zoom-service").then(({ deleteZoomMeeting }) =>
      deleteZoomMeeting(link.clinic_id, appt.zoom_meeting_id!).catch(() => {})
    ).catch(() => {});
  }

  return { ok: true, error: null };
}

// ── LGPD: record consent ──────────────────────────────────────────────────────

export async function recordConsentAction(
  rawToken: string,
  consentType: "data_processing" | "marketing" | "portal_access",
  granted: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("patient_consents").insert({
    clinic_id:    link.clinic_id,
    patient_id:   link.patient_id,
    consent_type: consentType,
    granted,
    source:       "portal",
  });

  if (error) return { ok: false, error: "Erro ao registrar consentimento." };
  return { ok: true, error: null };
}

// ── LGPD: request data deletion ───────────────────────────────────────────────

export async function requestDataDeletionAction(
  rawToken: string,
  reason?: string,
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const supabase = createSupabaseAdminClient();

  // Check if there's already a pending request
  const { data: existing } = await supabase
    .from("data_deletion_requests")
    .select("id, status")
    .eq("patient_id", link.patient_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Já existe uma solicitação de exclusão em análise." };
  }

  const { error } = await supabase.from("data_deletion_requests").insert({
    clinic_id:  link.clinic_id,
    patient_id: link.patient_id,
    reason:     reason?.trim() || null,
    status:     "pending",
  });

  if (error) return { ok: false, error: "Erro ao enviar solicitação. Tente novamente." };
  return { ok: true, error: null };
}
