import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDot, Sparkles } from "lucide-react";
import type { ActionSuggestion } from "@/lib/types";
import { setActionSuggestionStatus } from "@/app/actions/action-suggestions";
import { cn } from "@/lib/utils";

const priorityTone = {
  high: "bg-[#fff4ed] text-[#8a3d1d] ring-[#f1d4c6]",
  medium: "bg-[#f4f0e8] text-black/65 ring-axiel-line",
  low: "bg-white text-black/45 ring-axiel-line",
};

export function DashboardActionCard({ action }: { action: ActionSuggestion }) {
  const primaryStatus = action.status === "accepted" ? "completed" : "accepted";
  const primaryLabel = action.status === "accepted" ? "Complete" : "Accept";
  const PrimaryIcon = action.status === "accepted" ? CheckCircle2 : CircleDot;

  return (
    <article className="group rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-axiel-soft text-axiel-gold">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1", priorityTone[action.priority])}>
              {action.priority}
            </span>
            <span className="rounded-full bg-axiel-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
              {action.category.replaceAll("_", " ")}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-axiel-ink">{action.title}</h3>
          {action.description ? <p className="mt-2 text-sm leading-6 text-black/50">{action.description}</p> : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <form action={setActionSuggestionStatus} className="flex-1">
          <input type="hidden" name="id" value={action.id} />
          <input type="hidden" name="status" value={primaryStatus} />
          <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-5 text-sm font-semibold text-white shadow-md transition hover:bg-axiel-blueDark">
            <PrimaryIcon className="h-4 w-4" /> {primaryLabel}
          </button>
        </form>

        {action.suggested_url ? (
          <Link href={action.suggested_url} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-axiel-line bg-white px-5 text-sm font-semibold text-black/60 shadow-sm transition hover:bg-axiel-blueSoft">
            Open <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
