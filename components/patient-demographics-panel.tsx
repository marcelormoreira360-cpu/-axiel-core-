"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, X, AlertCircle, IdCard } from "lucide-react";
import { saveDemographicsAction, type DemographicsState } from "@/app/patients/[id]/demographics/actions";
import { ageFromDob } from "@/lib/patient-demographics";

type Props = {
  patientId: string;
  fullName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  weightKg: number | null;
  heightCm: number | null;
  city: string | null;
};

const inputCls =
  "w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition";

export function PatientDemographicsPanel({
  patientId, fullName, dateOfBirth, sex, weightKg, heightCm, city,
}: Props) {
  const t = useTranslations("patientProfile.demographics");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState<DemographicsState, FormData>(
    async (prev, fd) => {
      const res = await saveDemographicsAction(patientId, prev, fd);
      if (res?.ok) setEditing(false);
      return res;
    },
    null,
  );

  const age = ageFromDob(dateOfBirth);
  const dash = t("notInformed");
  const sexLabelMap: Record<string, string> = {
    male: t("sexMale"), female: t("sexFemale"), other: t("sexOther"),
  };
  const fmtSex = (s: string | null) => (s ? (sexLabelMap[s] ?? s) : dash);

  const rows: { label: string; value: string }[] = [
    { label: t("dobLabel"), value: dateOfBirth ? `${dateOfBirth}${age !== null ? ` · ${age} ${t("ageSuffix")}` : ""}` : dash },
    { label: t("sexLabel"), value: fmtSex(sex) },
    { label: t("weightLabel"), value: weightKg !== null ? `${weightKg} kg` : dash },
    { label: t("heightLabel"), value: heightCm !== null ? `${heightCm} cm` : dash },
    { label: t("cityLabel"), value: city || dash },
  ];

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px] mb-5">
      <div className="flex items-center justify-between gap-2 mb-[10px]">
        <div className="flex items-center gap-[7px]">
          <IdCard className="h-3.5 w-3.5 text-[#0F6E56]" />
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
            <p className="text-[10px] text-[#A09E98] leading-tight">{t("subtitle")}</p>
          </div>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition">
            <Pencil className="h-3 w-3" /> {t("edit")}
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className="space-y-[10px]">
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("nameLabel")}</label>
            <input name="full_name" defaultValue={fullName ?? ""} className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("dobLabel")}</label>
              <input type="date" name="date_of_birth" defaultValue={dateOfBirth ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("sexLabel")}</label>
              <select name="sex" defaultValue={sex ?? ""} className={inputCls}>
                <option value="">{t("sexUnset")}</option>
                <option value="male">{t("sexMale")}</option>
                <option value="female">{t("sexFemale")}</option>
                <option value="other">{t("sexOther")}</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("weightLabel")}</label>
              <input type="number" min={0} step="0.1" inputMode="decimal" name="weight_kg" defaultValue={weightKg ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("heightLabel")}</label>
              <input type="number" min={0} step="0.1" inputMode="decimal" name="height_cm" defaultValue={heightCm ?? ""} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("cityLabel")}</label>
            <input name="city" defaultValue={city ?? ""} className={inputCls} />
          </div>
          {state?.error && (
            <p className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</p>
          )}
          <div className="flex items-center gap-[8px]">
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[14px] py-[7px] transition">
              <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] rounded-[8px] px-[12px] py-[7px] transition">
              <X className="h-3.5 w-3.5" /> {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-[16px] gap-y-[8px]">
          {rows.map((r) => (
            <div key={r.label}>
              <p className="text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[1px]">{r.label}</p>
              <p className="text-[12px] text-[#0F1A2E]">{r.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
