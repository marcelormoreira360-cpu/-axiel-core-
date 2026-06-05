"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Botão "Pix" (via Asaas) numa sessão não paga: gera a cobrança Pix e devolve o
// link da página de pagamento (invoiceUrl) para a clínica enviar ao paciente.
export function AsaasPixButton({ appointmentId }: { appointmentId: string }) {
  const t = useTranslations("finance.charge");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/asaas/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? t("error"));
        return;
      }
      setUrl(data.url);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (url) {
    return (
      <div className="mt-1 w-full">
        <p className="text-[10px] text-[#A09E98] mb-1">{t("pixLinkReady")}</p>
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 text-[10px] text-[#6B6A66] bg-[#F4F3EF] border border-black/[.06] rounded-md px-2 py-1"
          />
          <button
            onClick={copy}
            className="shrink-0 text-[10px] font-medium text-[#0F6E56] border border-[#0F6E56]/20 bg-[#E1F5EE] hover:bg-[#d0f0e6] rounded-md px-2 py-1 transition"
          >
            {copied ? t("copied") : t("copy")}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[10px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] rounded-md px-2 py-1 transition"
          >
            {t("open")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={generate}
        disabled={loading}
        className="text-[10px] font-medium text-[#0B1F3A] border border-[#0B1F3A]/20 bg-[#0B1F3A]/[.04] hover:bg-[#0B1F3A]/[.08] disabled:opacity-50 rounded-md px-2.5 py-1 transition"
      >
        {loading ? t("generating") : t("pix")}
      </button>
      {error && <p className="text-[9px] text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
