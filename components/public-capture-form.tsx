"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TemplateWithStructure } from "@/lib/types";
import { PublicAssessmentForm, type PublicContact } from "@/components/public-assessment-form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fluxo do link PÚBLICO de captação: quem abre ainda NÃO é paciente.
 * Passo 1 — preenche os próprios dados (vira Lead). Passo 2 — responde o
 * questionário escolhido. O envio final vai junto com o cadastro.
 */
export function PublicCaptureForm({
  template,
  token,
}: {
  template: TemplateWithStructure;
  token: string;
}) {
  const t = useTranslations("publicForm");
  const [step, setStep] = useState<"contact" | "form">("contact");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot (fica escondido)
  const [error, setError] = useState<string | null>(null);

  const [contact, setContact] = useState<PublicContact | null>(null);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError(t("capture.nameRequired"));
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setError(t("capture.emailInvalid"));
      return;
    }
    if (!consent) {
      setError(t("capture.consentRequired"));
      return;
    }
    setContact({
      full_name: fullName.trim(),
      email: email.trim() ? email.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
      consent: true,
      website,
    });
    setStep("form");
  }

  if (step === "form" && contact) {
    return (
      <div>
        <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#0F6E56] mb-[12px]">
          {t("capture.step2")}
        </p>
        <PublicAssessmentForm template={template} token={token} contact={contact} publicMode />
      </div>
    );
  }

  return (
    <form onSubmit={handleContinue} className="space-y-[16px]">
      <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">
        {t("capture.step1")}
      </p>

      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[16px] space-y-[14px]">
        <div>
          <label className="text-[12px] font-medium text-[#0F1A2E] mb-[6px] block">
            {t("capture.fullName")} <span className="text-[#E53E3E]">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="w-full px-[12px] py-[10px] rounded-[8px] border border-black/[.12] text-[14px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#0F1A2E] mb-[6px] block">
            {t("capture.email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="w-full px-[12px] py-[10px] rounded-[8px] border border-black/[.12] text-[14px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#0F1A2E] mb-[6px] block">
            {t("capture.phone")}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            className="w-full px-[12px] py-[10px] rounded-[8px] border border-black/[.12] text-[14px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        {/* Honeypot: invisível para humanos, tentador para bots. */}
        <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-start gap-[8px] cursor-pointer pt-[2px]">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-[2px] h-[16px] w-[16px] shrink-0 accent-[#0F6E56]"
          />
          <span className="text-[12px] text-[#6B6A66] leading-relaxed">{t("capture.consent")}</span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[8px] px-[12px] py-[10px]">
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        className="w-full text-[14px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[10px] py-[13px] transition"
      >
        {t("capture.continue")}
      </button>

      <p className="text-center text-[11px] text-[#A09E98]">{t("capture.privacyNote")}</p>
    </form>
  );
}
