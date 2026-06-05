import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Shell } from "@/components/shell";
import { EmptyState } from "@/components/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAsaasConfigured } from "@/lib/asaas";
import { OrderChargeButtons } from "./order-charge-buttons";
import { OrderDeliverButton } from "./order-deliver-button";

type DbOrder = {
  id: string;
  status: "draft" | "pending" | "paid" | "delivered" | "canceled";
  payment_status: "unpaid" | "paid" | "refunded" | "failed";
  total_cents: number;
  currency: string;
  created_at: string;
  patients: { full_name: string } | null;
};

const ORDER_STATUS_LABELS: Record<DbOrder["status"], string> = {
  draft: "Rascunho",
  pending: "Pendente",
  paid: "Pago",
  delivered: "Entregue",
  canceled: "Cancelado",
};

const ORDER_STATUS_CLASSES: Record<DbOrder["status"], string> = {
  draft: "bg-[#F4F3EF] text-[#6B6A66]",
  pending: "bg-[#FEF3C7] text-[#92400E]",
  paid: "bg-[#E1F5EE] text-[#0F6E56]",
  delivered: "bg-[#E1F5EE] text-[#0F6E56]",
  canceled: "bg-[#FEE2E2] text-[#991B1B]",
};

const PAYMENT_STATUS_LABELS: Record<DbOrder["payment_status"], string> = {
  unpaid: "Não pago",
  paid: "Pago",
  refunded: "Reembolsado",
  failed: "Falhou",
};

function formatBRL(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function getProductOrders(): Promise<DbOrder[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_orders")
    .select("id, status, payment_status, total_cents, currency, created_at, patients(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as unknown as DbOrder[];
}

export default async function ProductOrdersPage() {
  const orders = await getProductOrders();
  const asaasEnabled = isAsaasConfigured();

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between mb-[22px]">
        <div className="flex items-center gap-[10px]">
          <Link
            href="/products"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
              Pedidos de produtos
            </h1>
            <p className="text-[12px] text-[#A09E98] mt-[2px]">
              {orders.length > 0
                ? `${orders.length} pedido${orders.length !== 1 ? "s" : ""}`
                : "Nenhum pedido ainda"}
            </p>
          </div>
        </div>
        <Link
          href="/products/orders/new"
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-lg px-3 py-1.5 transition"
        >
          + Novo pedido
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title="Nenhum pedido ainda"
          text="Os pedidos de produtos aparecerão aqui assim que forem criados."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]"
            >
              {/* Order ID + status */}
              <div className="flex items-start justify-between gap-2 mb-[8px]">
                <div>
                  <p className="text-[12px] font-medium text-[#0F1A2E] font-mono">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-[11px] text-[#A09E98] mt-[1px]">
                    {order.patients?.full_name ?? "Venda avulsa"}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-medium px-[8px] py-[2px] rounded-full ${ORDER_STATUS_CLASSES[order.status]}`}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              {/* Total + payment */}
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold tracking-[-0.03em] text-[#0F1A2E]">
                  {formatBRL(order.total_cents, order.currency)}
                </p>
                <span className="text-[11px] text-[#6B6A66]">
                  {PAYMENT_STATUS_LABELS[order.payment_status]}
                </span>
              </div>

              {/* Date */}
              <p className="text-[10px] text-[#A09E98] mt-[6px]">{formatDate(order.created_at)}</p>

              {/* Cobrança (pedidos não pagos) */}
              {order.payment_status !== "paid" && order.status !== "canceled" && order.total_cents > 0 && (
                <div className="mt-[10px] pt-[10px] border-t border-black/[.05]">
                  <OrderChargeButtons orderId={order.id} asaasEnabled={asaasEnabled} />
                </div>
              )}

              {/* Fulfillment (pago, ainda não entregue) */}
              {order.payment_status === "paid" && order.status === "paid" && (
                <div className="mt-[10px] pt-[10px] border-t border-black/[.05]">
                  <OrderDeliverButton orderId={order.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
