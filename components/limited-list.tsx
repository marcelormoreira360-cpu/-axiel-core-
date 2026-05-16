import { ReactNode } from "react";
import { ViewDetails } from "@/components/view-details";

export function LimitedList<T>({
  items,
  limit = 5,
  renderItem,
  className = "space-y-3",
  detailsLabel,
}: {
  items: T[];
  limit?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  detailsLabel?: string;
}) {
  const visible = items.slice(0, limit);
  const hidden = items.slice(limit);

  return (
    <div className={className}>
      {visible.map((item, index) => renderItem(item, index))}
      {hidden.length > 0 ? (
        <ViewDetails label={detailsLabel ?? `View ${hidden.length} more`}>
          <div className={className}>{hidden.map((item, index) => renderItem(item, index + limit))}</div>
        </ViewDetails>
      ) : null}
    </div>
  );
}
