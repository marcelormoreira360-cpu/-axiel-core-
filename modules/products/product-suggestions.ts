import type { ProductSuggestion } from "./product-types";

export function createSafeProductSuggestion(input: {
  patientContext: string;
  suggestedCategory: string;
}): ProductSuggestion {
  return {
    id: crypto.randomUUID(),
    suggestedCategory: input.suggestedCategory,
    reason: "This is a support category to review, not an automatic product choice.",
    safetyQuestions: ["Review patient context.", "Confirm this is appropriate before attaching a product."],
    followUpTiming: "Review in 14 days",
    nextStep: "Review support options with the patient.",
    status: "in_review",
  };
}
