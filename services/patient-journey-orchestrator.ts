import { MASTER_PATIENT_JOURNEY, type JourneyStage, type JourneyStep } from "@/modules/patient-journey/master-flow";

export type PatientJourneyContext = {
  leadId?: string;
  patientId?: string;
  formSubmissionId?: string;
  sessionId?: string;
  insightId?: string;
  hasFinalInsight?: boolean;
  hasPendingReview?: boolean;
  hasActiveNextStep?: boolean;
  hasActiveProductSupport?: boolean;
  hasOpenFollowUp?: boolean;
  hasMembership?: boolean;
};

export type PatientJourneyGuidance = {
  currentStage: JourneyStage;
  currentStep: JourneyStep;
  message: string;
  nextActionLabel: string;
};

export function getPatientJourneyGuidance(context: PatientJourneyContext): PatientJourneyGuidance {
  const currentStage = determineCurrentStage(context);
  const currentStep = MASTER_PATIENT_JOURNEY.find((step) => step.stage === currentStage) ?? MASTER_PATIENT_JOURNEY[0];

  return {
    currentStage,
    currentStep,
    message: buildGuidanceMessage(currentStage, context),
    nextActionLabel: actionLabel(currentStep.primaryAction),
  };
}

function determineCurrentStage(context: PatientJourneyContext): JourneyStage {
  if (!context.patientId && context.leadId) return "lead";
  if (context.patientId && !context.formSubmissionId) return "form";
  if (context.formSubmissionId && !context.sessionId) return "session";
  if (context.sessionId && !context.insightId) return "insight";
  if (context.insightId && !context.hasFinalInsight) return "insight";
  if (context.hasFinalInsight && !context.hasActiveNextStep) return "snapshot";
  if (context.hasActiveNextStep && !context.hasActiveProductSupport) return "next_step";
  if (context.hasActiveProductSupport && !context.hasOpenFollowUp) return "product_support";
  if (context.hasOpenFollowUp && !context.hasMembership) return "follow_up";
  return "membership";
}

function buildGuidanceMessage(stage: JourneyStage, context: PatientJourneyContext): string {
  switch (stage) {
    case "lead":
      return "This lead is ready for a simple next step.";
    case "form":
      return "Send or review a form to understand the patient better.";
    case "session":
      return "Create a Session and keep the patient context close.";
    case "insight":
      return context.hasPendingReview
        ? "An Insight needs human review before it is used."
        : "Create an Insight draft from the latest patient context.";
    case "snapshot":
      return "Review the Snapshot to understand what matters now.";
    case "next_step":
      return "Choose a clear Next Step for continuity.";
    case "product_support":
      return "Review Product Support only if it fits the patient journey.";
    case "follow_up":
      return "Create a follow-up so the patient does not fall through the cracks.";
    case "membership":
      return "Consider continuity options when the patient needs ongoing support.";
    default:
      return "Review the patient journey.";
  }
}

function actionLabel(action: JourneyStep["primaryAction"]): string {
  const labels: Record<string, string> = {
    contact_lead: "Contact lead",
    send_form: "Send form",
    convert_to_patient: "Convert to patient",
    create_session: "Create Session",
    add_session_note: "Add note",
    generate_insight_draft: "Generate Insight draft",
    review_insight: "Review Insight",
    review_snapshot: "Review Snapshot",
    accept_next_step: "Accept Next Step",
    add_product_support: "Add Product Support",
    create_follow_up: "Create follow-up",
    offer_membership: "Offer membership",
  };

  return labels[action] ?? "Review";
}
