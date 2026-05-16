import type { Lead } from "@/lib/types";

export function getLeadPriority(lead: Lead) {
  if (lead.stage === "scheduled") return "high";
  if (lead.stage === "contacted") return "medium";
  if (lead.stage === "new_lead") return "medium";
  return "low";
}

export function nextLeadAction(lead: Lead) {
  if (lead.stage === "new_lead") return "Contact today";
  if (lead.stage === "contacted") return "Schedule consultation";
  if (lead.stage === "scheduled") return "Prepare intake";
  return "Continue as patient";
}
