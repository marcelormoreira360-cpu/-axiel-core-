"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Plus, X, FileText, AlertCircle, CheckCircle2, AlertTriangle, Ban, Sparkles } from "lucide-react";
import { DEFAULT_CATALOG, type NeuroPillar } from "@/modules/neuro-id/catalog";
import {
  bandForDysfunction, bandForItem, type Band, type BandIcon as BandIconKey, type BandItemType,
} from "@/modules/neuro-id/bands";
import { createNeuroIdAssessmentAction, segmentInstrumentsAction } from "@/app/patients/[id]/neuro-id/actions";

export type NeuroIdMapView = {
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
  indice_geral: number | null;
  priority_pillar: NeuroPillar | null;
  is_partial: boolean;
} | null;

const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];
const eq = (d: number | null) => (d === null ? null : Math.round(100 - d));

const BAND_ICON: Record<BandIconKey, typeof CheckCircle2> = {
  check: CheckCircle2, alert: AlertTriangle, ban: Ban,
};

const LAB_DYS: Record<string, number> = { normal: 0, leve: 25, moderado: 50, alto: 85 };

const inputCls =
  "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56]/50 transition";

// ── Pílula de banda (cor + ícone + rótulo) — acessível ───────────────────────
function BandPill({ band, label, className = "" }: { band: Band; label: string; className?: string }) {
  const Icon = BAND_ICON[band.icon];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-[8px] py-[2px] rounded-full ${className}`}
      style={{ background: band.colors.fill, color: band.colors.text }}
    >
      <Icon className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}

// ── Pirâmide (faixas coloridas pela banda do eixo) ───────────────────────────
function NeuroPyramid({ data }: { data: { dys: number | null; balance: number | null; isPriority: boolean }[] }) {
  const polys = ["120,10 150,54 90,54", "90,54 150,54 182,98 58,98", "58,98 182,98 214,142 26,142"];
  const cy = [46, 84, 128];
  return (
    <svg viewBox="0 0 240 152" className="w-[190px] h-[120px] shrink-0" role="img" aria-label="Pirâmide Bio³">
      {data.map((d, i) => {
        const band = bandForDysfunction(d.dys);
        const fill = band ? band.colors.fill : "#E9E7E0";
        const txt = band ? band.colors.text : "#A09E98";
        return (
          <g key={i}>
            <polygon points={polys[i]} fill={fill} stroke="#fff" strokeWidth={2} />
            <text x={120} y={cy[i]} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={700} fill={txt}>
              {d.balance === null ? "—" : `${d.balance}%`}
            </text>
            {d.isPriority && <text x={120} y={cy[i] - 14} textAnchor="middle" fontSize={11} fill={txt}>★</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function PatientNeuroIdPanel({
  map, patientId, hasReport,
}: {
  map: NeuroIdMapView; patientId: string; hasReport: boolean;
}) {
  const t = useTranslations("neuroId");
  const [assessing, setAssessing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [qrmText, setQrmText] = useState("");
  const [qsnaText, setQsnaText] = useState("");
  const [segmenting, setSegmenting] = useState(false);
  const [segMsg, setSegMsg] = useState<string | null>(null);

  async function handleSegment() {
    setSegmenting(true);
    setSegMsg(null);
    const res = await segmentInstrumentsAction({ qrmText, qsnaText });
    setSegmenting(false);
    if (res.error) { setSegMsg(res.error); return; }
    setVals((v) => {
      const next = { ...v };
      for (const [code, val] of Object.entries(res.draft)) next[code] = String(val);
      return next;
    });
    setSegMsg(t("segmentReview"));
  }

  const pillarDys: Record<NeuroPillar, number | null> = {
    fisico: map?.fisico_pct ?? null,
    bioquimico: map?.bioquimico_pct ?? null,
    emocional: map?.emocional_pct ?? null,
  };
  const generalBalance = eq(map?.indice_geral ?? null);
  const indexBand = bandForDysfunction(map?.indice_geral ?? null);

  const pyramidData = (["emocional", "bioquimico", "fisico"] as NeuroPillar[]).map((p) => ({
    dys: pillarDys[p], balance: eq(pillarDys[p]), isPriority: map?.priority_pillar === p,
  }));

  function bandLabel(band: Band | null, itemType: BandItemType): string {
    return band ? t(`band.${itemType}.${band.key}`) : "—";
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-[6px]">
          <Activity className="h-4 w-4 text-[#A09E98]" />
          <p className="text-[13px] font-medium text-[#0F1A2E]">{t("title")}</p>
        </div>
        <div className="flex items-center gap-[10px]">
          {map && hasReport && (
            <a href={`/api/patients/${patientId}/neuro-id/pdf`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] transition">
              <FileText className="h-3 w-3" /> {t("viewPdf")}
            </a>
          )}
          {!assessing && (
            <button type="button" onClick={() => setAssessing(true)}
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition">
              <Plus className="h-3 w-3" /> {t("newAssessment")}
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[#A09E98] leading-snug mb-[12px] border-l-2 border-[#D9A441]/40 pl-2">{t("disclaimer")}</p>

      {map ? (
        <div className="space-y-[12px]">
          <div className="flex items-center gap-[16px] rounded-[10px] bg-[#FAFAF8] px-[14px] py-[12px] flex-wrap">
            <NeuroPyramid data={pyramidData} />
            <div className="text-center shrink-0">
              <p className="text-[10px] text-[#A09E98] uppercase tracking-[.05em]">{t("indexLabel")}</p>
              <p className="text-[26px] font-semibold leading-none mt-[2px]" style={{ color: indexBand?.colors.text ?? "#A09E98" }}>
                {generalBalance === null ? "—" : `${generalBalance}%`}
              </p>
              {indexBand && <span className="mt-[4px] inline-block"><BandPill band={indexBand} label={bandLabel(indexBand, "axis")} /></span>}
            </div>
            <div className="flex-1 min-w-0">
              {map.priority_pillar && (
                <p className="text-[12px] text-[#0F1A2E]"><span className="font-medium">{t("priorityLabel")}:</span> {t(`pillar.${map.priority_pillar}`)}</p>
              )}
              {map.is_partial && (
                <p className="text-[11px] text-[#C77D17] flex items-center gap-1 mt-[3px]"><AlertCircle className="h-3 w-3" /> {t("partialHint")}</p>
              )}
              <p className="text-[10px] text-[#A09E98] mt-[6px]">{t("band.legend")}</p>
            </div>
          </div>

          {/* Eixos com banda (cor + rótulo + ícone) */}
          {PILLARS.map((p) => {
            const band = bandForDysfunction(pillarDys[p]);
            const balance = eq(pillarDys[p]);
            return (
              <div key={p}>
                <div className="flex items-center justify-between mb-[3px]">
                  <span className="text-[12px] font-medium text-[#0F1A2E]">
                    {t(`pillar.${p}`)} <span className="text-[#A09E98] font-normal">· {t(`pillarHint.${p}`)}</span>
                    {map.priority_pillar === p && <span className="ml-[6px] text-[10px] text-[#991B1B]">★</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {band && <BandPill band={band} label={bandLabel(band, "axis")} />}
                    <span className="text-[12px] font-semibold" style={{ color: band?.colors.text ?? "#A09E98" }}>
                      {balance === null ? "—" : `${balance}%`}
                    </span>
                  </span>
                </div>
                <div className="h-[7px] bg-[#F4F3EF] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${balance ?? 0}%`, background: band?.colors.stroke ?? "#D3D1C7" }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !assessing && <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      )}

      {/* Formulário de avaliação (manual) */}
      {assessing && (
        <form
          action={async (fd) => { await createNeuroIdAssessmentAction(fd); setAssessing(false); setVals({}); }}
          className="mt-[12px] space-y-[14px] bg-[#FAFAF8] rounded-[10px] p-[12px]"
        >
          <input type="hidden" name="patient_id" value={patientId} />

          {/* Fase 2: colar QRM/Q-SNA → IA extrai sub-scores → revisar */}
          <div className="rounded-[8px] border border-[#3B6BE4]/20 bg-white p-[10px] space-y-[8px]">
            <p className="text-[11px] font-semibold text-[#0F1A2E] flex items-center gap-1"><Sparkles className="h-3 w-3 text-[#3B6BE4]" /> {t("segmentTitle")}</p>
            <p className="text-[10px] text-[#A09E98]">{t("segmentHint")}</p>
            <textarea value={qrmText} onChange={(e) => setQrmText(e.target.value)} rows={2} placeholder={t("qrmLabel")} className={`${inputCls} resize-none`} />
            <textarea value={qsnaText} onChange={(e) => setQsnaText(e.target.value)} rows={2} placeholder={t("qsnaLabel")} className={`${inputCls} resize-none`} />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" disabled={segmenting || (!qrmText.trim() && !qsnaText.trim())} onClick={handleSegment}
                className="text-[11px] font-medium text-white bg-[#3B6BE4] hover:bg-[#2f57bd] disabled:opacity-50 rounded-[8px] px-[12px] py-[6px] transition inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {segmenting ? t("segmenting") : t("segmentBtn")}
              </button>
              {segMsg && <span className="text-[10px] text-[#0F6E56]">{segMsg}</span>}
            </div>
            <p className="text-[10px] text-[#A09E98]">{t("segmentNote")}</p>
          </div>

          <p className="text-[11px] text-[#A09E98]">{t("formHint")}</p>

          {PILLARS.map((pillar) => (
            <div key={pillar}>
              <p className="text-[11px] font-semibold text-[#0F1A2E] mb-[6px]">{t(`pillar.${pillar}`)}</p>
              <div className="grid gap-[8px] sm:grid-cols-2">
                {DEFAULT_CATALOG.filter((it) => it.pillar === pillar).map((it) => {
                  const raw = vals[it.code] ?? "";
                  const band = it.input_type === "lab"
                    ? (raw ? bandForDysfunction(LAB_DYS[raw] ?? null) : null)
                    : (raw !== "" ? bandForItem(Number(raw)) : null);
                  return (
                    <label key={it.code} className="block">
                      <span className="text-[11px] text-[#6B6A66] mb-[2px] flex items-center justify-between gap-2">
                        <span>{it.label}{it.partial && <span className="text-[#C77D17]"> · {t("optional")}</span>}</span>
                        {band && <BandPill band={band} label={bandLabel(band, it.band_type)} />}
                      </span>
                      {it.input_type === "lab" ? (
                        <select name={`item__${it.code}`} className={inputCls} value={raw}
                          onChange={(e) => setVals((v) => ({ ...v, [it.code]: e.target.value }))}>
                          <option value="">{t("lab.unknown")}</option>
                          <option value="normal">{t("lab.normal")}</option>
                          <option value="leve">{t("lab.leve")}</option>
                          <option value="moderado">{t("lab.moderado")}</option>
                          <option value="alto">{t("lab.alto")}</option>
                        </select>
                      ) : (
                        <input type="number" min={0} max={10} step={1} name={`item__${it.code}`} className={inputCls}
                          value={raw} onChange={(e) => setVals((v) => ({ ...v, [it.code]: e.target.value }))} />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-[8px]">
            <button type="submit" className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[8px] transition">
              {t("compute")}
            </button>
            <button type="button" onClick={() => { setAssessing(false); setVals({}); }} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
