"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, ChevronLeft, ChevronRight, Clock, Check } from "lucide-react";
import type { PatientPortalSessionType } from "@/services/patient-portal-service";

type Slot = { time: string; iso: string };

interface PortalBookingModalProps {
  sessionTypes: PatientPortalSessionType[];
  clinicSlug: string;
  rawToken: string;
  brandColor: string;
  onClose: () => void;
  onSuccess: (appointmentId: string, startsAt: string) => void;
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmt(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function PortalBookingModal({
  sessionTypes,
  clinicSlug,
  rawToken,
  brandColor,
  onClose,
  onSuccess,
}: PortalBookingModalProps) {
  const t = useTranslations("portal.booking");
  const locale = useLocale();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<PatientPortalSessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate the next 14 days (starting tomorrow)
  const days: Date[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  // Fetch available slots whenever the date or session type changes
  useEffect(() => {
    if (!selectedDate || !selectedType) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setSlots([]);

    const dateStr = toYMD(selectedDate);
    fetch(`/api/book/${clinicSlug}/slots?date=${dateStr}&session_type_id=${selectedType.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => { cancelled = true; };
  }, [selectedDate, selectedType, clinicSlug]);

  async function handleBook() {
    if (!selectedType || !selectedSlot) return;
    setBooking(true);
    setError(null);

    try {
      const res = await fetch("/api/p/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: rawToken,
          session_type_id: selectedType.id,
          starts_at: selectedSlot.iso,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("errBook"));
        return;
      }

      setStep(3);
      onSuccess(data.appointment_id as string, selectedSlot.iso);
    } catch {
      setError(t("errConn"));
    } finally {
      setBooking(false);
    }
  }

  function goBack() {
    setError(null);
    setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  const stepTitle =
    step === 1 ? t("stepType")
    : step === 2 ? t("stepDate")
    : t("stepDone");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.07]">
          <div className="flex items-center gap-2">
            {step > 1 && step < 3 && (
              <button
                onClick={goBack}
                className="p-1 rounded-lg hover:bg-black/[.05] transition"
                aria-label={t("back")}
              >
                <ChevronLeft className="h-4 w-4 text-black/50" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-[#0F1A2E]">{stepTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/[.05] transition"
            aria-label={t("close")}
          >
            <X className="h-4 w-4 text-black/50" />
          </button>
        </div>

        {/* ── Modal body ───────────────────────────────────────────── */}
        <div className="p-5 max-h-[72vh] overflow-y-auto">

          {/* ── Step 1: Pick session type ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-2">
              {sessionTypes.map((st) => (
                <button
                  key={st.id}
                  onClick={() => { setSelectedType(st); setStep(2); }}
                  className="w-full text-left rounded-2xl border border-black/[.08] p-4 hover:border-black/20 hover:bg-black/[.02] transition group"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#0F1A2E] group-hover:text-black">{st.name}</p>
                    <ChevronRight className="h-4 w-4 text-black/30 group-hover:text-black/50 transition" />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-black/40">
                      <Clock className="h-3 w-3" />
                      {st.duration_minutes} {t("minUnit")}
                    </span>
                    {st.price_cents > 0 && (
                      <span className="text-xs text-black/40">{fmt(st.price_cents)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Pick date + slot ──────────────────────────── */}
          {step === 2 && selectedType && (
            <div className="space-y-5">
              {/* Session type recap chip */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs bg-black/[.03] rounded-xl px-3 py-2">
                <span className="font-semibold text-[#0F1A2E]">{selectedType.name}</span>
                <span className="text-black/30">·</span>
                <span className="text-black/50">{selectedType.duration_minutes} min</span>
                {selectedType.price_cents > 0 && (
                  <>
                    <span className="text-black/30">·</span>
                    <span className="text-black/50">{fmt(selectedType.price_cents)}</span>
                  </>
                )}
              </div>

              {/* Date picker */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40 mb-2">{t("dateLabel")}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {days.map((d) => {
                    const isSelected = selectedDate?.toDateString() === d.toDateString();
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => setSelectedDate(d)}
                        className={`shrink-0 flex flex-col items-center rounded-xl px-3 py-2.5 text-xs font-medium transition border ${
                          isSelected
                            ? "text-white border-transparent"
                            : "text-black/60 border-black/[.08] hover:border-black/20"
                        }`}
                        style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                      >
                        <span className="text-sm font-semibold">{d.getDate()}</span>
                        <span className="mt-0.5 text-[10px] opacity-70">
                          {d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot picker */}
              {selectedDate && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40 mb-2">
                    {t("slotLabel")}
                  </p>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 text-xs text-black/40 py-2">
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
                      {t("searching")}
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-black/40 py-2">
                      {t("noSlots")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map((slot) => {
                        const isSelected = selectedSlot?.iso === slot.iso;
                        return (
                          <button
                            key={slot.iso}
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-xl py-2 text-xs font-medium transition border ${
                              isSelected
                                ? "text-white border-transparent"
                                : "text-black/60 border-black/[.08] hover:border-black/20"
                            }`}
                            style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                          >
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <button
                onClick={handleBook}
                disabled={!selectedSlot || booking}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandColor }}
              >
                {booking ? t("booking") : t("confirm")}
              </button>
            </div>
          )}

          {/* ── Step 3: Success ───────────────────────────────────── */}
          {step === 3 && selectedType && selectedSlot && (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${brandColor}1A` }}
              >
                <Check className="h-8 w-8" style={{ color: brandColor }} />
              </div>
              <div>
                <p className="text-base font-semibold text-[#0F1A2E]">{t("doneTitle")}</p>
                <p className="mt-1.5 text-sm text-black/50">
                  {new Date(selectedSlot.iso).toLocaleDateString(locale, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  {t("at")}{" "}
                  {new Date(selectedSlot.iso).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-0.5 text-sm text-black/40">{selectedType.name}</p>
              </div>
              <p className="text-xs text-black/35">{t("whatsappConfirm")}</p>
              <button
                onClick={onClose}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition"
                style={{ backgroundColor: brandColor }}
              >
                {t("close")}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
