"use client";

import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { Card } from "@/components/card";
import type { Product } from "@/modules/products/product-types";

export function SellProductModal({
  product,
  open,
  onClose,
}: {
  product?: Product;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-axiel-primary/20 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-axiel-text-primary">Vender produto</h2>
          <p className="mt-1 text-sm text-axiel-text-secondary">Registre uma venda manual para esta clínica.</p>
        </div>

        <div className="space-y-4">
          <label className="space-y-2 text-sm font-medium">
            Produto
            <input className="w-full rounded-xl border border-gray-200 px-4 py-3" value={product?.name ?? ""} readOnly />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Quantidade
            <input className="w-full rounded-xl border border-gray-200 px-4 py-3" type="number" min="1" defaultValue={1} />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Status do pagamento
            <select className="w-full rounded-xl border border-gray-200 px-4 py-3">
              <option value="unpaid">Pendente</option>
              <option value="paid">Pago</option>
              <option value="failed">Falhou</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <ButtonPrimary type="button" onClick={onClose}>Registrar venda</ButtonPrimary>
          <ButtonSecondary type="button" onClick={onClose}>Cancelar</ButtonSecondary>
        </div>
      </Card>
    </div>
  );
}
