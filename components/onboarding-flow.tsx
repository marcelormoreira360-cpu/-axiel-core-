"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, ArrowRight, Brain, CheckCircle2, Clock,
  Dumbbell, Leaf, Sparkles, UserPlus, Heart, AlertCircle, Upload,
} from "lucide-react";
import { completeOnboardingAction } from "@/app/onboarding/actions";
import { track } from "@/lib/analytics";

// ── Step labels ───────────────────────────────────────────────────
const STEP_KEYS = ["profile", "name", "hours", "team"] as const;

// ── Data ──────────────────────────────────────────────────────────
const PROFILE_META = [
  { id: "integrativa",  icon: <Leaf className="h-5 w-5" /> },
  { id: "fisioterapia", icon: <Dumbbell className="h-5 w-5" /> },
  { id: "saude_mental", icon: <Brain className="h-5 w-5" /> },
  { id: "nutricao",     icon: <Heart className="h-5 w-5" /> },
  { id: "wellness",     icon: <Sparkles className="h-5 w-5" /> },
] as const;

const HOURS_KEYS = ["weekdays", "extended", "flexible"] as const;

// ── Component ─────────────────────────────────────────────────────
export function OnboardingFlow() {
  const router = useRouter();
  const t = useTranslations("onboarding.flow");

  const STEPS = STEP_KEYS.map((key) => t(`stepLabels.${key}`));
  const PROFILES = PROFILE_META.map((p) => ({
    ...p,
    label: t(`profiles.${p.id}.label`),
    examples: t(`profiles.${p.id}.examples`),
  }));
  const HOURS_OPTIONS = HOURS_KEYS.map((id) => ({
    id,
    label: t(`hours.${id}.label`),
    summary: t(`hours.${id}.summary`),
  }));
  const [actionState, formAction, isPending] = useActionState(completeOnboardingAction, null);

  const [step,          setStep]          = useState(0);
  const [clinicProfile, setClinicProfile] = useState("integrativa");
  const [clinicName,    setClinicName]    = useState("");
  const [hoursPreset,   setHoursPreset]   = useState("weekdays");
  const [staffEmail,    setStaffEmail]    = useState("");
  const [userEmail,     setUserEmail]     = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [logoFile, setLogoFile]           = useState<File | null>(null);
  const [logoPreview, setLogoPreview]     = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch current user email for self-invite guard
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return; // 2MB max
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const progress        = ((step + 1) / STEPS.length) * 100;
  const selectedProfile = PROFILES.find((p) => p.id === clinicProfile)!;
  const error           = actionState && "error" in actionState ? actionState.error : null;
  const success         = actionState && "success" in actionState;

  // Per-step validation
  const isSelfInvite = !!(staffEmail.trim() && userEmail && staffEmail.trim().toLowerCase() === userEmail.toLowerCase());
  const canAdvance = step === 1
    ? clinicName.trim().length >= 2   // name must have at least 2 chars
    : step === 3
    ? acceptedTerms                   // must accept terms on last step
    : true;

  // Navigate client-side on success (more reliable than server redirect with useActionState)
  useEffect(() => {
    if (success) {
      // Analytics: onboarding concluído — clínica criada com sucesso
      track("onboarding_completed", { clinic_profile: clinicProfile, invited_staff: !!staffEmail.trim() });
      router.push("/onboarding/ready");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clinicProfile/staffEmail só são lidos no momento do sucesso
  }, [success, router]);

  return (
    <div className="max-w-[640px] mx-auto space-y-[16px]">
      {/* Progress bar */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[16px]">
        <div className="flex items-center justify-between mb-[10px]">
          <span className="text-[11px] font-medium text-[#A09E98]">{t("progress", { current: step + 1, total: STEPS.length })}</span>
          <span className="text-[11px] font-medium text-[#A09E98]">{Math.round(progress)}%</span>
        </div>
        <div className="h-[4px] rounded-full bg-[#F4F3EF] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0F1A2E] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-[12px] grid grid-cols-4 gap-[6px]">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={[
                "rounded-full px-[10px] py-[5px] text-center text-[10px] font-medium transition",
                i <= step ? "bg-[#0F1A2E] text-white" : "bg-[#F4F3EF] text-[#A09E98]",
              ].join(" ")}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <form action={formAction}>
        {/* Hidden inputs mirror state so server action receives them */}
        <input type="hidden" name="clinic_name"    value={clinicName || selectedProfile.label} readOnly />
        <input type="hidden" name="clinic_profile" value={clinicProfile} readOnly />
        <input type="hidden" name="hours_preset"   value={hoursPreset} readOnly />
        <input type="hidden" name="staff_email"    value={staffEmail} readOnly />

        {/* ── Step 0 — Profile ─────────────────────────── */}
        {step === 0 && (
          <div className="space-y-[10px]">
            <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
              <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
                {t("stepProfile.eyebrow")}
              </p>
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
                {t("stepProfile.title")}
              </h2>
              <p className="text-[13px] text-[#A09E98] leading-relaxed">
                {t("stepProfile.subtitle")}
              </p>
            </div>

            <div className="space-y-[8px]">
              {PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setClinicProfile(profile.id)}
                  className={[
                    "w-full text-left rounded-[12px] border px-[18px] py-[14px] transition flex items-start gap-[14px]",
                    clinicProfile === profile.id
                      ? "border-[#0F6E56] bg-[#E1F5EE]"
                      : "border-black/[.07] bg-white hover:border-black/[.15]",
                  ].join(" ")}
                >
                  <div className={[
                    "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 mt-[1px]",
                    clinicProfile === profile.id ? "bg-[#0F6E56] text-white" : "bg-[#F4F3EF] text-[#6B6A66]",
                  ].join(" ")}>
                    {profile.icon}
                  </div>
                  <div className="flex-1">
                    <p className={[
                      "text-[14px] font-semibold mb-[2px]",
                      clinicProfile === profile.id ? "text-[#085041]" : "text-[#0F1A2E]",
                    ].join(" ")}>
                      {profile.label}
                    </p>
                    <p className={[
                      "text-[12px] leading-relaxed",
                      clinicProfile === profile.id ? "text-[#0F6E56]" : "text-[#A09E98]",
                    ].join(" ")}>
                      {profile.examples}
                    </p>
                  </div>
                  {clinicProfile === profile.id && (
                    <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0 mt-[2px]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1 — Clinic name ──────────────────── */}
        {step === 1 && (
          <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
            <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
              {selectedProfile.icon}
            </div>
            <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
              {t("stepName.eyebrow", { label: selectedProfile.label })}
            </p>
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
              {t("stepName.title")}
            </h2>
            <p className="text-[13px] text-[#A09E98] leading-relaxed mb-[20px]">
              {t("stepName.subtitle")}
            </p>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder={t("stepName.namePlaceholder", { label: selectedProfile.label })}
              maxLength={80}
              className="w-full px-[16px] py-[14px] rounded-[10px] border border-black/[.10] text-[18px] font-medium text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
            {clinicName.trim().length > 0 && clinicName.trim().length < 2 && (
              <p className="mt-2 text-[12px] text-red-500">{t("stepName.nameTooShort")}</p>
            )}

            {/* Logo (optional) */}
            <div className="mt-[20px]">
              <label className="block text-sm font-medium text-[#0F1A2E] mb-2">
                {t("stepName.logoLabel")} <span className="text-black/30 font-normal">{t("stepName.logoOptional")}</span>
              </label>
              <div
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-3 cursor-pointer border border-dashed border-black/20 hover:border-[#0F6E56] rounded-xl p-3 transition"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt={t("stepName.logoPreviewAlt")} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-[#F4F3EF] flex items-center justify-center shrink-0">
                    <Upload className="h-4 w-4 text-[#A09E98]" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-[#0F1A2E]">{logoPreview ? t("stepName.logoChange") : t("stepName.logoUpload")}</p>
                  <p className="text-xs text-black/40">{t("stepName.logoHint")}</p>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
              {/* Hidden input to pass logo data via form */}
              {logoFile && (
                <input type="hidden" name="logo_data_url" value={logoPreview ?? ""} />
              )}
            </div>
          </div>
        )}

        {/* ── Step 2 — Hours ───────────────────────── */}
        {step === 2 && (
          <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
            <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
              {t("stepHours.eyebrow")}
            </p>
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
              {t("stepHours.title")}
            </h2>
            <p className="text-[13px] text-[#A09E98] leading-relaxed mb-[20px]">
              {t("stepHours.subtitle")}
            </p>
            <div className="space-y-[8px]">
              {HOURS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setHoursPreset(opt.id)}
                  className={[
                    "w-full text-left rounded-[12px] border px-[18px] py-[14px] transition flex items-center justify-between",
                    hoursPreset === opt.id
                      ? "border-[#0F6E56] bg-[#E1F5EE]"
                      : "border-black/[.07] bg-[#FAFAF8] hover:border-black/[.15]",
                  ].join(" ")}
                >
                  <div>
                    <p className={[
                      "text-[14px] font-semibold",
                      hoursPreset === opt.id ? "text-[#085041]" : "text-[#0F1A2E]",
                    ].join(" ")}>
                      {opt.label}
                    </p>
                    <p className={[
                      "text-[12px] mt-[2px]",
                      hoursPreset === opt.id ? "text-[#0F6E56]" : "text-[#A09E98]",
                    ].join(" ")}>
                      {opt.summary}
                    </p>
                  </div>
                  {hoursPreset === opt.id && (
                    <CheckCircle2 className="h-4 w-4 text-[#0F6E56] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3 — Team ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-[12px]">
            <div className="bg-white border border-black/[.07] rounded-[14px] px-[24px] py-[28px]">
              <div className="w-10 h-10 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56] mb-[16px]">
                <UserPlus className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-medium tracking-[.10em] uppercase text-[#A09E98] mb-[6px]">
                {t("stepTeam.eyebrow")}
              </p>
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F1A2E] mb-[6px]">
                {t("stepTeam.title")}
              </h2>
              <p className="text-[13px] text-[#A09E98] leading-relaxed mb-[20px]">
                {t("stepTeam.subtitle")}
              </p>
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder={t("stepTeam.emailPlaceholder")}
                className={[
                  "w-full px-[16px] py-[14px] rounded-[10px] border text-[16px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none transition",
                  isSelfInvite ? "border-amber-400 focus:border-amber-500" : "border-black/[.10] focus:border-[#0F6E56]",
                ].join(" ")}
              />
              {isSelfInvite && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <p className="text-[12px] text-amber-700">
                    {t("stepTeam.selfInviteWarning")}
                  </p>
                </div>
              )}
            </div>

            {/* Summary card */}
            <div className="bg-[#0F1A2E] rounded-[12px] px-[18px] py-[16px] space-y-[10px]">
              <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40">
                {t("summary.title")}
              </p>
              {[
                t("summary.sessionTypes", { label: selectedProfile.label }),
                t("summary.anamnesisForm"),
                t("summary.demoData"),
                t("summary.schedule"),
              ].map((item) => (
                <div key={item} className="flex items-center gap-[8px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#0F6E56] shrink-0" />
                  <span className="text-[12px] text-white/70">{item}</span>
                </div>
              ))}
            </div>

            {/* LGPD consent */}
            <div className="bg-white border border-black/[.07] rounded-[12px] px-[18px] py-[14px]">
              <label className="flex items-start gap-[10px] cursor-pointer group">
                <div className="mt-[1px] shrink-0">
                  <div
                    onClick={() => setAcceptedTerms((v) => !v)}
                    className={[
                      "w-[16px] h-[16px] rounded-[4px] border-2 flex items-center justify-center transition",
                      acceptedTerms
                        ? "bg-[#0F6E56] border-[#0F6E56]"
                        : "border-black/[.20] group-hover:border-[#0F6E56]",
                    ].join(" ")}
                  >
                    {acceptedTerms && (
                      <svg className="w-[9px] h-[9px] text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-[#6B6A66] leading-relaxed">
                  {t.rich("terms", {
                    terms: (chunks) => (
                      <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline font-medium">
                        {chunks}
                      </a>
                    ),
                    privacy: (chunks) => (
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline font-medium">
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              </label>
            </div>
          </div>
        )}

        {/* ── Error banner — near the button so it's always visible ── */}
        {error && (
          <div className="mt-[12px] flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 px-[16px] py-[14px]">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-[1px]" />
            <p className="text-[13px] text-red-700 break-words">{error}</p>
          </div>
        )}

        {/* ── Success state ──────────────────────────── */}
        {success && (
          <div className="mt-[12px] flex items-center gap-3 rounded-[12px] border border-green-200 bg-green-50 px-[16px] py-[14px]">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-[13px] text-green-700">{t("successCreated")}</p>
          </div>
        )}

        {/* ── Navigation ──────────────────────────── */}
        <div className="mt-[12px] flex items-center justify-between bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[14px]">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || isPending || !!success}
            className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] disabled:opacity-30 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={isPending || !canAdvance}
              title={!canAdvance ? t("fillNameToContinue") : undefined}
              className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] rounded-[8px] px-[16px] py-[9px] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("continue")} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending || !!success}
              className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[9px] transition disabled:opacity-60"
            >
              {isPending || !!success ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {success ? t("redirecting") : t("creating")}
                </>
              ) : (
                <>{t("createClinic")} <CheckCircle2 className="h-3.5 w-3.5" /></>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
