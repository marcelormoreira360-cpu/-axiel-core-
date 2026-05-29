"use server";

import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";

export type SendPortalAccessState = { sent: boolean } | null;

export async function sendPortalAccessAction(
  _prev: SendPortalAccessState,
  formData: FormData
): Promise<SendPortalAccessState> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    // Still return sent:true to prevent enumeration
    return { sent: true };
  }

  const supabase = createSupabaseAdminClient();

  type PatientRow = {
    id: string;
    full_name: string;
    clinic_id: string;
    clinics: { name: string } | null;
  };

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, clinic_id, clinics(name)")
    .eq("email", email)
    .eq("status", "active")
    .limit(1)
    .maybeSingle() as { data: PatientRow | null };

  if (patient) {
    // Revoke existing portal links
    await supabase
      .from("patient_portal_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("patient_id", patient.id)
      .is("revoked_at", null);

    // Create new token
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("patient_portal_links").insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: null,
    });

    if (!insertError) {
      const clinicName =
        patient.clinics && typeof patient.clinics === "object" && "name" in patient.clinics
          ? (patient.clinics as { name: string }).name
          : "sua clínica";

      const portalUrl = `${APP_URL}/p/${rawToken}`;

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = DEFAULT_FROM_EMAIL;

      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `Acesse seu portal — ${clinicName}`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Acesse seu portal</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.07);padding:40px 32px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(0,0,0,0.35);">${clinicName}</p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#0F1A2E;letter-spacing:-0.02em;">Olá, ${patient.full_name.split(" ")[0]} 👋</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(0,0,0,0.6);">
                Recebemos uma solicitação de acesso ao seu portal de paciente. Clique no botão abaixo para entrar.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}"
                      style="display:inline-block;background:#0F6E56;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:-0.01em;">
                      Acessar meu portal
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:13px;color:rgba(0,0,0,0.4);line-height:1.6;text-align:center;">
                Este link expira em <strong>24 horas</strong>. Não compartilhe este e-mail com ninguém.<br/>
                Se você não solicitou este acesso, ignore este e-mail.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:rgba(0,0,0,0.3);">Powered by AXIEL Core</p>
      </td>
    </tr>
  </table>
</body>
</html>
        `.trim(),
      });
    }
  }

  return { sent: true };
}
