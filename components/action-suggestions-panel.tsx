import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { ActionSuggestion } from "@/lib/types";
import { ActionSuggestionCard } from "@/components/action-suggestion-card";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { getTerm } from "@/modules/ui/terminology";

export function ActionSuggestionsPanel({ actions, title = getTerm("nextStep", "plural") }: { actions: ActionSuggestion[]; title?: string }) {
  const activeActions = actions.filter((action) => action.status === "pending" || action.status === "accepted");

  return (
    <Card className="p-6 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-axiel-gold">GUIDED WORKFLOW</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-black/45">Accept, ignore, or complete. AXIEL keeps track.</p>
        </div>
        <Sparkles className="h-5 w-5 text-axiel-gold" />
      </div>

      <div className="grid gap-3">
        {activeActions.slice(0, 5).map((action) => (
          <ActionSuggestionCard key={action.id} action={action} compact />
        ))}
        {activeActions.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-7 w-7" />}
            title={`No ${getTerm("nextStep", "lowerPlural")}`}
            text={`The system will surface the ${getTerm("nextStep", "lower")} as patients, leads, ${getTerm("session", "lowerPlural")}, and follow-ups are added.`}
            href="/dashboard"
            action="Back to dashboard"
          />
        ) : null}
      </div>

      <Link href="/actions" className="mt-4 inline-flex rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/60 shadow-sm transition hover:bg-axiel-blueSoft">View all {getTerm("nextStep", "lowerPlural")}</Link>
    </Card>
  );
}
