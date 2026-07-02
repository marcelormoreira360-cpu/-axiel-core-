"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Plus, Pencil, X, FileText, AlertCircle, CheckCircle2, AlertTriangle, Ban, Download, ShieldAlert } from "lucide-react";
import { DEFAULT_CATALOG, type NeuroPillar } from "@/modules/neuro-id/catalog";
import {
  bandForDysfunction, bandForItem, severityColor, priorityPillars, sharesSummingTo100,
  type Band, type BandIcon as BandIconKey, type BandItemType,
} from "@/modules/neuro-id/bands";
import { createNeuroIdAssessmentAction, updateNeuroIdAssessmentAction, importQuestionnaireAnswersAction } from "@/app/patients/[id]/neuro-id/actions";

export type NeuroIdMapView = {
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
  indice_geral: number | null;
  priority_pillar: NeuroPillar | null;
  is_partial: boolean;
  status?: string | null;
} | null;

const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];
const round = (d: number | null) => (d === null ? null : Math.round(d));

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

// ── Pirâmide (cor CONTÍNUA verde→amarelo→vermelho pela gravidade do eixo) ─────
// Cor = severidade (disfunção do eixo) · número = PESO do eixo no total (soma 100%).
// Ordem fixa topo→base: Biomecânico (topo) / Bioquímico (meio) / Bioemocional (base).
function NeuroPyramid({ data, className = "w-[190px] h-[120px] shrink-0" }: { data: { dys: number | null; share: number | null; isPriority: boolean }[]; className?: string }) {
  const polys = ["120,10 150,54 90,54", "90,54 150,54 182,98 58,98", "58,98 182,98 214,142 26,142"];
  const cy = [46, 84, 128];
  return (
    <svg viewBox="0 0 240 152" className={className} role="img" aria-label="Pirâmide Bio³ — peso de cada eixo no total, cor por gravidade">
      {data.map((d, i) => {
        const c = severityColor(d.dys);
        return (
          <g key={i}>
            <polygon points={polys[i]} fill={c.fillStrong} stroke={c.stroke} strokeWidth={2} />
            <text x={120} y={cy[i]} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={700} fill={c.text}>
              {d.share === null ? "—" : `${d.share}%`}
            </text>
            {d.isPriority && <text x={120} y={cy[i] - 14} textAnchor="middle" fontSize={11} fill={c.text}>★</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Escala 0–10 clicável e colorida por banda (0–3 verde · 4–6 âmbar · 7–10 vermelho) ──
// Prático: o terapeuta só clica. Preserva valor decimal auto-importado (destaca o
// botão arredondado; o valor cru fica no hidden input até alguém clicar).
function ScaleButtons({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const sel = value === "" || !Number.isFinite(Number(value)) ? null : Math.round(Number(value));
  return (
    <div className="flex gap-[3px] flex-wrap" role="group" aria-label="Pontuação 0 a 10">
      {Array.from({ length: 11 }, (_, n) => {
        const c = bandForItem(n)?.colors ?? { fill: "#F4F3EF", stroke: "#A09E98", text: "#6B6A66" };
        const active = sel === n;
        return (
          <button
            type="button"
            key={n}
            onClick={() => onSelect(String(n))}
            aria-pressed={active}
            className="w-[28px] h-[28px] rounded-[7px] text-[12px] font-medium border transition hover:opacity-80"
            style={
              active
                ? { background: c.stroke, color: "#fff", borderColor: c.stroke }
                : { background: c.fill, color: c.text, borderColor: "transparent" }
            }
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export type AttentionPoint = { code: string; label: string; dysfunction: number };

export function PatientNeuroIdPanel({
  map, patientId, hasReport, attentionPoints = [],
  assessmentId = null, initialValues = {}, initialAutoCodes = [],
}: {
  map: NeuroIdMapView; patientId: string; hasReport: boolean; attentionPoints?: AttentionPoint[];
  assessmentId?: string | null; initialValues?: Record<string, string>; initialAutoCodes?: string[];
}) {
  const t = useTranslations("neuroId");
  const tCommon = useTranslations("common.actions");
  const [assessing, setAssessing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [autoCodes, setAutoCodes] = useState<Set<string>>(new Set());
  const [origins, setOrigins] = useState<Record<string, string>>({});
  const [phq9Alert, setPhq9Alert] = useState<number | null>(null);
  const [unanswered, setUnanswered] = useState<string[]>([]);
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());

  function resetFormHints() {
    setUnanswered([]);
    setPendingCodes(new Set());
    setImportMsg(null);
    setPhq9Alert(null);
    setOrigins({});
  }

  // Nova avaliação (reavaliação) → formulário em branco; cria uma avaliação nova.
  function startNew() {
    setVals({});
    setAutoCodes(new Set());
    resetFormHints();
    setEditing(false);
    setAssessing(true);
  }

  // Rever / editar → recarrega os pontos da última avaliação; ao salvar, CORRIGE a mesma.
  function startEdit() {
    setVals({ ...initialValues });
    setAutoCodes(new Set(initialAutoCodes));
    resetFormHints();
    setEditing(true);
    setAssessing(true);
  }

  function closeForm() {
    setAssessing(false);
    setEditing(false);
    setVals({});
    resetFormHints();
    setAutoCodes(new Set());
  }

  async function handleImport() {
    setImporting(true);
    setImportMsg(null);
    const res = await importQuestionnaireAnswersAction(patientId);
    setImporting(false);
    if (res.error) { setImportMsg(res.error); return; }
    const entries = Object.entries(res.draft);
    setVals((v) => {
      const next = { ...v };
      for (const [code, val] of entries) next[code] = String(val);
      return next;
    });
    setAutoCodes((prev) => new Set([...prev, ...entries.map(([c]) => c)]));
    setOrigins((prev) => ({ ...prev, ...res.origins }));
    setPhq9Alert(res.phq9Item9 ? res.phq9Item9.value : null);
    setUnanswered(res.unanswered ?? []);
    // Itens mapeados sem resposta → marca "pendente" (mas não os já preenchidos agora).
    const filled = new Set(entries.map(([c]) => c));
    setPendingCodes(new Set((res.missing ?? []).filter((c) => !filled.has(c))));
    setImportMsg(entries.length > 0 ? t("importDone", { count: entries.length }) : t("importNone"));
  }

  const pillarDys: Record<NeuroPillar, number | null> = {
    fisico: map?.fisico_pct ?? null,
    bioquimico: map?.bioquimico_pct ?? null,
    emocional: map?.emocional_pct ?? null,
  };
  const generalDys = round(map?.indice_geral ?? null);
  const indexBand = bandForDysfunction(map?.indice_geral ?? null);

  // Peso de cada eixo no total — porcentagens inteiras que somam exatamente 100%.
  const [shareFisico, shareBioq, shareEmo] = sharesSummingTo100(PILLARS.map((p) => pillarDys[p]));
  const shareByPillar: Record<NeuroPillar, number | null> = {
    fisico: shareFisico, bioquimico: shareBioq, emocional: shareEmo,
  };

  // Prioritários: o(s) pior(es) eixo(s); permite empate/quase-empate (2+ simultâneos).
  const prioritySet = new Set<NeuroPillar>(priorityPillars(pillarDys));

  // Pirâmide topo→base: Biomecânico (topo) / Bioquímico (meio) / Bioemocional (base).
  const pyramidData = (["fisico", "bioquimico", "emocional"] as NeuroPillar[]).map((p) => ({
    dys: pillarDys[p], share: shareByPillar[p], isPriority: prioritySet.has(p),
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
          {!assessing && map && assessmentId && (
            <button type="button" onClick={startEdit}
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] transition">
              <Pencil className="h-3 w-3" /> {t("editAssessment")}
            </button>
          )}
          {!assessing && (
            <button type="button" onClick={startNew}
              className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition">
              <Plus className="h-3 w-3" /> {t("newAssessment")}
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[#A09E98] leading-snug mb-[12px] border-l-2 border-[#D9A441]/40 pl-2">{t("disclaimer")}</p>

      {map ? (
        <div className="space-y-[12px]">
          {map.status === "auto_draft" && (
            <div className="rounded-[10px] border border-[#C77D17]/30 bg-[#FFF8E7] px-[12px] py-[10px] flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-[#633806] flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-[1px]" />
                {t("autoDraftBanner")}
              </p>
              <button type="button" onClick={() => { startNew(); handleImport(); }}
                className="text-[11px] font-medium text-white bg-[#C77D17] hover:bg-[#A8650F] rounded-[8px] px-[12px] py-[6px] transition shrink-0">
                {t("reviewComplete")}
              </button>
            </div>
          )}
          {/* Resumo escaneável: índice-herói + pirâmide pequena (assinatura) */}
          <div className="flex items-center gap-[16px] rounded-[10px] bg-[#FAFAF8] px-[14px] py-[12px] flex-wrap">
            <div className="shrink-0 flex flex-col items-center gap-[3px]">
              <NeuroPyramid data={pyramidData} className="w-[120px] h-[76px]" />
              <p className="text-[8px] text-[#A09E98] text-center leading-tight max-w-[124px]">{t("pyramidShareCaption")}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-[#A09E98] leading-snug">{t("indexCaption")}</p>
              <div className="flex items-baseline gap-[8px] flex-wrap mt-[2px]">
                <p className="text-[40px] font-semibold leading-none" style={{ color: indexBand?.colors.text ?? "#A09E98" }}>
                  {generalDys === null ? "—" : `${generalDys}%`}
                </p>
                {indexBand && <BandPill band={indexBand} label={bandLabel(indexBand, "axis")} />}
              </div>
              {map.priority_pillar && (
                <p className="text-[11px] text-[#0F1A2E] mt-[4px]"><span className="font-medium">{t("startHere")}:</span> {t(`pillar.${map.priority_pillar}`)}</p>
              )}
              {map.is_partial && (
                <p className="text-[11px] text-[#C77D17] flex items-center gap-1 mt-[2px]"><AlertCircle className="h-3 w-3 shrink-0" /> {t("partialHint")}</p>
              )}
            </div>
          </div>

          {/* 3 cards dos pilares: disfunção absoluta · cor contínua por gravidade · ★ no(s) prioritário(s) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[8px]">
            {(["fisico", "bioquimico", "emocional"] as NeuroPillar[]).map((p) => {
              const band = bandForDysfunction(pillarDys[p]);
              const c = severityColor(pillarDys[p]);
              const disf = round(pillarDys[p]);
              const isPriority = prioritySet.has(p);
              return (
                <div key={p} className="rounded-[10px] border px-[12px] py-[10px]"
                  style={{ background: c.fill, borderColor: isPriority ? c.stroke : "transparent", borderWidth: isPriority ? 2 : 1 }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium" style={{ color: c.text }}>{t(`pillar.${p}`)}</span>
                    {band && <BandPill band={band} label={bandLabel(band, "axis")} />}
                  </div>
                  <p className="text-[26px] font-semibold leading-none mt-[6px]" style={{ color: c.text }}>
                    {disf === null ? "—" : `${disf}%`}
                  </p>
                  <p className="text-[9px] mt-[2px] opacity-70" style={{ color: c.text }}>{t("cardSubtitle")}</p>
                  {isPriority && (
                    <p className="text-[10px] font-semibold mt-[4px] flex items-center gap-1" style={{ color: c.text }}>★ {t("startHere")}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pontos de atenção: piores itens (barras coloridas, pior primeiro) */}
          {attentionPoints.length > 0 && (
            <div className="rounded-[10px] border border-black/[.06] px-[12px] py-[10px]">
              <p className="text-[11px] font-semibold text-[#0F1A2E] mb-[8px]">{t("attentionTitle")}</p>
              <div className="space-y-[7px]">
                {attentionPoints.map((ap) => {
                  const band = bandForDysfunction(ap.dysfunction);
                  return (
                    <div key={ap.code}>
                      <div className="flex items-center justify-between gap-2 mb-[2px]">
                        <span className="text-[11px] text-[#0F1A2E] truncate">{ap.label}</span>
                        <span className="text-[11px] font-semibold shrink-0" style={{ color: band?.colors.text ?? "#A09E98" }}>{ap.dysfunction}%</span>
                      </div>
                      <div className="h-[6px] bg-[#F4F3EF] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${ap.dysfunction}%`, background: band?.colors.stroke ?? "#D3D1C7" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-[#A09E98] leading-snug">{t("legendRanges")}</p>
        </div>
      ) : (
        !assessing && <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      )}

      {/* Formulário de avaliação (manual) */}
      {assessing && (
        <form
          action={async (fd) => {
            if (editing && assessmentId) await updateNeuroIdAssessmentAction(fd);
            else await createNeuroIdAssessmentAction(fd);
            closeForm();
          }}
          className="mt-[12px] space-y-[14px] bg-[#FAFAF8] rounded-[10px] p-[12px]"
        >
          <input type="hidden" name="patient_id" value={patientId} />
          {editing && assessmentId && <input type="hidden" name="assessment_id" value={assessmentId} />}
          {editing && (
            <p className="text-[11px] text-[#6B6A66] bg-[#EEF6F2] border border-[#0F6E56]/20 rounded-[8px] px-[10px] py-[7px] flex items-start gap-1.5">
              <Pencil className="h-3.5 w-3.5 shrink-0 mt-[1px] text-[#0F6E56]" /> {t("editingHint")}
            </p>
          )}

          {/* §8: importar respostas de questionário (MSQ, PHQ-9, GAD-7, HPA) */}
          <div className="rounded-[8px] border border-[#0F6E56]/20 bg-white p-[10px] space-y-[8px]">
            <p className="text-[11px] font-semibold text-[#0F1A2E] flex items-center gap-1"><Download className="h-3 w-3 text-[#0F6E56]" /> {t("importTitle")}</p>
            <p className="text-[10px] text-[#A09E98]">{t("importHint")}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" disabled={importing} onClick={handleImport}
                className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[12px] py-[6px] transition inline-flex items-center gap-1">
                <Download className="h-3 w-3" /> {importing ? t("importing") : t("importBtn")}
              </button>
              {importMsg && <span className="text-[10px] text-[#0F6E56]">{importMsg}</span>}
            </div>
            {phq9Alert !== null && (
              <p className="text-[11px] text-[#991B1B] bg-[#FEE2E2] rounded-[6px] px-[8px] py-[6px] flex items-start gap-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-[1px]" /> {t("phq9Alert", { value: phq9Alert })}
              </p>
            )}
            {unanswered.length > 0 && (
              <p className="text-[11px] text-[#633806] bg-[#FFF8E7] border border-[#C77D17]/30 rounded-[6px] px-[8px] py-[6px] flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-[1px] text-[#C77D17]" /> {t("unansweredHint", { list: unanswered.join(", ") })}
              </p>
            )}
          </div>

          <p className="text-[11px] text-[#A09E98]">{t("formHint")}</p>

          {PILLARS.map((pillar) => (
            <div key={pillar}>
              <p className="text-[11px] font-semibold text-[#0F1A2E] mb-[6px]">{t(`pillar.${pillar}`)}</p>
              <div className="grid gap-[8px] sm:grid-cols-2">
                {DEFAULT_CATALOG
                  .filter((it) => it.pillar === pillar && (!it.auto || (vals[it.code] ?? "") !== ""))
                  .map((it) => {
                  const raw = vals[it.code] ?? "";
                  const band = it.input_type === "lab"
                    ? (raw ? bandForDysfunction(LAB_DYS[raw] ?? null) : null)
                    : (raw !== "" ? bandForItem(Number(raw)) : null);
                  return (
                    <label key={it.code} className="block">
                      <span className="text-[11px] text-[#6B6A66] mb-[2px] flex items-center justify-between gap-2">
                        <span>{it.label}
                          {it.partial && <span className="text-[#C77D17]"> · {t("optional")}</span>}
                          {autoCodes.has(it.code) && <span className="text-[#0F6E56]"> · {t("autoTag")}</span>}
                          {origins[it.code] && <span className="text-[#A09E98]"> · {t("normalizedFrom", { ratio: origins[it.code] })}</span>}
                          {pendingCodes.has(it.code) && raw === "" && <span className="text-[#C77D17]"> · {t("pendingTag")}</span>}
                        </span>
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
                      ) : it.band_type === "mobility" || it.band_type === "pain" ? (
                        // Só os itens MANUAIS de palpação/dor do Biomecânico viram escala clicável.
                        // QRM/Q-SNA e os pilares Bioquímico/Bioemocional seguem como campo numérico
                        // (extraídos dos questionários, podem ter decimais).
                        <>
                          <ScaleButtons value={raw} onSelect={(val) => setVals((v) => ({ ...v, [it.code]: val }))} />
                          <input type="hidden" name={`item__${it.code}`} value={raw} />
                        </>
                      ) : (
                        <input type="number" min={0} max={10} step="0.1" inputMode="decimal" name={`item__${it.code}`} className={inputCls}
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
              {editing ? t("saveCorrection") : t("compute")}
            </button>
            <button type="button" onClick={closeForm} aria-label={tCommon("close")} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
