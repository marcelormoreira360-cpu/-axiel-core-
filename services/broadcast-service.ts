import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { createLogger } from "@/lib/logger";

const log = createLogger("broadcast");

export type BroadcastSegment = "all_active" | "inactive_30" | "inactive_60" | "custom";

export interface BroadcastPatient {
  id: string;
  full_name: string;
  phone: string;
}

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  failedNames: string[];
}

// ── Segment queries ───────────────────────────────────────────────────────────

export async function getBroadcastPatients(
  clinicId: string,
  segment: BroadcastSegment,
  customIds?: string[],
): Promise<BroadcastPatient[]> {
  const supabase = createSupabaseAdminClient();

  if (segment === "custom" && customIds?.length) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinicId)
      .in("id", customIds)
      .not("phone", "is", null)
      .neq("phone", "");
    return (data ?? []) as BroadcastPatient[];
  }

  if (segment === "all_active") {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .not("phone", "is", null)
      .neq("phone", "");
    return (data ?? []) as BroadcastPatient[];
  }

  // inactive_30 or inactive_60: patients with last appointment older than N days
  // (or patients who never had a session at all)
  const days = segment === "inactive_30" ? 30 : 60;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Active patients with phone
  const { data: activePats } = await supabase
    .from("patients")
    .select("id, full_name, phone")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .not("phone", "is", null)
    .neq("phone", "");

  if (!activePats?.length) return [];

  // Latest appointment per patient
  const patientIds = activePats.map((p) => p.id);
  const { data: appts } = await supabase
    .from("appointments")
    .select("patient_id, starts_at")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds)
    .in("status", ["confirmed", "completed"])
    .order("starts_at", { ascending: false });

  // Build map of last session per patient
  const lastSession = new Map<string, string>();
  for (const a of appts ?? []) {
    if (!lastSession.has(a.patient_id as string)) {
      lastSession.set(a.patient_id as string, a.starts_at as string);
    }
  }

  // Filter: last session before cutoff OR never had a session
  return activePats.filter((p) => {
    const last = lastSession.get(p.id);
    return !last || last < cutoff;
  }) as BroadcastPatient[];
}

// ── Segment counts (for preview before sending) ───────────────────────────────

export async function getBroadcastCount(
  clinicId: string,
  segment: BroadcastSegment,
): Promise<number> {
  const patients = await getBroadcastPatients(clinicId, segment);
  return patients.length;
}

// ── Send broadcast ────────────────────────────────────────────────────────────

/**
 * Sends a WhatsApp broadcast to all patients in the segment.
 * Processes sequentially with a small delay to respect rate limits.
 * Returns a summary of sent / failed counts.
 */
export async function sendBroadcast(params: {
  clinicId: string;
  userId: string;
  segment: BroadcastSegment;
  title: string;
  messageBody: string;
  customIds?: string[];
}): Promise<BroadcastResult> {
  const { clinicId, userId, segment, title, messageBody, customIds } = params;

  const patients = await getBroadcastPatients(clinicId, segment, customIds);
  const supabase = createSupabaseAdminClient();

  let sent = 0;
  let failed = 0;
  const failedNames: string[] = [];

  for (const patient of patients) {
    // Interpolate {{nome}}
    const body = messageBody
      .replace(/{{nome}}/gi, patient.full_name.split(" ")[0])
      .replace(/{{nome_completo}}/gi, patient.full_name);

    try {
      await sendWhatsAppText(patient.phone, body);
      sent++;
    } catch (err) {
      failed++;
      failedNames.push(patient.full_name);
      log.error("broadcast send failed", { patient_id: patient.id, error: err });
    }

    // Small delay between sends to respect rate limits (~10 msg/s safe limit)
    if (patients.indexOf(patient) < patients.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  // Log the campaign
  const status = failed === 0 ? "completed" : sent === 0 ? "failed" : "partial";
  await supabase.from("broadcast_campaigns").insert({
    clinic_id:        clinicId,
    created_by:       userId,
    title,
    segment,
    message_body:     messageBody,
    total_recipients: patients.length,
    sent_count:       sent,
    failed_count:     failed,
    status,
  });

  return { total: patients.length, sent, failed, failedNames };
}

// ── Recent campaigns ──────────────────────────────────────────────────────────

export interface BroadcastCampaign {
  id: string;
  title: string;
  segment: BroadcastSegment;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: "completed" | "failed" | "partial";
  created_at: string;
}

export async function getRecentBroadcasts(
  clinicId: string,
  limit = 10,
): Promise<BroadcastCampaign[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("broadcast_campaigns")
    .select("id, title, segment, total_recipients, sent_count, failed_count, status, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as BroadcastCampaign[];
}
