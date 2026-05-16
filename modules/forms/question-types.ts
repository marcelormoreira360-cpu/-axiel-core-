export const FORM_CATEGORIES = [
  "Initial Assessment",
  "Session Form",
  "Follow-up Form",
  "Lead Form",
  "Protocol Form",
  "Custom Form",
] as const;

export type FormCategory = (typeof FORM_CATEGORIES)[number];

export const QUESTION_TYPES = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Long answer" },
  { value: "yes_no", label: "Yes / No" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "scale_1_10", label: "Scale 1–10" },
  { value: "body_map", label: "Body Map" },
] as const;

export type FormQuestionType = (typeof QUESTION_TYPES)[number]["value"];

export type FormStatus = "Active" | "Draft";

export type AxielForm = {
  id: string;
  clinic_id?: string | null;
  name: string;
  description?: string | null;
  category: FormCategory;
  status: FormStatus;
  question_count: number;
  updated_at: string;
};

export type FormQuestion = {
  id: string;
  label: string;
  question_type: FormQuestionType;
  is_required: boolean;
  options?: string[];
  display_order: number;
};

export type FormSubmissionSummary = {
  id: string;
  form_name: string;
  completed_at: string;
  summary: string;
};
