"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";

export function CopyPortalLinkCard({ url }: { url: string }) {
  const t = useTranslations("patients.portalLink");
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-black/40">{t("title")}</p>
      <p className="mt-1 text-xs leading-5 text-black/40">{t("expires")}</p>
      <div className="mt-3 rounded-2xl bg-axiel-soft p-4 text-sm leading-6 text-black/60 break-all">{url}</div>
      <button
        type="button"
        onClick={copyLink}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-5 text-sm font-semibold text-white shadow-md transition hover:bg-axiel-blueDark"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
