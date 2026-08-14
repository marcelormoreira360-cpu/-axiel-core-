"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { confirmAppointmentByToken, cancelAppointmentByToken } from "@/services/appointment-service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: FormDataEntryValue | null, max = 200): string {
  return ((v as string) ?? "").trim().slice(0, max);
}

export async function confirmAppointmentAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean; questionnaires?: { name: string; token: string }[] }> {
  const token = clean(formData.get("token"), 128);
  if (!token) return { error: "Link inválido." };

  if (!(await checkRateLimitDb(`confirm-appt:${token.slice(0, 16)}`, 10, 60 * 60_000))) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const fullName = clean(formData.get("full_name"), 120);
  const email = clean(formData.get("email"), 160).toLowerCase();
  const phoneRaw = clean(formData.get("phone"), 40);
  const cpf = clean(formData.get("cpf"), 20) || null;
  const dob = clean(formData.get("date_of_birth"), 10) || null;
  const addressLine = clean(formData.get("address_line"), 200) || null;
  const neighborhood = clean(formData.get("neighborhood"), 120) || null;
  const city = clean(formData.get("city"), 120) || null;
  const state = clean(formData.get("state"), 40) || null;
  const zipCode = clean(formData.get("zip_code"), 20) || null;
  const country = clean(formData.get("country"), 60) || "Brasil";

  const consentData = formData.get("consent_data") === "on";
  const consentAnalytics = formData.get("consent_analytics") === "on";

  // Questionários respondidos NA tela (fluxo questionário-primeiro). JSON no
  // campo `responses`. Se vier, salvamos as respostas e NÃO enviamos o intake
  // por link/e-mail (já foi respondido aqui).
  type InlineResp = import("@/services/onboarding-assessment-service").InlineAssessmentResponse;
  let inlineResponses: InlineResp[] = [];
  const responsesRaw = formData.get("responses");
  if (typeof responsesRaw === "string" && responsesRaw.trim()) {
    try {
      const parsed = JSON.parse(responsesRaw);
      if (Array.isArray(parsed)) inlineResponses = parsed as InlineResp[];
    } catch { /* ignora payload malformado */ }
  }

  if (!fullName) return { error: "Informe seu nome completo." };
  if (email && !EMAIL_RE.test(email)) return { error: "E-mail inválido." };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: "Data de nascimento inválida." };
  if (!consentData) return { error: "É necessário aceitar o tratamento dos seus dados para confirmar." };

  // Aceite da política de no-show pelo link de confirmação (canal confirm_link).
  const policyAccepted = formData.get("policy_accepted") === "on";

  // Guard de servidor da política (igual ao booking web): se a clínica cobra falta e o
  // aceite não veio, não confirma. O checkbox do front é burlável; a checagem real é aqui.
  {
    const { getAppointmentByConfirmToken } = await import("@/services/appointment-service");
    const preInfo = await getAppointmentByConfirmToken(token);
    if (preInfo?.clinic_id) {
      const { getClinicPolicyPresentation } = await import("@/services/no-show-policy-presentation");
      const pres = await getClinicPolicyPresentation(preInfo.clinic_id);
      if (pres.clinicCharges && !policyAccepted) {
        return { error: "Para confirmar, leia e aceite a política de agendamento e cancelamento." };
      }
    }
  }

  const phone = phoneRaw ? phoneRaw.replace(/\D/g, "") || phoneRaw : null;

  const result = await confirmAppointmentByToken(token, {
    full_name: fullName,
    email: email || null,
    phone,
    cpf,
    date_of_birth: dob,
    address_line: addressLine,
    neighborhood,
    city,
    state,
    zip_code: zipCode,
    country,
  });

  if (!result.ok || !result.patientId || !result.clinicId) {
    return { error: result.error ?? "Não foi possível confirmar." };
  }

  // A ficha do paciente e a agenda devem refletir os dados recém-confirmados.
  revalidatePath(`/patients/${result.patientId}`);
  revalidatePath("/schedule");

  // Consentimentos (LGPD) — best-effort
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : (h.get("x-real-ip") ?? null);
  const ua = h.get("user-agent");
  const supabase = createSupabaseAdminClient();
  await supabase.from("patient_consents").insert([
    { clinic_id: result.clinicId, patient_id: result.patientId, consent_type: "data_processing", granted: true, ip_address: ip, user_agent: ua ? ua.slice(0, 300) : null, source: "onboarding" },
    { clinic_id: result.clinicId, patient_id: result.patientId, consent_type: "analytics_anonymized", granted: consentAnalytics, ip_address: ip, user_agent: ua ? ua.slice(0, 300) : null, source: "onboarding" },
  ]);

  // Prova do aceite da política de no-show (canal confirm_link). Mesma tabela append-only,
  // com consent_type='no_show_policy' + policy_version + appointment_id, igual ao booking
  // web. Best-effort: se falhar, a confirmação persiste e a fila de decisão de taxa
  // mostrará "consentimento: ausente". Nunca leva dado clínico.
  if (policyAccepted && result.appointmentId) {
    try {
      const { recordNoShowPolicyConsent } = await import("@/services/no-show-consent-service");
      await recordNoShowPolicyConsent(
        {
          clinicId: result.clinicId,
          patientId: result.patientId,
          appointmentId: result.appointmentId,
          granted: true,
          source: "confirm_link",
          ip,
          userAgent: ua ? ua.slice(0, 300) : null,
        },
        supabase,
      );
    } catch { /* não bloqueia a confirmação */ }
  }

  // Side-effects pós-confirmação (fire-and-forget): integrações + automações
  if (result.appointmentId && result.startsAt) {
    import("@/services/appointment-service").then(({ runIntegrationsForAppointment }) =>
      runIntegrationsForAppointment(result.appointmentId!).catch(() => {}),
    ).catch(() => {});
    import("@/services/automation-service").then(({ scheduleAutomations }) =>
      scheduleAutomations({ id: result.appointmentId!, clinic_id: result.clinicId!, patient_id: result.patientId!, starts_at: result.startsAt! }).catch(() => {}),
    ).catch(() => {});
  }

  // Questionário-PRIMEIRO: se o paciente respondeu os questionários NESTA tela,
  // salvamos as respostas e NÃO enviamos o intake por link/e-mail.
  if (inlineResponses.length > 0) {
    try {
      const { saveInlineAssessmentResponses } = await import("@/services/onboarding-assessment-service");
      await saveInlineAssessmentResponses({
        clinicId: result.clinicId,
        patientId: result.patientId,
        responses: inlineResponses,
      });
    } catch { /* não bloqueia a confirmação */ }
    return { success: true, questionnaires: [] };
  }

  // Fallback (sem respostas inline — ex.: paciente que volta): mantém o envio dos
  // questionários de entrada por link/e-mail e devolve os tokens para a tela.
  let questionnaires: { name: string; token: string }[] = [];
  if (result.appointmentId) {
    try {
      const fwdHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
      const proto = h.get("x-forwarded-proto") ?? (fwdHost.startsWith("localhost") ? "http" : "https");
      const baseUrl = fwdHost ? `${proto}://${fwdHost}` : "";
      const { sendOnboardingAssessments } = await import("@/services/onboarding-assessment-service");
      const r = await sendOnboardingAssessments({
        id: result.appointmentId,
        clinic_id: result.clinicId,
        patient_id: result.patientId,
        baseUrl,
      });
      questionnaires = r.links.map((l) => ({ name: l.name, token: l.token }));
    } catch { /* não bloqueia a confirmação */ }
  }

  return { success: true, questionnaires };
}

/**
 * Cancelamento self-service pelo paciente. Rate limit próprio (mais apertado que
 * o de confirmação, pois é ação destrutiva). Retorna o status resultante para a
 * UI escolher a mensagem (com aviso vs tardio) sem expor rótulo frio ao paciente.
 */
export async function cancelAppointmentAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean; status?: "cancelled_notice" | "late_cancel" }> {
  const token = clean(formData.get("token"), 128);
  if (!token) return { error: "Link inválido." };

  if (!(await checkRateLimitDb(`cancel-appt:${token.slice(0, 16)}`, 6, 60 * 60_000))) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const reason = clean(formData.get("reason"), 300) || null;

  const result = await cancelAppointmentByToken(token, reason);
  if (!result.ok) return { error: result.error ?? "Não foi possível cancelar." };

  revalidatePath("/schedule");
  return { success: true, status: result.status };
}
