"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link2, Copy, Check, UserPlus } from "lucide-react";
import { createPublicCaptureLinkAction } from "@/app/forms/[id]/invite/actions";

/**
 * Painel do LINK DE CAPTAÇÃO: gera um link público reutilizável para enviar a
 * quem ainda não é paciente. A pessoa preenche os dados (vira Lead) e responde
 * o questionário.
 */
export function PublicCaptureLinkPanel({ templateId }: { templateId: string }) {
  const t = useTranslations("forms.capture");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const res = await createPublicCaptureLinkAction(templateId);
      setUrl(res.url);
      setCopied(false);
    });
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-[7px] mb-[6px]">
        <UserPlus className="h-3.5 w-3.5 text-[#0F6E56]" />
        <p className="text-[11px] font-medium text-[#6B6A66]">{t("title")}</p>
      </div>
      <p className="text-[11px] text-[#A09E98] leading-relaxed mb-[10px]">{t("desc")}</p>

      {!url ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[10px] py-[9px] transition"
        >
          <Link2 className="h-3.5 w-3.5" />
          {isPending ? t("generating") : t("generate")}
        </button>
      ) : (
        <>
          <p className="text-[11px] text-[#A09E98] mb-[6px]">{t("ready")}</p>
          <div className="flex items-center gap-[6px] bg-[#F4F3EF] rounded-[8px] px-[10px] py-[8px]">
            <p className="text-[11px] text-[#0F1A2E] flex-1 truncate font-mono">{url}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-[4px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[6px] px-[8px] py-[4px] transition"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="mt-[8px] text-[11px] text-[#A09E98] hover:text-[#0F1A2E] transition disabled:opacity-50"
          >
            {t("regenerate")}
          </button>
        </>
      )}
    </div>
  );
}
