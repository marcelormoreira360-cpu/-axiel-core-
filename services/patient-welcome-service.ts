import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { PatientWelcomeEmail } from "@/components/email/patient-welcome-email";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import type { Patient } from "@/lib/types";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const log = createLogger("patient-welcome");

export async function sendPatientWelcome(
  patient: Pick<Patient, "id" | "full_name" | "email" | "phone" | "clinic_id">,
  portalToken?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", patient.clinic_id).single();
  const clinicName = (clinic?.name as string | null) ?? "nossa clínica";
  const first = patient.full_name.split(" ")[0];
  const portalUrl = portalToken ? `${APP_URL}/p/${portalToken}` : null;
  const locale = await resolveClinicLocale(patient.clinic_id);
  const t = await getServerT(locale, "emails");

  if (patient.email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = DEFAULT_FROM_EMAIL;

    try {
      await resend.emails.send({
        from: fromAddress,
        to: patient.email,
        subject: t("welcome.subject", { clinic: clinicName }),
        react: PatientWelcomeEmail({
          clinicName,
          patientFirstName: first,
          portalUrl,
          t,
          locale,
        }),
      });
    } catch (e) {
      log.error("email failed", e);
    }
  }

  if (patient.phone) {
    const msg = portalUrl
      ? `Olá, ${first}! 👋\n\nBem-vindo(a) à *${clinicName}*!\n\nAcesse seu portal do paciente:\n${portalUrl}`
      : `Olá, ${first}! 👋\n\nBem-vindo(a) à *${clinicName}*! Seu cadastro está pronto.`;
    try {
      await sendWhatsAppText(patient.phone, msg);
    } catch (e) {
      log.error("whatsapp failed", e);
    }
  }
}
