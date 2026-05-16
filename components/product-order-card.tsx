import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/modules/products/product-language";
import type { ProductOrder } from "@/modules/products/product-types";

export function ProductOrderCard({ order }: { order: ProductOrder }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-axiel-text-primary">Order {order.id}</p>
          <p className="mt-1 text-sm text-axiel-text-secondary">{order.patientName ?? "Walk-in sale"}</p>
        </div>
        <StatusBadge label={order.status} tone={order.status === "paid" || order.status === "delivered" ? "final" : "neutral"} />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-axiel-text-secondary">{order.paymentStatus}</span>
        <span className="font-medium text-axiel-text-primary">{formatCurrency(order.totalCents, order.currency)}</span>
      </div>
    </Card>
  );
}
