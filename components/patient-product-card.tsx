import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import type { PatientProduct } from "@/modules/products/product-types";

export function PatientProductCard({ item }: { item: PatientProduct }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-axiel-text-primary">{item.productName}</p>
          <p className="mt-1 text-sm text-axiel-text-secondary">Reason: {item.reason}</p>
        </div>
        <StatusBadge label={item.status === "active" ? "Active" : item.status} tone={item.status === "active" ? "final" : "neutral"} />
      </div>
      <p className="text-sm text-axiel-text-primary">Next Step: {item.nextStep}</p>
      {item.reviewDate && <p className="text-sm text-axiel-text-secondary">Review: {item.reviewDate}</p>}
    </Card>
  );
}
