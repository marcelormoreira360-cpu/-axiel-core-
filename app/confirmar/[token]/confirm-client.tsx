"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, CalendarClock, Loader2, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
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
}) {
  const t = useTranslations("confirmBooking");
  const locale = useLocale();
  const showCpf = locale === "pt-BR";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [questionnaires, setQuestionnaires] = useState<{ name: string; token: string }[]>([]);

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
    startTransition(async () => {
      const res = await confirmAppointmentAction(fd);
      if (res.error) setError(res.error);
      else if (res.success) { setQuestionnaires(res.questionnaires ?? []); setDone(true); }
    });
  }

  // ── Estados terminais ──
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
