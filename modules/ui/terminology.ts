export const UI_TERMS = {
  session: {
    singular: "Session",
    plural: "Sessions",
    lower: "session",
    lowerPlural: "sessions",
  },
  insight: {
    singular: "Insight",
    plural: "Insights",
    lower: "insight",
    lowerPlural: "insights",
  },
  nextStep: {
    singular: "Next Step",
    plural: "Next Steps",
    lower: "next step",
    lowerPlural: "next steps",
  },
} as const;

export type TermKey = keyof typeof UI_TERMS;
export type TermVariant = "singular" | "plural" | "lower" | "lowerPlural";

export function getTerm(key: TermKey, variant: TermVariant = "singular") {
  return UI_TERMS[key][variant];
}

export function getTerms() {
  return UI_TERMS;
}

export const PROHIBITED_UI_TERMS = [
  "report",
  "reports",
  "analysis",
  "recommendation",
  "recommendations",
] as const;

export function patientInsightTitle() {
  return `Patient ${getTerm("insight")}`;
}

export function patientInsightPdfLabel() {
  return `Download ${getTerm("insight")}`;
}

export const AI_INSIGHT_NOTICE = "AI-generated insights (not medical advice)" as const;

export function aiInsightLabel(): typeof AI_INSIGHT_NOTICE {
  return AI_INSIGHT_NOTICE;
}
