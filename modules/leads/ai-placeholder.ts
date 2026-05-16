import type { Lead } from "@/lib/types";

export function getLeadAiPlaceholder(lead?: Lead | null) {
  if (!lead) {
    return {
      label: "AI lead classification",
      text: "Future AI will classify each lead by urgency, readiness, and best next action.",
    };
  }

  return {
    label: "AI lead classification",
    text: `Future AI will review ${lead.full_name}'s source, notes, and conversation history to suggest the best next action.`,
  };
}
