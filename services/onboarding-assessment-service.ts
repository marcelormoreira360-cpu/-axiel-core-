import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// Cria convites (idempotente) para os templates dados e envia o link ao paciente
// por WhatsApp e e-mail. Usado tanto no onboarding (1ª sessão) quanto na reavaliação.
export async function sendAssessmentsToPatient(input: {
  clinicId: string;
  patientId: string;
  templateIds: string[];
  supabase?: SupabaseAdmin;
}): Promise<{ sent: number }> {
  const supabase = input.supabase ?? createSupabaseAdminClient();
  if (!input.templateIds.length) return { sent: 0 };

  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("id, name")
    .eq("clinic_id", input.clinicId)
    .eq("is_active", true)
    .in("id", input.templateIds);
  if (!templates?.length) return { sent: 0 };

  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, email, phone")
    .eq("id", input.patientId)
    .maybeSingle();
  if (!patient) return { sent: 0 };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const links: { name: string; url: string }[] = [];

  for (const tpl of templates) {
    // Idempotência: já existe convite aberto (não respondido, não expirado)?
    const { data: open } = await supabase
      .from("assessment_invitations")
      .select("id")
      .eq("patient_id", input.patientId)
      .eq("template_id", tpl.id)
      .is("completed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (open) continue;

    const token = crypto.randomBytes(32).toString("hex");
    const token_hash = crypto.createHash("sha256").update(token).digest("hex");
    const { error } = await supabase.from("assessment_invitations").insert({
      token_hash,
      template_id: tpl.id,
      patient_id: input.patientId,
      clinic_id: input.clinicId,
    });
    if (error) continue;
    links.push({ name: tpl.name as string, url: `${baseUrl}/f/${token}` });
  }

  if (links.length === 0) return { sent: 0 };

  const phone = patient.phone as string | null;
  if (phone) {
    const intro = links.length > 1
      ? `Por favor responda estes ${links.length} questionários:`
      : "Por favor responda este questionário:";
    const body = `Olá! ${intro}\n\n` + links.map((l) => `• ${l.name}: ${l.url}`).join("\n");
    try {
      const { sendWhatsAppText } = await import("@/services/whatsapp-service");
      await sendWhatsAppText(phone, body);
    } catch { /* canal opcional */ }
  }

  const email = patient.email as string | null;
  if (email) {
    const items = links.map((l) => `<li style="margin:6px 0"><a href="${l.url}">${l.name}</a></li>`).join("");
    const html = `<p>Olá,</p><p>Por favor responda ${links.length > 1 ? "os questionários" : "o questionário"} abaixo. Leva poucos minutos e ajuda muito no seu acompanhamento:</p><ul>${items}</ul><p>Obrigado!</p>`;
    try {
      const { sendSimpleEmail } = await import("@/services/email-service");
      await sendSimpleEmail({ to: email, subject: "Seus questionários", html });
    } catch { /* canal opcional */ }
  }

  return { sent: links.length };
}

// Onboarding: ao marcar a PRIMEIRA sessão, envia os questionários marcados
// (send_on_first_appointment). Fire-and-forget nos hooks de agendamento.
export async function sendOnboardingAssessments(appt: {
  id: string;
  clinic_id: string;
  patient_id: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // É a primeira sessão? (só este agendamento existe para o paciente)
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", appt.patient_id)
    .eq("clinic_id", appt.clinic_id)
    .is("deleted_at", null);
  if ((count ?? 0) > 1) return;

  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("id")
    .eq("clinic_id", appt.clinic_id)
    .eq("is_active", true)
    .eq("send_on_first_appointment", true);
  if (!templates?.length) return;

  await sendAssessmentsToPatient({
    clinicId: appt.clinic_id,
    patientId: appt.patient_id,
    templateIds: templates.map((t) => t.id as string),
    supabase,
  });
}

// Reavaliação automática por cadência (chamado pelo cron diário). Para cada
// template com reassessment_interval_days > 0, reenvia aos pacientes ativos cuja
// última resposta passou do intervalo e que não têm convite aberto. Idempotente.
export async function processReassessments(): Promise<{ resent: number }> {
  const supabase = createSupabaseAdminClient();
  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("id, clinic_id, reassessment_interval_days")
    .eq("is_active", true)
    .gt("reassessment_interval_days", 0);
  if (!templates?.length) return { resent: 0 };

  const nowIso = new Date().toISOString();
  let resent = 0;

  for (const tpl of templates) {
    const intervalDays = tpl.reassessment_interval_days as number;
    const cutoff = new Date(Date.now() - intervalDays * 86_400_000).toISOString();

    const { data: responses } = await supabase
      .from("assessment_responses")
      .select("patient_id, created_at")
      .eq("template_id", tpl.id)
      .eq("clinic_id", tpl.clinic_id)
      .order("created_at", { ascending: false })
      .limit(2000);

    const latestByPatient = new Map<string, string>();
    for (const r of responses ?? []) {
      if (!latestByPatient.has(r.patient_id as string)) latestByPatient.set(r.patient_id as string, r.created_at as string);
    }
    const dueIds = [...latestByPatient.entries()].filter(([, d]) => d < cutoff).map(([id]) => id);
    if (dueIds.length === 0) continue;

    const [{ data: activePatients }, { data: openInv }] = await Promise.all([
      supabase.from("patients").select("id").eq("clinic_id", tpl.clinic_id).eq("status", "active").in("id", dueIds),
      supabase.from("assessment_invitations").select("patient_id").eq("template_id", tpl.id).is("completed_at", null).gt("expires_at", nowIso).in("patient_id", dueIds),
    ]);
    const activeSet = new Set((activePatients ?? []).map((p) => p.id as string));
    const openSet = new Set((openInv ?? []).map((i) => i.patient_id as string));

    const finalIds = dueIds.filter((id) => activeSet.has(id) && !openSet.has(id)).slice(0, 50);
    for (const pid of finalIds) {
      const { sent } = await sendAssessmentsToPatient({
        clinicId: tpl.clinic_id as string,
        patientId: pid,
        templateIds: [tpl.id as string],
        supabase,
      });
      resent += sent;
    }
  }

  return { resent };
}
