import { Card } from "@/components/card";
import { ButtonSecondary } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/modules/products/product-language";
import type { Product } from "@/modules/products/product-types";

export function ProductCard({
  product,
  onSell,
  onAddToPatient,
}: {
  product: Product;
  onSell?: () => void;
  onAddToPatient?: () => void;
}) {
  const inventoryLabel =
    product.inventoryQuantity <= 0 ? "Out of stock" : product.inventoryQuantity <= 5 ? "Low inventory" : "In stock";

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-axiel-text-primary">{product.name}</p>
          <p className="mt-1 text-sm text-axiel-text-secondary">{product.category}</p>
        </div>
        <StatusBadge label={product.isActive ? "Active" : "Inactive"} tone={product.isActive ? "final" : "neutral"} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-axiel-text-primary">{formatCurrency(product.priceCents, product.currency)}</span>
        <span className="text-axiel-text-secondary">{inventoryLabel}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ButtonSecondary type="button">View details</ButtonSecondary>
        <ButtonSecondary type="button" onClick={onAddToPatient}>Add to patient</ButtonSecondary>
        <ButtonSecondary type="button" onClick={onSell}>Sell</ButtonSecondary>
      </div>
    </Card>
  );
}
