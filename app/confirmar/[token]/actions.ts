"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { confirmAppointmentByToken } from "@/services/appointment-service";

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

  if (!fullName) return { error: "Informe seu nome completo." };
  if (email && !EMAIL_RE.test(email)) return { error: "E-mail inválido." };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: "Data de nascimento inválida." };
  if (!consentData) return { error: "É necessário aceitar o tratamento dos seus dados para confirmar." };

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

  // Side-effects pós-confirmação (fire-and-forget): integrações + automações
  if (result.appointmentId && result.startsAt) {
    import("@/services/appointment-service").then(({ runIntegrationsForAppointment }) =>
      runIntegrationsForAppointment(result.appointmentId!).catch(() => {}),
    ).catch(() => {});
    import("@/services/automation-service").then(({ scheduleAutomations }) =>
      scheduleAutomations({ id: result.appointmentId!, clinic_id: result.clinicId!, patient_id: result.patientId!, starts_at: result.startsAt! }).catch(() => {}),
    ).catch(() => {});
  }

  // Questionários de entrada: cria os convites, tenta WhatsApp/e-mail E devolve os
  // tokens para exibir/encadear nesta tela (não depende da entrega externa funcionar).
  // baseUrl derivado do host da requisição → links sempre no domínio do Core
  // (evita cair no NEXT_PUBLIC_APP_URL apontando para outro app).
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
