import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ActionSuggestion } from "@/lib/types";
import { ActionSuggestionCard } from "@/components/action-suggestion-card";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";

export async function ActionSuggestionsPanel({ actions, title }: { actions: ActionSuggestion[]; title?: string }) {
  const t = await getTranslations("actions");
  const activeActions = actions.filter((action) => action.status === "pending" || action.status === "accepted");

  return (
    <Card className="p-6 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-axiel-gold">{t("panel.eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title ?? t("panel.title")}</h2>
          <p className="mt-1 text-sm text-black/45">{t("panel.subtitle")}</p>
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
            title={t("panel.emptyTitle")}
            text={t("panel.emptyText")}
            href="/dashboard"
            action={t("panel.backToDashboard")}
          />
        ) : null}
      </div>

      <Link href="/actions" className="mt-4 inline-flex rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/60 shadow-sm transition hover:bg-axiel-blueSoft">{t("panel.viewAll")}</Link>
    </Card>
  );
}
