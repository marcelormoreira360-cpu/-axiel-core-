import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getHotmartToken, listRecentHotmartPurchases } from "@/services/hotmart-service";
import { HotmartForm } from "./hotmart-form";
import { redirect } from "next/navigation";

function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    completed: { label: "Confirmada", color: "bg-[#E1F5EE] text-[#0F6E56]" },
    cancelled:  { label: "Cancelada",  color: "bg-red-50 text-red-500" },
    refunded:   { label: "Reembolsada", color: "bg-amber-50 text-amber-600" },
    chargeback: { label: "Chargeback", color: "bg-red-100 text-red-600" },
  };
  return map[status] ?? { label: status, color: "bg-[#F4F3EF] text-[#6B6A66]" };
}

function formatBRL(cents: number | null) {
  if (!cents) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function HotmartSettingsPage() {
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [hottok, purchases] = await Promise.all([
    getHotmartToken(clinic.id),
    listRecentHotmartPurchases(clinic.id),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/webhooks/hotmart?clinic_id=${clinic.id}`;

  return (
    <Shell>
      <div className="mb-8">
        <Link
          href="/settings/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integrações
        </Link>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Integração</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Hotmart</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">
          Sincronize compras de cursos e infoprodutos da Hotmart com os pacientes da clínica.
          Quando alguém comprar, o cadastro é criado automaticamente e uma mensagem de boas-vindas é enviada.
        </p>
      </div>

      <HotmartForm
        clinicId={clinic.id}
        webhookUrl={webhookUrl}
        hasToken={!!hottok}
      />

      {/* Compras recentes */}
      {purchases.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Compras recentes</h2>
          <div className="overflow-hidden rounded-xl border border-black/[.07] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[.06] bg-[#FAFAF8]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">Comprador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/40">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04]">
                {purchases.map((p) => {
                  const s = statusLabel(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAF8] transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0F1A2E]">{p.buyer_name || "—"}</p>
                        <p className="text-xs text-black/40">{p.buyer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#0F1A2E]">{p.product_name}</td>
                      <td className="px-4 py-3 font-medium text-[#0F1A2E]">{formatBRL(p.price_cents)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-black/40">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
