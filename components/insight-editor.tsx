"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, X, Check, AlertTriangle } from "lucide-react";
import type { AiInsightOutput, NeuroMapaIntegrativo, NeuroPlanoRegulacao, NeuroSecaoItem } from "@/lib/types";
import { saveAiInsightEditsAction } from "@/app/patients/[id]/insights/actions";

const TA_CLASS =
  "w-full text-sm leading-6 text-axiel-text-primary bg-white dark:bg-white/[.03] border border-black/[.12] dark:border-white/[.12] rounded-lg px-3 py-2 outline-none focus:border-[#0F6E56]/60 transition";

function Field({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-axiel-text-secondary">{label}</span>
      <textarea className={TA_CLASS} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * Editor MANUAL do Doc 1 / Doc 2 na mesa de revisão. O revisor ajusta o texto à
 * mão antes de aprovar/enviar; salva em final_output (sem aprovar). Só aparece
 * enquanto o insight NÃO está finalizado.
 */
export function InsightEditor({ patientId, insightId, output }: { patientId: string; insightId: string; output: AiInsightOutput }) {
  const t = useTranslations("neuroId.documents360");
  const tc = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const m = output.mapa_integrativo ?? {};
  const p = output.plano_regulacao ?? {};

  // Estado editável (inicializado a partir do output atual).
  const [aberturaCalorosa, setAbertura] = useState(m.abertura_calorosa ?? "");
  const [bio3Titulo, setBio3Titulo] = useState(m.leitura_bio3?.titulo ?? "");
  const [bio3Desc, setBio3Desc] = useState(m.leitura_bio3?.descricao ?? "");
  const [neuro, setNeuro] = useState<NeuroSecaoItem[]>(() => (m.leitura_neurometrica ?? []).map((i) => ({ ...i })));
  const [temas, setTemas] = useState((m.leitura_bioemocional?.temas ?? []).join("\n"));
  const [sintese, setSintese] = useState(m.leitura_bioemocional?.sintese ?? "");
  const [ancora, setAncora] = useState(m.ancora_positiva ?? "");
  const [aha, setAha] = useState(m.conexao_aha ?? "");
  const [porqueAgir, setPorqueAgir] = useState(m.porque_agir_agora ?? "");
  const [proximoPasso1, setProximoPasso1] = useState(m.proximo_passo ?? "");

  const [ondeChegar, setOndeChegar] = useState(p.onde_queremos_chegar ?? "");
  const [pilarNervoso, setPilarNervoso] = useState(p.tres_pilares?.nervoso ?? "");
  const [pilarEmocional, setPilarEmocional] = useState(p.tres_pilares?.emocional ?? "");
  const [pilarEstilo, setPilarEstilo] = useState(p.tres_pilares?.estilo_de_vida ?? "");
  const [comoCaminhar, setComoCaminhar] = useState(p.como_caminhar_juntos ?? "");
  const [proximoPasso2, setProximoPasso2] = useState(p.proximo_passo ?? "");

  function updateNeuro(idx: number, key: keyof NeuroSecaoItem, val: string) {
    setNeuro((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }

  function handleSave() {
    setSaved(false);
    setWarn(null);
    setError(null);
    const mapa_integrativo: Partial<NeuroMapaIntegrativo> = {
      abertura_calorosa: aberturaCalorosa,
      leitura_bio3: { titulo: bio3Titulo, descricao: bio3Desc },
      leitura_neurometrica: neuro,
      leitura_bioemocional: { temas: temas.split("\n").map((s) => s.trim()).filter(Boolean), sintese },
      ancora_positiva: ancora,
      conexao_aha: aha,
      porque_agir_agora: porqueAgir,
      proximo_passo: proximoPasso1,
    };
    const plano_regulacao: Partial<NeuroPlanoRegulacao> = {
      onde_queremos_chegar: ondeChegar,
      tres_pilares: { nervoso: pilarNervoso, emocional: pilarEmocional, estilo_de_vida: pilarEstilo },
      como_caminhar_juntos: comoCaminhar,
      proximo_passo: proximoPasso2,
    };
    startTransition(async () => {
      const res = await saveAiInsightEditsAction(patientId, insightId, { mapa_integrativo, plano_regulacao });
      if (!res.ok) {
        setError(res.error ?? tc("save"));
        return;
      }
      setSaved(true);
      setWarn(res.guardrailNote ?? null);
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
          <Pencil className="h-3.5 w-3.5" /> {t("editor.editButton")}
        </button>
        {saved ? (
          <p className="inline-flex items-center gap-2 text-xs text-[#0F6E56]">
            <Check className="h-3.5 w-3.5" /> {t("editor.saved")}
          </p>
        ) : null}
        {warn ? (
          <p className="flex items-start gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" /> {t("editor.guardrailWarn", { note: warn })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/[.10] dark:border-white/[.12] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-axiel-text-primary">{t("editor.title")}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-axiel-text-secondary hover:text-axiel-text-primary" aria-label={tc("cancel")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-axiel-text-secondary">{t("editor.hint")}</p>

      {/* Documento 1 */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{t("doc1Title")}</p>
        <Field label={t("editor.opening")} value={aberturaCalorosa} onChange={setAbertura} rows={3} />
        <Field label={`${t("editor.bio3")} — ${tc("edit")}`} value={bio3Titulo} onChange={setBio3Titulo} rows={1} />
        <Field label={t("editor.bio3")} value={bio3Desc} onChange={setBio3Desc} rows={3} />
        {neuro.map((item, idx) => (
          <div key={idx} className="space-y-2 rounded-lg bg-gray-50 dark:bg-white/[.04] p-2">
            <Field label={`${t("neurometricReading")} ${idx + 1}`} value={item.titulo} onChange={(v) => updateNeuro(idx, "titulo", v)} rows={1} />
            <Field label={t("editor.detail")} value={item.descricao} onChange={(v) => updateNeuro(idx, "descricao", v)} rows={3} />
          </div>
        ))}
        <Field label={t("editor.themes")} value={temas} onChange={setTemas} rows={3} />
        <Field label={`${t("emotionalReading")} — ${t("editor.synthesis")}`} value={sintese} onChange={setSintese} rows={2} />
        <Field label={t("positiveAnchor")} value={ancora} onChange={setAncora} rows={2} />
        <Field label={t("ahaConnection")} value={aha} onChange={setAha} rows={3} />
        <Field label={t("whyActNow")} value={porqueAgir} onChange={setPorqueAgir} rows={3} />
        <Field label={t("nextStep")} value={proximoPasso1} onChange={setProximoPasso1} rows={2} />
      </div>

      {/* Documento 2 */}
      <div className="space-y-3 border-t border-black/[.08] dark:border-white/[.08] pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-axiel-text-secondary">{t("doc2Title")}</p>
        <Field label={t("goalTitle")} value={ondeChegar} onChange={setOndeChegar} rows={3} />
        <Field label={t("pillarNervous")} value={pilarNervoso} onChange={setPilarNervoso} rows={2} />
        <Field label={t("pillarEmotional")} value={pilarEmocional} onChange={setPilarEmocional} rows={2} />
        <Field label={t("pillarLifestyle")} value={pilarEstilo} onChange={setPilarEstilo} rows={2} />
        <Field label={t("howWeWalk")} value={comoCaminhar} onChange={setComoCaminhar} rows={3} />
        <Field label={t("nextStep")} value={proximoPasso2} onChange={setProximoPasso2} rows={2} />
      </div>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0F6E56] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> {pending ? t("editor.saving") : tc("save")}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-xs font-medium text-axiel-text-secondary hover:text-axiel-text-primary disabled:opacity-50">
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}
