"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Check, AlertCircle, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import {
  createAssessmentFieldAction,
  updateAssessmentFieldAction,
  toggleAssessmentFieldActiveAction,
  deleteAssessmentFieldAction,
  moveAssessmentFieldAction,
  type FieldState,
} from "@/app/settings/avaliacao/actions";
import type { ClinicAssessmentField, AssessmentFieldType } from "@/lib/types";
import { ASSESSMENT_GROUP_ORDER, isAssessmentGroup } from "@/lib/assessment-groups";

const TYPES: AssessmentFieldType[] = ["textarea", "text", "number", "select"];

function groupLabelKey(g: string): string {
  return isAssessmentGroup(g) ? g : "mediadores";
}

const inputCls =
  "w-full h-9 px-3 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#A09E98] outline-none focus:border-[#0F6E56] transition";

/** Campos condicionais por tipo (placeholder, help, opções de select / min-max de número). */
function TypeExtras({
  type,
  field,
  t,
}: {
  type: AssessmentFieldType;
  field?: ClinicAssessmentField;
  t: (k: string) => string;
}) {
  return (
    <>
      {type !== "select" && (
        <div className="sm:col-span-2">
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("placeholder")}</label>
          <input type="text" name="placeholder" defaultValue={field?.placeholder ?? ""} className={inputCls} />
        </div>
      )}
      {type === "select" && (
        <div className="sm:col-span-2">
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("choices")}</label>
          <textarea
            name="choices"
            rows={4}
            defaultValue={(field?.options?.choices ?? []).join("\n")}
            placeholder={t("choicesPlaceholder")}
            className={`${inputCls} h-auto py-2 resize-none`}
          />
        </div>
      )}
      {type === "number" && (
        <>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("min")}</label>
            <input type="number" name="min" defaultValue={field?.options?.min ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("max")}</label>
            <input type="number" name="max" defaultValue={field?.options?.max ?? ""} className={inputCls} />
          </div>
        </>
      )}
      <div className="sm:col-span-2">
        <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("helpText")}</label>
        <input type="text" name="help_text" defaultValue={field?.help_text ?? ""} className={inputCls} />
      </div>
    </>
  );
}

/** Select do grupo (seção ATM) onde o campo aparece na ficha. */
function GroupSelect({ field, t }: { field?: ClinicAssessmentField; t: (k: string) => string }) {
  return (
    <div>
      <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("group")}</label>
      <select name="group_key" defaultValue={groupLabelKey(field?.group_key ?? "mediadores")} className={inputCls}>
        {ASSESSMENT_GROUP_ORDER.map((g) => (
          <option key={g} value={g}>{t(`groups.${g}`)}</option>
        ))}
      </select>
    </div>
  );
}

/** Editor inline de um campo existente. */
function FieldEditor({ field, onDone }: { field: ClinicAssessmentField; onDone: () => void }) {
  const t = useTranslations("settings.assessmentFields");
  const [type, setType] = useState<AssessmentFieldType>(field.field_type);
  const [state, formAction, isPending] = useActionState<FieldState, FormData>(
    async (prev, fd) => {
      const r = await updateAssessmentFieldAction(prev, fd);
      if (r?.ok) onDone();
      return r;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-3 bg-[#FAFAF8] border border-black/[.07] rounded-[10px] p-3 mt-2">
      <input type="hidden" name="id" value={field.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("name")} *</label>
          <input type="text" name="label" required defaultValue={field.label} className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("type")}</label>
          <select name="field_type" value={type} onChange={(e) => setType(e.target.value as AssessmentFieldType)} className={inputCls}>
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>{t(`types.${tp}`)}</option>
            ))}
          </select>
        </div>
        <GroupSelect field={field} t={t} />
        <TypeExtras type={type} field={field} t={t} />
        <label className="sm:col-span-2 flex items-center gap-2 text-[12px] text-[#6B6A66] cursor-pointer">
          <input type="checkbox" name="include_in_report" defaultChecked={field.include_in_report} className="accent-[#0F6E56]" />
          {t("includeInReport")}
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] disabled:opacity-50 transition">
          <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onDone} className="text-[12px] text-[#6B6A66] hover:text-[#0F1A2E] transition">
          {t("cancel")}
        </button>
        {state?.error && (
          <span className="inline-flex items-center gap-1 text-[12px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</span>
        )}
      </div>
    </form>
  );
}

export function AssessmentFieldsForm({ initial }: { initial: ClinicAssessmentField[] }) {
  const t = useTranslations("settings.assessmentFields");
  const [editing, setEditing] = useState<string | null>(null);
  const [addType, setAddType] = useState<AssessmentFieldType>("textarea");
  const [state, formAction, isPending] = useActionState<FieldState, FormData>(
    async (prev, fd) => createAssessmentFieldAction(prev, fd),
    null,
  );

  return (
    <div className="space-y-6">
      {/* Lista atual */}
      <div>
        <p className="text-[12px] font-medium text-[#6B6A66] mb-2">{t("listLabel")}</p>
        {initial.length === 0 ? (
          <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            {initial.map((f, i) => (
              <div key={f.id} className="border border-black/[.07] rounded-[10px] px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                    <button type="button" disabled={i === 0} onClick={() => moveAssessmentFieldAction(f.id, "up")}
                      className="text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30 transition" title={t("moveUp")}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={i === initial.length - 1} onClick={() => moveAssessmentFieldAction(f.id, "down")}
                      className="text-[#A09E98] hover:text-[#0F1A2E] disabled:opacity-30 transition" title={t("moveDown")}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-[#0F1A2E]">{f.label}</span>
                      <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#EEF3F1] text-[#0F6E56]">{t(`groups.${groupLabelKey(f.group_key)}`)}</span>
                      <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">{t(`types.${f.field_type}`)}</span>
                      {f.include_in_report && (
                        <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#E1F5EE] text-[#085041]">{t("inReportBadge")}</span>
                      )}
                      {!f.is_active && (
                        <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#FEE2E2] text-[#991B1B]">{t("inactive")}</span>
                      )}
                    </div>
                    {f.help_text && <p className="text-[11px] text-[#A09E98] mt-[2px]">{f.help_text}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setEditing(editing === f.id ? null : f.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#6B6A66] hover:text-[#0F6E56] border border-black/[.08] transition" title={t("edit")}>
                      {editing === f.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => toggleAssessmentFieldActiveAction(f.id, !f.is_active)}
                      className="text-[11px] text-[#6B6A66] hover:text-[#0F1A2E] transition">
                      {f.is_active ? t("deactivate") : t("activate")}
                    </button>
                    <button type="button" onClick={() => deleteAssessmentFieldAction(f.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#A09E98] hover:text-red-500 border border-black/[.08] transition" title={t("delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {editing === f.id && <FieldEditor field={f} onDone={() => setEditing(null)} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar campo */}
      <form action={formAction} className="space-y-3 border-t border-black/[.07] pt-5">
        <p className="text-[12px] font-medium text-[#6B6A66]">{t("addLabel")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("name")} *</label>
            <input type="text" name="label" required placeholder={t("namePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("type")}</label>
            <select name="field_type" value={addType} onChange={(e) => setAddType(e.target.value as AssessmentFieldType)} className={inputCls}>
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>{t(`types.${tp}`)}</option>
              ))}
            </select>
          </div>
          <GroupSelect t={t} />
          <TypeExtras type={addType} t={t} />
          <label className="sm:col-span-2 flex items-center gap-2 text-[12px] text-[#6B6A66] cursor-pointer">
            <input type="checkbox" name="include_in_report" defaultChecked className="accent-[#0F6E56]" />
            {t("includeInReport")}
          </label>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={isPending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] disabled:opacity-50 transition">
            <Plus className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("add")}
          </button>
          {state?.ok && (
            <span className="inline-flex items-center gap-1 text-[12px] text-[#0F6E56]"><Check className="h-3 w-3" /> {t("saved")}</span>
          )}
          {state?.error && (
            <span className="inline-flex items-center gap-1 text-[12px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</span>
          )}
        </div>
      </form>
    </div>
  );
}
