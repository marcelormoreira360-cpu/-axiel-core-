import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { getCurrentClinic } from "@/services/clinic-service";
import { getProducts } from "@/services/product-service";
import { getPatients } from "@/services/patient-service";
import { NewOrderForm } from "../new-order-form";

export default async function NewProductOrderPage() {
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [products, patients] = await Promise.all([getProducts(), getPatients()]);
  const activeProducts = products
    .filter((p) => p.is_active && p.price_cents > 0)
    .map((p) => ({ id: p.id, name: p.name, price_cents: p.price_cents }));

  return (
    <Shell>
      <div className="mb-6">
        <BackLink fallbackHref="/products/orders" className="inline-flex items-center gap-1.5 text-[12px] text-[#6B6A66] dark:text-[#9E9C97] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Pedidos
        </BackLink>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">Novo pedido</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">Selecione produtos e quantidades para gerar um pedido.</p>
      </div>

      {activeProducts.length === 0 ? (
        <EmptyState
          title="Nenhum produto ativo"
          text="Cadastre produtos com valor para poder criar pedidos."
          action="Cadastrar produto"
          href="/products/new"
        />
      ) : (
        <NewOrderForm products={activeProducts} patients={patients.map((p) => ({ id: p.id, full_name: p.full_name }))} />
      )}
    </Shell>
  );
}
