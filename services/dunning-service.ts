/**
 * Dunning — sends payment-failure reminders to patients with past_due subscriptions.
 * Called by the daily cron. Deduped via communication_logs (max 1 reminder per 3 days).
 *
 * Canal (item 4 Fase 1): respeita o opt-in por canal (patient_consents). Como e
 * mensagem transacional, envia em qualquer canal que o paciente NAO tenha feito
 * opt-out explicito (ver canSendTransactional). Preferencia WhatsApp -> e-mail;
 * se o WhatsApp falhar e houver e-mail permitido, cai para o e-mail.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { sendSimpleEmail } from "@/services/email-service";
import {
  getChannelConsentsForPatients,
  canSendTransactional,
} from "@/services/channel-consent-service";

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

  // Opt-in por canal, em lote (uma consulta para todos os inadimplentes).
  const consentsByPatient = await getChannelConsentsForPatients(allPatientIds, supabase);

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
    const consents = consentsByPatient.get(patientId);

    // Canais disponiveis para ESTE paciente, respeitando opt-out por canal.
    const whatsappOk = !!patient.phone && canSendTransactional(consents?.whatsapp ?? "unknown");
    const emailOk = !!patient.email && canSendTransactional(consents?.email ?? "unknown");

    const text =
      `Olá, ${first}! ⚠️\n\n` +
      `Não conseguimos processar o pagamento do seu plano *${planName}*.\n\n` +
      `Para continuar com acesso aos seus benefícios, atualize seu método de pagamento o quanto antes. Entre em contato com a clínica se precisar de ajuda. 💚`;

    // Preferencia: WhatsApp -> e-mail (fallback tambem quando o WhatsApp falha).
    let sent = false;
    if (whatsappOk) {
      sent = await deliverWhatsApp(supabase, sub, patientId, patient.phone as string, text);
    }
    if (!sent && emailOk) {
      sent = await deliverEmail(supabase, sub, patientId, patient.email as string, text);
    }
    if (sent) notified++;
    else skipped++;
  }

  return { notified, skipped };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

type DunningSub = { clinic_id: string; plan_name?: string };

async function deliverWhatsApp(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sub: DunningSub,
  patientId: string,
  phone: string,
  body: string
): Promise<boolean> {
  try {
    await sendWhatsAppText(phone, body);
    await supabase.from("communication_logs").insert({
      clinic_id: sub.clinic_id, patient_id: patientId, channel: "whatsapp",
      use_case: "dunning", recipient: phone, body, status: "sent", provider: "twilio",
    });
    return true;
  } catch (e) {
    await supabase.from("communication_logs").insert({
      clinic_id: sub.clinic_id, patient_id: patientId, channel: "whatsapp",
      use_case: "dunning", recipient: phone, body, status: "failed",
      provider: "twilio", error_message: errMsg(e),
    });
    return false;
  }
}

async function deliverEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sub: DunningSub,
  patientId: string,
  email: string,
  body: string
): Promise<boolean> {
  const subject = "Falha no pagamento do seu plano";
  // Escapa dados do paciente (nome/plano) antes de injetar no HTML do e-mail.
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<p>${esc(body).replace(/\n/g, "<br/>")}</p>`;
  try {
    await sendSimpleEmail({ to: email, subject, html });
    await supabase.from("communication_logs").insert({
      clinic_id: sub.clinic_id, patient_id: patientId, channel: "email",
      use_case: "dunning", recipient: email, subject, body, status: "sent", provider: "resend",
    });
    return true;
  } catch (e) {
    await supabase.from("communication_logs").insert({
      clinic_id: sub.clinic_id, patient_id: patientId, channel: "email",
      use_case: "dunning", recipient: email, subject, body, status: "failed",
      provider: "resend", error_message: errMsg(e),
    });
    return false;
  }
}
