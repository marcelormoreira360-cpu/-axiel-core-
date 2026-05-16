import type { Lead, LeadStage } from "@/lib/types";

export const leadStages: Array<{ id: LeadStage; title: string; shortTitle: string; description: string }> = [
  {
    id: "new_lead",
    title: "New",
    shortTitle: "New",
    description: "New lead",
  },
  {
    id: "contacted",
    title: "Contacted",
    shortTitle: "Contacted",
    description: "Conversation started",
  },
  {
    id: "scheduled",
    title: "Scheduled",
    shortTitle: "Scheduled",
    description: "Visit or call booked",
  },
  {
    id: "converted_to_patient",
    title: "Patient",
    shortTitle: "Patient",
    description: "Converted",
  },
];

export const leadStageLabels: Record<LeadStage, string> = leadStages.reduce(
  (labels, stage) => ({ ...labels, [stage.id]: stage.title }),
  {} as Record<LeadStage, string>
);

export function groupLeadsByStage(leads: Lead[]) {
  return leadStages.map((stage) => ({
    ...stage,
    leads: leads.filter((lead) => lead.stage === stage.id),
  }));
}

export function getNextLeadAction(lead: Lead) {
  if (lead.stage === "new_lead") return "Contact today";
  if (lead.stage === "contacted") return "Book visit";
  if (lead.stage === "scheduled") return "Prepare intake";
  return "Open patient file";
}

export function getLeadPipelineSummary(leads: Lead[]) {
  return {
    total: leads.length,
    newLeads: leads.filter((lead) => lead.stage === "new_lead").length,
    contacted: leads.filter((lead) => lead.stage === "contacted").length,
    scheduled: leads.filter((lead) => lead.stage === "scheduled").length,
    converted: leads.filter((lead) => lead.stage === "converted_to_patient").length,
  };
}
