"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, X, Check, Loader2 } from "lucide-react";
import { TEMPLATE_CATALOG } from "@/app/forms/forms-catalog";

const TAG_COLORS: Record<string, string> = {
  "Depressão":  "bg-blue-50 text-blue-600",
  "Depression": "bg-blue-50 text-blue-600",
  "Ansiedade":  "bg-amber-50 text-amber-600",
  "Anxiety":    "bg-amber-50 text-amber-600",
  "HPA":        "bg-purple-50 text-purple-600",
  "MSQ":        "bg-teal-50 text-teal-600",
};

interface ActionEntry {
  key: string;
  action: () => Promise<void>;
}

interface Props {
  available: string[];
  actionEntries: ActionEntry[];
}

export function ImportTemplatesButton({ available, actionEntries }: Props) {
  const t = useTranslations("forms.import");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(null);

  if (available.length === 0) return null;

  function handleImport(key: string, action: () => Promise<void>) {
    setError(null);
    setCurrentKey(key);
    startTransition(async () => {
      try {
        await action();
        setDone((prev) => [...prev, key]);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error"));
      } finally {
        setCurrentKey(null);
      }
    });
  }

  const remaining = available.filter((k) => !done.includes(k));
  const catalog = TEMPLATE_CATALOG.filter((t) => available.includes(t.key));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition"
      >
        <Download className="h-3 w-3" />
        {t("button", { count: remaining.length })}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#0F1A2E]/30 backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-[520px] bg-white rounded-[16px] border border-black/[.08] shadow-xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">{t("library")}</p>
                <h2 className="text-[16px] font-medium text-[#0F1A2E] mt-[2px]">{t("importValidated")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">{error}</div>
            )}

            <div className="space-y-[6px]">
              {catalog.map((tpl) => {
                const isDone = done.includes(tpl.key);
                const isLoading = isPending && currentKey === tpl.key;
                const entry = actionEntries.find((e) => e.key === tpl.key);
                return (
                  <div
                    key={tpl.key}
                    className={`flex items-center gap-3 px-[12px] py-[10px] rounded-[10px] border transition ${
                      isDone ? "border-[#0F6E56]/20 bg-[#F0FAF6]" : "border-black/[.07] bg-white"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[6px] mb-[2px]">
                        <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{tpl.name}</p>
                        <span className={`shrink-0 rounded-full px-[6px] py-[1px] text-[9px] font-semibold ${TAG_COLORS[tpl.tag] ?? "bg-[#F4F3EF] text-[#6B6A66]"}`}>
                          {tpl.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A09E98]">{tpl.description}</p>
                    </div>

                    {isDone ? (
                      <div className="shrink-0 flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56]">
                        <Check className="h-3.5 w-3.5" /> {t("imported")}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending || !entry}
                        onClick={() => entry && handleImport(tpl.key, entry.action)}
                        className="shrink-0 flex items-center gap-[4px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[6px] px-[10px] py-[5px] transition"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        {t("import")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {remaining.filter((k) => !done.includes(k)).length === 0 && catalog.length > 0 && (
              <p className="mt-4 text-center text-[12px] text-[#0F6E56] font-medium">
                {t("allImported")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
