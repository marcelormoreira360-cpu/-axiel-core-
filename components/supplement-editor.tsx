"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import type { NeuroProtocoloSuplementacao } from "@/lib/types";
import { saveSupplementEditsAction } from "@/app/patients/[id]/insights/actions";

const IN_CLASS =
  "w-full text-sm leading-6 text-axiel-text-primary bg-white dark:bg-white/[.03] border border-black/[.12] dark:border-white/[.12] rounded-lg px-3 py-2 outline-none focus:border-[#0F6E56]/60 transition";

type Item = NonNullable<NeuroProtocoloSuplementacao["itens"]>[number];

function emptyItem(): Item {
  return { nome: "", objetivo: "", dose_sugerida: "", forma: "", como_tomar: "", buy_url: "", observacao: "" };
}

/**
 * Editor MANUAL do Documento 2 (Suplementação) na mesa de revisão. O profissional
 * ajusta itens (nome, forma, dose, como tomar) e — nos EUA — cola o link de compra.
 * Salva em final_output (sem enviar). O campo de link só aparece quando country="US".
 */
export function SupplementEditor({
  patientId,
  insightId,
  protocolo,
  country,
}: {
  patientId: string;
  insightId: string;
  protocolo: NeuroProtocoloSuplementacao | null | undefined;
  country: "BR" | "US";
}) {
  const t = useTranslations("neuroId.documents360.supplementEditor");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>(() =>
    (protocolo?.itens ?? []).map((i) => ({ ...emptyItem(), ...i })),
  );
  const [general, setGeneral] = useState((protocolo?.observacoes_gerais ?? []).join("\n"));

  function update(idx: number, key: keyof Item, val: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }

  function handleSave() {
    setSaved(false);
    setError(null);
    const payload: NeuroProtocoloSuplementacao = {
      itens: items
        .filter((it) => it.nome.trim())
        .map((it) => ({
          nome: it.nome.trim(),
          objetivo: (it.objetivo ?? "").trim(),
          dose_sugerida: (it.dose_sugerida ?? "").trim(),
          forma: (it.forma ?? "").trim() || undefined,
          como_tomar: (it.como_tomar ?? "").trim() || undefined,
          buy_url: country === "US" ? (it.buy_url ?? "").trim() || undefined : undefined,
          observacao: (it.observacao ?? "").trim(),
        })),
      observacoes_gerais: general.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    startTransition(async () => {
      const res = await saveSupplementEditsAction(patientId, insightId, payload);
      if (!res.ok) {
        setError(res.error ?? tc("save"));
        return;
      }
      setSaved(true);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { setOpen(true); setSaved(false); }}
          className="inline-flex items-center gap-2 rounded-xl border border-black/[.12] dark:border-white/[.14] px-4 py-2 text-xs font-medium text-axiel-text-primary transition hover:bg-gray-50 dark:hover:bg-white/[.06]"
        >
          <Pencil className="h-3.5 w-3.5" /> {t("editButton")}
        </button>
        {saved ? (
          <p className="inline-flex items-center gap-2 text-xs text-[#0F6E56]">
            <Check className="h-3.5 w-3.5" /> {t("saved")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/[.10] dark:border-white/[.12] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-axiel-text-primary">{t("title")}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-axiel-text-secondary hover:text-axiel-text-primary" aria-label={tc("cancel")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-axiel-text-secondary">{country === "US" ? t("hintUs") : t("hintBr")}</p>

      {items.length === 0 ? <p className="text-xs text-axiel-text-secondary">{t("empty")}</p> : null}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-2 rounded-lg bg-gray-50 dark:bg-white/[.04] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-axiel-text-secondary">#{idx + 1}</span>
              <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-axiel-text-secondary hover:text-red-600" aria-label={t("removeItem")}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input className={IN_CLASS} placeholder={t("fieldName")} value={item.nome} onChange={(e) => update(idx, "nome", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={IN_CLASS} placeholder={t("fieldForm")} value={item.forma ?? ""} onChange={(e) => update(idx, "forma", e.target.value)} />
              <input className={IN_CLASS} placeholder={t("fieldDose")} value={item.dose_sugerida ?? ""} onChange={(e) => update(idx, "dose_sugerida", e.target.value)} />
            </div>
            <input className={IN_CLASS} placeholder={t("fieldHow")} value={item.como_tomar ?? ""} onChange={(e) => update(idx, "como_tomar", e.target.value)} />
            <input className={IN_CLASS} placeholder={t("fieldGoal")} value={item.objetivo ?? ""} onChange={(e) => update(idx, "objetivo", e.target.value)} />
            <input className={IN_CLASS} placeholder={t("fieldNote")} value={item.observacao ?? ""} onChange={(e) => update(idx, "observacao", e.target.value)} />
            {country === "US" ? (
              <div className="space-y-1">
                <input className={IN_CLASS} placeholder={t("fieldBuyUrl")} value={item.buy_url ?? ""} onChange={(e) => update(idx, "buy_url", e.target.value)} />
                <p className="text-[11px] text-axiel-text-secondary">{t("buyUrlHint")}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setItems((p) => [...p, emptyItem()])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-black/[.16] dark:border-white/[.16] px-3 py-2 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06]">
        <Plus className="h-3.5 w-3.5" /> {t("addItem")}
      </button>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-axiel-text-secondary">{t("generalNotes")}</span>
        <textarea className={IN_CLASS} rows={2} value={general} onChange={(e) => setGeneral(e.target.value)} />
      </label>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-[#0F6E56] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> {pending ? t("saving") : tc("save")}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-xs font-medium text-axiel-text-secondary hover:text-axiel-text-primary disabled:opacity-50">
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}
