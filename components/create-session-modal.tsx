"use client";

import { useRouter } from "next/navigation";
import type { PatientLite } from "@/services/patient-service";
import { useState, useTransition, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X, Search, UserPlus, Settings2, Copy, Check, Link2, Mail } from "lucide-react";
import type { Patient, SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import { buildStartsAtForToday, buildStartsAtForDate } from "@/modules/schedule/time-slots";

type ConfirmLinkResult = { url?: string; phone?: string | null; email?: string | null; patientName?: string; error?: string };

export function CreateSessionModal({
  slot,
  patients,
  sessionTypes,
  onClose,
  action,
  confirmLinkAction,
  emailLinkAction,
}: {
  slot: TimeSlot | null;
  patients: PatientLite[];
  sessionTypes: SessionType[];
  onClose: () => void;
  action: (formData: FormData) => Promise<void>;
  confirmLinkAction?: (formData: FormData) => Promise<ConfirmLinkResult>;
  emailLinkAction?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const t = useTranslations("schedule.modal");
  const tCommon = useTranslations("common.actions");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  // If no session types are configured, fall back to a default 60-min slot
  const DEFAULT_TYPE: SessionType = {
    id: "", clinic_id: "", name: t("defaultType"), duration_minutes: 60,
    price_cents: 0, is_active: true, is_online: false, is_recorded: false,
    created_at: "", updated_at: "",
  };
  const [selectedType, setSelectedType] = useState<SessionType | null>(sessionTypes[0] ?? DEFAULT_TYPE);
  const inputRef = useRef<HTMLInputElement>(null);

  // Modo: confirmar agora (cria a sessão) x enviar link de confirmação ao paciente
  const canSendLink = !!confirmLinkAction;
  const [mode, setMode] = useState<"now" | "link">("now");
  const [linkResult, setLinkResult] = useState<{ url: string; phone: string | null; email: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!slot) return null;

  const dateLabel = slot.date
    ? `${slot.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} · ${slot.label}`
    : slot.label;

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWhatsApp(phone: string, url: string) {
    const digits = phone.replace(/\D/g, "");
    const msg = t("waMessage", { url });
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  function sendEmail(email: string, url: string) {
    if (!emailLinkAction) return;
    setEmailState("sending");
    const fd = new FormData();
    fd.set("email", email);
    fd.set("url", url);
    fd.set("date_label", dateLabel);
    startTransition(async () => {
      const res = await emailLinkAction(fd);
      setEmailState(res.ok ? "sent" : "error");
    });
  }

  const filtered = query.trim().length > 0
    ? patients.filter((p) =>
        p.full_name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  function pickPatient(patient: PatientLite) {
    setSelectedPatient(patient);
    setQuery(patient.full_name);
  }

  function switchToNew() {
    setIsNewPatient(true);
    setSelectedPatient(null);
    setQuery("");
    // Pre-fill name from search query if user typed something
    if (query.trim()) setNewName(query.trim());
  }

  function switchToExisting() {
    setIsNewPatient(false);
    setNewName(""); setNewEmail(""); setNewPhone("");
  }

  function submit(formData: FormData) {
    if (!selectedType) return;
    setError(null);
    if (isNewPatient) {
      if (!newName.trim()) return;
      formData.set("new_patient_name", newName.trim());
      formData.set("new_patient_email", newEmail.trim());
      formData.set("new_patient_phone", newPhone.trim());
    } else {
      if (!selectedPatient) return;
      formData.set("patient_id", selectedPatient.id);
    }
    formData.set("duration_minutes", String(selectedType.duration_minutes));
    if (selectedType.id) formData.set("session_type_id", selectedType.id);

    if (mode === "link" && confirmLinkAction) {
      startTransition(async () => {
        const res = await confirmLinkAction(formData);
        if (res.error || !res.url) {
          setError(res.error ?? t("linkError"));
          return;
        }
        setLinkResult({ url: res.url, phone: res.phone ?? null, email: res.email ?? null });
        router.refresh();
      });
      return;
    }

    startTransition(async () => {
      await action(formData);
      onClose();
      router.refresh();
    });
  }

  const canSubmit = !!selectedType && !isPending &&
    (isNewPatient ? newName.trim().length > 0 : !!selectedPatient);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("cancel")}
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1A2E]/30 backdrop-blur-[2px]"
      />

      {linkResult ? (
        <div className="relative w-full max-w-[420px] bg-white dark:bg-[#111827] rounded-[16px] border border-black/[.08] dark:border-white/[.08] shadow-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">{t("linkReadyTitle")}</p>
              <h2 className="text-[16px] font-medium tracking-[-0.02em] text-[#0F1A2E] dark:text-[#E8E6E2] mt-[2px] capitalize">{dateLabel}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tCommon("close")}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97] mb-3 leading-relaxed">{t("linkReadyDesc")}</p>

          {/* Link + copiar */}
          <div className="flex items-center gap-[6px] mb-3">
            <span className="flex-1 text-[11px] font-mono text-[#6B6A66] dark:text-[#9E9C97] bg-[#F4F3EF] dark:bg-white/[.06] rounded-[6px] px-[10px] py-[8px] truncate">
              {linkResult.url}
            </span>
            <button
              type="button"
              onClick={() => copyLink(linkResult.url)}
              className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[7px] px-[10px] py-[8px] transition shrink-0"
            >
              {copied ? <><Check className="h-3 w-3" />{t("copied")}</> : <><Copy className="h-3 w-3" />{t("copy")}</>}
            </button>
          </div>

          {/* Envio rápido */}
          <div className="space-y-[7px]">
            {linkResult.phone && (
              <button
                type="button"
                onClick={() => openWhatsApp(linkResult.phone!, linkResult.url)}
                className="w-full flex items-center justify-center gap-[7px] text-[12px] font-medium text-white bg-[#25D366] hover:opacity-90 rounded-[8px] py-[9px] transition"
              >
                <Link2 className="h-3.5 w-3.5" />{t("sendWhatsApp")}
              </button>
            )}
            {linkResult.email && (
              <button
                type="button"
                disabled={emailState === "sending" || emailState === "sent"}
                onClick={() => sendEmail(linkResult.email!, linkResult.url)}
                className="w-full flex items-center justify-center gap-[7px] text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] border border-black/[.12] dark:border-white/[.12] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] disabled:opacity-50 rounded-[8px] py-[9px] transition"
              >
                <Mail className="h-3.5 w-3.5" />
                {emailState === "sent" ? t("emailSent") : emailState === "sending" ? t("emailSending") : emailState === "error" ? t("emailError") : t("sendEmail")}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] rounded-[8px] py-[9px] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
          >
            {t("done")}
          </button>
        </div>
      ) : (
      <form
        action={submit}
        className="relative w-full max-w-[420px] bg-white dark:bg-[#111827] rounded-[16px] border border-black/[.08] dark:border-white/[.08] shadow-xl p-6"
      >
        <input
          type="hidden"
          name="starts_at"
          value={
            slot.date
              ? buildStartsAtForDate(slot.date, slot.hour, slot.minute)
              : buildStartsAtForToday(slot.hour, slot.minute)
          }
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">{t("title")}</p>
            <h2 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2] mt-[2px]">
              {slot.label}
              {slot.date && (
                <span className="ml-2 text-[13px] font-normal text-[#A09E98]">
                  {slot.date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Patient section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-[6px]">
            <label className="text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97]">{t("patient")}</label>
            <div className="flex rounded-[7px] border border-black/[.08] dark:border-white/[.08] overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={switchToExisting}
                className={`px-3 py-1 transition font-medium ${!isNewPatient ? "bg-[#0F1A2E] dark:bg-white/[.10] text-white" : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]"}`}
              >
                {t("existing")}
              </button>
              <button
                type="button"
                onClick={switchToNew}
                className={`px-3 py-1 transition font-medium ${isNewPatient ? "bg-[#0F1A2E] dark:bg-white/[.10] text-white" : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]"}`}
              >
                {t("new")}
              </button>
            </div>
          </div>

          {/* Existing patient search */}
          {!isNewPatient && (
            <>
              <div className="relative">
                <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#A09E98] pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (selectedPatient && e.target.value !== selectedPatient.full_name) {
                      setSelectedPatient(null);
                    }
                  }}
                  placeholder={t("searchPlaceholder")}
                  autoComplete="off"
                  className="w-full pl-[30px] pr-3 py-[9px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] dark:bg-transparent text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                />
              </div>

              {query.trim().length > 0 && !selectedPatient && (
                <div className="mt-[4px] bg-white dark:bg-[#111827] border border-black/[.08] dark:border-white/[.08] rounded-[8px] overflow-hidden shadow-sm">
                  {filtered.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => pickPatient(patient)}
                      className="w-full text-left px-[12px] py-[9px] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition flex items-center gap-[8px] border-b border-black/[.05] dark:border-white/[.05]"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[9px] font-medium text-[#0F6E56] shrink-0">
                        {patient.full_name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{patient.full_name}</p>
                        {patient.email && <p className="text-[10px] text-[#A09E98]">{patient.email}</p>}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <button
                      type="button"
                      onClick={switchToNew}
                      className="w-full text-left px-[12px] py-[9px] hover:bg-[#F0FAF6] dark:hover:bg-[#0F6E56]/[.10] transition flex items-center gap-[8px]"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center shrink-0">
                        <UserPlus className="h-3 w-3 text-[#0F6E56]" />
                      </div>
                      <p className="text-[12px] font-medium text-[#0F6E56]">{t("registerNew")}</p>
                    </button>
                  )}
                </div>
              )}

              {selectedPatient && (
                <div className="mt-[4px] flex items-center gap-[8px] px-[10px] py-[7px] bg-[#E1F5EE] dark:bg-[#0F6E56]/[.15] rounded-[8px]">
                  <span className="text-[12px] text-[#085041] dark:text-[#9FE1CB] font-medium flex-1">{selectedPatient.full_name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedPatient(null); setQuery(""); inputRef.current?.focus(); }}
                    className="text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* New patient inline form */}
          {isNewPatient && (
            <div className="space-y-[8px]">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] dark:bg-transparent text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
              />
              <div className="grid grid-cols-2 gap-[6px]">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] dark:bg-transparent text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                />
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] dark:border-white/[.10] dark:bg-transparent text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                />
              </div>
              <p className="text-[10px] text-[#A09E98]">{t("newHint")}</p>
            </div>
          )}
        </div>

        {/* Treatment type */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-[6px]">
            <label className="text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97]">{t("treatmentType")}</label>
            <button
              type="button"
              onClick={() => router.push("/settings/session-types")}
              className="flex items-center gap-[4px] text-[10px] text-[#A09E98] hover:text-[#0F6E56] transition"
            >
              <Settings2 className="h-3 w-3" />
              {t("editList")}
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-[5px] pr-[2px]">
            {sessionTypes.length === 0 ? (
              <div className="px-[12px] py-[9px] rounded-[8px] border border-[#0F6E56] bg-[#F0FAF6] dark:bg-[#0F6E56]/[.12] flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#0F6E56]">{t("defaultType")}</span>
                <span className="text-[11px] text-[#0F6E56]">{t("minutes", { count: 60 })}</span>
              </div>
            ) : sessionTypes.map((type) => {
              const isSelected = selectedType?.id === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={[
                    "w-full flex items-center justify-between px-[12px] py-[9px] rounded-[8px] border text-left transition",
                    isSelected
                      ? "border-[#0F6E56] bg-[#F0FAF6] dark:bg-[#0F6E56]/[.12]"
                      : "border-black/[.08] dark:border-white/[.08] hover:border-black/[.16] dark:hover:border-white/[.24] bg-white dark:bg-[#111827]",
                  ].join(" ")}
                >
                  <span className={`text-[12px] font-medium ${isSelected ? "text-[#0F6E56]" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>
                    {type.name}
                  </span>
                  <span className={`text-[11px] ${isSelected ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>
                    {t("minutes", { count: type.duration_minutes })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode toggle: confirmar agora x enviar link */}
        {canSendLink && (
          <div className="mb-4">
            <div className="flex rounded-[8px] border border-black/[.08] dark:border-white/[.08] overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={() => setMode("now")}
                className={`flex-1 px-3 py-[7px] transition font-medium ${mode === "now" ? "bg-[#0F1A2E] dark:bg-white/[.10] text-white" : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]"}`}
              >
                {t("modeNow")}
              </button>
              <button
                type="button"
                onClick={() => setMode("link")}
                className={`flex-1 px-3 py-[7px] transition font-medium ${mode === "link" ? "bg-[#0F1A2E] dark:bg-white/[.10] text-white" : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]"}`}
              >
                {t("modeLink")}
              </button>
            </div>
            {mode === "link" && (
              <p className="text-[10px] text-[#A09E98] mt-[6px]">{t("modeLinkHint")}</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-[12px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-[8px] px-[11px] py-[8px] mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] rounded-[8px] py-[9px] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] py-[9px] transition"
          >
            {isPending ? t("saving") : mode === "link" ? t("sendLink") : t("confirm")}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
