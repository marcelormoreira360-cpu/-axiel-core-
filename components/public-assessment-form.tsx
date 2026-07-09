"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { TemplateWithStructure, AssessmentQuestion, ScoreBand } from "@/lib/types";
// Contato do fecho da tela de resultado (convite, sem preço/agendamento) —
// fonte única compartilhada com o e-mail de resultado (lib/contact).
import { CONTACT_PHONE_DIGITS, CONTACT_SITE_URL } from "@/lib/contact";

/** Flags de nota de segurança condicional (MSQ da feira), calculados no backend. */
type SafetyFlags = { showA: boolean; showB: boolean; showC: boolean };

/** Resultado devolvido pelo backend no modo público (funil value-first). */
type PublicResult = {
  total_score: number;
  max_possible_score: number;
  score_percentage: number;
  band: ScoreBand | null;
  safety_flags: SafetyFlags | null;
  /** Ideação (PHQ-9) marcada: mostra recursos de crise no topo do resultado. */
  crisis?: boolean;
};

const DEFAULT_SCALE_LABELS = [
  "Nunca ou quase nunca",
  "Ocasionalmente, efeito leve",
  "Ocasionalmente, efeito severo",
  "Frequentemente, efeito leve",
  "Frequentemente, efeito severo",
];

function ScaleInput({
  question,
  value,
  onChange,
}: {
  question: AssessmentQuestion;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const steps = Array.from(
    { length: question.max_score - question.min_score + 1 },
    (_, i) => i + question.min_score
  );
  return (
    <div className="flex items-center gap-[4px] flex-wrap">
      {steps.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={[
            "w-10 h-10 rounded-[8px] text-[13px] font-semibold border transition shrink-0",
            value === n
              ? n >= 3
                ? "bg-[#E53E3E] border-[#E53E3E] text-white"
                : n >= 1
                ? "bg-[#0F6E56] border-[#0F6E56] text-white"
                : "bg-[#0F1A2E] border-[#0F1A2E] text-white dark:bg-[#1C2333] dark:border-white/[.25]"
              : "border-black/[.12] text-[#6B6A66] hover:border-[#0F6E56] hover:text-[#0F6E56] bg-white dark:bg-[#161B26] dark:border-white/[.12] dark:text-[#9E9C97] dark:hover:border-[#0F6E56] dark:hover:text-[#9FE1CB]",
          ].join(" ")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export type PublicContact = {
  /** Fluxo FINAL: nome (nome+sobrenome), e-mail e telefone são obrigatórios. */
  full_name: string;
  email: string;
  phone: string;
  consent: boolean;
  /** honeypot anti-bot */
  website?: string;
};

export function PublicAssessmentForm({
  template,
  token,
  chain = [],
  contact,
  publicMode = false,
}: {
  template: TemplateWithStructure;
  token: string;
  /** Tokens dos próximos questionários (encadeamento Q1→Q2→…→fim). */
  chain?: string[];
  /** Cadastro do futuro paciente — presente só em link público de captação. */
  contact?: PublicContact | null;
  /** Modo captação: esconde o placar clínico na tela final. */
  publicMode?: boolean;
}) {
  const t = useTranslations("publicForm");
  // Idioma ativo (cookie AXIEL_LOCALE, via LanguageSwitcher) — enviado ao backend
  // para o e-mail de resultado sair no mesmo idioma da tela.
  const locale = useLocale();
  const [advancing, setAdvancing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modo público (funil value-first): resultado devolvido pelo backend.
  const [result, setResult] = useState<PublicResult | null>(null);

  function setAnswer(qid: string, value: number | string | null) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  const { sectionScores, totalScore, maxPossible, percentage, answeredCount, totalQuestions, missingRequired } = useMemo(() => {
    let total = 0;
    let maxP = 0;
    let answered = 0;
    let totalQ = 0;
    let missingReq = 0;
    const sScores: Record<string, { score: number; max: number }> = {};
    for (const section of template.assessment_sections) {
      let sScore = 0;
      let sMax = 0;
      for (const q of section.assessment_questions) {
        totalQ++;
        const v = answers[q.id];
        const isText = q.question_type === "text";
        const isAnswered = isText ? typeof v === "string" && v.trim().length > 0 : typeof v === "number";
        if (!isText) {
          if (typeof v === "number") { sScore += v; total += v; }
          sMax += q.max_score;
          maxP += q.max_score;
        }
        if (isAnswered) answered++;
        // Perguntas com pontuação (scale/yes_no/número) são sempre obrigatórias
        // para um score válido; texto livre é opcional, a menos que marcado.
        const isRequired = !isText || q.is_required;
        if (isRequired && !isAnswered) missingReq++;
      }
      sScores[section.id] = { score: sScore, max: sMax };
    }
    return {
      sectionScores: sScores,
      totalScore: total,
      maxPossible: maxP,
      percentage: maxP > 0 ? Math.round((total / maxP) * 100) : 0,
      answeredCount: answered,
      totalQuestions: totalQ,
      missingRequired: missingReq,
    };
  }, [answers, template]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Bloqueia envio/avanço só se faltar responder alguma pergunta obrigatória
    // (perguntas com pontuação, ou de texto marcadas como obrigatórias).
    if (missingRequired > 0) {
      setError(t("answerAll", { count: missingRequired }));
      return;
    }
    setSubmitting(true);
    setError(null);

    // Build answers array
    const answersPayload: {
      question_id: string;
      section_id: string | null;
      value_number: number | null;
      value_text: string | null;
    }[] = [];
    for (const section of template.assessment_sections) {
      for (const q of section.assessment_questions) {
        const raw = answers[q.id];
        answersPayload.push({
          question_id: q.id,
          section_id: section.id,
          value_number: q.question_type !== "text" && typeof raw === "number" ? raw : null,
          value_text: q.question_type === "text" && typeof raw === "string" ? raw : null,
        });
      }
    }

    // Build section_scores
    const sectionScoresPayload: Record<string, { title: string; score: number; max: number }> = {};
    for (const section of template.assessment_sections) {
      const ss = sectionScores[section.id] ?? { score: 0, max: 0 };
      sectionScoresPayload[section.id] = { title: section.title, score: ss.score, max: ss.max };
    }

    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          answers: answersPayload,
          section_scores: sectionScoresPayload,
          total_score: totalScore,
          max_possible_score: maxPossible,
          notes: notes.trim() || null,
          contact: contact ?? null,
          locale,
        }),
      });

      // Confirma de fato o salvamento: exige ok:true do servidor (evita falso-positivo
      // se a requisição cair num redirect/HTML com status 200, ex.: login).
      const body = await res.json().catch(
        () =>
          ({} as {
            ok?: boolean;
            error?: string;
            total_score?: number;
            max_possible_score?: number;
            score_percentage?: number;
            band?: ScoreBand | null;
            safety_flags?: SafetyFlags | null;
            crisis?: boolean;
          }),
      );
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? t("errSave"));
      }

      // Encadeamento: se há próximos questionários, avança automaticamente.
      if (chain.length > 0) {
        const [next, ...rest] = chain;
        const q = rest.length ? `?chain=${rest.join(",")}` : "";
        setAdvancing(true);
        window.location.href = `/f/${next}${q}`;
        return;
      }

      // Modo público: guarda o resultado devolvido para renderizar score + faixa.
      if (publicMode) {
        setResult({
          total_score: body.total_score ?? totalScore,
          max_possible_score: body.max_possible_score ?? maxPossible,
          score_percentage: body.score_percentage ?? percentage,
          band: body.band ?? null,
          safety_flags: body.safety_flags ?? null,
          crisis: body.crisis ?? false,
        });
      }
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errSave"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    // Modo captação: os dados já foram coletados no início, então a tela de
    // resultado mostra APENAS o snapshot (score + faixa + interpretação + notas
    // condicionais + CTA + rodapés). Sem convite de contato pós-score.
    if (publicMode) {
      const r = result ?? {
        total_score: totalScore,
        max_possible_score: maxPossible,
        score_percentage: percentage,
        band: null as ScoreBand | null,
        safety_flags: null as SafetyFlags | null,
      };
      const band = r.band;
      const bandColor = band?.color || "#0F6E56";
      const flags = r.safety_flags;
      return (
        <div className="space-y-[16px]">
          {/* CRISE (PHQ-9 ideação): recursos de apoio no TOPO, antes de tudo. */}
          {r.crisis && (
            <div className="rounded-[16px] px-[20px] py-[18px] bg-[#FEF3F2] border-2 border-[#FDA29B] dark:bg-[#3B1418] dark:border-[#F04438]">
              <p className="text-[15px] font-semibold text-[#B42318] dark:text-[#FDA29B] mb-[6px]">{t("result.crisisTitle")}</p>
              <p className="text-[13px] text-[#7A271A] dark:text-[#FECDCA] leading-relaxed whitespace-pre-line">{t("result.crisisBody")}</p>
            </div>
          )}
          {/* Cartão de resultado FINAL (copy Aval): snapshot + score + faixa. */}
          <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[16px] px-[24px] py-[28px]">
            <h2 className="text-[20px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-[4px] text-center">
              {t("result.heading")}
            </h2>

            {/* "Your score: {score} of {max} ({percent}% — {band})" */}
            <p className="text-[13px] text-[#4A4A46] dark:text-[#C9C7C2] text-center mb-[16px]">
              {t("result.scoreLine", {
                score: r.total_score,
                max: r.max_possible_score,
                percent: r.score_percentage,
                band: band?.label ?? "—",
              })}
            </p>

            <div className="h-[6px] rounded-full bg-[#F4F3EF] dark:bg-white/[.08] overflow-hidden max-w-[320px] mx-auto">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${r.score_percentage}%`, backgroundColor: bandColor }}
              />
            </div>

            {/* Descrição da faixa (band description do scoring_config). */}
            {band?.description && (
              <div
                className="mt-[20px] rounded-[12px] px-[16px] py-[14px]"
                style={{ backgroundColor: `${bandColor}14`, border: `1px solid ${bandColor}33` }}
              >
                <div className="flex items-center gap-[8px] mb-[6px]">
                  <span
                    className="inline-block w-[10px] h-[10px] rounded-full shrink-0"
                    style={{ backgroundColor: bandColor }}
                  />
                  <p className="text-[14px] font-semibold" style={{ color: bandColor }}>
                    {band.label}
                  </p>
                </div>
                <p className="text-[13px] text-[#4A4A46] dark:text-[#C9C7C2] leading-relaxed">{band.description}</p>
              </div>
            )}

            {/* "What this means" */}
            <div className="mt-[20px]">
              <p className="text-[13px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-[4px]">
                {t("result.whatThisMeansTitle")}
              </p>
              <p className="text-[13px] text-[#4A4A46] dark:text-[#C9C7C2] leading-relaxed">
                {t("result.whatThisMeansBody")}
              </p>
            </div>

            {/* Notas de segurança CONDICIONAIS (A e C coexistem; B só sem A). */}
            {flags?.showA && (
              <div className="mt-[16px] rounded-[12px] px-[16px] py-[12px] bg-[#FDF6EC] border border-[#E9D8B0] dark:bg-amber-400/10 dark:border-amber-400/30">
                <p className="text-[13px] text-[#7A5B12] dark:text-amber-300 leading-relaxed">{t("result.noteA")}</p>
              </div>
            )}
            {flags?.showB && (
              <div className="mt-[16px] rounded-[12px] px-[16px] py-[12px] bg-[#FDF6EC] border border-[#E9D8B0] dark:bg-amber-400/10 dark:border-amber-400/30">
                <p className="text-[13px] text-[#7A5B12] dark:text-amber-300 leading-relaxed">{t("result.noteB")}</p>
              </div>
            )}
            {flags?.showC && (
              <div className="mt-[16px] rounded-[12px] px-[16px] py-[12px] bg-[#EAF4FB] border border-[#BBD9EC] dark:bg-sky-400/10 dark:border-sky-400/30">
                <p className="text-[13px] text-[#1E4C6B] dark:text-sky-300 leading-relaxed">{t("result.noteC")}</p>
              </div>
            )}

            {/* Fecho de contato (convite, sem preço/botão de agendamento). */}
            <div className="mt-[22px]">
              <p className="text-[13px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-[2px]">
                {t("result.ctaTitle")}
              </p>
              <p className="text-[13px] text-[#4A4A46] dark:text-[#C9C7C2] leading-relaxed mb-[12px]">
                {t("result.ctaBody")}
              </p>
              <div className="space-y-[6px]">
                <p className="text-[13px] text-[#4A4A46] dark:text-[#C9C7C2]">
                  {t("result.ctaCallLabel")}{" "}
                  <a
                    href={`tel:+1${CONTACT_PHONE_DIGITS}`}
                    className="font-semibold text-[#0F6E56] underline hover:text-[#085041] dark:text-[#9FE1CB] dark:hover:text-[#C6EDDF]"
                  >
                    {t("result.ctaCallNumber")}
                  </a>
                </p>
                <p className="text-[13px] text-[#4A4A46] dark:text-[#C9C7C2]">
                  {t("result.ctaVisitLabel")}{" "}
                  <a
                    href={CONTACT_SITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0F6E56] underline hover:text-[#085041] dark:text-[#9FE1CB] dark:hover:text-[#C6EDDF]"
                  >
                    {t("result.ctaVisitSite")}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Rodapés PERMANENTES (toda tela de resultado): disclaimer, 988, 18+. */}
          <div className="pt-[8px] space-y-[8px]">
            <p className="text-[11px] text-[#A09E98] dark:text-[#6B6A66] leading-relaxed text-center">
              {t("result.footerDisclaimer")}
            </p>
            <p className="text-[11px] text-[#A09E98] dark:text-[#6B6A66] leading-relaxed text-center">
              {t("result.footer988")}
            </p>
            <p className="text-[11px] text-[#A09E98] dark:text-[#6B6A66] leading-relaxed text-center">
              {t("result.footerAge")}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[16px] px-[24px] py-[40px] text-center">
        <div className="w-14 h-14 rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/20 flex items-center justify-center mx-auto mb-[16px]">
          <span className="text-[28px]">✓</span>
        </div>
        <h2 className="text-[20px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-[8px]">{t("doneTitle")}</h2>
        <p className="text-[13px] text-[#A09E98] dark:text-[#6B6A66] leading-relaxed">
          {t("doneDesc")}
        </p>
        <div className="mt-[24px] bg-[#F4F3EF] dark:bg-[#0B0F17] rounded-[12px] px-[16px] py-[12px]">
          <p className="text-[11px] text-[#A09E98] dark:text-[#6B6A66]">{t("totalScore")}</p>
          <p className="text-[28px] font-bold text-[#0F1A2E] dark:text-[#E8E6E2] tracking-[-0.04em]">
            {totalScore}<span className="text-[14px] text-[#A09E98] dark:text-[#6B6A66] font-normal">/{maxPossible}</span>
          </p>
          <div className="h-[4px] rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/20 mt-[6px] overflow-hidden">
            <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const scaleLabels = (template as any).scale_labels ?? DEFAULT_SCALE_LABELS;

  const fillPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <form onSubmit={submit} className="space-y-[16px]">
      {/* Progress indicator */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[16px] py-[12px]">
        <div className="flex items-center justify-between mb-[8px]">
          <p className="text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97]">
            {t("answeredOf", { answered: answeredCount, total: totalQuestions })}
          </p>
          <p className="text-[11px] font-semibold text-[#0F6E56] dark:text-[#9FE1CB]">{fillPercent}%</p>
        </div>
        <div className="h-[5px] rounded-full bg-[#F4F3EF] dark:bg-[#0B0F17] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0F6E56] transition-all duration-300"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>

      {/* Instructions */}
      {template.instructions && (
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[8px]">{template.instructions}</p>
          <div className="space-y-[3px]">
            {scaleLabels.map((label: string, i: number) => (
              <p key={i} className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">
                <span className="font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{i}</span> — {label}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {template.assessment_sections.map((section) => {
        const ss = sectionScores[section.id] ?? { score: 0, max: 0 };
        return (
          <div key={section.id} className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-[16px] py-[10px] bg-[#0F1A2E] dark:bg-[#1C2333]">
              <p className="text-[11px] font-medium tracking-[.08em] uppercase text-white/80">{section.title}</p>
              <div className="flex items-center gap-[4px]">
                <span className="text-[11px] font-semibold text-white">{ss.score}</span>
                <span className="text-[10px] text-white/40">/{ss.max}</span>
              </div>
            </div>
            <div className="divide-y divide-black/[.05] dark:divide-white/[.06]">
              {section.assessment_questions.map((q) => (
                <div key={q.id} className="px-[16px] py-[14px]">
                  <p className="text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] mb-[10px] leading-snug">{q.text}</p>
                  {q.question_type === "scale" && (
                    <ScaleInput
                      question={q}
                      value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : null}
                      onChange={(v) => setAnswer(q.id, v)}
                    />
                  )}
                  {q.question_type === "yes_no" && (
                    <div className="flex gap-[6px]">
                      {[{ label: t("no"), value: 0 }, { label: t("yes"), value: 1 }].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAnswer(q.id, opt.value)}
                          className={[
                            "px-[14px] py-[8px] rounded-[8px] text-[12px] font-medium border transition",
                            answers[q.id] === opt.value
                              ? "bg-[#0F6E56] border-[#0F6E56] text-white"
                              : "border-black/[.12] text-[#6B6A66] hover:border-[#0F6E56] bg-white dark:bg-[#161B26] dark:border-white/[.12] dark:text-[#9E9C97] dark:hover:border-[#0F6E56]",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.question_type === "text" && (
                    <textarea
                      rows={2}
                      value={typeof answers[q.id] === "string" ? String(answers[q.id]) : ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.12] dark:bg-[#1C2333] dark:text-[#E8E6E2] text-[13px] outline-none focus:border-[#0F6E56] dark:focus:border-[#0F6E56] resize-none transition"
                    />
                  )}
                  {q.question_type === "number" && (
                    <input
                      type="number"
                      min={q.min_score}
                      max={q.max_score}
                      value={typeof answers[q.id] === "number" ? String(answers[q.id]) : ""}
                      onChange={(e) => setAnswer(q.id, e.target.value ? Number(e.target.value) : null)}
                      className="w-24 px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.12] dark:bg-[#1C2333] dark:text-[#E8E6E2] text-[13px] text-center outline-none focus:border-[#0F6E56] dark:focus:border-[#0F6E56] transition"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Grand total */}
      <div className="bg-[#0F1A2E] dark:bg-[#1C2333] rounded-[12px] px-[16px] py-[14px]">
        <div className="flex items-baseline justify-between mb-[8px]">
          <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40">{t("total")}</p>
          <div className="flex items-baseline gap-[4px]">
            <span className="text-[26px] font-bold text-white tracking-[-0.04em]">{totalScore}</span>
            <span className="text-[12px] text-white/40">/{maxPossible}</span>
            <span className="ml-[8px] text-[14px] font-semibold text-[#0F6E56] dark:text-[#9FE1CB]">{percentage}%</span>
          </div>
        </div>
        <div className="h-[5px] rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[#0F6E56] transition-all" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Observations */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] px-[16px] py-[14px]">
        <label className="text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-[6px] block">
          {t("notesLabel")}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t("notesPlaceholder")}
          className="w-full resize-none rounded-[8px] border border-black/[.10] dark:border-white/[.12] dark:bg-[#1C2333] dark:text-[#E8E6E2] px-[10px] py-[8px] text-[13px] placeholder:text-[#D3D1C7] dark:placeholder:text-[#6B6A66] outline-none focus:border-[#0F6E56] dark:focus:border-[#0F6E56] transition"
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[8px] px-[12px] py-[10px]">
          <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {missingRequired > 0 && (
        <p className="text-[12px] text-[#8A5A06] dark:text-amber-300 bg-[#FDF8EE] dark:bg-amber-400/10 border border-[#E9D8B0] dark:border-amber-400/30 rounded-[8px] px-[11px] py-[8px] text-center">
          {t("answerAll", { count: missingRequired })}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || advancing || missingRequired > 0}
        className="w-full text-[14px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[10px] py-[13px] transition"
      >
        {submitting || advancing ? t("submitting") : chain.length > 0 ? t("next") : t("submit")}
      </button>
    </form>
  );
}
