"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Plus, X, FileText, AlertCircle } from "lucide-react";
import { DEFAULT_CATALOG, PILLAR_LABELS, type NeuroPillar } from "@/modules/neuro-id/catalog";
import { createNeuroIdAssessmentAction } from "@/app/patients/[id]/neuro-id/actions";

export type NeuroIdMapView = {
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
  indice_geral: number | null;
  priority_pillar: NeuroPillar | null;
  is_partial: boolean;
} | null;

const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];

// disfunção → equilíbrio (100 − d) para exibição ao paciente
const eq = (d: number | null) => (d === null ? null : Math.round(100 - d));

function balanceColor(equilibrium: number | null): string {
  if (equilibrium === null) return "#D3D1C7";
  if (equilibrium >= 70) return "#0F6E56";
  if (equilibrium >= 45) return "#C77D17";
  return "#C0392B";
}

const inputCls =
  "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56]/50 transition";

function PillarBar({ pillar, dysfunction, label, hint, isPriority }: {
  pillar: NeuroPillar; dysfunction: number | null; label: string; hint: string; isPriority: boolean;
}) {
  const balance = eq(dysfunction);
  const color = balanceColor(balance);
  return (
    <div>
      <div className="flex items-center justify-between mb-[3px]">
        <span className="text-[12px] font-medium text-[#0F1A2E]">
          {label} <span className="text-[#A09E98] font-normal">· {hint}</span>
          {isPriority && <span className="ml-[6px] text-[10px] px-[6px] py-[1px] rounded-full bg-[#FEE2E2] text-[#991B1B]">★</span>}
        </span>
        <span className="text-[12px] font-semibold" style={{ color }}>
          {balance === null ? "—" : `${balance}%`}
        </span>
      </div>
      <div className="h-[7px] bg-[#F4F3EF] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${balance ?? 0}%`, background: color }} />
      </div>
    </div>
  );
}

export function PatientNeuroIdPanel({
  map,
  patientId,
  hasReport,
}: {
  map: NeuroIdMapView;
  patientId: string;
  hasReport: boolean;
}) {
  const t = useTranslations("neuroId");
  const [assessing, setAssessing] = useState(false);

  const pillarDys: Record<NeuroPillar, number | null> = {
    fisico: map?.fisico_pct ?? null,
    bioquimico: map?.bioquimico_pct ?? null,
    emocional: map?.emocional_pct ?? null,
  };
  const generalBalance = eq(map?.indice_geral ?? null);

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-[6px]">
          <Activity className="h-4 w-4 text-[#A09E98]" />
          <p className="text-[13px] font-medium text-[#0F1A2E]">{t("title")}</p>
        </div>
        <div className="flex items-center gap-[10px]">
          {map && hasReport && (
            <a
              href={`/api/patients/${patientId}/neuro-id/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] transition"
            >
              <FileText className="h-3 w-3" /> {t("viewPdf")}
            </a>
          )}
          {!assessing && (
            <button
              type="button"
              onClick={() => setAssessing(true)}
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
            >
              <Plus className="h-3 w-3" /> {t("newAssessment")}
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[#A09E98] leading-snug mb-[12px] border-l-2 border-[#D9A441]/40 pl-2">{t("disclaimer")}</p>

      {/* Mapa (equilíbrio) */}
      {map ? (
        <div className="space-y-[12px]">
          <div className="flex items-center gap-[14px] rounded-[10px] bg-[#FAFAF8] px-[14px] py-[12px]">
            <div className="text-center shrink-0">
              <p className="text-[10px] text-[#A09E98] uppercase tracking-[.05em]">{t("indexLabel")}</p>
              <p className="text-[26px] font-semibold leading-none mt-[2px]" style={{ color: balanceColor(generalBalance) }}>
                {generalBalance === null ? "—" : `${generalBalance}%`}
              </p>
              <p className="text-[10px] text-[#A09E98] mt-[2px]">{t("equilibrium")}</p>
            </div>
            <div className="flex-1 min-w-0">
              {map.priority_pillar && (
                <p className="text-[12px] text-[#0F1A2E]">
                  <span className="font-medium">{t("priorityLabel")}:</span> {PILLAR_LABELS[map.priority_pillar]}
                </p>
              )}
              {map.is_partial && (
                <p className="text-[11px] text-[#C77D17] flex items-center gap-1 mt-[3px]">
                  <AlertCircle className="h-3 w-3" /> {t("partialHint")}
                </p>
              )}
            </div>
          </div>

          {PILLARS.map((p) => (
            <PillarBar
              key={p}
              pillar={p}
              dysfunction={pillarDys[p]}
              label={t(`pillar.${p}`)}
              hint={t(`pillarHint.${p}`)}
              isPriority={map.priority_pillar === p}
            />
          ))}
        </div>
      ) : (
        !assessing && <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      )}

      {/* Formulário de avaliação */}
      {assessing && (
        <form
          action={async (fd) => {
            await createNeuroIdAssessmentAction(fd);
            setAssessing(false);
          }}
          className="mt-[12px] space-y-[14px] bg-[#FAFAF8] rounded-[10px] p-[12px]"
        >
          <input type="hidden" name="patient_id" value={patientId} />
          <p className="text-[11px] text-[#A09E98]">{t("formHint")}</p>

          {PILLARS.map((pillar) => (
            <div key={pillar}>
              <p className="text-[11px] font-semibold text-[#0F1A2E] mb-[6px]">{t(`pillar.${pillar}`)}</p>
              <div className="grid gap-[8px] sm:grid-cols-2">
                {DEFAULT_CATALOG.filter((it) => it.pillar === pillar).map((it) => (
                  <label key={it.code} className="block">
                    <span className="text-[11px] text-[#6B6A66] mb-[2px] block">
                      {it.label}
                      {it.input_type === "scale_0_10" && (
                        <span className="text-[#C4C2BA]"> (0–10{it.direction === "higher_better" ? ", ↑ melhor" : ", ↑ pior"})</span>
                      )}
                      {it.partial && <span className="text-[#C77D17]"> · {t("optional")}</span>}
                    </span>
                    {it.input_type === "lab" ? (
                      <select name={`item__${it.code}`} className={inputCls} defaultValue="">
                        <option value="">{t("lab.unknown")}</option>
                        <option value="normal">{t("lab.normal")}</option>
                        <option value="leve">{t("lab.leve")}</option>
                        <option value="moderado">{t("lab.moderado")}</option>
                        <option value="alto">{t("lab.alto")}</option>
                      </select>
                    ) : it.input_type === "med" ? (
                      <input type="number" min={0} max={10} name={`item__${it.code}`} placeholder={t("medPlaceholder")} className={inputCls} />
                    ) : it.input_type === "boolean" ? (
                      <select name={`item__${it.code}`} className={inputCls} defaultValue="">
                        <option value="">—</option>
                        <option value="true">{t("yes")}</option>
                        <option value="false">{t("no")}</option>
                      </select>
                    ) : (
                      <input type="number" min={0} max={10} step={1} name={`item__${it.code}`} className={inputCls} />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-[8px]">
            <button type="submit" className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[8px] transition">
              {t("compute")}
            </button>
            <button type="button" onClick={() => setAssessing(false)} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
