/**
 * Trial expiry — avisa o dono da clínica por e-mail quando o período de teste
 * está acabando (D-3 e D-1). Chamado pelo cron diário (/api/cron/automations).
 *
 * Idempotente: cada aviso (D-3 / D-1) é registrado em communication_logs com
 * use_case dedicado ('trial_expiry_d3' / 'trial_expiry_d1') — mesmo padrão de
 * dedup do dunning-service. Antes de enviar, verifica se já existe log 'sent'
 * para a clínica dentro da janela do trial atual.
 */

import { render } from "@react-email/render";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";
import { TrialExpiryEmail } from "@/components/email/trial-expiry-email";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

// Marcos de aviso. O use_case identifica o aviso no communication_logs (dedup).
const MILESTONES = [
  { daysLeft: 3 as const, useCase: "trial_expiry_d3", subjectKey: "trialExpiry.subject3d" },
  { daysLeft: 1 as const, useCase: "trial_expiry_d1", subjectKey: "trialExpiry.subject1d" },
];

/**
 * Diferença em dias de calendário (UTC) entre `now` e `target`.
 * Compara apenas a DATA (ano/mês/dia em UTC), ignorando o horário — assim um
 * trial_ends_at às 03h ou às 23h cai no mesmo "dia", independente do fuso em
 * que o cron roda.
 */
function calendarDaysUntil(target: Date, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((end - today) / DAY_MS);
}

export async function processTrialExpiryEmails(): Promise<{ sent: number; skipped: number; failed: number }> {
  const supabase = createSupabaseAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();

  // Janela ampla por timestamp (ontem → +5 dias). O marco exato (D-3/D-1) é
  // decidido por diferença de datas UTC em calendarDaysUntil — timezone-safe.
  const windowStart = new Date(now.getTime() - DAY_MS).toISOString();
  const windowEnd = new Date(now.getTime() + 5 * DAY_MS).toISOString();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("clinic_id, trial_ends_at, status, clinics(name)")
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", windowStart)
    .lte("trial_ends_at", windowEnd);

  if (error) throw error;
  if (!subs || subs.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  type TrialSubscriptionRow = {
    clinic_id: string;
    trial_ends_at: string;
    status: string;
    clinics: unknown;
  };

  async function processSubscription(sub: TrialSubscriptionRow): Promise<"sent" | "skipped"> {
    const trialEnd = new Date(sub.trial_ends_at as string);
    const daysLeft = calendarDaysUntil(trialEnd, now);

    const milestone = MILESTONES.find((m) => m.daysLeft === daysLeft);
    if (!milestone) return "skipped";

    const clinicId = sub.clinic_id as string;
    const clinic = (sub.clinics as unknown) as { name: string } | null;
    const clinicName = clinic?.name ?? "AXIEL Core";

    // Dedup: já enviamos este aviso para esta clínica neste trial?
    // Janela limitada ao trial atual (começo ≈ trial_ends_at - 90d) para não
    // bloquear um eventual novo trial futuro da mesma clínica.
    const dedupSince = new Date(trialEnd.getTime() - 90 * DAY_MS).toISOString();
    const { data: existing } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("use_case", milestone.useCase)
      .eq("status", "sent")
      .gte("created_at", dedupSince)
      .limit(1);

    if (existing && existing.length > 0) return "skipped";

    // Dono da clínica (mesmo padrão do monthly-report-service)
    const { data: owners } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicId)
      .in("role", ["clinic_owner", "admin", "platform_admin"])
      .limit(1);

    if (!owners || owners.length === 0) return "skipped";

    const { data: authUser } = await supabase.auth.admin.getUserById(owners[0].id);
    const ownerEmail = authUser?.user?.email;
    if (!ownerEmail) return "skipped";

    const locale = await resolveClinicLocale(clinicId);
    const t = await getServerT(locale, "emails");
    const trialEndDate = trialEnd.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const subject = t(milestone.subjectKey, { clinic: clinicName });
    const ctaUrl = `${APP_URL}/billing`;

    const html = await render(
      TrialExpiryEmail({
        clinicName,
        daysLeft: milestone.daysLeft,
        trialEndDate,
        ctaUrl,
        t,
        locale,
      })
    );

    try {
      const { error: sendError } = await resend.emails.send({
        from: DEFAULT_FROM_EMAIL,
        to: ownerEmail,
        subject,
        html,
      });
      if (sendError) throw new Error(sendError.message);

      await supabase.from("communication_logs").insert({
        clinic_id: clinicId,
        channel:   "email",
        use_case:  milestone.useCase,
        recipient: ownerEmail,
        subject,
        body:      t("trialExpiry.intro", { clinic: clinicName, date: trialEndDate }),
        status:    "sent",
        provider:  "resend",
      });

      return "sent";
    } catch (e) {
      // Registra a falha (status 'failed' NÃO bloqueia o dedup — retenta amanhã)
      await supabase.from("communication_logs").insert({
        clinic_id:     clinicId,
        channel:       "email",
        use_case:      milestone.useCase,
        recipient:     ownerEmail,
        subject,
        body:          t("trialExpiry.intro", { clinic: clinicName, date: trialEndDate }),
        status:        "failed",
        provider:      "resend",
        error_message: e instanceof Error ? e.message : "Unknown error",
      });
      throw e;
    }
  }

  // Clínicas em paralelo — falha em uma não bloqueia as outras
  const results = await Promise.allSettled(subs.map((s) => processSubscription(s)));

  let sent = 0, skipped = 0, failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      r.value === "sent" ? sent++ : skipped++;
    } else {
      console.error("[trial-expiry] clinic failed:", r.reason);
      failed++;
    }
  }

  return { sent, skipped, failed };
}
