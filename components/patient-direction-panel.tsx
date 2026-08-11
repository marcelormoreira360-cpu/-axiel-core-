"use client";

/**
 * patient-direction-panel.tsx — Painel de Direção estruturado (Melhoria 3).
 *
 * Consolida numa faixa fixa (ficha do paciente E topo da sessão) tudo que o
 * terapeuta precisa para lembrar o rumo sem reabrir a avaliação: queixa
 * principal, 3 objetivos, eixos Neuro ID (Físico/Bioquímico/Emocional),
 * pacote atual, medicamentos em uso (sinal de atenção) e o resumo evolutivo.
 *
 * Recebe TODAS as props já carregadas no server (nenhum fetch novo no client).
 * O modo edição reusa a mesma action da Feature 2 (saveCaseSummaryAction), por
 * isso a edição rápida da queixa/resumo funciona também na tela de sessão.
 *
 * Uso interno. Linguagem prudente (associação, não diagnóstico fechado).
 */

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Compass, Pencil, Check, X, AlertCircle, ChevronDown, ChevronRight,
  Target, Activity, Package, Pill, AlertTriangle, ClipboardList, Sparkles, FileText,
} from "lucide-react";
import { saveCaseSummaryAction, draftCaseSummaryAction, type CaseSummaryState } from "@/app/patients/[id]/case-summary/actions";
import { SessionPackageBadge } from "@/components/session-package-badge";
import { severityColor } from "@/modules/neuro-id/bands";
import type { NeuroPillar } from "@/modules/neuro-id/catalog";
import type { PatientPackage } from "@/services/package-service";
import type { MedicationLoadDisplay } from "@/services/medication-load-service";

type NeuroAxes = {
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
  indice_geral: number | null;
  priority_pillar: NeuroPillar | null;
  is_partial: boolean;
};

type Props = {
  patientId: string;
  chiefComplaint: string | null;
  caseSummary: string | null;
  /** Bruto de assessment_data.objetivo (rótulo "Objetivo (3 prioridades)"). */
  objetivoRaw: string | null;
  neuro: NeuroAxes | null;
  packages: PatientPackage[];
  medication: MedicationLoadDisplay | null;
  /**
   * Slot "Resumo evolutivo" (Melhoria 2, ainda não construída). Por ora recebe
   * patients.case_summary; quando o digest existir, basta trocar a origem.
   */
  evolutionSummary: string | null;
  /** Sínteses dos exames funcionais (título/tipo · data · síntese da IA), read-only. */
  exams?: { id: string; title: string | null; exam_type: string; exam_date: string; summary: string | null }[];
  defaultOpen?: boolean;
  /**
   * "full" (sessão): tudo. "compact" (ficha): só queixa + resumo do caso +
   * resumo evolutivo + rascunho IA, sem eixos/pacote/medicação (já mostrados no
   * Mapa Bio³ e na carga de medicação da ficha). Default "full".
   */
  variant?: "compact" | "full";
};

const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];

// Limpa numeração/bullet do começo da linha (1. / 1) / - / • / *).
function cleanBullet(s: string): string {
  return s.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim();
}

/**
 * Parseia os 3 objetivos: quebra por linha, senão por numeração inline
 * (1. ... 2. ...), senão por ponto e vírgula. Fallback: texto corrido (1 item).
 */
export function parseGoals(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const text = raw.trim();
  if (!text) return [];

  const byLine = text.split(/\r?\n+/).map(cleanBullet).filter(Boolean);
  if (byLine.length >= 2) return byLine.slice(0, 3);

  const inline = text.split(/(?=(?:^|\s)\d+[.)]\s)/).map(cleanBullet).filter(Boolean);
  if (inline.length >= 2) return inline.slice(0, 3);

  const bySemi = text.split(/;+/).map((s) => s.trim()).filter(Boolean);
  if (bySemi.length >= 2) return bySemi.slice(0, 3);

  return [cleanBullet(text) || text];
}

function round(n: number | null): number | null {
  return n === null || !Number.isFinite(n) ? null : Math.round(n);
}

// Formata a data do exame de forma robusta (date-only não sofre shift de fuso).
function formatExamDate(d: string): string {
  const dt = new Date(d.length <= 10 ? `${d}T12:00:00` : d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
}

export function PatientDirectionPanel({
  patientId,
  chiefComplaint,
  caseSummary,
  objetivoRaw,
  neuro,
  packages,
  medication,
  evolutionSummary,
  exams = [],
  defaultOpen = true,
  variant = "full",
}: Props) {
  const isFull = variant === "full";
  const t = useTranslations("directionPanel");
  const tp = useTranslations("neuroId");

  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  // Estado local dos campos SALVOS: reflete o save imediatamente mesmo quando a
  // rota não é revalidada (ex.: tela de sessão, cujo path a action não revalida).
  const [chief, setChief] = useState(chiefComplaint);
  const [summary, setSummary] = useState(caseSummary);
  // Campos CONTROLADOS do formulário (editáveis + preenchíveis pelo rascunho IA).
  const [draftChief, setDraftChief] = useState(chiefComplaint ?? "");
  const [draftSummary, setDraftSummary] = useState(caseSummary ?? "");
  // Rascunho por IA: estado de carregamento + aviso ("preencha a avaliação").
  const [drafting, startDraft] = useTransition();
  const [draftHint, setDraftHint] = useState<"none" | "no_assessment" | "error" | "filled">("none");

  const openEditor = () => {
    setDraftChief(chief ?? "");
    setDraftSummary(summary ?? "");
    setDraftHint("none");
    setEditing(true);
    setOpen(true);
  };

  const generateDraft = () => {
    setDraftHint("none");
    startDraft(async () => {
      const res = await draftCaseSummaryAction(patientId);
      if (res.ok) {
        setDraftChief(res.chief);
        setDraftSummary(res.summary);
        setDraftHint("filled");
      } else {
        setDraftHint(res.reason === "no_assessment" ? "no_assessment" : "error");
      }
    });
  };

  const [state, formAction, isPending] = useActionState<CaseSummaryState, FormData>(
    async (prev, fd) => {
      const res = await saveCaseSummaryAction(patientId, prev, fd);
      if (res?.ok) {
        setChief(String(fd.get("chief_complaint") ?? "").trim() || null);
        setSummary(String(fd.get("case_summary") ?? "").trim() || null);
        setEditing(false);
        setDraftHint("none");
      }
      return res;
    },
    null,
  );

  const goals = parseGoals(objetivoRaw);
  const hasActivePackage = packages.some((p) => p.is_active);
  const activeMeds = medication && medication.count > 0 ? medication : null;
  // Dois blocos distintos em modo leitura: o resumo do caso (manual, editável)
  // e o resumo evolutivo (automático, rolante, read-only). Não se sobrepõem.
  const manualSummary = summary;
  const evolutionDigest = evolutionSummary;
  // Sínteses de exames com conteúdo (a IA já resumiu ao carregar o PDF), read-only.
  const examsWithSummary = exams.filter((e) => e.summary && e.summary.trim());

  return (
    <div className="bg-white border border-[#0F6E56]/20 rounded-[12px] overflow-hidden">
      {/* Cabeçalho recolhível */}
      <div className="flex items-center justify-between gap-2 px-[16px] py-[11px] bg-[#E1F5EE] dark:bg-[#0F6E56]/[.12]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-[7px] min-w-0"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
          )}
          <Compass className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
          <span className="text-[12px] font-medium text-[#085041] truncate">{t("title")}</span>
          {!open && chief && (
            <span className="text-[11px] text-[#3A4A42] dark:text-[#9E9C97] truncate hidden sm:inline">
              , {chief}
            </span>
          )}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={openEditor}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition shrink-0"
          >
            <Pencil className="h-3 w-3" /> {t("edit")}
          </button>
        )}
      </div>

      {open && (
        <div className="p-[16px]">
          {editing ? (
            <form action={formAction} className="space-y-[10px]">
              {/* Rascunho por IA: preenche os campos abaixo (editável, não salva) */}
              <div className="flex flex-wrap items-center gap-[8px]">
                <button
                  type="button"
                  onClick={generateDraft}
                  disabled={drafting}
                  className="inline-flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] bg-[#E1F5EE] hover:bg-[#CDEEE2] disabled:opacity-50 rounded-[8px] px-[10px] py-[6px] transition"
                >
                  <Sparkles className="h-3 w-3" /> {drafting ? t("drafting") : t("draftButton")}
                </button>
                {draftHint === "filled" && (
                  <span className="text-[10px] text-[#6B6A66] dark:text-[#9E9C97]">{t("draftFilled")}</span>
                )}
                {draftHint === "no_assessment" && (
                  <span className="flex items-center gap-1 text-[10px] text-[#8A5A14]"><AlertCircle className="h-3 w-3" /> {t("draftNoAssessment")}</span>
                )}
                {draftHint === "error" && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500"><AlertCircle className="h-3 w-3" /> {t("draftError")}</span>
                )}
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("chiefLabel")}</label>
                <input
                  name="chief_complaint"
                  value={draftChief}
                  onChange={(e) => setDraftChief(e.target.value)}
                  placeholder={t("chiefPlaceholder")}
                  className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-[4px] block">{t("summaryLabel")}</label>
                <textarea
                  name="case_summary"
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  rows={4}
                  placeholder={t("summaryPlaceholder")}
                  className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition resize-none"
                />
              </div>
              {draftHint === "filled" && (
                <p className="text-[10px] text-[#A09E98]">{t("draftReviewHint")}</p>
              )}
              {state?.error && (
                <p className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" /> {state.error}</p>
              )}
              <div className="flex items-center gap-[8px]">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[8px] px-[14px] py-[7px] transition"
                >
                  <Check className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("save")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] rounded-[8px] px-[12px] py-[7px] transition"
                >
                  <X className="h-3.5 w-3.5" /> {t("cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-[14px]">
              {/* Queixa principal */}
              {chief ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[2px]">{t("chiefLabel")}</p>
                  <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{chief}</p>
                </div>
              ) : null}

              {/* 3 objetivos (só na variante completa) */}
              {isFull && goals.length > 0 && (
                <div>
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[4px]">
                    <Target className="h-3 w-3" /> {t("goalsLabel")}
                  </p>
                  {goals.length === 1 ? (
                    <p className="text-[12px] text-[#3A4A42] dark:text-[#9E9C97] leading-relaxed">{goals[0]}</p>
                  ) : (
                    <ol className="space-y-[3px]">
                      {goals.map((g, i) => (
                        <li key={i} className="flex gap-[7px] items-start">
                          <span className="text-[11px] font-semibold text-[#0F6E56] shrink-0 mt-[1px]">{i + 1}.</span>
                          <span className="text-[12px] text-[#3A4A42] dark:text-[#9E9C97] leading-relaxed">{g}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Linha: eixos Neuro ID · pacote · medicação (só na variante completa;
                  na ficha isso já aparece no Mapa Bio³ e na carga de medicação) */}
              {isFull && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
                {/* Eixos Neuro ID */}
                <div className="min-w-0">
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[6px]">
                    <Activity className="h-3 w-3" /> {t("axesLabel")}
                    {neuro?.is_partial && (
                      <span className="text-[9px] font-medium text-[#8A5A14] bg-[#F4E4C8] rounded-full px-[5px] py-[1px] normal-case tracking-normal">
                        {t("partial")}
                      </span>
                    )}
                  </p>
                  {neuro ? (
                    <div className="space-y-[5px]">
                      {PILLARS.map((p) => {
                        const key = `${p}_pct` as const;
                        const val = round(neuro[key]);
                        const c = severityColor(val);
                        const isPriority = neuro.priority_pillar === p;
                        return (
                          <div key={p} className="flex items-center gap-[7px]">
                            <span className="text-[10px] text-[#6B6A66] dark:text-[#9E9C97] w-[74px] shrink-0 truncate">
                              {isPriority && <span className="text-[#0F6E56]">★ </span>}
                              {tp(`pillar.${p}`)}
                            </span>
                            <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: c.fill }}>
                              <div className="h-full rounded-full" style={{ width: `${val ?? 0}%`, background: c.stroke }} />
                            </div>
                            <span className="text-[10px] font-semibold w-[26px] text-right shrink-0" style={{ color: c.text }}>
                              {val ?? "·"}{val !== null ? "%" : ""}
                            </span>
                          </div>
                        );
                      })}
                      {neuro.indice_geral !== null && (
                        <div className="flex items-center gap-[7px] pt-[3px] border-t border-black/[.05]">
                          <span className="text-[10px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] w-[74px] shrink-0">{t("index")}</span>
                          <div className="flex-1" />
                          <span className="text-[11px] font-semibold w-[26px] text-right shrink-0" style={{ color: severityColor(round(neuro.indice_geral)).text }}>
                            {round(neuro.indice_geral)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#A09E98]">{t("axesEmpty")}</p>
                  )}
                </div>

                {/* Pacote */}
                <div className="min-w-0">
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[6px]">
                    <Package className="h-3 w-3" /> {t("packageLabel")}
                  </p>
                  {hasActivePackage ? (
                    <SessionPackageBadge packages={packages} />
                  ) : (
                    <p className="text-[11px] text-[#A09E98]">{t("packageEmpty")}</p>
                  )}
                </div>

                {/* Medicação em uso + sinal de atenção */}
                <div className="min-w-0">
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[6px]">
                    <Pill className="h-3 w-3" /> {t("medsLabel")}
                  </p>
                  {activeMeds ? (
                    <div className="space-y-[5px]">
                      <p className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] leading-relaxed">
                        {activeMeds.medications.length > 0
                          ? activeMeds.medications.join(", ")
                          : t("medsCountOnly", { count: activeMeds.count })}
                      </p>
                      <span className="inline-flex items-center gap-[4px] text-[10px] font-medium text-[#8A5A14] bg-[#F4E4C8] rounded-full px-[7px] py-[2px]">
                        <AlertTriangle className="h-3 w-3" />
                        {activeMeds.polypharmacy ? t("medsPolypharmacy", { count: activeMeds.count }) : t("medsAttention")}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#A09E98]">{t("medsEmpty")}</p>
                  )}
                </div>
              </div>
              )}

              {/* Resumo do caso (manual, editável pelo terapeuta) */}
              {manualSummary ? (
                <div>
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[2px]">
                    <ClipboardList className="h-3 w-3" /> {t("caseLabel")}
                  </p>
                  <p className="text-[12px] text-[#3A4A42] dark:text-[#9E9C97] leading-relaxed whitespace-pre-wrap">{manualSummary}</p>
                </div>
              ) : null}

              {/* Sínteses de exames (a IA já resumiu ao carregar o PDF), read-only.
                  Só na sessão (variante full); na ficha ficam na Anamnese, sem duplicar. */}
              {isFull && examsWithSummary.length > 0 && (
                <div>
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[4px]">
                    <FileText className="h-3 w-3" /> {t("examsLabel")}
                  </p>
                  <div className="space-y-[9px]">
                    {examsWithSummary.slice(0, 4).map((e) => (
                      <div key={e.id}>
                        <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">
                          {e.title || e.exam_type}
                          <span className="text-[10px] font-normal text-[#A09E98] ml-[6px]">{formatExamDate(e.exam_date)}</span>
                        </p>
                        <p className="text-[12px] text-[#3A4A42] dark:text-[#9E9C97] leading-relaxed whitespace-pre-wrap">{e.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumo evolutivo (automático, rolante, read-only, Melhoria 2) */}
              {evolutionDigest ? (
                <div className="rounded-[8px] bg-[#F8F7F4] dark:bg-white/[.04] p-[10px]">
                  <p className="flex items-center gap-[5px] text-[10px] uppercase tracking-[.05em] text-[#A09E98] mb-[3px]">
                    <Activity className="h-3 w-3" /> {t("evolutionLabel")}
                    <span className="text-[9px] font-medium text-[#6B6A66] bg-black/[.05] dark:bg-white/[.08] rounded-full px-[5px] py-[1px] normal-case tracking-normal">
                      {t("evolutionAuto")}
                    </span>
                  </p>
                  <p className="text-[12px] text-[#3A4A42] dark:text-[#9E9C97] leading-relaxed whitespace-pre-wrap">{evolutionDigest}</p>
                </div>
              ) : null}

              {/* Vazio total: nada preenchido ainda (na compacta, ignora eixos/pacote/meds) */}
              {!chief && !manualSummary && !evolutionDigest
                && (!isFull || (examsWithSummary.length === 0 && goals.length === 0 && !neuro && !hasActivePackage && !activeMeds)) && (
                <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
