"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, AlertCircle, ClipboardList, Settings2, Download, Sparkles } from "lucide-react";
import { saveAssessmentAction, importQuestionnaireFindingsAction, suggestAtmIntegrationAction, type AssessmentState } from "@/app/patients/[id]/assessment/actions";
import { FINDINGS_MARKER } from "@/modules/neuro-id/findings";
import { groupForField, type AssessmentGroup } from "@/lib/assessment-groups";
import type { ClinicAssessmentField } from "@/lib/types";

// Marca o bloco de rascunho da IA no campo ATM, para deduplicar ao re-sugerir.
const ATM_AI_MARKER = "[Sugestão IA (revise)]";

type Props = {
  patientId: string;
  /** Campos configurados da clínica (ativos, na ordem). */
  fields: ClinicAssessmentField[];
  /** Respostas atuais do paciente por field_key. */
  values: Record<string, string | number | null> | null;
  /** Gestor pode editar a estrutura dos campos. */
  canConfigure?: boolean;
};

const inputCls =
  "w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition";

function fieldDefault(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Agrupa os campos (já na ordem global da config) em blocos CONTÍGUOS por grupo.
 * Campos do mesmo grupo que estejam juntos viram um bloco com um cabeçalho; se o
 * terapeuta intercalar grupos, o cabeçalho reaparece (comportamento esperado).
 */
function groupRuns(fields: ClinicAssessmentField[]): { group: AssessmentGroup; fields: ClinicAssessmentField[] }[] {
  const runs: { group: AssessmentGroup; fields: ClinicAssessmentField[] }[] = [];
  for (const f of fields) {
    const g = groupForField(f);
    const last = runs[runs.length - 1];
    if (last && last.group === g) last.fields.push(f);
    else runs.push({ group: g, fields: [f] });
  }
  return runs;
}

export function PatientAssessmentPanel({ patientId, fields, values, canConfigure }: Props) {
  const t = useTranslations("patientAssessment");
  const [state, formAction, isPending] = useActionState<AssessmentState, FormData>(
    async (prev, fd) => saveAssessmentAction(patientId, prev, fd),
    null,
  );

  // Campos-alvo dos achados: Anamnese (Mediadores) e Antecedentes recebem o texto
  // importado dos questionários; ficam controlados (semeados do que já foi salvo).
  const anamneseKey =
    fields.find((f) => f.field_key === "anamnese")?.field_key ??
    fields.find((f) => f.field_type === "textarea")?.field_key ??
    null;
  const antecedentsKey = fields.find((f) => f.field_key === "antecedents" && f.field_type === "textarea")?.field_key ?? null;
  // Campo da Integração (ATM): recebe o rascunho sugerido pela IA; controlado para a
  // sugestão entrar no textarea (terapeuta revisa e edita antes de salvar).
  const atmKey = fields.find((f) => f.field_key === "integracao_atm" && f.field_type === "textarea")?.field_key ?? null;
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    if (anamneseKey) o[anamneseKey] = fieldDefault(values?.[anamneseKey]);
    if (antecedentsKey) o[antecedentsKey] = fieldDefault(values?.[antecedentsKey]);
    if (atmKey) o[atmKey] = fieldDefault(values?.[atmKey]);
    return o;
  });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [suggestingAtm, setSuggestingAtm] = useState(false);
  const [atmMsg, setAtmMsg] = useState<string | null>(null);

  // Anexa um bloco de achados deduplicando (remove um bloco anterior pelo marcador).
  function mergeFindings(prev: string, block: string): string {
    const idx = prev.indexOf(FINDINGS_MARKER);
    const base = (idx >= 0 ? prev.slice(0, idx) : prev).trim();
    return base ? `${base}\n\n${block}` : block;
  }

  // Anexa o rascunho da IA preservando o que o terapeuta já escreveu; re-sugerir
  // substitui o bloco anterior (deduplica pelo marcador), nunca apaga o texto humano.
  function mergeAtmSuggestion(prev: string, suggestion: string): string {
    const idx = prev.indexOf(ATM_AI_MARKER);
    const base = (idx >= 0 ? prev.slice(0, idx) : prev).trim();
    const block = `${ATM_AI_MARKER}\n${suggestion.trim()}`;
    return base ? `${base}\n\n${block}` : block;
  }

  async function handleSuggestAtm() {
    if (!atmKey) return;
    setSuggestingAtm(true);
    setAtmMsg(null);
    const res = await suggestAtmIntegrationAction(patientId);
    setSuggestingAtm(false);
    if (res.error || !res.suggestion) {
      setAtmMsg(res.error ?? t("atmError"));
      return;
    }
    setOverrides((o) => ({ ...o, [atmKey]: mergeAtmSuggestion(o[atmKey] ?? "", res.suggestion!) }));
    setAtmMsg(t("atmSuggested"));
  }

  function renderField(f: ClinicAssessmentField) {
    const dv = fieldDefault(values?.[f.field_key]);
    const controlled = f.field_key in overrides; // Anamnese e Antecedentes
    return (
      <div key={f.id}>
        <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{f.label}</label>
        {f.field_type === "textarea" && (
          <textarea
            name={f.field_key}
            {...(controlled
              ? { value: overrides[f.field_key], onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setOverrides((o) => ({ ...o, [f.field_key]: e.target.value })) }
              : { defaultValue: dv })}
            rows={f.field_key === anamneseKey ? 6 : 4}
            placeholder={f.placeholder ?? ""}
            className={`${inputCls} resize-none`}
          />
        )}
        {f.field_type === "text" && (
          <input name={f.field_key} defaultValue={dv} placeholder={f.placeholder ?? ""} className={inputCls} />
        )}
        {f.field_type === "number" && (
          <input
            type="number"
            inputMode="numeric"
            name={f.field_key}
            defaultValue={dv}
            min={f.options?.min}
            max={f.options?.max}
            placeholder={f.placeholder ?? ""}
            className={inputCls}
          />
        )}
        {f.field_type === "select" && (
          <select name={f.field_key} defaultValue={dv} className={inputCls}>
            <option value="">{t("selectPlaceholder")}</option>
            {dv && !(f.options?.choices ?? []).includes(dv) && <option value={dv}>{dv}</option>}
            {(f.options?.choices ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {f.help_text && <p className="text-[10px] text-[#A09E98] mt-[3px]">{f.help_text}</p>}
      </div>
    );
  }

  function importBlock() {
    return (
      <div className="rounded-[8px] border border-[#0F6E56]/20 bg-[#F6FBF9] p-[10px] space-y-[6px]">
        <p className="text-[10px] text-[#6B6A66] leading-snug">{t("findingsHint")}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" disabled={importing} onClick={handleImportFindings}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[12px] py-[6px] transition">
            <Download className="h-3 w-3" /> {importing ? t("importingFindings") : t("importFindings")}
          </button>
          {importMsg && <span className="text-[10px] text-[#0F6E56]">{importMsg}</span>}
        </div>
      </div>
    );
  }

  function atmBlock() {
    return (
      <div className="rounded-[8px] border border-[#0F6E56]/20 bg-[#F6FBF9] p-[10px] space-y-[6px]">
        <p className="text-[10px] text-[#6B6A66] leading-snug">{t("atmHint")}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" disabled={suggestingAtm} onClick={handleSuggestAtm}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[12px] py-[6px] transition">
            <Sparkles className="h-3 w-3" /> {suggestingAtm ? t("atmSuggesting") : t("atmSuggest")}
          </button>
          {atmMsg && <span className="text-[10px] text-[#0F6E56]">{atmMsg}</span>}
        </div>
      </div>
    );
  }

  async function handleImportFindings() {
    setImporting(true);
    setImportMsg(null);
    const res = await importQuestionnaireFindingsAction(patientId);
    setImporting(false);
    if (res.error) { setImportMsg(res.error); return; }
    if (!res.hasData) { setImportMsg(t("findingsNone")); return; }
    // Roteia: Anamnese (QRM/Q-SNA/estilo/ambiente) e Antecedentes (história familiar).
    // Reimportar deduplica (substitui o bloco anterior por campo).
    setOverrides((o) => {
      const next = { ...o };
      if (anamneseKey && res.anamnese) next[anamneseKey] = mergeFindings(o[anamneseKey] ?? "", res.anamnese);
      if (res.antecedents) {
        if (antecedentsKey) next[antecedentsKey] = mergeFindings(o[antecedentsKey] ?? "", res.antecedents);
        else if (anamneseKey) next[anamneseKey] = mergeFindings(next[anamneseKey] ?? "", res.antecedents); // fallback
      }
      return next;
    });
    setImportMsg(t("findingsImported"));
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px] mb-5">
      <div className="flex items-center justify-between gap-2 mb-[10px]">
        <div className="flex items-center gap-[7px]">
          <ClipboardList className="h-3.5 w-3.5 text-[#0F6E56]" />
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
            <p className="text-[10px] text-[#A09E98] leading-tight">{t("subtitle")}</p>
          </div>
        </div>
        {canConfigure && (
          <Link
            href="/settings/avaliacao"
            className="inline-flex items-center gap-1 text-[11px] text-[#6B6A66] hover:text-[#0F6E56] transition shrink-0"
            title={t("configure")}
          >
            <Settings2 className="h-3.5 w-3.5" /> {t("configure")}
          </Link>
        )}
      </div>

      {fields.length === 0 ? (
        <p className="text-[12px] text-[#A09E98]">{t("noFields")}</p>
      ) : (
        // Sempre editável: formulário pré-preenchido com o que já foi salvo.
        <form action={formAction} className="space-y-[14px]">
          <p className="text-[10px] text-[#A09E98] leading-snug">{t("atmIntro")}</p>
          {/* Renderiza na ORDEM GLOBAL (order_index, definida na config), agrupando em
              blocos contíguos por group_key. A config manda 100% na ficha. */}
          {groupRuns(fields).map((run, ri) => (
            <div key={`${run.group}-${ri}`} className="space-y-[8px]">
              <div className="border-l-2 border-[#0F6E56]/30 pl-[8px]">
                <p className="text-[11px] font-semibold text-[#0F1A2E]">{t(`group.${run.group}`)}</p>
                <p className="text-[10px] text-[#A09E98] leading-snug">{t(`groupHint.${run.group}`)}</p>
              </div>
              {run.fields.map((f) => (
                <div key={f.id} className="space-y-[8px]">
                  {anamneseKey && f.field_key === anamneseKey && importBlock()}
                  {atmKey && f.field_key === atmKey && atmBlock()}
                  {renderField(f)}
                </div>
              ))}
            </div>
          ))}

          {state?.error && (
            <p className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</p>
          )}
          <div className="flex items-center gap-[10px]">
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[14px] py-[7px] transition">
              <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
            </button>
            {state?.ok && !isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56]">
                <Check className="h-3 w-3" /> {t("saved")}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
