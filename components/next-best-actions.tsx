import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type { ActionSuggestion } from "@/lib/types";
import { startActionSuggestion } from "@/app/actions/action-suggestions";
import { Card } from "@/components/card";
import { cn } from "@/lib/utils";

const toneByPriority = {
  high: "border-[#ead1c1] bg-[#fff8f4]",
  medium: "border-axiel-line bg-white",
  low: "border-axiel-line bg-white",
};

function actionButtonLabel(action: ActionSuggestion) {
  if (action.category === "lead") return "Open lead";
  if (action.category === "patient") return "Open patient";
  if (action.category === "follow_up") return "Follow up";
  if (action.category === "schedule") return "Open schedule";
  return "Start";
}

function emptyMessage() {
  return (
    <Card className="p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#f3eee5] text-axiel-gold">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-axiel-ink">Everything looks clear</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-black/45">
              No urgent reviews, follow-ups, or new leads need attention right now.
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-axiel-soft px-4 py-2 text-sm font-semibold text-black/45">
          Calm day
        </span>
      </div>
    </Card>
  );
}

export function NextBestActions({ actions }: { actions: ActionSuggestion[] }) {
  const visibleActions = actions.filter((action) => action.status === "pending" || action.status === "accepted").slice(0, 5);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-axiel-gold shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Guided workflow
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-axiel-ink md:text-5xl">Next Best Actions</h2>
        </div>
        <p className="hidden text-sm text-black/35 md:block">Up to 5</p>
      </div>

      {visibleActions.length === 0 ? (
        emptyMessage()
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {visibleActions.map((action, index) => (
            <article
              key={action.id}
              className={cn(
                "flex min-h-[230px] flex-col justify-between rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                index === 0 ? "md:col-span-2 xl:col-span-2" : "",
                toneByPriority[action.priority]
              )}
            >
              <div>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-black/40">
                    {action.category.replaceAll("_", " ")}
                  </span>
                  {action.priority === "high" ? <span className="h-2.5 w-2.5 rounded-full bg-axiel-gold" /> : null}
                </div>
                <h3 className={cn("font-semibold tracking-tight text-axiel-ink", index === 0 ? "text-3xl" : "text-xl")}>
                  {action.title}
                </h3>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/48">{action.description}</p>
              </div>

              <form action={startActionSuggestion} className="mt-6">
                <input type="hidden" name="id" value={action.id} />
                <input type="hidden" name="url" value={action.suggested_url ?? "/dashboard"} />
                <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-5 text-sm font-semibold text-white shadow-md transition hover:bg-axiel-blueDark">
                  {actionButtonLabel(action)} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
