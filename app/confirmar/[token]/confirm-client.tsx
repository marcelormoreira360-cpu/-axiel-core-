"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, CalendarClock, Loader2, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { TemplateWithStructure } from "@/lib/types";
import { confirmAppointmentAction } from "./actions";

export function ConfirmClient({
  token,
  invalid,
  clinicName,
  logoUrl,
  primaryColor,
  startsAt,
  durationMinutes,
  sessionTypeName,
  patientName,
  patientEmail,
  patientPhone,
  intakeForms = [],
}: {
  token: string;
  invalid: boolean;
  clinicName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  startsAt: string | null;
  durationMinutes: number | null;
  sessionTypeName: string | null;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  /** Questionários de intake para responder ANTES dos dados (obrigatórios). */
  intakeForms?: TemplateWithStructure[];
}) {
  const t = useTranslations("confirmBooking");
  const locale = useLocale();
  const showCpf = locale === "pt-BR";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [questionnaires, setQuestionnaires] = useState<{ name: string; token: string }[]>([]);
  // Wizard questionário-primeiro: phase 0..N-1 = cada questionário; N = dados.
  const [phase, setPhase] = useState(0);
  // Respostas por template: { [templateId]: { [questionId]: number|string } }.
  const [formAnswers, setFormAnswers] = useState<Record<string, Record<string, number | string>>>({});

  function setAns(tplId: string, qId: string, v: number | string) {
    setFormAnswers((prev) => ({ ...prev, [tplId]: { ...(prev[tplId] ?? {}), [qId]: v } }));
  }

  // Ao trocar de questionário (ou ir para os dados), abre no TOPO. O efeito roda
  // depois do render, então o novo conteúdo já existe (scrollTo dentro do clique
  // corria antes de renderizar e o paciente caía no fim da página anterior).
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [phase]);

  // Faltam obrigatórias no questionário atual? (scale/yes_no/number sempre; texto só se is_required)
  function missingInForm(tpl: TemplateWithStructure): number {
    const a = formAnswers[tpl.id] ?? {};
    let missing = 0;
    for (const s of tpl.assessment_sections) {
      for (const q of s.assessment_questions) {
        const v = a[q.id];
        const isText = q.question_type === "text";
        const answered = isText ? typeof v === "string" && v.trim().length > 0 : typeof v === "number";
        if ((!isText || q.is_required) && !answered) missing++;
      }
    }
    return missing;
  }

  // Monta o payload de respostas (todas as fases) para enviar junto da confirmação.
  function buildResponsesPayload() {
    return intakeForms.map((tpl) => {
      const a = formAnswers[tpl.id] ?? {};
      const answers: { question_id: string; section_id: string | null; value_number: number | null; value_text: string | null }[] = [];
      const section_scores: Record<string, { title: string; score: number; max: number }> = {};
      let total = 0;
      let max = 0;
      for (const s of tpl.assessment_sections) {
        let ss = 0;
        let sm = 0;
        for (const q of s.assessment_questions) {
          const v = a[q.id];
          const isText = q.question_type === "text";
          answers.push({
            question_id: q.id,
            section_id: s.id,
            value_number: !isText && typeof v === "number" ? v : null,
            value_text: isText && typeof v === "string" ? v : null,
          });
          if (!isText) {
            if (typeof v === "number") { ss += v; total += v; }
            sm += q.max_score;
            max += q.max_score;
          }
        }
        section_scores[s.id] = { title: s.title, score: ss, max: sm };
      }
      return { template_id: tpl.id, answers, section_scores, total_score: total, max_possible_score: max, notes: null };
    });
  }

  const dateStr = startsAt
    ? new Date(startsAt).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const timeStr = startsAt
    ? new Date(startsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : "";

  const labelCls = "block text-[12px] font-medium text-[#0F1A2E] mb-[5px]";
  const inputCls =
    "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[11px] py-[9px] outline-none focus:border-[#0F6E56]/50 transition";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("token", token);
    if (intakeForms.length > 0) fd.set("responses", JSON.stringify(buildResponsesPayload()));
    startTransition(async () => {
      const res = await confirmAppointmentAction(fd);
      if (res.error) setError(res.error);
      else if (res.success) { setQuestionnaires(res.questionnaires ?? []); setDone(true); }
    });
  }

  // ── Estados terminais ──
  // IMPORTANTE: `done` (sucesso do cliente) vem ANTES de `invalid`. Ao confirmar,
  // o server action re-renderiza a página e o agendamento já não está "pending",
  // então `invalid` viraria true e mostraria "Link indisponível" por cima do
  // sucesso. Checando `done` primeiro, o paciente vê a confirmação, não o erro.
  if (done) {
    return (
      <main className="min-h-screen bg-[#F4F3EF] flex items-center justify-center px-[16px] py-[40px]">
        <div className="w-full max-w-[440px] bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[40px] text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-[14px]" style={{ color: primaryColor }} />
          <h1 className="text-[18px] font-medium text-[#0F1A2E] mb-[6px]">{t("doneTitle")}</h1>
          <p className="text-[13px] text-[#6B6A66] leading-relaxed mb-3">{t("doneDesc")}</p>
          <p className="text-[13px] font-medium text-[#0F1A2E] capitalize">{dateStr} · {timeStr}</p>

          {questionnaires.length > 0 && (() => {
            const startUrl =
              `/f/${questionnaires[0].token}` +
              (questionnaires.length > 1
                ? `?chain=${questionnaires.slice(1).map((q) => q.token).join(",")}`
                : "");
            return (
              <div className="mt-5 text-left border-t border-black/[.07] pt-4">
                <p className="text-[13px] font-medium text-[#0F1A2E] mb-[2px]">{t("questionnairesTitle")}</p>
                <p className="text-[12px] text-[#6B6A66] mb-3">{t("questionnairesHint")}</p>
                <ul className="mb-3 space-y-[4px]">
                  {questionnaires.map((q, i) => (
                    <li key={q.token} className="text-[12px] text-[#0F1A2E] flex items-center gap-[6px]">
                      <span className="text-[#A09E98]">{i + 1}.</span> {q.name}
                    </li>
                  ))}
                </ul>
                <a
                  href={startUrl}
                  className="flex items-center justify-center gap-[7px] rounded-[9px] px-[14px] py-[11px] text-white text-[13px] font-medium"
                  style={{ background: primaryColor }}
                >
                  {t("openQuestionnaire")} →
                </a>
              </div>
            );
          })()}
        </div>
      </main>
    );
  }

  if (invalid) {
    return (
      <main className="min-h-screen bg-[#F4F3EF] flex items-center justify-center px-[16px] py-[40px]">
        <div className="w-full max-w-[440px] bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[36px] text-center">
          <AlertCircle className="h-9 w-9 mx-auto mb-[12px] text-[#B42318]" />
          <h1 className="text-[17px] font-medium text-[#0F1A2E] mb-[6px]">{t("invalidTitle")}</h1>
          <p className="text-[13px] text-[#6B6A66] leading-relaxed">{t("invalidDesc")}</p>
        </div>
      </main>
    );
  }

  // ── Fase de QUESTIONÁRIO (antes dos dados) ──────────────────────────────────
  if (!done && intakeForms.length > 0 && phase < intakeForms.length) {
    const tpl = intakeForms[phase];
    const a = formAnswers[tpl.id] ?? {};
    const missing = missingInForm(tpl);
    const scaleLabels = ((tpl as unknown as { scale_labels?: string[] }).scale_labels) ?? null;
    function advance() {
      if (missing > 0) { setError(t("answerAllShort")); return; }
      setError(null);
      setPhase((p) => p + 1); // o scroll-to-top é feito pelo useEffect([phase])
    }
    return (
      <main className="min-h-screen bg-[#F4F3EF] px-[16px] py-[36px]">
        <div className="w-full max-w-[560px] mx-auto">
          <div className="flex justify-end mb-[10px]"><LanguageSwitcher /></div>
          <div className="text-center mb-[16px]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={clinicName ?? ""} className="h-[40px] mx-auto mb-[10px] object-contain" />
            ) : null}
            <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">
              {t("stepOf", { current: phase + 1, total: intakeForms.length })}
            </p>
            <h1 className="text-[19px] font-medium tracking-[-0.02em] text-[#0F1A2E] mt-[2px]">{tpl.name}</h1>
            {tpl.instructions ? <p className="text-[12px] text-[#6B6A66] mt-[4px] whitespace-pre-line">{tpl.instructions}</p> : null}
          </div>

          <div className="space-y-[12px]">
            {tpl.assessment_sections.map((section) => (
              <div key={section.id} className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
                <div className="px-[16px] py-[9px] bg-[#0F1A2E]">
                  <p className="text-[11px] font-medium tracking-[.08em] uppercase text-white/80">{section.title}</p>
                </div>
                <div className="divide-y divide-black/[.05]">
                  {section.assessment_questions.map((q) => {
                    const v = a[q.id];
                    return (
                      <div key={q.id} className="px-[16px] py-[13px]">
                        <p className="text-[13px] text-[#0F1A2E] mb-[9px] leading-snug">{q.text}</p>
                        {q.question_type === "scale" && (
                          <div className="flex items-center gap-[4px] flex-wrap">
                            {Array.from({ length: q.max_score - q.min_score + 1 }, (_, i) => i + q.min_score).map((n) => (
                              <button key={n} type="button" onClick={() => setAns(tpl.id, q.id, n)}
                                className={["w-10 h-10 rounded-[8px] text-[13px] font-semibold border transition shrink-0",
                                  v === n ? "text-white border-transparent" : "border-black/[.12] text-[#6B6A66] bg-white hover:border-[#0F6E56]"].join(" ")}
                                style={v === n ? { background: primaryColor } : undefined}>{n}</button>
                            ))}
                          </div>
                        )}
                        {q.question_type === "yes_no" && (
                          <div className="flex gap-[6px]">
                            {[{ l: t("no"), val: 0 }, { l: t("yes"), val: 1 }].map((o) => (
                              <button key={o.val} type="button" onClick={() => setAns(tpl.id, q.id, o.val)}
                                className={["px-[14px] py-[8px] rounded-[8px] text-[12px] font-medium border transition",
                                  v === o.val ? "text-white border-transparent" : "border-black/[.12] text-[#6B6A66] bg-white hover:border-[#0F6E56]"].join(" ")}
                                style={v === o.val ? { background: primaryColor } : undefined}>{o.l}</button>
                            ))}
                          </div>
                        )}
                        {q.question_type === "number" && (
                          <input type="number" min={q.min_score} max={q.max_score}
                            value={typeof v === "number" ? String(v) : ""}
                            onChange={(e) => setAns(tpl.id, q.id, e.target.value ? Number(e.target.value) : "")}
                            className="w-24 px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-center outline-none focus:border-[#0F6E56]" />
                        )}
                        {q.question_type === "text" && (
                          <textarea rows={2} value={typeof v === "string" ? v : ""}
                            onChange={(e) => setAns(tpl.id, q.id, e.target.value)}
                            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] outline-none focus:border-[#0F6E56] resize-none" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {scaleLabels ? (
              <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[12px]">
                {scaleLabels.map((label: string, i: number) => (
                  <p key={i} className="text-[11px] text-[#6B6A66]"><span className="font-semibold text-[#0F1A2E]">{i}</span> — {label}</p>
                ))}
              </div>
            ) : null}
          </div>

          {error && <p className="mt-[12px] text-[12px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-[8px] px-[11px] py-[8px]">{error}</p>}

          <button type="button" onClick={advance} disabled={missing > 0}
            className="mt-[14px] w-full text-[13px] font-medium text-white rounded-[9px] px-[14px] py-[11px] disabled:opacity-40 transition"
            style={{ background: primaryColor }}>
            {t("next")}
          </button>
          {phase > 0 && (
            <button type="button" onClick={() => { setPhase((p) => p - 1); setError(null); }}
              className="mt-[8px] w-full text-[12px] text-[#6B6A66] hover:text-[#0F1A2E] transition">
              {t("back")}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F3EF] px-[16px] py-[36px]">
      <div className="w-full max-w-[560px] mx-auto">
        <div className="flex justify-end mb-[10px]">
          <LanguageSwitcher />
        </div>
        {/* Cabeçalho da clínica */}
        <div className="text-center mb-[20px]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={clinicName ?? ""} className="h-[44px] mx-auto mb-[12px] object-contain" />
          ) : (
            <div
              className="h-[44px] w-[44px] mx-auto mb-[12px] rounded-[10px] flex items-center justify-center text-white text-[18px] font-semibold"
              style={{ background: primaryColor }}
            >
              {(clinicName ?? "?").charAt(0)}
            </div>
          )}
          <h1 className="text-[20px] font-medium tracking-[-0.02em] text-[#0F1A2E]">{t("title")}</h1>
          <p className="text-[13px] text-[#6B6A66] mt-[3px]">{t("subtitle", { clinic: clinicName ?? "" })}</p>
        </div>

        {/* Horário proposto */}
        <div className="bg-white border border-[#0F6E56]/25 rounded-[14px] px-[20px] py-[16px] mb-[16px] flex items-center gap-[12px]">
          <div className="w-9 h-9 rounded-[9px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
            <CalendarClock className="h-[18px] w-[18px] text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[.06em] uppercase text-[#A09E98]">{t("proposedLabel")}</p>
            <p className="text-[15px] font-medium text-[#0F1A2E] capitalize">{dateStr}</p>
            <p className="text-[13px] text-[#6B6A66]">
              {timeStr}{durationMinutes ? ` · ${t("minutes", { count: durationMinutes })}` : ""}
              {sessionTypeName ? ` · ${sessionTypeName}` : ""}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-black/[.07] rounded-[14px] px-[22px] py-[24px] space-y-[18px]">
          {/* Dados pessoais */}
          <section className="space-y-[14px]">
            <p className="text-[11px] font-medium tracking-[.07em] uppercase text-[#A09E98]">{t("sectionPersonal")}</p>
            <div>
              <label className={labelCls} htmlFor="full_name">{t("fullName")} *</label>
              <input id="full_name" name="full_name" required defaultValue={patientName} maxLength={120} className={inputCls} autoComplete="name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <div>
                <label className={labelCls} htmlFor="email">{t("email")}</label>
                <input id="email" name="email" type="email" defaultValue={patientEmail} maxLength={160} className={inputCls} autoComplete="email" />
              </div>
              <div>
                <label className={labelCls} htmlFor="phone">{t("phone")}</label>
                <input id="phone" name="phone" type="tel" defaultValue={patientPhone} maxLength={40} className={inputCls} autoComplete="tel" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <div>
                <label className={labelCls} htmlFor="date_of_birth">{t("dob")}</label>
                <input id="date_of_birth" name="date_of_birth" type="date" className={inputCls} />
              </div>
              {showCpf && (
                <div>
                  <label className={labelCls} htmlFor="cpf">{t("cpf")}</label>
                  <input id="cpf" name="cpf" maxLength={20} className={inputCls} inputMode="numeric" />
                </div>
              )}
            </div>
          </section>

          {/* Endereço */}
          <section className="space-y-[14px] pt-[4px]">
            <p className="text-[11px] font-medium tracking-[.07em] uppercase text-[#A09E98]">{t("sectionAddress")}</p>
            <div>
              <label className={labelCls} htmlFor="address_line">{t("addressLine")}</label>
              <input id="address_line" name="address_line" maxLength={200} className={inputCls} autoComplete="street-address" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <div>
                <label className={labelCls} htmlFor="neighborhood">{t("neighborhood")}</label>
                <input id="neighborhood" name="neighborhood" maxLength={120} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="zip_code">{t("zip")}</label>
                <input id="zip_code" name="zip_code" maxLength={20} className={inputCls} autoComplete="postal-code" inputMode="numeric" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <div>
                <label className={labelCls} htmlFor="city">{t("city")}</label>
                <input id="city" name="city" maxLength={120} className={inputCls} autoComplete="address-level2" />
              </div>
              <div>
                <label className={labelCls} htmlFor="state">{t("state")}</label>
                <input id="state" name="state" maxLength={40} className={inputCls} autoComplete="address-level1" />
              </div>
            </div>
          </section>

          {/* Consentimentos */}
          <section className="space-y-[10px] pt-[6px]">
            <p className="text-[11px] font-medium tracking-[.07em] uppercase text-[#A09E98]">{t("sectionConsent")}</p>
            <label className="flex items-start gap-[9px] cursor-pointer">
              <input type="checkbox" name="consent_data" required className="mt-[2px] h-[15px] w-[15px] accent-[#0F6E56]" />
              <span className="text-[12px] text-[#6B6A66] leading-relaxed">{t("consentData")} *</span>
            </label>
            <label className="flex items-start gap-[9px] cursor-pointer">
              <input type="checkbox" name="consent_analytics" className="mt-[2px] h-[15px] w-[15px] accent-[#0F6E56]" />
              <span className="text-[12px] text-[#6B6A66] leading-relaxed">{t("consentAnalytics")}</span>
            </label>
          </section>

          {error && (
            <p className="text-[12px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-[8px] px-[11px] py-[8px]">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-[7px] text-[13px] font-medium text-white rounded-[9px] px-[14px] py-[11px] disabled:opacity-60 transition"
            style={{ background: primaryColor }}
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />{t("submitting")}</> : t("confirmSlot")}
          </button>

          <p className="text-[10px] text-[#A09E98] text-center leading-relaxed">{t("privacyNote")}</p>
        </form>
      </div>
    </main>
  );
}
