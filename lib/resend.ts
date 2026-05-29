import { Resend } from "resend";
import { DEFAULT_FROM_EMAIL } from "@/lib/constants";

export function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

/** @deprecated Import DEFAULT_FROM_EMAIL from @/lib/constants instead */
export function getDefaultEmailFrom() {
  return DEFAULT_FROM_EMAIL;
}
