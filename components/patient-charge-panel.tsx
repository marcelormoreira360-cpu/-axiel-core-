"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, RefreshCw } from "lucide-react";

export type ChargeableOffer = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  offer_type: "session_package" | "membership";
  number_of_sessions: number;
};

function formatMoney(cents: number, currency: string, locale: string) {
  try {
    return (cents / 100).toLocaleString(locale, { style: "currency", currency: currency || "BRL" });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

// Painel "Cobrança" no perfil do paciente: a clínica escolhe uma oferta ativa
// (pacote ou plano) e gera um link de pagamento Stripe para enviar ao paciente.
export function PatientChargePanel({
  patientId,
  offers,
}: {
  patientId: string;
  offers: ChargeableOffer[];
}) {
  const t = useTranslations("finance.chargeOffer");
  const locale = useLocale();
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const current = offers.find((o) => o.id === selected) ?? null;

  async function generate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      const res = await fetch("/api/finance/charge-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, offer_id: selected }),
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

  return (
    <div className="space-y-[8px]">
      <p className="text-[11px] font-medium text-[#6B6A66]">{t("title")}</p>

      <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[14px] space-y-[10px]">
        {offers.length === 0 ? (
          <p className="text-[12px] text-[#A09E98]">
            {t("noOffers")}{" "}
            <Link href="/settings/offers" className="text-[#0F6E56] hover:underline">
              {t("noOffersLink")}
            </Link>
          </p>
        ) : (
          <>
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setUrl(null);
                setError(null);
              }}
              className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
            >
              <option value="">{t("selectPlaceholder")}</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {formatMoney(o.price_cents, o.currency, locale)}
                  {o.offer_type === "membership" ? ` / ${t("perCycle")}` : ""}
                </option>
              ))}
            </select>

            {current && (
              <div className="flex items-center gap-[6px] text-[10px] text-[#A09E98]">
                {current.offer_type === "membership" ? (
                  <>
                    <RefreshCw className="h-3 w-3 text-[#0F6E56]" />
                    <span>{t("hintRecurring")}</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-3 w-3 text-[#0F6E56]" />
                    <span>{t("hintOneTime")}</span>
                  </>
                )}
              </div>
            )}

            {url ? (
              <div>
                <p className="text-[10px] text-[#A09E98] mb-1">{t("linkReady")}</p>
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
                <p className="text-[9px] text-[#A09E98] mt-1">{t("sendHint")}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {error ? (
                  <p className="text-[10px] text-rose-500">{error}</p>
                ) : (
                  <span />
                )}
                <button
                  onClick={generate}
                  disabled={!selected || loading}
                  className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[16px] py-[8px] transition"
                >
                  {loading ? t("generating") : t("generate")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
