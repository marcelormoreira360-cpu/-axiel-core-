export type JourneyStage =
  | "lead"
  | "form"
  | "patient"
  | "session"
  | "insight"
  | "snapshot"
  | "next_step"
  | "product_support"
  | "follow_up"
  | "membership";

export type JourneyAction =
  | "contact_lead"
  | "send_form"
  | "convert_to_patient"
  | "create_session"
  | "add_session_note"
  | "generate_insight_draft"
  | "review_insight"
  | "review_snapshot"
  | "accept_next_step"
  | "add_product_support"
  | "create_follow_up"
  | "offer_membership";

export type JourneyStep = {
  stage: JourneyStage;
  title: string;
  description: string;
  primaryAction: JourneyAction;
  visibleActions: JourneyAction[];
  mvp: boolean;
};

export const MASTER_PATIENT_JOURNEY: JourneyStep[] = [
  {
    stage: "lead",
    title: "Lead",
    description: "A new person enters the clinic journey.",
    primaryAction: "send_form",
    visibleActions: ["contact_lead", "send_form", "convert_to_patient"],
    mvp: true,
  },
  {
    stage: "form",
    title: "Form",
    description: "Collect simple context before the first Session.",
    primaryAction: "send_form",
    visibleActions: ["send_form"],
    mvp: true,
  },
  {
    stage: "patient",
    title: "Patient",
    description: "The lead becomes a patient with a clear profile.",
    primaryAction: "create_session",
    visibleActions: ["create_session"],
    mvp: true,
  },
  {
    stage: "session",
    title: "Session",
    description: "The professional records notes and key observations.",
    primaryAction: "add_session_note",
    visibleActions: ["add_session_note", "create_follow_up"],
    mvp: true,
  },
  {
    stage: "insight",
    title: "Insight",
    description: "AI helps organize patterns, always requiring human validation.",
    primaryAction: "review_insight",
    visibleActions: ["generate_insight_draft", "review_insight"],
    mvp: true,
  },
  {
    stage: "snapshot",
    title: "Snapshot",
    description: "A short view of what matters now.",
    primaryAction: "review_snapshot",
    visibleActions: ["review_snapshot", "create_follow_up"],
    mvp: true,
  },
  {
    stage: "next_step",
    title: "Next Step",
    description: "A simple next action for continuity.",
    primaryAction: "accept_next_step",
    visibleActions: ["accept_next_step", "create_follow_up"],
    mvp: true,
  },
  {
    stage: "product_support",
    title: "Product Support",
    description: "Optional support items connected to the patient journey.",
    primaryAction: "add_product_support",
    visibleActions: ["add_product_support", "create_follow_up"],
    mvp: true,
  },
  {
    stage: "follow_up",
    title: "Follow-up",
    description: "Keep the patient connected after the main Session.",
    primaryAction: "create_follow_up",
    visibleActions: ["create_follow_up"],
    mvp: true,
  },
  {
    stage: "membership",
    title: "Membership",
    description: "Support long-term continuity and retention.",
    primaryAction: "offer_membership",
    visibleActions: ["offer_membership"],
    mvp: false,
  },
];
