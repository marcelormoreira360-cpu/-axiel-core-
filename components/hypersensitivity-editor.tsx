"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import type { NeuroRelatorioHipersensibilidade } from "@/lib/types";
import { saveHypersensitivityEditsAction } from "@/app/patients/[id]/insights/actions";

const IN_CLASS =
  "w-full text-sm leading-6 text-axiel-text-primary bg-white dark:bg-white/[.03] border border-black/[.12] dark:border-white/[.12] rounded-lg px-3 py-2 outline-none focus:border-[#5B3FA0]/60 transition";

type Row = Record<string, string>;
type Col = { key: string; label: string; rows?: number };

function Field({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-axiel-text-secondary">{label}</span>
      <textarea className={IN_CLASS} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Editor genérico de tabela: uma "linha" por item, um campo por coluna. */
function RowsEditor({ title, cols, rows, setRows, addLabel, removeLabel }: {
  title: string; cols: Col[]; rows: Row[]; setRows: (r: Row[]) => void; addLabel: string; removeLabel: string;
}) {
  const empty = (): Row => Object.fromEntries(cols.map((c) => [c.key, ""]));
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{title}</p>
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={idx} className="space-y-2 rounded-lg bg-gray-50 dark:bg-white/[.04] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-axiel-text-secondary">#{idx + 1}</span>
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="text-axiel-text-secondary hover:text-red-600" aria-label={removeLabel}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {cols.map((c) => (
              <label key={c.key} className="block space-y-1">
                <span className="text-[11px] font-medium text-axiel-text-secondary">{c.label}</span>
                <textarea className={IN_CLASS} rows={c.rows ?? 1} value={row[c.key] ?? ""} onChange={(e) => setRows(rows.map((r, i) => (i === idx ? { ...r, [c.key]: e.target.value } : r)))} />
              </label>
            ))}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows([...rows, empty()])} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-black/[.16] dark:border-white/[.16] px-3 py-2 text-xs font-medium text-axiel-text-secondary transition hover:bg-gray-50 dark:hover:bg-white/[.06]">
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

/**
 * Editor MANUAL do Documento 3 (Hipersensibilidade). Cobre TODO o documento:
 * textos narrativos + as tabelas (padrões, achados, retirada, eixos, fases,
 * implicações) célula a célula. Salva em final_output; o envio é separado.
 */
export function HypersensitivityEditor({
  patientId,
  insightId,
  relatorio,
}: {
  patientId: string;
  insightId: string;
  relatorio: NeuroRelatorioHipersensibilidade | null | undefined;
}) {
  const t = useTranslations("neuroId.documents360.hyperEditor");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Narrativos
  const [intro, setIntro] = useState(relatorio?.introducao ?? "");
  const [important, setImportant] = useState(relatorio?.visao_geral?.importante ?? "");
  const [quadro, setQuadro] = useState(relatorio?.visao_geral?.quadro ?? "");
  const [principais, setPrincipais] = useState(relatorio?.visao_geral?.principais_achados ?? "");
  const [prioridade, setPrioridade] = useState(relatorio?.visao_geral?.prioridade_funcional ?? "");
  const [retiradaMod, setRetiradaMod] = useState(relatorio?.retirada_moderada ?? "");
  const [relacaoSN, setRelacaoSN] = useState(relatorio?.relacao_sistema_nervoso ?? "");
  const [planoAlimentar, setPlanoAlimentar] = useState((relatorio?.plano_alimentar ?? []).join("\n"));
  const [monitoramento, setMonitoramento] = useState((relatorio?.monitoramento ?? []).join("\n"));
  const [implicTexto, setImplicTexto] = useState(relatorio?.implicacoes_suplementacao?.texto ?? "");
  const [resumo, setResumo] = useState(relatorio?.resumo_executivo ?? "");
  const [general, setGeneral] = useState((relatorio?.observacoes_gerais ?? []).join("\n"));

  // Tabelas (cada linha = um objeto)
  const [padroes, setPadroes] = useState<Row[]>(() => (relatorio?.padroes ?? []).map((r) => ({ ...r })));
  const [achados, setAchados] = useState<Row[]>(() => (relatorio?.achados_prioritarios ?? []).map((r) => ({ ...r })));
  const [retiradaAlta, setRetiradaAlta] = useState<Row[]>(() => (relatorio?.retirada_alta ?? []).map((r) => ({ ...r })));
  const [eixos, setEixos] = useState<Row[]>(() => (relatorio?.eixos ?? []).map((r) => ({ ...r })));
  const [fases, setFases] = useState<Row[]>(() => (relatorio?.fases ?? []).map((r) => ({ ...r })));
  const [apoiar, setApoiar] = useState<Row[]>(() => (relatorio?.implicacoes_suplementacao?.apoiar ?? []).map((r) => ({ ...r })));
  const [pontos, setPontos] = useState<Row[]>(() => (relatorio?.implicacoes_suplementacao?.pontos_atencao ?? []).map((r) => ({ ...r })));

  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const cleanRows = <T extends Row>(rows: Row[], keys: (keyof T)[]) =>
    rows
      .map((r) => Object.fromEntries(keys.map((k) => [k, (r[k as string] ?? "").trim()])) as T)
      .filter((r) => keys.some((k) => (r[k] as string).length > 0));

  function handleSave() {
    setSaved(false);
    setError(null);
    const payload: NeuroRelatorioHipersensibilidade = {
      introducao: intro.trim() || undefined,
      visao_geral: {
        importante: important.trim() || undefined,
        quadro: quadro.trim() || undefined,
        principais_achados: principais.trim() || undefined,
        prioridade_funcional: prioridade.trim() || undefined,
      },
      padroes: cleanRows(padroes, ["padrao", "interpretacao"]) as Array<{ padrao: string; interpretacao: string }>,
      achados_prioritarios: cleanRows(achados, ["area", "achados", "prioridade"]) as Array<{ area: string; achados: string; prioridade: string }>,
      retirada_alta: cleanRows(retiradaAlta, ["grupo", "itens"]) as Array<{ grupo: string; itens: string }>,
      retirada_moderada: retiradaMod.trim() || undefined,
      relacao_sistema_nervoso: relacaoSN.trim() || undefined,
      eixos: cleanRows(eixos, ["titulo", "descricao"]) as Array<{ titulo: string; descricao: string }>,
      fases: cleanRows(fases, ["titulo", "descricao"]) as Array<{ titulo: string; descricao: string }>,
      plano_alimentar: lines(planoAlimentar),
      implicacoes_suplementacao: {
        texto: implicTexto.trim() || undefined,
        apoiar: cleanRows(apoiar, ["titulo", "descricao"]) as Array<{ titulo: string; descricao: string }>,
        pontos_atencao: cleanRows(pontos, ["titulo", "descricao"]) as Array<{ titulo: string; descricao: string }>,
      },
      monitoramento: lines(monitoramento),
      resumo_executivo: resumo.trim() || undefined,
      observacoes_gerais: lines(general),
    };
    startTransition(async () => {
      const res = await saveHypersensitivityEditsAction(patientId, insightId, payload);
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
          <p className="inline-flex items-center gap-2 text-xs text-[#5B3FA0]">
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
      <p className="text-xs text-axiel-text-secondary">{t("hint")}</p>

      <Field label={t("intro")} value={intro} onChange={setIntro} rows={2} />
      <Field label={t("important")} value={important} onChange={setImportant} rows={2} />
      <Field label={t("quadro")} value={quadro} onChange={setQuadro} rows={3} />
      <Field label={t("principaisAchados")} value={principais} onChange={setPrincipais} rows={2} />
      <Field label={t("prioridadeFuncional")} value={prioridade} onChange={setPrioridade} rows={2} />

      <RowsEditor title={t("patterns")} cols={[{ key: "padrao", label: t("colPattern") }, { key: "interpretacao", label: t("colInterp"), rows: 2 }]} rows={padroes} setRows={setPadroes} addLabel={t("addRow")} removeLabel={t("removeRow")} />
      <RowsEditor title={t("findings")} cols={[{ key: "area", label: t("colArea") }, { key: "achados", label: t("colFindings"), rows: 3 }, { key: "prioridade", label: t("colPriority"), rows: 2 }]} rows={achados} setRows={setAchados} addLabel={t("addRow")} removeLabel={t("removeRow")} />
      <RowsEditor title={t("removalHighTable")} cols={[{ key: "grupo", label: t("colGroup") }, { key: "itens", label: t("colItems"), rows: 3 }]} rows={retiradaAlta} setRows={setRetiradaAlta} addLabel={t("addRow")} removeLabel={t("removeRow")} />
      <Field label={t("removalModerate")} value={retiradaMod} onChange={setRetiradaMod} rows={2} />

      <Field label={t("nervousRelation")} value={relacaoSN} onChange={setRelacaoSN} rows={3} />
      <RowsEditor title={t("axes")} cols={[{ key: "titulo", label: t("colTitle") }, { key: "descricao", label: t("colDesc"), rows: 2 }]} rows={eixos} setRows={setEixos} addLabel={t("addRow")} removeLabel={t("removeRow")} />

      <RowsEditor title={t("phasesTable")} cols={[{ key: "titulo", label: t("colTitle") }, { key: "descricao", label: t("colDesc"), rows: 3 }]} rows={fases} setRows={setFases} addLabel={t("addRow")} removeLabel={t("removeRow")} />

      <Field label={t("mealPlan")} value={planoAlimentar} onChange={setPlanoAlimentar} rows={4} />

      <Field label={t("supplementImplications")} value={implicTexto} onChange={setImplicTexto} rows={2} />
      <RowsEditor title={t("supportTable")} cols={[{ key: "titulo", label: t("colTitle") }, { key: "descricao", label: t("colDesc"), rows: 2 }]} rows={apoiar} setRows={setApoiar} addLabel={t("addRow")} removeLabel={t("removeRow")} />
      <RowsEditor title={t("attentionTable")} cols={[{ key: "titulo", label: t("colTitle") }, { key: "descricao", label: t("colDesc"), rows: 2 }]} rows={pontos} setRows={setPontos} addLabel={t("addRow")} removeLabel={t("removeRow")} />

      <Field label={t("monitoring")} value={monitoramento} onChange={setMonitoramento} rows={2} />
      <Field label={t("executiveSummary")} value={resumo} onChange={setResumo} rows={3} />
      <Field label={t("generalNotes")} value={general} onChange={setGeneral} rows={2} />

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-[#5B3FA0] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> {pending ? t("saving") : tc("save")}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-xs font-medium text-axiel-text-secondary hover:text-axiel-text-primary disabled:opacity-50">
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}
