"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormatMoney } from "@/components/currency-provider";

// ── Per-session pay button ───────────────────────────────────────────────────
export function PaySessionButton({
  appointmentId,
  priceCents,
  rawToken,
  brandColor,
}: {
  appointmentId: string;
  priceCents: number;
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const money = useFormatMoney();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatted = money(priceCents);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/session-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_token: rawToken, appointment_id: appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("errStart")); return; }
      window.location.href = data.url;
    } catch {
      setError(t("errConn"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePay}
        disabled={loading}
        className="shrink-0 rounded-xl px-3 py-1 text-xs font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: brandColor }}
      >
        {loading ? "…" : t("pay", { amount: formatted })}
      </button>
      {error && <p className="text-[10px] text-red-500 max-w-[120px] text-right">{error}</p>}
    </div>
  );
}
