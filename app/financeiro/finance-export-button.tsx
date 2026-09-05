"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText, Sheet } from "lucide-react";

// Botão de export dos dashboards financeiros. Aponta para
// /api/financeiro/export/[report]?format=pdf|csv (GET autenticado, mesmo domínio).
export function FinanceExportButton({ report }: { report: string }) {
  const t = useTranslations("finance.export");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const base = `/api/financeiro/export/${report}`;
  const linkCls =
    "flex items-center gap-[8px] px-[12px] py-[8px] text-[12px] text-[#0F1A2E] hover:bg-[#F4F3EF] transition";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-[6px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] bg-white dark:bg-transparent px-[12px] py-[7px] text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
      >
        <Download className="h-3.5 w-3.5" /> {t("button")}
      </button>
      {open && (
        <div className="absolute right-0 mt-[6px] z-10 w-[150px] bg-white border border-black/[.08] rounded-[10px] shadow-lg overflow-hidden">
          <a href={`${base}?format=pdf`} className={linkCls} onClick={() => setOpen(false)}>
            <FileText className="h-3.5 w-3.5 text-[#B42318]" /> {t("pdf")}
          </a>
          <a href={`${base}?format=csv`} className={linkCls} onClick={() => setOpen(false)}>
            <Sheet className="h-3.5 w-3.5 text-[#0F6E56]" /> {t("csv")}
          </a>
        </div>
      )}
    </div>
  );
}
