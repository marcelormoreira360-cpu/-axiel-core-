"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { saveClinicalTestCatalogAction, type CatalogState } from "@/app/settings/clinical-tests/actions";

type Row = { tempId: string; name: string };

function uid() {
  return Math.random().toString(36).slice(2);
}

export function ClinicalTestsCatalogForm({ initial }: { initial: string[] }) {
  const t = useTranslations("settings.clinicalTests");
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length ? initial.map((name) => ({ tempId: uid(), name })) : [{ tempId: uid(), name: "" }],
  );
  const [state, formAction, isPending] = useActionState<CatalogState, FormData>(
    async (prev, fd) => saveClinicalTestCatalogAction(prev, fd),
    null,
  );

  function update(tempId: string, name: string) {
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, name } : r)));
  }
  function add() {
    setRows((prev) => [...prev, { tempId: uid(), name: "" }]);
  }
  function remove(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  const catalogValue = JSON.stringify(rows.map((r) => r.name).filter((n) => n.trim()));

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="catalog" value={catalogValue} />

      <label className="text-[12px] font-medium text-[#6B6A66]">{t("label")}</label>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>}
        {rows.map((r) => (
          <div key={r.tempId} className="flex items-center gap-2">
            <input
              type="text"
              value={r.name}
              onChange={(e) => update(r.tempId, e.target.value)}
              placeholder={t("placeholder")}
              className="flex-1 h-9 px-3 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#A09E98] outline-none focus:border-[#0F6E56] transition"
            />
            <button
              type="button"
              onClick={() => remove(r.tempId)}
              className="w-9 h-9 flex items-center justify-center rounded-[8px] text-[#A09E98] hover:text-red-500 border border-black/[.08] shrink-0 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-[12px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("add")}
      </button>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] disabled:opacity-50 transition"
        >
          <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
        </button>
        {state?.ok && <span className="text-[12px] text-[#0F6E56]">{t("saved")}</span>}
        {state?.error && (
          <span className="inline-flex items-center gap-1 text-[12px] text-red-500">
            <AlertCircle className="h-3 w-3" /> {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
