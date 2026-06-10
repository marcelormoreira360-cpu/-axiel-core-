"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Botão "copiar link de indicação" — sub-componente client do ReferralCard.
export function ReferralCopyButton({ link }: { link: string }) {
  const t = useTranslations("referral");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para contextos sem clipboard API (http, browsers antigos)
      try {
        const el = document.createElement("textarea");
        el.value = link;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* sem clipboard — usuário copia manualmente */ }
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-[8px] px-[12px] py-[7px] text-[11px] font-medium transition ${
        copied
          ? "bg-[#E1F5EE] text-[#0F6E56]"
          : "bg-[#0F1A2E] text-white hover:bg-[#1C2A45]"
      }`}
    >
      {copied ? t("copied") : t("copy")}
    </button>
  );
}
