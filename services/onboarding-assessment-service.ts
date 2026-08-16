import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicTimezone } from "@/services/clinic-service";
import type { TemplateWithStructure } from "@/lib/types";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Questionários de intake (send_on_first_appointment) COM estrutura (seções +
 * perguntas), no idioma do paciente. Usado na tela de confirmação quando os
 * questionários vêm ANTES dos dados. Só devolve para a PRIMEIRA sessão (paciente
 * sem outros agendamentos) — paciente que volta não refaz o intake.
 */
export async function getOnboardingTemplatesForPatient(input: {
  clinicId: string;
  patientId: string;
}): Promise<TemplateWithStructure[]> {
  const supabase = createSupabaseAdminClient();

  // Primeira sessão? (só o agendamento atual existe para o paciente)
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", input.patientId)
    .eq("clinic_id", input.clinicId)
    .is("deleted_at", null);
  if ((count ?? 0) > 1) return [];

  // Já respondeu algum questionário? Então não é intake novo.
  const { count: respCount } = await supabase
    .from("assessment_responses")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", input.patientId)
    .eq("clinic_id", input.clinicId);
  if ((respCount ?? 0) > 0) return [];

  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("*, assessment_sections(*, assessment_questions(*))")
    .eq("clinic_id", input.clinicId)
    .eq("is_active", true)
    .eq("send_on_first_appointment", true);
  if (!templates?.length) return [];

  const { data: p } = await supabase
    .from("patients")
    .select("locale")
    .eq("id", input.patientId)
    .maybeSingle();
  const wantEn = String(p?.locale ?? "").toLowerCase().startsWith("en");
  const matches = (templates as unknown as TemplateWithStructure[]).filter((t) =>
    wantEn
      ? String((t as { locale?: string }).locale ?? "").toLowerCase().startsWith("en")
      : !String((t as { locale?: string }).locale ?? "").toLowerCase().startsWith("en"),
  );
  const chosen = (matches.length > 0 ? matches : (templates as unknown as TemplateWithStructure[]));
  for (const t of chosen) {
    t.assessment_sections.sort((a, b) => a.order_index - b.order_index);
    for (const s of t.assessment_sections) s.assessment_questions.sort((a, b) => a.order_index - b.order_index);
  }
  return chosen;
}

/** Uma resposta de questionário enviada junto com a confirmação (questionário-primeiro). */
export type InlineAssessmentResponse = {
  template_id: string;
  answers: { question_id: string; section_id: string | null; value_number: number | null; value_text: string | null }[];
  section_scores: Record<string, { title: string; score: number; max: number }> | null;
  total_score: number;
  max_possible_score: number;
  notes: string | null;
};

/**
 * Salva respostas de intake respondidas NA tela de confirmação (antes dos dados).
 * Grava assessment_responses + assessment_answers, marca convites abertos como
 * respondidos e atualiza o rascunho do Mapa Bio³. Best-effort item a item: uma
 * falha não derruba a confirmação.
 */
export async function saveInlineAssessmentResponses(input: {
  clinicId: string;
  patientId: string;
  responses: InlineAssessmentResponse[];
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  for (const r of input.responses) {
    try {
      const maxScore = r.max_possible_score ?? 0;
      const scorePct = maxScore > 0 ? Math.round((r.total_score / maxScore) * 10000) / 100 : 0;
      const { data: response, error: rErr } = await supabase
        .from("assessment_responses")
        .insert({
          template_id: r.template_id,
          patient_id: input.patientId,
          clinic_id: input.clinicId,
          total_score: r.total_score,
          max_possible_score: maxScore,
          score_percentage: scorePct,
          section_scores: r.section_scores,
          notes: r.notes,
        })
        .select("id")
        .single();
      if (rErr || !response) continue;

      if (r.answers.length > 0) {
        await supabase.from("assessment_answers").insert(
          r.answers.map((a) => ({
            response_id: response.id,
            question_id: a.question_id,
            section_id: a.section_id ?? null,
            value_number: a.value_number ?? null,
            value_text: a.value_text ?? null,
          })),
        );
      }

      // Marca convite aberto desse template como respondido (não fica pendente).
      await supabase
        .from("assessment_invitations")
        .update({ completed_at: new Date().toISOString(), response_id: response.id })
        .eq("patient_id", input.patientId)
        .eq("template_id", r.template_id)
        .is("completed_at", null);
    } catch {
      /* não bloqueia a confirmação */
    }
  }

  // Atualiza o rascunho do Mapa Bio³ com os novos dados (silencioso).
  try {
    const { autoUpsertNeuroIdDraft } = await import("@/services/neuro-id-service");
    await autoUpsertNeuroIdDraft(input.patientId, input.clinicId, supabase);
  } catch {
    /* silencioso */
  }
}

// Cria convites (idempotente) para os templates dados e envia o link ao paciente
// por WhatsApp e e-mail. Usado tanto no onboarding (1ª sessão) quanto na reavaliação.
export async function sendAssessmentsToPatient(input: {
  clinicId: string;
  patientId: string;
  templateIds: string[];
  supabase?: SupabaseAdmin;
  /** Base absoluta para os links (ex.: derivada do host da requisição). Default: NEXT_PUBLIC_APP_URL. */
  baseUrl?: string;
  /** Agendamento de origem: o link do /f expira quando essa sessão passa. Null = avulso. */
  appointmentId?: string | null;
}): Promise<{ sent: number; links: { name: string; url: string; token: string }[] }> {
  const supabase = input.supabase ?? createSupabaseAdminClient();
  if (!input.templateIds.length) return { sent: 0, links: [] };

  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("id, name")
    .eq("clinic_id", input.clinicId)
    .eq("is_active", true)
    .in("id", input.templateIds);
  if (!templates?.length) return { sent: 0, links: [] };

  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, email, phone, locale")
    .eq("id", input.patientId)
    .maybeSingle();
  if (!patient) return { sent: 0, links: [] };

  // Idioma das mensagens ao paciente (e-mail/WhatsApp): en x pt (default pt).
  const isEn = String(patient.locale ?? "").toLowerCase().startsWith("en");

  const baseUrl = input.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  const links: { name: string; url: string; token: string }[] = [];

  for (const tpl of templates) {
    const token = crypto.randomBytes(32).toString("hex");
    const token_hash = crypto.createHash("sha256").update(token).digest("hex");
    // 30 dias de validade (explícito, não depende só do default do banco).
    const expires_at = new Date(Date.now() + 30 * 86_400_000).toISOString();

    // Já existe convite aberto (não respondido, não expirado)? Antes o código
    // PULAVA (continue), o que deixava a tela de confirmação sem os links do
    // paciente e o botão "Abrir questionário" não aparecia. Agora reaproveita o
    // convite girando o token — sempre há um link fresco e utilizável para
    // exibir/abrir, sem duplicar o questionário.
    const { data: open } = await supabase
      .from("assessment_invitations")
      .select("id")
      .eq("patient_id", input.patientId)
      .eq("template_id", tpl.id)
      .is("completed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (open) {
      // Reaproveita o convite girando o token; também atualiza o agendamento de
      // origem (quando informado) p/ o link seguir a data da sessão atual.
      const update: Record<string, unknown> = { token_hash, expires_at };
      if (input.appointmentId !== undefined) update.appointment_id = input.appointmentId;
      const { error } = await supabase
        .from("assessment_invitations")
        .update(update)
        .eq("id", open.id);
      if (error) continue;
    } else {
      const { error } = await supabase.from("assessment_invitations").insert({
        token_hash,
        template_id: tpl.id,
        patient_id: input.patientId,
        clinic_id: input.clinicId,
        expires_at,
        appointment_id: input.appointmentId ?? null,
      });
      if (error) continue;
    }
    links.push({ name: tpl.name as string, url: `${baseUrl}/f/${token}`, token });
  }

  if (links.length === 0) return { sent: 0, links: [] };

  // Reafirma o horário do PRÓXIMO agendamento do paciente (quando houver) e
  // prepara a nota "se já respondeu, desconsidere" — ambos entram tanto na
  // mensagem (WhatsApp/SMS) quanto no e-mail. Horário sempre no fuso da clínica.
  let apptLine = ""; // texto puro para WhatsApp/SMS
  let apptLineHtml = ""; // <p> para o e-mail
  try {
    const { data: nextAppt } = await supabase
      .from("appointments")
      .select("starts_at")
      .eq("patient_id", input.patientId)
      .eq("clinic_id", input.clinicId)
      .is("deleted_at", null)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextAppt?.starts_at) {
      const tz = await getClinicTimezone(input.clinicId);
      const fmt = isEn ? "en-US" : "pt-BR";
      const d = new Date(nextAppt.starts_at as string);
      const dateStr = d.toLocaleDateString(fmt, { weekday: "long", day: "numeric", month: "long", timeZone: tz });
      const timeStr = d.toLocaleTimeString(fmt, { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const at = isEn ? " at " : " às ";
      apptLine = isEn ? `Your appointment: ${dateStr}${at}${timeStr}.` : `Seu horário: ${dateStr}${at}${timeStr}.`;
      apptLineHtml = `<p style="margin:0 0 10px"><strong>${isEn ? "Your appointment" : "Seu horário"}:</strong> ${dateStr}${at}${timeStr}.</p>`;
    }
  } catch { /* horário é opcional na mensagem */ }

  const disregard = isEn
    ? "If you have already answered these, you can disregard this message."
    : "Se você já respondeu, pode desconsiderar esta mensagem.";

  const phone = patient.phone as string | null;
  if (phone) {
    const intro = isEn
      ? (links.length > 1 ? `Please fill out these ${links.length} questionnaires:` : "Please fill out this questionnaire:")
      : (links.length > 1 ? `Por favor responda estes ${links.length} questionários:` : "Por favor responda este questionário:");
    const greeting = isEn ? "Hi!" : "Olá!";
    const body =
      `${greeting} ${intro}\n\n` +
      (apptLine ? `${apptLine}\n\n` : "") +
      links.map((l) => `• ${l.name}: ${l.url}`).join("\n") +
      `\n\n${disregard}`;
    // SMS (Twilio): canal mais confiável no celular, não depende da janela de 24h do WhatsApp.
    // Requer o telefone em E.164 (com código do país); mesmo tratamento do envio WhatsApp.
    try {
      const { getTwilioClient, getTwilioFromNumber } = await import("@/lib/twilio");
      const smsTo = phone.startsWith("+") ? phone : `+${phone}`;
      await getTwilioClient().messages.create({ from: getTwilioFromNumber(), to: smsTo, body });
    } catch { /* canal opcional */ }
    // WhatsApp (best-effort): só entrega dentro da janela de 24h aberta pelo paciente.
    try {
      const { sendWhatsAppText } = await import("@/services/whatsapp-service");
      await sendWhatsAppText(phone, body);
    } catch { /* canal opcional */ }
  }

  const email = patient.email as string | null;
  if (email) {
    const items = links.map((l) => `<li style="margin:6px 0"><a href="${l.url}">${l.name}</a></li>`).join("");
    const disregardHtml = `<p style="margin:14px 0 0;color:#6B6A66;font-size:13px">${disregard}</p>`;
    const html = isEn
      ? `<p>Hi,</p>${apptLineHtml}<p>Please fill out the ${links.length > 1 ? "questionnaires" : "questionnaire"} below. It takes only a few minutes and helps a lot with your care:</p><ul>${items}</ul>${disregardHtml}<p>Thank you!</p>`
      : `<p>Olá,</p>${apptLineHtml}<p>Por favor responda ${links.length > 1 ? "os questionários" : "o questionário"} abaixo. Leva poucos minutos e ajuda muito no seu acompanhamento:</p><ul>${items}</ul>${disregardHtml}<p>Obrigado!</p>`;
    try {
      const { sendSimpleEmail } = await import("@/services/email-service");
      await sendSimpleEmail({ to: email, subject: isEn ? "Your questionnaires" : "Seus questionários", html });
    } catch { /* canal opcional */ }
  }

  return { sent: links.length, links };
}

// Onboarding: ao marcar a PRIMEIRA sessão, envia os questionários marcados
// (send_on_first_appointment). Retorna os links gerados para também poderem ser
// exibidos na tela (ex.: confirmação do paciente), além do envio WhatsApp/e-mail.
export async function sendOnboardingAssessments(appt: {
  id: string;
  clinic_id: string;
  patient_id: string;
  baseUrl?: string;
}): Promise<{ links: { name: string; url: string; token: string }[] }> {
  const supabase = createSupabaseAdminClient();

  // É a primeira sessão? (só este agendamento existe para o paciente)
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", appt.patient_id)
    .eq("clinic_id", appt.clinic_id)
    .is("deleted_at", null);
  if ((count ?? 0) > 1) return { links: [] };

  const { data: templates } = await supabase
    .from("assessment_templates")
    .select("id, locale")
    .eq("clinic_id", appt.clinic_id)
    .eq("is_active", true)
    .eq("send_on_first_appointment", true);
  if (!templates?.length) return { links: [] };

  // Escolhe a versão do formulário no idioma do paciente (en x pt-BR).
  // Se a clínica não tiver formulário no idioma do paciente, cai no que existir
  // (não deixa o paciente sem intake por causa do idioma).
  const { data: p } = await supabase
    .from("patients")
    .select("locale")
    .eq("id", appt.patient_id)
    .maybeSingle();
  const wantEn = String(p?.locale ?? "").toLowerCase().startsWith("en");
  const matches = templates.filter((t) =>
    wantEn
      ? String(t.locale ?? "").toLowerCase().startsWith("en")
      : !String(t.locale ?? "").toLowerCase().startsWith("en"),
  );
  const chosen = matches.length > 0 ? matches : templates;

  const { links } = await sendAssessmentsToPatient({
    clinicId: appt.clinic_id,
    patientId: appt.patient_id,
    templateIds: chosen.map((t) => t.id as string),
    supabase,
    baseUrl: appt.baseUrl,
    appointmentId: appt.id, // vincula o link do intake à 1ª sessão
  });
  return { links };
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
