import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import type { Patient } from "@/lib/types";

export async function sendPatientWelcome(
  patient: Pick<Patient, "id" | "full_name" | "email" | "phone" | "clinic_id">,
  portalToken?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", patient.clinic_id).single();
  const clinicName = clinic?.name ?? "nossa clínica";
  const first = patient.full_name.split(" ")[0];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const portalUrl = portalToken ? `${appUrl}/portal/${portalToken}` : null;

  if (patient.email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";
    const html = [
      `<p>Olá, ${first}!</p>`,
      `<p>Bem-vindo(a) à <strong>${clinicName}</strong>. Seu cadastro foi criado com sucesso.</p>`,
      portalUrl
        ? `<p>Acesse seu portal do paciente para acompanhar suas sessões e evolução:</p><p><a href="${portalUrl}">Acessar portal →</a></p>`
        : "",
      `<p>Em caso de dúvidas, entre em contato conosco.</p>`,
    ].join("\n");

    try {
      await resend.emails.send({
        from: fromAddress,
        to: patient.email,
        subject: `Bem-vindo(a) à ${clinicName}`,
        html,
      });
    } catch (e) {
      console.error("[patient-welcome] email failed:", e);
    }
  }

  if (patient.phone) {
    const msg = portalUrl
      ? `Olá, ${first}! 👋\n\nBem-vindo(a) à *${clinicName}*!\n\nAcesse seu portal do paciente:\n${portalUrl}`
      : `Olá, ${first}! 👋\n\nBem-vindo(a) à *${clinicName}*! Seu cadastro está pronto.`;
    try {
      await sendWhatsAppText(patient.phone, msg);
    } catch (e) {
      console.error("[patient-welcome] whatsapp failed:", e);
    }
  }
}
