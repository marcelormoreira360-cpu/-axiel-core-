import Link from "next/link";
import { Package } from "lucide-react";
import { Shell } from "@/components/shell";
import { EmptyState } from "@/components/empty-state";
import { getProducts } from "@/services/product-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getClinicCurrency } from "@/services/finance-service";
import { formatMoney } from "@/lib/finance-utils";
import { getLocale } from "next-intl/server";
import { toggleProductActiveAction } from "./actions";


function avgPriceCents(products: { price_cents: number }[]) {
  if (products.length === 0) return 0;
  return Math.round(products.reduce((s, p) => s + p.price_cents, 0) / products.length);
}

export default async function ProductsPage() {
  const clinic = await getCurrentClinic();
  const __cur = await getClinicCurrency(clinic?.id ?? "");
  const __loc = await getLocale();
  const products = await getProducts();
  const activeProducts = products.filter((p) => p.is_active);
  const avg = avgPriceCents(products);

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">Produtos</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {products.length > 0
              ? `${products.length} produto${products.length !== 1 ? "s" : ""} no catálogo`
              : "Nenhum produto ainda"}
          </p>
        </div>
        <Link
          href="/products/new"
          className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12] dark:border-white/[.12]"
        >
          + Novo produto
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Nenhum produto ainda"
          text="Adicione suplementos, kits e itens de suporte ao catálogo da clínica."
          href="/products/new"
          action="Criar primeiro produto"
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-[10px] mb-[22px]">
            {[
              { label: "Total de produtos", value: products.length, accent: true },
              { label: "Ativos", value: activeProducts.length, accent: false },
              { label: "Valor médio", value: formatMoney(avg, __cur, __loc), accent: false },
            ].map((stat) => (
              <div
                key={stat.label}
                className={[
                  "rounded-[10px] border px-[14px] py-[12px]",
                  stat.accent
                    ? "bg-[#0F1A2E] border-transparent"
                    : "bg-white dark:bg-[#111827] border-black/[.07] dark:border-white/[.07]",
                ].join(" ")}
              >
                <p
                  className={`text-[10px] font-medium tracking-[.08em] uppercase mb-[6px] ${
                    stat.accent ? "text-white/50" : "text-[#A09E98]"
                  }`}
                >
                  {stat.label}
                </p>
                <p
                  className={`text-[26px] font-semibold tracking-[-0.04em] leading-none ${
                    stat.accent ? "text-white" : "text-[#0F1A2E] dark:text-[#E8E6E2]"
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[10px]">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[16px] py-[14px] flex flex-col gap-[10px]"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate leading-snug">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-[#A09E98] mt-[2px]">{product.category}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-medium px-[8px] py-[2px] rounded-full ${
                      product.is_active
                        ? "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#0F6E56] dark:text-[#9FE1CB]"
                        : "bg-[#F4F3EF] dark:bg-white/[.06] text-[#6B6A66] dark:text-[#9E9C97]"
                    }`}
                  >
                    {product.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97] leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Price + inventory row */}
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold tracking-[-0.03em] text-[#0F1A2E] dark:text-[#E8E6E2]">
                    {formatMoney(product.price_cents, __cur, __loc)}
                  </p>
                  <div className="flex items-center gap-[5px]">
                    <span
                      className={`w-[6px] h-[6px] rounded-full ${
                        product.inventory_quantity > 5
                          ? "bg-[#0F6E56]"
                          : product.inventory_quantity > 0
                          ? "bg-[#F5A623]"
                          : "bg-[#FF6B4A]"
                      }`}
                    />
                    <span className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">
                      {product.inventory_quantity} em estoque
                    </span>
                  </div>
                </div>

                {/* SKU */}
                {product.sku && (
                  <p className="text-[10px] text-[#A09E98]">SKU: {product.sku}</p>
                )}

                {/* Toggle active */}
                <form action={toggleProductActiveAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <input
                    type="hidden"
                    name="is_active"
                    value={product.is_active ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] bg-[#F4F3EF] dark:bg-white/[.06] hover:bg-[#EEECEA] dark:hover:bg-white/[.08] transition px-[10px] py-[5px] rounded-lg w-full mt-[2px]"
                  >
                    {product.is_active ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
