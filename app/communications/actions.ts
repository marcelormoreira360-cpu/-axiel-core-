"use server";

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/services/user-service";
import { ensureDefaultCommunicationTemplates, sendCommunication, updateCommunicationTemplate } from "@/services/communication-service";
import type { CommunicationChannel, CommunicationUseCase } from "@/modules/communications/templates";

export async function installDefaultTemplatesAction() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic.");
  await ensureDefaultCommunicationTemplates(profile.clinic_id);
  redirect("/communications");
}

export async function updateTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) throw new Error("Template and message body are required.");
  await updateCommunicationTemplate({ id, subject, body });
  redirect("/communications");
}

export async function sendManualCommunicationAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic.");

  const channel = String(formData.get("channel") ?? "email") as CommunicationChannel;
  const useCase = String(formData.get("use_case") ?? "follow_up") as CommunicationUseCase;
  const recipient = String(formData.get("recipient") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();

  if (!recipient || !body) throw new Error("Recipient and message are required.");

  await sendCommunication({
    clinic_id: profile.clinic_id,
    patient_id: String(formData.get("patient_id") ?? "") || null,
    lead_id: String(formData.get("lead_id") ?? "") || null,
    appointment_id: String(formData.get("appointment_id") ?? "") || null,
    follow_up_id: String(formData.get("follow_up_id") ?? "") || null,
    template_id: String(formData.get("template_id") ?? "") || null,
    channel,
    use_case: useCase,
    recipient,
    subject,
    body,
  });

  redirect(String(formData.get("return_to") ?? "/communications"));
}
