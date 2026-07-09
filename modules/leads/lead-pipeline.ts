import type { Lead, LeadStage } from "@/lib/types";

export const leadStageOrder: LeadStage[] = [
  "new_lead",
  "contacted",
  "scheduled",
  "converted_to_patient",
];

// Chaves next-intl relativas ao namespace "leads".
// Traduza no client com useTranslations("leads") ou no server com getTranslations("leads").
export const leadStages: Array<{
  id: LeadStage;
  titleKey: string;
  shortTitleKey: string;
  descriptionKey: string;
}> = leadStageOrder.map((id) => ({
  id,
  titleKey: `pipeline.stages.${id}.title`,
  shortTitleKey: `pipeline.stages.${id}.short`,
  descriptionKey: `pipeline.stages.${id}.description`,
}));

export function getNextLeadActionKey(lead: Lead): string {
  if (lead.stage === "new_lead") return "pipeline.nextAction.new_lead";
  if (lead.stage === "contacted") return "pipeline.nextAction.contacted";
  if (lead.stage === "scheduled") return "pipeline.nextAction.scheduled";
  return "pipeline.nextAction.converted_to_patient";
}

/**
 * @deprecated Fallback em inglês para consumidores ainda não migrados para next-intl
 * (app/leads/[id]/page.tsx e modules/ai-insights/contextual-placeholders.ts).
 * Prefira leadStages[].titleKey com useTranslations("leads") / getTranslations("leads").
 */
export const leadStageLabels: Record<LeadStage, string> = {
  new_lead: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  converted_to_patient: "Patient",
};

/**
 * @deprecated Fallback em inglês; prefira getNextLeadActionKey + next-intl.
 */
export function getNextLeadAction(lead: Lead) {
  if (lead.stage === "new_lead") return "Contact today";
  if (lead.stage === "contacted") return "Book visit";
  if (lead.stage === "scheduled") return "Prepare intake";
  return "Open patient file";
}

export function groupLeadsByStage(leads: Lead[]) {
  return leadStages.map((stage) => ({
    ...stage,
    leads: leads.filter((lead) => lead.stage === stage.id),
  }));
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
