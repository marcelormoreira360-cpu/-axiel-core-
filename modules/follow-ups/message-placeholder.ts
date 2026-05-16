import type { FollowUpChannel, Patient } from "@/lib/types";

export function buildFollowUpMessagePlaceholder(patient: Pick<Patient, "full_name">, channel: FollowUpChannel) {
  if (channel === "none") {
    return { subject: null, body: null };
  }

  if (channel === "sms") {
    return {
      subject: null,
      body: `Hi ${patient.full_name}, checking in after your visit. Reply if you would like help with your next step.`,
    };
  }

  return {
    subject: "Checking in",
    body: `Hi ${patient.full_name}, just checking in after your visit. Let us know if you would like help scheduling your next step.`,
  };
}

export const MESSAGE_AUTOMATION_STATUS = "Ready to send manually. Automation rules can be added later.";
