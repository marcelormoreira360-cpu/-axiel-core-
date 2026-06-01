"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale-actions";
import { LOCALES } from "@/i18n/locales";

/**
 * Alterna o idioma da interface (PT-BR / EN). Grava cookie + preferência no banco
 * via Server Action e atualiza a árvore sem reload completo.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common.language");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-black/[.08] dark:border-white/[.10] bg-white/60 dark:bg-white/[.06] p-[2px]"
      role="group"
      aria-label={t("label")}
    >
      <Languages className="h-[13px] w-[13px] ml-1 text-[#A09E98] dark:text-[#6B6A66]" aria-hidden="true" />
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => change(code)}
            disabled={isPending}
            aria-pressed={active}
            className={[
              "px-[7px] py-[2px] rounded-[6px] text-[11px] font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-[#0F6E56] text-white"
                : "text-[#6B6A66] dark:text-[#9E9C97] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2]",
            ].join(" ")}
          >
            {code === "pt-BR" ? "PT" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
