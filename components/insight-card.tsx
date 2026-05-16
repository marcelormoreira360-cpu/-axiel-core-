import type { ReactNode } from "react";
import { Badge, type BadgeStatus } from "@/components/status-badge";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { cn } from "@/lib/utils";

export type InsightCardProps = {
  title: string;
  summary: string;
  status: BadgeStatus;
  approveLabel?: string;
  adjustLabel?: string;
  onApprove?: () => void;
  onAdjust?: () => void;
  approveDisabled?: boolean;
  adjustDisabled?: boolean;
  details?: ReactNode;
  className?: string;
};

export function InsightCard({
  title,
  summary,
  status,
  approveLabel = "Approve",
  adjustLabel = "Adjust",
  onApprove,
  onAdjust,
  approveDisabled = false,
  adjustDisabled = false,
  details,
  className,
}: InsightCardProps) {
  return (
    <div className={cn("bg-white rounded-2xl p-6 shadow-sm space-y-4 transition hover:shadow-md", className)}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-axiel-text-primary">{title}</h3>
        <Badge status={status} />
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-axiel-text-secondary">{summary}</p>

      <div className="flex flex-wrap gap-3">
        <ButtonPrimary type="button" onClick={onApprove} disabled={approveDisabled}>
          {approveLabel}
        </ButtonPrimary>
        <ButtonSecondary type="button" onClick={onAdjust} disabled={adjustDisabled}>
          {adjustLabel}
        </ButtonSecondary>
      </div>

      {details ? (
        <details className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-axiel-text-secondary">
          <summary className="cursor-pointer list-none font-medium text-axiel-text-primary">View details</summary>
          <div className="mt-3 border-t border-gray-100 pt-3">{details}</div>
        </details>
      ) : null}
    </div>
  );
}
