"use client";

import { useState } from "react";

// Botões de cobrança de um pedido: Cartão (Stripe) + Pix/Boleto (Asaas).
export function OrderChargeButtons({ orderId, asaasEnabled }: { orderId: string; asaasEnabled: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(key: string, endpoint: string, billingType?: "PIX" | "BOLETO") {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, ...(billingType ? { billing_type: billingType } : {}) }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) { setError(data.error ?? "Erro ao gerar cobrança."); return; }
      setUrl(data.url);
    } catch {
      setError("Erro ao gerar cobrança.");
    } finally {
      setLoading(null);
    }
  }

  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  }

  if (url) {
    return (
      <div className="flex items-center gap-1.5">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          className="w-40 text-[10px] text-[#6B6A66] dark:text-[#9E9C97] bg-axiel-background border border-axiel-line rounded-md px-2 py-1" />
        <button onClick={copy} className="text-[10px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] border border-[#0F6E56]/20 bg-[#E1F5EE] dark:bg-[#0F6E56]/20 hover:bg-[#d0f0e6] dark:hover:bg-[#0F6E56]/30 rounded-md px-2 py-1 transition">
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-axiel-line hover:bg-axiel-background rounded-md px-2 py-1 transition">Abrir</a>
      </div>
    );
  }

  const btn = "text-[10px] font-medium text-[#0B1F3A] dark:text-[#E8E6E2] border border-[#0B1F3A]/20 dark:border-white/[.15] bg-[#0B1F3A]/[.04] dark:bg-white/[.06] hover:bg-[#0B1F3A]/[.08] dark:hover:bg-white/[.08] disabled:opacity-50 rounded-md px-2 py-1 transition";

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <button onClick={() => run("card", "/api/stripe/order-checkout")} disabled={!!loading} className={btn}>
        {loading === "card" ? "…" : "Cartão"}
      </button>
      {asaasEnabled && (
        <>
          <button onClick={() => run("pix", "/api/asaas/charge-order", "PIX")} disabled={!!loading} className={btn}>
            {loading === "pix" ? "…" : "Pix"}
          </button>
          <button onClick={() => run("boleto", "/api/asaas/charge-order", "BOLETO")} disabled={!!loading} className={btn}>
            {loading === "boleto" ? "…" : "Boleto"}
          </button>
        </>
      )}
      {error && <span className="text-[9px] text-rose-500 w-full text-right">{error}</span>}
    </div>
  );
}
