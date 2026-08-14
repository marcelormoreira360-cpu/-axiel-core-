"use client";

import { formatDualTime } from "@/lib/timezone";

export function formatDate(value: string | null | undefined, locale: string, timezone?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: timezone });
}

// Exibição dupla: horário no fuso do PACIENTE (onde ele está) e, quando diferente,
// também no da CLÍNICA. starts_at é um instante UTC; sem timeZone o toLocale* usa o
// fuso do navegador e desloca o horário (ex.: Brasil UTC-3 vs clínica NY UTC-4).
export function formatDateTime(
  value: string | null | undefined,
  locale: string,
  at: string,
  patientTz: string,
  clinicTz: string,
) {
  if (!value) return "—";
  const dual = formatDualTime({ iso: value, patientTz, clinicTz, locale });
  const base = `${dual.patient.dateShort} ${at} ${dual.patient.time}`;
  if (dual.sameZone) return base;
  return `${base} (${dual.patient.label}) · ${dual.clinic.time} (${dual.clinic.label})`;
}

export function shortText(value: string | null | undefined, fallback: string, max = 180) {
  const clean = value?.trim();
  if (!clean) return fallback;
  return clean.length > max ? `${clean.slice(0, max - 3)}…` : clean;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{title}</p>
      {children}
    </div>
  );
}
