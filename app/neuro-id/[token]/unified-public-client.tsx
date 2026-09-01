"use client";

import { useState } from "react";
import NeuroIdUnifiedForm from "@/components/neuroid-unified-form";
import { formChrome, type FormLocale } from "@/modules/neuro-id/form-i18n";
import { submitUnifiedFormPublicAction } from "./actions";

type AnswerMap = Record<string, number | string | string[]>;
type Kind = "patient" | "public";

/**
 * Client do LINK do formulário unificado. Renderiza o componente rico em modo
 * `patientFacing` (sem pirâmide ao vivo). Fluxo:
 *  - convite de paciente: preenche → envia → agradece;
 *  - link público: preenche → dados de contato + consentimento → envia → agradece.
 *
 * O idioma inicial vem do `patients.locale` (default pt-BR); a 1ª pergunta do
 * formulário ("Em qual idioma…") troca o idioma AO VIVO de todo o cabeçalho e
 * das perguntas, para o paciente que prefere outro idioma se virar sozinho.
 */
export default function UnifiedPublicClient({
  token,
  kind,
  locale: initialLocale = "pt-BR",
  clinicName = "",
  patientName = null,
}: {
  token: string;
  kind: Kind;
  locale?: FormLocale;
  clinicName?: string;
  patientName?: string | null;
}) {
  const [locale, setLocale] = useState<FormLocale>(initialLocale);
  const chrome = formChrome(locale);
  const greeting =
    kind === "patient" && patientName
      ? chrome.greetingNamed.replace("{name}", patientName.split(/\s+/)[0])
      : chrome.greetingAnon;
  const [step, setStep] = useState<"form" | "contact" | "done" | "error">("form");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contato (só link público)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  async function send(a: AnswerMap, contact?: Parameters<typeof submitUnifiedFormPublicAction>[2]) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await submitUnifiedFormPublicAction(token, a, contact);
      if (r.ok) setStep("done");
      else {
        setError(r.error ?? chrome.sendError);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : chrome.sendFailed);
    } finally {
      setSaving(false);
    }
  }

  function handleComplete(a: AnswerMap) {
    setAnswers(a);
    if (kind === "public") {
      setStep("contact");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      void send(a);
    }
  }

  // Cabeçalho e rodapé vivem no client para acompanhar a troca de idioma ao vivo.
  const header = (
    <div className="mx-auto mb-2 max-w-6xl px-4">
      {clinicName && (
        <p className="text-[11px] font-medium uppercase tracking-[.10em] text-[#A09E98] dark:text-[#6B6A66]">{clinicName}</p>
      )}
      <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E] dark:text-[#E8E6E2]">
        {chrome.headerTitle}
      </h1>
      <p className="mt-[2px] text-[13px] text-[#A09E98] dark:text-[#6B6A66]">{greeting}</p>
    </div>
  );
  const footer = (
    <p className="mx-auto mt-6 max-w-6xl px-4 text-center text-[11px] text-[#D3D1C7] dark:text-white/20">
      {chrome.footerPrivacy}
    </p>
  );

  if (step === "done") {
    return (
      <>
        {header}
        <div className="mx-auto max-w-xl rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="mb-2 text-2xl">✅</p>
          <h2 className="mb-1 text-lg font-semibold text-emerald-900 dark:text-emerald-200">{chrome.done.title}</h2>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80">
            {chrome.done.desc}
          </p>
        </div>
        {footer}
      </>
    );
  }

  return (
    <>
      {header}
      <div>
      {error && (
        <div className="mx-auto mb-3 max-w-2xl rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30">{error}</div>
      )}

      {step === "form" && (
        <NeuroIdUnifiedForm
          patientFacing
          locale={locale}
          onLocaleChange={setLocale}
          completeLabel={kind === "public" ? chrome.continueLabel : chrome.submitAnswersLabel}
          onComplete={handleComplete}
        />
      )}

      {step === "contact" && (
        <form
          className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          onSubmit={(e) => {
            e.preventDefault();
            void send(answers, {
              full_name: fullName,
              email,
              phone: phone || null,
              date_of_birth: dob || null,
              consent,
              website: website || null,
            });
          }}
        >
          <h2 className="mb-1 text-lg font-semibold">{chrome.contact.title}</h2>
          <p className="mb-4 text-sm text-neutral-500">{chrome.contact.desc}</p>

          {/* honeypot invisível */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{chrome.contact.fullName}</span>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{chrome.contact.email}</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </label>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{chrome.contact.phone}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{chrome.contact.birth}</span>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </label>
          </div>
          <label className="mb-4 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>{chrome.contact.consent}</span>
          </label>

          <button
            type="submit"
            disabled={saving || !consent}
            className="w-full rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? chrome.contact.sending : chrome.contact.submit}
          </button>
        </form>
      )}
      </div>
      {footer}
    </>
  );
}
