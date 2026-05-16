import type { FormCategory, FormQuestion } from "@/modules/forms/question-types";

export type FormTemplate = {
  id: string;
  name: string;
  description: string;
  category: FormCategory;
  questions: Omit<FormQuestion, "id">[];
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "initial-patient-intake",
    name: "Initial Patient Intake",
    description: "A calm starter form for new patients.",
    category: "Initial Assessment",
    questions: [
      { label: "What brings you in today?", question_type: "long_text", is_required: true, display_order: 1 },
      { label: "What would you like support with first?", question_type: "short_text", is_required: true, display_order: 2 },
      { label: "How is your energy this week?", question_type: "scale_1_10", is_required: false, display_order: 3 },
    ],
  },
  {
    id: "pain-body-map",
    name: "Pain & Body Map Assessment",
    description: "Capture pain areas and simple patient notes.",
    category: "Initial Assessment",
    questions: [
      { label: "Mark any area of attention.", question_type: "body_map", is_required: true, display_order: 1 },
      { label: "When do you notice this most?", question_type: "long_text", is_required: false, display_order: 2 },
      { label: "How strong is the discomfort today?", question_type: "scale_1_10", is_required: false, display_order: 3 },
    ],
  },
  {
    id: "stress-sleep",
    name: "Stress and Sleep Check-in",
    description: "A short check-in for stress, sleep, and rhythm.",
    category: "Follow-up Form",
    questions: [
      { label: "How did you sleep this week?", question_type: "long_text", is_required: true, display_order: 1 },
      { label: "How is your stress level today?", question_type: "scale_1_10", is_required: true, display_order: 2 },
      { label: "Anything changed since the last Session?", question_type: "yes_no", is_required: false, display_order: 3 },
    ],
  },
  {
    id: "follow-up-progress",
    name: "Follow-up Progress Form",
    description: "A simple way to track progress between Sessions.",
    category: "Follow-up Form",
    questions: [
      { label: "What improved since your last Session?", question_type: "long_text", is_required: false, display_order: 1 },
      { label: "What still needs attention?", question_type: "long_text", is_required: false, display_order: 2 },
      { label: "How ready do you feel for the Next Step?", question_type: "scale_1_10", is_required: false, display_order: 3 },
    ],
  },
  {
    id: "lead-screening",
    name: "Lead Screening Form",
    description: "A light form to understand new leads.",
    category: "Lead Form",
    questions: [
      { label: "What are you looking for support with?", question_type: "long_text", is_required: true, display_order: 1 },
      { label: "Have you visited us before?", question_type: "yes_no", is_required: false, display_order: 2 },
      { label: "Best way to contact you?", question_type: "multiple_choice", is_required: true, options: ["WhatsApp", "Email", "Phone"], display_order: 3 },
    ],
  },
];
