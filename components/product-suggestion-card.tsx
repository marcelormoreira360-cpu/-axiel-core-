import { Card } from "@/components/card";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import type { ProductSuggestion } from "@/modules/products/product-types";

export function ProductSuggestionCard({ suggestion }: { suggestion: ProductSuggestion }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-axiel-text-primary">{suggestion.suggestedCategory}</p>
          <p className="mt-1 text-sm text-axiel-text-secondary">{suggestion.reason}</p>
        </div>
        <StatusBadge label={suggestion.status === "in_review" ? "In Review" : suggestion.status} tone={suggestion.status === "approved" ? "final" : suggestion.status === "in_review" ? "review" : "neutral"} />
      </div>

      <div>
        <p className="text-sm font-medium text-axiel-text-primary">Safety questions</p>
        <ul className="mt-2 space-y-1 text-sm text-axiel-text-secondary">
          {suggestion.safetyQuestions.slice(0, 3).map((question) => (
            <li key={question}>• {question}</li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-axiel-text-primary">Next Step: {suggestion.nextStep}</p>

      <div className="flex gap-3">
        <ButtonPrimary type="button">Approve</ButtonPrimary>
        <ButtonSecondary type="button">Ignore</ButtonSecondary>
      </div>
    </Card>
  );
}
