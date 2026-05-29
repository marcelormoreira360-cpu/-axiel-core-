import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { createLogger } from "@/lib/logger";
import { APP_URL } from "@/lib/constants";

const log = createLogger("waitlist");

export interface WaitlistEntry {
  id: string;
  clinic_id: string;
  patient_id: string;
  session_type_id: string | null;
  notes: string | null;
  status: "waiting" | "notified" | "booked" | "expired" | "removed";
  notified_at: string | null;
  created_at: string;
  patients?: { full_name: string; phone: string | null; email: string | null } | null;
  session_types?: { name: string } | null;
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getWaitlist(clinicId: string): Promise<WaitlistEntry[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("waitlist_entries")
    .select("*, patients(full_name, phone, email), session_types(name)")
    .eq("clinic_id", clinicId)
    .in("status", ["waiting", "notified"])
    .order("created_at", { ascending: true });
  return (data ?? []) as WaitlistEntry[];
}

export async function getWaitlistCount(clinicId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("waitlist_entries")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "waiting");
  return count ?? 0;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function addToWaitlist(params: {
  clinicId: string;
  patientId: string;
  sessionTypeId?: string | null;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();

  // Check if patient is already waiting
  const { data: existing } = await supabase
    .from("waitlist_entries")
    .select("id, status")
    .eq("clinic_id", params.clinicId)
    .eq("patient_id", params.patientId)
    .eq("status", "waiting")
    .maybeSingle();

  if (existing) return { ok: false, error: "Paciente já está na fila de espera." };

  const { error } = await supabase.from("waitlist_entries").insert({
    clinic_id:       params.clinicId,
    patient_id:      params.patientId,
    session_type_id: params.sessionTypeId ?? null,
    notes:           params.notes ?? null,
    status:          "waiting",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeFromWaitlist(entryId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("waitlist_entries")
    .update({ status: "removed" })
    .eq("id", entryId);
}

export async function markWaitlistBooked(patientId: string, clinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("waitlist_entries")
    .update({ status: "booked" })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["waiting", "notified"]);
}

// ── Notify ────────────────────────────────────────────────────────────────────

/**
 * Called when an appointment is cancelled.
 * Sends WhatsApp to the first MAX_NOTIFY waiting patients with the booking link.
 * Non-blocking — catches all errors internally.
 */
const MAX_NOTIFY = 3;

export async function notifyWaitlistOnCancellation(params: {
  clinicId: string;
  clinicSlug: string;
  cancelledStartsAt: string;
  sessionTypeName?: string;
}): Promise<void> {
  const { clinicId, clinicSlug, cancelledStartsAt, sessionTypeName } = params;
  const supabase = createSupabaseAdminClient();

  // Get first waiting patients (FIFO order)
  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select("id, patient_id, patients(full_name, phone)")
    .eq("clinic_id", clinicId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(MAX_NOTIFY);

  if (!entries?.length) return;

  const bookingUrl = `${APP_URL}/book/${clinicSlug}`;
  const date = new Date(cancelledStartsAt);
  const dateStr = date.toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const sessionLabel = sessionTypeName ? ` de ${sessionTypeName}` : "";

  for (const entry of entries) {
    const patient = Array.isArray(entry.patients) ? entry.patients[0] : entry.patients;
    if (!patient?.phone) continue;

    const firstName = (patient.full_name as string).split(" ")[0];
    const msg =
      `Olá, ${firstName}! 🌿\n\n` +
      `Uma vaga${sessionLabel} ficou disponível na agenda:\n` +
      `📅 ${dateStr} às ${timeStr}\n\n` +
      `Acesse o link para agendar antes que outra pessoa reserve:\n${bookingUrl}`;

    try {
      await sendWhatsAppText(patient.phone as string, msg);
      await supabase
        .from("waitlist_entries")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", entry.id);
      log.info("waitlist notified", { entry_id: entry.id, patient_id: entry.patient_id });
    } catch (err) {
      log.error("waitlist notify failed", { entry_id: entry.id, error: err });
    }
  }
}
