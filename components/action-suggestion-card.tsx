import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Circle, X } from "lucide-react";
import type { ActionSuggestion } from "@/lib/types";
import { setActionSuggestionStatus } from "@/app/actions/action-suggestions";
import { cn } from "@/lib/utils";

const priorityLabels = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function ActionSuggestionCard({ action, compact = false }: { action: ActionSuggestion; compact?: boolean }) {
  const isDone = action.status === "completed" || action.status === "ignored";

  return (
    <div className={cn("rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md", isDone && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              action.priority === "high" && "bg-axiel-ink text-white",
              action.priority === "medium" && "bg-axiel-soft text-black/70",
              action.priority === "low" && "bg-white text-black/45 ring-1 ring-axiel-line"
            )}>{priorityLabels[action.priority]}</span>
            <span className="rounded-full bg-axiel-soft px-3 py-1 text-xs font-semibold capitalize text-black/45">{action.status}</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight">{action.title}</h3>
          {action.description ? <p className="mt-1 text-sm leading-5 text-black/55">{action.description}</p> : null}
          {!compact && action.reason ? <p className="mt-2 text-xs leading-5 text-black/40">Why: {action.reason}</p> : null}
        </div>
        {action.suggested_url ? (
          <Link href={action.suggested_url} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-axiel-soft transition hover:bg-black hover:text-white">
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {action.status === "pending" ? (
          <form action={setActionSuggestionStatus}>
            <input type="hidden" name="id" value={action.id} />
            <input type="hidden" name="status" value="accepted" />
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-axiel-blueDark">
              <Circle className="h-4 w-4" /> Accept
            </button>
          </form>
        ) : null}

        {action.status !== "completed" ? (
          <form action={setActionSuggestionStatus}>
            <input type="hidden" name="id" value={action.id} />
            <input type="hidden" name="status" value="completed" />
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:border border-axiel-line bg-white">
              <CheckCircle2 className="h-4 w-4" /> Complete
            </button>
          </form>
        ) : null}

        {action.status !== "ignored" && action.status !== "completed" ? (
          <form action={setActionSuggestionStatus}>
            <input type="hidden" name="id" value={action.id} />
            <input type="hidden" name="status" value="ignored" />
            <button className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-black/50 shadow-sm transition hover:border border-axiel-line bg-white">
              <X className="h-4 w-4" /> Ignore
            </button>
          </form>
        ) : null}

        {action.status === "completed" ? (
          <div className="flex items-center justify-center gap-2 rounded-full bg-axiel-soft px-4 py-2.5 text-sm font-semibold text-black/55">
            <Check className="h-4 w-4" /> Done
          </div>
        ) : null}
      </div>
    </div>
  );
}
