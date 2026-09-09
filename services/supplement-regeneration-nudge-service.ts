import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import { getPack } from "@/modules/clinical-packs/registry";
import { SUPPLEMENT_REASONING_VERSION } from "@/modules/ai-insights/supplement-reasoning";
import { shouldNudgeRegeneration } from "@/services/ai-insight/supplement-queue-logic";
import { sendSimpleEmail } from "@/services/email-service";

const log = createLogger("supplement-regeneration-nudge");
// Mesma fonte dos demais serviços de notificação (monthly-report/trial-expiry):
// gestores resolvidos por users.clinic_id + role.
const MANAGER_ROLES = ["clinic_owner", "clinic_manager", "admin", "platform_admin"];

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nudgeEmailHtml(clinicName: string, eligible: number, pending: number, sendable: number): string {
  const base = appUrl();
  const link = base ? `${base}/settings/supplements/regeneration` : null;
  const linhas = [
    eligible > 0 ? `<li><b>${eligible}</b> paciente(s) com suplementação a atualizar</li>` : "",
    pending > 0 ? `<li><b>${pending}</b> na fila, aguardando processamento</li>` : "",
    sendable > 0 ? `<li><b>${sendable}</b> aprovado(s) prontos para enviar</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  return [
    `<p>Olá! Há trabalho de suplementação esperando na ${esc(clinicName)}:</p>`,
    `<ul>${linhas}</ul>`,
    link
      ? `<p><a href="${link}">Abrir a tela de atualização de suplementação</a></p>`
      : `<p>Acesse Configurações &gt; Personalizar minha clínica &gt; Atualizar suplementação.</p>`,
    `<p style="color:#888;font-size:12px">Nada é gerado ou enviado automaticamente. Você revisa e dispara.</p>`,
  ].join("");
}

/**
 * Fase 2b — CRON DE NOTIFICAÇÃO. Não gera nem envia nada: varre as clínicas cujo
 * pack gera suplementação e, quando há trabalho (pacientes a atualizar, fila
 * pendente, ou aprovados a enviar), avisa os gestores por e-mail. Roda com service
 * role (cron, sem sessão). O pipeline de geração continua sendo disparado pelo
 * gestor autenticado; aqui só existe o "toque" para ele não precisar lembrar.
 */
export async function notifySupplementRegenerationWork(): Promise<{ clinicsNotified: number; emailsSent: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: clinics } = await supabase.from("clinics").select("id, name, clinical_pack_id");

  let clinicsNotified = 0;
  let emailsSent = 0;

  for (const clinic of (clinics ?? []) as Array<{ id: string; name: string | null; clinical_pack_id: string | null }>) {
    if (!getPack(clinic.clinical_pack_id).producesSupplementation) continue;

    const [eligibleRes, sendableRes, pendingRes] = await Promise.all([
      supabase.rpc(
        "eligible_supplement_regeneration_patients",
        { p_clinic: clinic.id, p_version: SUPPLEMENT_REASONING_VERSION },
        { count: "exact", head: true },
      ),
      supabase
        .from("supplement_regeneration_jobs")
        .select("id, ai_insights!inner(review_status)", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("status", "done")
        .is("sent_at", null)
        .eq("ai_insights.review_status", "final"),
      supabase
        .from("supplement_regeneration_jobs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("status", "pending"),
    ]);

    const eligible = eligibleRes.count ?? 0;
    const sendable = sendableRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    if (!shouldNudgeRegeneration(eligible, pending, sendable)) continue;

    const { data: managers } = await supabase
      .from("users")
      .select("email")
      .eq("clinic_id", clinic.id)
      .in("role", MANAGER_ROLES);
    const emails = [...new Set((managers ?? []).map((m) => m.email).filter((e): e is string => !!e))];
    if (emails.length === 0) continue;

    const html = nudgeEmailHtml(clinic.name ?? "sua clínica", eligible, pending, sendable);
    for (const email of emails) {
      try {
        await sendSimpleEmail({ to: email, subject: "Suplementação: há atualizações a revisar", html });
        emailsSent++;
      } catch (e) {
        log.error("falha ao notificar gestor", e, { clinic: clinic.id });
      }
    }
    clinicsNotified++;
  }

  return { clinicsNotified, emailsSent };
}
