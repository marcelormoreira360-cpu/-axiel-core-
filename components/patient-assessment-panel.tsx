"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, AlertCircle, ClipboardList, Settings2, Download } from "lucide-react";
import { saveAssessmentAction, importQuestionnaireFindingsAction, type AssessmentState } from "@/app/patients/[id]/assessment/actions";
import type { ClinicAssessmentField } from "@/lib/types";

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

export function PatientAssessmentPanel({ patientId, fields, values, canConfigure }: Props) {
  const t = useTranslations("patientAssessment");
  const [state, formAction, isPending] = useActionState<AssessmentState, FormData>(
    async (prev, fd) => saveAssessmentAction(patientId, prev, fd),
    null,
  );

  // Campo-alvo dos achados dos questionários: "anamnese" (padrão) ou a 1ª textarea.
  const anamneseKey =
    fields.find((f) => f.field_key === "anamnese")?.field_key ??
    fields.find((f) => f.field_type === "textarea")?.field_key ??
    null;
  const [anamneseText, setAnamneseText] = useState<string>(
    anamneseKey ? fieldDefault(values?.[anamneseKey]) : "",
  );
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function handleImportFindings() {
    setImporting(true);
    setImportMsg(null);
    const res = await importQuestionnaireFindingsAction(patientId);
    setImporting(false);
    if (res.error) { setImportMsg(res.error); return; }
    if (!res.hasData) { setImportMsg(t("findingsNone")); return; }
    setAnamneseText((prev) => (prev.trim() ? `${prev.trim()}\n\n${res.text}` : res.text));
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
        <form action={formAction} className="space-y-[10px]">
          {anamneseKey && (
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
          )}
          {fields.map((f) => {
            const dv = fieldDefault(values?.[f.field_key]);
            const isAnamnese = f.field_key === anamneseKey;
            return (
              <div key={f.id}>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{f.label}</label>
                {f.field_type === "textarea" && (
                  <textarea
                    name={f.field_key}
                    {...(isAnamnese
                      ? { value: anamneseText, onChange: (e) => setAnamneseText(e.target.value) }
                      : { defaultValue: dv })}
                    rows={isAnamnese ? 6 : 4}
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
                    {/* Preserva valor já salvo que não está mais na lista (não apaga ao salvar). */}
                    {dv && !(f.options?.choices ?? []).includes(dv) && (
                      <option value={dv}>{dv}</option>
                    )}
                    {(f.options?.choices ?? []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
                {f.help_text && <p className="text-[10px] text-[#A09E98] mt-[3px]">{f.help_text}</p>}
              </div>
            );
          })}

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
