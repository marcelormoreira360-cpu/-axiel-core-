import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getResendClient, getDefaultEmailFrom } from "@/lib/resend";
import { getTwilioClient, getTwilioFromNumber } from "@/lib/twilio";
import { SimpleMessageEmail } from "@/components/email/simple-message-email";
import type { CommunicationChannel, CommunicationUseCase } from "@/modules/communications/templates";
import { defaultCommunicationTemplates } from "@/modules/communications/templates";

export type CommunicationTemplate = {
  id: string;
  clinic_id: string;
  key: string;
  name: string;
  channel: CommunicationChannel;
  use_case: CommunicationUseCase;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function ensureDefaultCommunicationTemplates(clinicId: string) {
  const supabase = await createSupabaseServerClient();

  const rows = defaultCommunicationTemplates.map((template) => ({
    ...template,
    clinic_id: clinicId,
    is_active: true,
  }));

  const { error } = await supabase
    .from("communication_templates")
    .upsert(rows, { onConflict: "clinic_id,key" });

  if (error) throw error;
}

export async function getCommunicationTemplates(clinicId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("communication_templates")
    .select("*")
    .order("use_case", { ascending: true })
    .order("channel", { ascending: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CommunicationTemplate[];
}

export async function getTemplateByUseCase(clinicId: string, useCase: CommunicationUseCase, channel: CommunicationChannel) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("use_case", useCase)
    .eq("channel", channel)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data as CommunicationTemplate | null;
}

export async function updateCommunicationTemplate(input: {
  id: string;
  subject?: string | null;
  body: string;
  is_active?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("communication_templates")
    .update({ subject: input.subject ?? null, body: input.body, is_active: input.is_active ?? true })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as CommunicationTemplate;
}

async function createLog(input: {
  clinic_id: string;
  patient_id?: string | null;
  lead_id?: string | null;
  appointment_id?: string | null;
  follow_up_id?: string | null;
  template_id?: string | null;
  channel: CommunicationChannel;
  use_case: CommunicationUseCase;
  recipient: string;
  subject?: string | null;
  body: string;
  status: "queued" | "sent" | "failed";
  provider?: "resend" | "twilio" | null;
  provider_message_id?: string | null;
  error_message?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("communication_logs")
    .insert({ ...input, created_by: user?.id ?? null })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getCommunicationLogs(clinicId?: string, limit = 25) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("communication_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function sendCommunication(input: {
  clinic_id: string;
  patient_id?: string | null;
  lead_id?: string | null;
  appointment_id?: string | null;
  follow_up_id?: string | null;
  template_id?: string | null;
  channel: CommunicationChannel;
  use_case: CommunicationUseCase;
  recipient: string;
  subject?: string | null;
  body: string;
}) {
  if (!input.recipient) throw new Error("Recipient is required.");
  if (!input.body.trim()) throw new Error("Message body is required.");

  try {
    if (input.channel === "email") {
      const resend = getResendClient();
      const result = await resend.emails.send({
        from: getDefaultEmailFrom(),
        to: [input.recipient],
        subject: input.subject || "Message from your clinic",
        react: SimpleMessageEmail({ body: input.body }),
      });

      if (result.error) throw new Error(result.error.message || "Resend email failed.");

      return await createLog({
        ...input,
        status: "sent",
        provider: "resend",
        provider_message_id: result.data?.id ?? null,
      });
    }

    const client = getTwilioClient();
    const message = await client.messages.create({
      from: getTwilioFromNumber(),
      to: input.recipient,
      body: input.body,
    });

    return await createLog({
      ...input,
      subject: null,
      status: "sent",
      provider: "twilio",
      provider_message_id: message.sid,
    });
  } catch (error) {
    await createLog({
      ...input,
      status: "failed",
      provider: input.channel === "email" ? "resend" : "twilio",
      error_message: error instanceof Error ? error.message : "Unknown communication error",
    });
    throw error;
  }
}
