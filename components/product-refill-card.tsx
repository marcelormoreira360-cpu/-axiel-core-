import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";

export function ProductRefillCard({
  productName,
  dueAt,
  message,
  status = "pending",
}: {
  productName: string;
  dueAt: string;
  message: string;
  status?: "pending" | "completed" | "canceled";
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <p className="font-semibold text-axiel-text-primary">{productName}</p>
        <StatusBadge label={status === "pending" ? "Pending" : status} tone={status === "completed" ? "final" : "neutral"} />
      </div>
      <p className="text-sm text-axiel-text-secondary">Due: {dueAt}</p>
      <p className="text-sm text-axiel-text-primary">{message}</p>
    </Card>
  );
}
