"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPatientById } from "@/services/patient-service";
import { createNeuroIdAssessment, updateNeuroIdAssessment, importQuestionnaireAnswers, getLatestNeuroIdMap, type QuestionnaireImport } from "@/services/neuro-id-service";
import { buildNeuroIdPatientReportPdf } from "@/services/neuro-id-pdf-service";
import { sendSimpleEmail } from "@/services/email-service";
import { sendPushToPatient } from "@/services/push-service";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function createNeuroIdAssessmentAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) throw new Error("Paciente obrigatório");

  // Hardening: paciente precisa pertencer à clínica do usuário (RLS-scoped).
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) throw new Error("Paciente não encontrado nesta clínica.");

  // Campos vêm como item__<code>. Mantém só os preenchidos.
  const values: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith("item__")) continue;
    const raw = String(val).trim();
    if (raw === "") continue;
    values[key.slice("item__".length)] = raw;
  }

  await createNeuroIdAssessment({
    clinicId: profile.clinic_id,
    patientId,
    createdBy: profile.id,
    values,
  });

  revalidatePath(`/patients/${patientId}`);
}

/**
 * "Rever / editar": corrige a MESMA avaliação (não cria reavaliação). Recebe o
 * assessment_id + os itens preenchidos e regrava valores/scores in-place.
 */
export async function updateNeuroIdAssessmentAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!patientId) throw new Error("Paciente obrigatório");
  if (!assessmentId) throw new Error("Avaliação obrigatória");

  // Hardening: paciente precisa pertencer à clínica do usuário (RLS-scoped).
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) throw new Error("Paciente não encontrado nesta clínica.");

  const values: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith("item__")) continue;
    const raw = String(val).trim();
    if (raw === "") continue;
    values[key.slice("item__".length)] = raw;
  }

  await updateNeuroIdAssessment({
    assessmentId,
    clinicId: profile.clinic_id,
    patientId,
    values,
  });

  revalidatePath(`/patients/${patientId}`);
}

/**
 * §8: importa as respostas de questionário do paciente → rascunho 0–10 (auto)
 * para revisão humana. NÃO grava; a gravação ocorre no createNeuroIdAssessmentAction.
 */
export async function importQuestionnaireAnswersAction(
  patientId: string,
): Promise<QuestionnaireImport & { error?: string }> {
  const empty: QuestionnaireImport = { draft: {}, sources: {}, origins: {}, missing: [], unanswered: [], phq9Item9: null };
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ...empty, error: "Não autorizado." };
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) return { ...empty, error: "Paciente não encontrado nesta clínica." };
  try {
    return await importQuestionnaireAnswers(patientId, profile.clinic_id);
  } catch {
    return { ...empty, error: "Não foi possível importar as respostas agora." };
  }
}

/**
 * Envia ao PACIENTE, por e-mail (PDF anexo) + push (best-effort), o relatório
 * do Mapa Bio³ (versão do paciente — a mesma do botão "Ver PDF"). Registro em
 * communication_logs (channel email, use_case neuro_id_report) para auditoria.
 * Texto neutro, sem promessa de resultado.
 */
export async function sendNeuroIdReportToPatientAction(
  patientId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { error: "Não autorizado." };

  // Hardening: paciente precisa pertencer à clínica do usuário (RLS-scoped).
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) return { error: "Paciente não encontrado nesta clínica." };
  if (!patient.email) return { error: "Paciente sem e-mail cadastrado." };

  const map = await getLatestNeuroIdMap(patientId);
  if (!map) return { error: "Nenhum Mapa Bio³ disponível para enviar." };

  // Marca da clínica (mesmo caminho da rota /api/patients/[id]/neuro-id/pdf).
  let brand: { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null } = {};
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("clinics")
      .select("name, logo_url, primary_color, report_tagline")
      .eq("id", profile.clinic_id)
      .single();
    if (data) brand = { name: data.name, logoUrl: data.logo_url, primaryColor: data.primary_color, tagline: data.report_tagline };
  } catch { /* usa defaults */ }

  // Gera o PDF do RELATÓRIO DO PACIENTE (mesmos dados da rota de "Ver PDF").
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildNeuroIdPatientReportPdf({
      map,
      patientName: patient.full_name ?? null,
      clinic: brand,
      vars: {
        q1: patient.chief_complaint ?? null,
        q2: null,
        sintoma: patient.chief_complaint ?? null,
      },
    });
  } catch {
    return { error: "Não foi possível gerar o PDF do relatório." };
  }

  // Assunto/corpo no idioma da clínica (namespace emails).
  const locale = await resolveClinicLocale(profile.clinic_id);
  const t = await getServerT(locale, "emails");
  const clinicName = brand.name ?? t("defaultClinic");
  const firstName = (patient.full_name ?? "").trim().split(/\s+/)[0] || "";
  const subject = t("neuroIdReport.subject", { clinic: clinicName });
  const html =
    `<p>${firstName ? t("neuroIdReport.greeting", { name: firstName }) : t("neuroIdReport.greetingNoName")}</p>` +
    `<p>${t("neuroIdReport.intro")}</p>` +
    `<p>${t("neuroIdReport.outro")}</p>`;
  const safeName = (patient.full_name ?? "paciente").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paciente";
  const pdfFilename = `mapa-bio3-${safeName}.pdf`;

  try {
    await sendSimpleEmail({
      to: patient.email,
      subject,
      html,
      attachments: [{ filename: pdfFilename, content: pdfBuffer }],
    });
  } catch (e) {
    // Registro da falha para auditoria (best-effort; não mascara o erro real).
    try {
      const admin = createSupabaseAdminClient();
      await admin.from("communication_logs").insert({
        clinic_id: profile.clinic_id,
        patient_id: patientId,
        created_by: profile.id,
        channel: "email",
        use_case: "neuro_id_report",
        recipient: patient.email,
        subject,
        body: t("neuroIdReport.intro"),
        status: "failed",
        provider: "resend",
        error_message: e instanceof Error ? e.message : String(e),
      });
    } catch { /* log não pode quebrar o retorno */ }
    return { error: e instanceof Error ? e.message : "Falha ao enviar o e-mail." };
  }

  // Push ao paciente (se houver assinatura) — tolerante a falha.
  try {
    await sendPushToPatient(patientId, {
      title: t("neuroIdReport.pushTitle"),
      body: t("neuroIdReport.pushBody"),
      tag: `neuro-id-report-${patientId}`,
    });
  } catch { /* push é best-effort */ }

  // Registro permanente do envio (padrão dos outros envios ao paciente).
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("communication_logs").insert({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      created_by: profile.id,
      channel: "email",
      use_case: "neuro_id_report",
      recipient: patient.email,
      subject,
      body: t("neuroIdReport.intro"),
      status: "sent",
      provider: "resend",
    });
  } catch { /* auditoria não deve quebrar o envio */ }

  return { ok: true };
}
