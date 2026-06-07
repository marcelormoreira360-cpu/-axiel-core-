import type { IntakeQuestionType } from "@/lib/types";

export const questionTypeLabels: Record<IntakeQuestionType, string> = {
  short_text: "Short answer",
  long_text: "Long answer",
  number: "Number",
  date: "Date",
  yes_no: "Yes / No",
  body_map: "Anatomical map",
};

export const questionTypeOptions: { value: IntakeQuestionType; label: string }[] = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Long answer" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / No" },
  { value: "body_map", label: "Anatomical map" },
];
