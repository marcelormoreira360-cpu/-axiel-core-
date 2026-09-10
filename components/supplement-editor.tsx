"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import type { NeuroProtocoloSuplementacao, NeuroFormulaManipulada } from "@/lib/types";
import { saveSupplementEditsAction } from "@/app/patients/[id]/insights/actions";

const IN_CLASS =
  "w-full text-sm leading-6 text-axiel-text-primary bg-white dark:bg-white/[.03] border border-black/[.12] dark:border-white/[.12] rounded-lg px-3 py-2 outline-none focus:border-[#0F6E56]/60 transition";

type Item = NonNullable<NeuroProtocoloSuplementacao["itens"]>[number];
type Cuidado = { titulo: string; texto: string };
type Formula = NeuroFormulaManipulada;

function emptyItem(): Item {
  return { nome: "", objetivo: "", dose_sugerida: "", forma: "", como_tomar: "", buy_url: "", observacao: "" };
}
function emptyFormula(): Formula {
  return { nome: "", composicao: [{ ativo: "", quantidade: "" }], excipiente: "", posologia: "", duracao: "" };
}

/**
 * Editor MANUAL do Documento 2 (Suplementação). Sensível ao país:
 *  • BR → cuidados + FÓRMULAS manipuladas (nome, composição ativo+quantidade, excipiente,
 *    posologia, duração) — receita pronta para a farmácia.
 *  • US → itens (nome/forma/dose/como tomar) + link de compra.
 * Salva em final_output (sem enviar).
 */
export function SupplementEditor({
  patientId,
  insightId,
  protocolo,
  country,
  open: openProp,
  onOpenChange,
}: {
  patientId: string;
  insightId: string;
  protocolo: NeuroProtocoloSuplementacao | null | undefined;
  country: "BR" | "US";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const t = useTranslations("neuroId.documents360.supplementEditor");
  const tc = useTranslations("common.actions");
  // Modo controlado (open/onOpenChange): o pai comanda a abertura e provê o gatilho;
  // sem essas props, mantém o botão-gatilho embutido.
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const setOpen = (v: boolean) => { if (isControlled) onOpenChange?.(v); else setOpenState(v); };
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // US / legado
  const [items, setItems] = useState<Item[]>(() => (protocolo?.itens ?? []).map((i) => ({ ...emptyItem(), ...i })));
  const [general, setGeneral] = useState((protocolo?.observacoes_gerais ?? []).join("\n"));

  // BR rico
  const [intro, setIntro] = useState(protocolo?.intro ?? "");
  const [cuidados, setCuidados] = useState<Cuidado[]>(() => (protocolo?.cuidados ?? []).map((c) => ({ titulo: c.titulo ?? "", texto: c.texto ?? "" })));
  const [formulas, setFormulas] = useState<Formula[]>(() => (protocolo?.formulas ?? []).map((f) => ({
    nome: f.nome ?? "", excipiente: f.excipiente ?? "", posologia: f.posologia ?? "", duracao: f.duracao ?? "",
    composicao: (f.composicao ?? []).map((c) => ({ ativo: c.ativo ?? "", quantidade: c.quantidade ?? "" })),
  })));
  const [proximos, setProximos] = useState(protocolo?.proximos_passos ?? "");

  function updateItem(idx: number, key: keyof Item, val: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }

  function handleSave() {
    setSaved(false);
    setError(null);
    const obs = general.split("\n").map((s) => s.trim()).filter(Boolean);
    let payload: NeuroProtocoloSuplementacao;
    if (country === "BR") {
      payload = {
        itens: [],
        observacoes_gerais: obs,
        intro: intro.trim() || undefined,
        cuidados: cuidados
          .map((c) => ({ titulo: c.titulo.trim(), texto: c.texto.trim() }))
          .filter((c) => c.titulo || c.texto),
        formulas: formulas
          .map((f) => ({
            nome: f.nome.trim(),
            composicao: (f.composicao ?? [])
              .map((c) => ({ ativo: c.ativo.trim(), quantidade: c.quantidade.trim() }))
              .filter((c) => c.ativo),
            excipiente: (f.excipiente ?? "").trim() || undefined,
            posologia: (f.posologia ?? "").trim() || undefined,
            duracao: (f.duracao ?? "").trim() || undefined,
          }))
          .filter((f) => f.nome || f.composicao.length > 0),
        proximos_passos: proximos.trim() || undefined,
      };
    } else {
      payload = {
        itens: items
          .filter((it) => it.nome.trim())
          .map((it) => ({
            nome: it.nome.trim(),
            objetivo: (it.objetivo ?? "").trim(),
            dose_sugerida: (it.dose_sugerida ?? "").trim(),
            forma: (it.forma ?? "").trim() || undefined,
            como_tomar: (it.como_tomar ?? "").trim() || undefined,
            buy_url: (it.buy_url ?? "").trim() || undefined,
            observacao: (it.observacao ?? "").trim(),
          })),
        observacoes_gerais: obs,
      };
    }
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
    if (isControlled) return null; // pai provê o gatilho (barra do retângulo)
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
      <p className="text-xs text-axiel-text-secondary">{country === "US" ? t("hintUs") : t("hintBrRich")}</p>

      {country === "BR" ? (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-axiel-text-secondary">{t("introLabel")}</span>
            <textarea className={IN_CLASS} rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
          </label>

          {/* Cuidados */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{t("cuidadosTitle")}</p>
            {cuidados.map((c, idx) => (
              <div key={idx} className="space-y-2 rounded-lg bg-gray-50 dark:bg-white/[.04] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-axiel-text-secondary">#{idx + 1}</span>
                  <button type="button" onClick={() => setCuidados(cuidados.filter((_, i) => i !== idx))} className="text-axiel-text-secondary hover:text-red-600" aria-label={t("removeCuidado")}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <input className={IN_CLASS} placeholder={t("cuidadoTitulo")} value={c.titulo} onChange={(e) => setCuidados(cuidados.map((x, i) => (i === idx ? { ...x, titulo: e.target.value } : x)))} />
                <textarea className={IN_CLASS} rows={2} placeholder={t("cuidadoTexto")} value={c.texto} onChange={(e) => setCuidados(cuidados.map((x, i) => (i === idx ? { ...x, texto: e.target.value } : x)))} />
              </div>
            ))}
            <button type="button" onClick={() => setCuidados([...cuidados, { titulo: "", texto: "" }])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-black/[.16] dark:border-white/[.16] px-3 py-2 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06]"><Plus className="h-3.5 w-3.5" /> {t("addCuidado")}</button>
          </div>

          {/* Fórmulas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{t("formulasTitle")}</p>
            {formulas.map((f, fi) => (
              <div key={fi} className="space-y-2 rounded-lg bg-gray-50 dark:bg-white/[.04] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-axiel-text-secondary">#{fi + 1}</span>
                  <button type="button" onClick={() => setFormulas(formulas.filter((_, i) => i !== fi))} className="text-axiel-text-secondary hover:text-red-600" aria-label={t("removeFormula")}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <input className={IN_CLASS} placeholder={t("formulaNome")} value={f.nome} onChange={(e) => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, nome: e.target.value } : x)))} />
                {/* Composição */}
                <div className="space-y-1.5 pl-2 border-l-2 border-[#0F6E56]/20">
                  {f.composicao.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input className={IN_CLASS} placeholder={t("fieldAtivo")} value={c.ativo} onChange={(e) => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, composicao: x.composicao.map((y, j) => (j === ci ? { ...y, ativo: e.target.value } : y)) } : x)))} />
                      <input className={`${IN_CLASS} max-w-[160px]`} placeholder={t("fieldQuantidade")} value={c.quantidade} onChange={(e) => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, composicao: x.composicao.map((y, j) => (j === ci ? { ...y, quantidade: e.target.value } : y)) } : x)))} />
                      <button type="button" onClick={() => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, composicao: x.composicao.filter((_, j) => j !== ci) } : x)))} className="text-axiel-text-secondary hover:text-red-600 shrink-0" aria-label={t("removeAtivo")}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, composicao: [...x.composicao, { ativo: "", quantidade: "" }] } : x)))} className="inline-flex items-center gap-1 text-xs font-medium text-[#0F6E56] hover:opacity-80"><Plus className="h-3 w-3" /> {t("addAtivo")}</button>
                </div>
                <input className={IN_CLASS} placeholder={t("fieldExcipiente")} value={f.excipiente ?? ""} onChange={(e) => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, excipiente: e.target.value } : x)))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={IN_CLASS} placeholder={t("fieldPosologia")} value={f.posologia ?? ""} onChange={(e) => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, posologia: e.target.value } : x)))} />
                  <input className={IN_CLASS} placeholder={t("fieldDuracao")} value={f.duracao ?? ""} onChange={(e) => setFormulas(formulas.map((x, i) => (i === fi ? { ...x, duracao: e.target.value } : x)))} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setFormulas([...formulas, emptyFormula()])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-black/[.16] dark:border-white/[.16] px-3 py-2 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06]"><Plus className="h-3.5 w-3.5" /> {t("addFormula")}</button>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-axiel-text-secondary">{t("proximosPassos")}</span>
            <textarea className={IN_CLASS} rows={2} value={proximos} onChange={(e) => setProximos(e.target.value)} />
          </label>
        </>
      ) : (
        <>
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
                <input className={IN_CLASS} placeholder={t("fieldName")} value={item.nome} onChange={(e) => updateItem(idx, "nome", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={IN_CLASS} placeholder={t("fieldForm")} value={item.forma ?? ""} onChange={(e) => updateItem(idx, "forma", e.target.value)} />
                  <input className={IN_CLASS} placeholder={t("fieldDose")} value={item.dose_sugerida ?? ""} onChange={(e) => updateItem(idx, "dose_sugerida", e.target.value)} />
                </div>
                <input className={IN_CLASS} placeholder={t("fieldHow")} value={item.como_tomar ?? ""} onChange={(e) => updateItem(idx, "como_tomar", e.target.value)} />
                <input className={IN_CLASS} placeholder={t("fieldGoal")} value={item.objetivo ?? ""} onChange={(e) => updateItem(idx, "objetivo", e.target.value)} />
                <input className={IN_CLASS} placeholder={t("fieldNote")} value={item.observacao ?? ""} onChange={(e) => updateItem(idx, "observacao", e.target.value)} />
                <div className="space-y-1">
                  <input className={IN_CLASS} placeholder={t("fieldBuyUrl")} value={item.buy_url ?? ""} onChange={(e) => updateItem(idx, "buy_url", e.target.value)} />
                  <p className="text-[11px] text-axiel-text-secondary">{t("buyUrlHint")}</p>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((p) => [...p, emptyItem()])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-black/[.16] dark:border-white/[.16] px-3 py-2 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06]">
            <Plus className="h-3.5 w-3.5" /> {t("addItem")}
          </button>
        </>
      )}

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
