import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import type { HealthAgentReport } from "../route";
import { DEFAULT_FROM_EMAIL } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-agent-send");

function buildEmailHtml(patientName: string, report: HealthAgentReport): string {
  const firstName = patientName.split(" ")[0];
  const p = report.patient;

  const positiveItems = (p.positive_points ?? [])
    .map((pt: string) => `<li style="margin-bottom:6px">✓ ${pt}</li>`)
    .join("");

  const attentionItems = (p.attention_areas ?? [])
    .map(
      (a: { area: string; explanation: string; action: string }) => `
      <div style="background:#FAFAF8;border-radius:8px;padding:12px 14px;margin-bottom:8px;">
        <p style="font-size:13px;font-weight:600;color:#0F1A2E;margin:0 0 4px">${a.area}</p>
        <p style="font-size:12px;color:#6B6A66;margin:0 0 6px">${a.explanation}</p>
        <p style="font-size:12px;color:#0F6E56;margin:0"><strong>O que fazer:</strong> ${a.action}</p>
      </div>`
    )
    .join("");

  const nextSteps = (p.next_steps ?? [])
    .map((s: string, i: number) => `<li style="margin-bottom:6px"><strong>${i + 1}.</strong> ${s}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#0F1A2E;padding:28px 32px">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:.08em;text-transform:uppercase">Relatório de saúde</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:600;color:#fff">${p.greeting ?? `Olá, ${firstName}`}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">

      <!-- Overall message -->
      <p style="font-size:14px;color:#0F1A2E;line-height:1.6;margin:0 0 24px">${p.overall_message ?? ""}</p>

      <!-- Positive points -->
      ${positiveItems ? `
      <div style="background:#E1F5EE;border-radius:10px;padding:16px 18px;margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#085041;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px">Pontos positivos</p>
        <ul style="margin:0;padding-left:4px;list-style:none;font-size:13px;color:#085041">${positiveItems}</ul>
      </div>` : ""}

      <!-- Attention areas -->
      ${attentionItems ? `
      <div style="margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#6B6A66;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px">Áreas de atenção</p>
        ${attentionItems}
      </div>` : ""}

      <!-- Next steps -->
      ${nextSteps ? `
      <div style="margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#6B6A66;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px">Próximos passos</p>
        <ul style="margin:0;padding-left:4px;list-style:none;font-size:13px;color:#0F1A2E">${nextSteps}</ul>
      </div>` : ""}

      <!-- Encouragement -->
      ${p.encouragement ? `
      <div style="border-top:1px solid #F4F3EF;padding-top:20px;margin-top:4px">
        <p style="font-size:13px;color:#0F6E56;font-style:italic;line-height:1.6;margin:0">"${p.encouragement}"</p>
      </div>` : ""}

    </div>

    <!-- Footer -->
    <div style="background:#FAFAF8;border-top:1px solid #F4F3EF;padding:18px 32px">
      <p style="margin:0;font-size:11px;color:#A09E98;line-height:1.6">
        Este relatório foi gerado por inteligência artificial com base nos seus dados clínicos e não substitui a avaliação do seu profissional de saúde.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  // ── Auth + clinic resolution ────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Usuário sem clínica associada." }, { status: 403 });
  }

  // ── Rate limiting: 20 sends per clinic per hour ─────────────────────────────
  if (!(await checkRateLimitDb(`health-agent-send:${profile.clinic_id}`, 20, 60 * 60_000))) {
    return NextResponse.json(
      { error: "Limite de envios atingido. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  // ── Feature gate: ai_insights ───────────────────────────────────────────────
  const billingCtx = await getBillingContext(profile.clinic_id);
  if (!canUseFeature(billingCtx, "ai_insights")) {
    return NextResponse.json(
      { error: "Insights com IA disponíveis no plano Professional ou superior." },
      { status: 403 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const { patientId, report } = (await req.json()) as {
      patientId?: string;
      report?: HealthAgentReport;
    };
    if (!patientId || !report) {
      return NextResponse.json({ error: "patientId e report são obrigatórios" }, { status: 400 });
    }

    // Scope the patient query to the caller's clinic — prevents sending
    // health reports for patients of other clinics.
    const { data: patient } = await supabase
      .from("patients")
      .select("full_name, email")
      .eq("id", patientId)
      .eq("clinic_id", profile.clinic_id) // ← ownership check
      .maybeSingle();

    if (!patient?.email) {
      return NextResponse.json({ error: "Paciente não possui email cadastrado" }, { status: 400 });
    }

    const resend = new Resend(apiKey);
    const firstName = patient.full_name.split(" ")[0];

    await resend.emails.send({
      from: fromEmail,
      to: patient.email,
      subject: `Seu relatório de saúde, ${firstName}`,
      html: buildEmailHtml(patient.full_name, report),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    log.error("Send health agent send error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
