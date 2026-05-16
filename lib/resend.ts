import { Resend } from "resend";

export function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export function getDefaultEmailFrom() {
  return process.env.RESEND_FROM_EMAIL || "AXIEL Core <onboarding@resend.dev>";
}
