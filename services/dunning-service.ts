/**
 * Dunning — sends payment-failure reminders to patients with past_due subscriptions.
 * Called by the daily cron. Deduped via communication_logs (max 1 reminder per 3 days).
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";

const DEMO_PATIENT_EMAIL = "paciente-demo@exemplo.com";
const DUNNING_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export async function processDunning(): Promise<{ notified: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: pastDue, error } = await supabase
    .from("patient_subscriptions")
    .select("id, clinic_id, patient_id, plan_name, patients(full_name, phone, email)")
    .eq("status", "past_due");

  if (error) throw error;

  if (!pastDue || pastDue.length === 0) return { notified: 0, skipped: 0 };

  // Batch dedup: skip patients already reminded in last 3 days
  const since = new Date(Date.now() - DUNNING_INTERVAL_MS).toISOString();
  const allPatientIds = pastDue
    .map((s) => ((s.patients as unknown) as { id?: string } | null)?.id ?? s.patient_id as string)
    .filter(Boolean);

  const alreadyNotified = new Set<string>();
  if (allPatientIds.length > 0) {
    const { data: recentLogs } = await supabase
      .from("communication_logs")
      .select("patient_id")
      .in("patient_id", allPatientIds)
      .eq("use_case", "dunning")
      .gte("created_at", since);
    (recentLogs ?? []).forEach((r) => alreadyNotified.add(r.patient_id as string));
  }

  let notified = 0, skipped = 0;

  for (const sub of pastDue) {
    const patient = (sub.patients as unknown) as {
      full_name: string;
      phone: string | null;
      email: string | null;
    } | null;

    if (!patient) { skipped++; continue; }
    if (patient.email === DEMO_PATIENT_EMAIL) { skipped++; continue; }

    const patientId = sub.patient_id as string;

    if (alreadyNotified.has(patientId)) { skipped++; continue; }

    const first = patient.full_name.split(" ")[0];
    const planName = sub.plan_name as string;

    if (patient.phone) {
      const body =
        `Olá, ${first}! ⚠️\n\n` +
        `Não conseguimos processar o pagamento do seu plano *${planName}*.\n\n` +
        `Para continuar com acesso aos seus benefícios, atualize seu método de pagamento o quanto antes. Entre em contato com a clínica se precisar de ajuda. 💚`;

      try {
        await sendWhatsAppText(patient.phone, body);
        await supabase.from("communication_logs").insert({
          clinic_id:  sub.clinic_id,
          patient_id: patientId,
          channel:    "whatsapp",
          use_case:   "dunning",
          recipient:  patient.phone,
          body,
          status:     "sent",
          provider:   "twilio",
        });
        notified++;
      } catch (e) {
        await supabase.from("communication_logs").insert({
          clinic_id:     sub.clinic_id,
          patient_id:    patientId,
          channel:       "whatsapp",
          use_case:      "dunning",
          recipient:     patient.phone,
          body,
          status:        "failed",
          provider:      "twilio",
          error_message: e instanceof Error ? e.message : "Unknown error",
        });
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  return { notified, skipped };
}
