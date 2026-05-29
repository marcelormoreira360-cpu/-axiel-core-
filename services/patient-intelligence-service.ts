/**
 * patient-intelligence-service.ts
 *
 * Computes engagement score and churn risk from already-loaded patient data.
 * Pure functions — zero extra DB queries.
 */

import type { Appointment, Patient } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChurnRisk = "none" | "low" | "medium" | "high";

export interface PatientEngagement {
  /** 0–100 composite score */
  score: number;
  /** Human-readable risk level */
  churnRisk: ChurnRisk;
  /** Days since the most-recent appointment (null = no appointments ever) */
  daysSinceLastSession: number | null;
  /** Appointments in the last 90 days */
  sessionsLast90Days: number;
  /** Ratio of completed / (completed + no_show + cancelled) in the last 90 days.
   *  null when fewer than 2 scheduled appointments exist in the window. */
  attendanceRate: number | null;
  /** PT-BR label for the UI badge */
  label: string;
  /** Tailwind colour classes for badge background + text */
  badgeClasses: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(isoDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86_400_000);
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Computes a 0-100 engagement score and churn-risk label for a patient.
 *
 * Scoring breakdown:
 *   Recency   40 pts — days since last appointment
 *   Frequency 35 pts — sessions in the last 90 days
 *   Compliance 15 pts — completed vs. scheduled ratio (last 90d)
 *   Status     10 pts — active patient status
 */
export function computePatientEngagement(
  appointments: Appointment[],
  patient: Pick<Patient, "status" | "created_at">,
): PatientEngagement {
  const now = new Date();
  const cutoff90 = new Date(now.getTime() - 90 * 86_400_000);

  // Sort DESC so [0] = most recent
  const sorted = [...appointments].sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
  );

  // --- Recency ---
  const lastAppt = sorted[0] ?? null;
  const daysSinceLastSession = lastAppt
    ? daysBetween(lastAppt.starts_at, now)
    : null;

  let recencyPts = 0;
  if (daysSinceLastSession !== null) {
    if (daysSinceLastSession <= 30)      recencyPts = 40;
    else if (daysSinceLastSession <= 60) recencyPts = 25;
    else if (daysSinceLastSession <= 90) recencyPts = 10;
    else                                  recencyPts = 0;
  }

  // --- Frequency (last 90 days) ---
  const recent = appointments.filter(
    (a) => new Date(a.starts_at) >= cutoff90,
  );
  const sessionsLast90Days = recent.length;

  let frequencyPts = 0;
  if      (sessionsLast90Days >= 4) frequencyPts = 35;
  else if (sessionsLast90Days === 3) frequencyPts = 26;
  else if (sessionsLast90Days === 2) frequencyPts = 17;
  else if (sessionsLast90Days === 1) frequencyPts = 8;

  // --- Compliance (completed vs. no-show / cancelled) ---
  const scheduledRecent = recent.filter((a) =>
    ["completed", "no_show", "cancelled"].includes(a.status ?? ""),
  );
  const completedRecent = recent.filter((a) => a.status === "completed");
  let compliancePts = 8; // neutral when insufficient data
  let attendanceRate: number | null = null;

  if (scheduledRecent.length >= 2) {
    attendanceRate = completedRecent.length / scheduledRecent.length;
    if      (attendanceRate >= 0.8) compliancePts = 15;
    else if (attendanceRate >= 0.6) compliancePts = 10;
    else if (attendanceRate >= 0.4) compliancePts = 5;
    else                             compliancePts = 0;
  }

  // --- Status bonus ---
  const statusPts = patient.status === "active" ? 10 : 0;

  // --- Total ---
  const score = Math.min(100, recencyPts + frequencyPts + compliancePts + statusPts);

  // --- Churn risk ---
  let churnRisk: ChurnRisk;

  if (patient.status === "inactive" || patient.status === "archived") {
    churnRisk = "high";
  } else if (daysSinceLastSession === null) {
    // New patient with no appointments yet
    const daysSinceCreated = daysBetween(patient.created_at, now);
    churnRisk = daysSinceCreated <= 30 ? "none" : "high";
  } else if (daysSinceLastSession <= 30) {
    churnRisk = "none";
  } else if (daysSinceLastSession <= 45) {
    churnRisk = "low";
  } else if (daysSinceLastSession <= 75) {
    churnRisk = "medium";
  } else {
    churnRisk = "high";
  }

  // --- Label + badge classes ---
  const LABELS: Record<ChurnRisk, string> = {
    none:   "Engajado",
    low:    "Atenção",
    medium: "Em risco",
    high:   "Churn provável",
  };

  const BADGE_CLASSES: Record<ChurnRisk, string> = {
    none:   "bg-[#E1F5EE] text-[#085041]",
    low:    "bg-[#FFF8E7] text-[#633806]",
    medium: "bg-[#FAEEDA] text-[#7C3D04]",
    high:   "bg-[#FEE2E2] text-[#991B1B]",
  };

  return {
    score,
    churnRisk,
    daysSinceLastSession,
    sessionsLast90Days,
    attendanceRate,
    label:        LABELS[churnRisk],
    badgeClasses: BADGE_CLASSES[churnRisk],
  };
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | "appointment"
  | "session_note"
  | "insight"
  | "form"
  | "exam"
  | "prescription";

export interface TimelineEvent {
  id: string;
  date: string; // ISO string — used for sorting and display
  type: TimelineEventType;
  title: string;
  subtitle?: string;
  href?: string;
  badge?: string;
  /** Tailwind background colour class for the dot */
  dotColor: string;
}

/**
 * Builds a reverse-chronological event stream from already-loaded arrays.
 * All params are optional so callers can pass only what they have.
 */
export function buildPatientTimeline(
  patientId: string,
  opts: {
    appointments?: Appointment[];
    sessionRecords?: Array<{ id: string; created_at: string; notes?: string | null; appointment_id?: string | null }>;
    aiInsights?: Array<{ id: string; created_at: string; review_status: string; output?: { structured_summary?: { overview?: string } } | null }>;
    assessmentResponses?: Array<{ id: string; filled_at: string; assessment_templates?: { name?: string } | null; score_percentage?: number | null }>;
    exams?: Array<{ id: string; created_at: string; name?: string | null; exam_date?: string | null }>;
    prescriptions?: Array<{ id: string; created_at: string; name?: string | null }>;
  },
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Appointments
  for (const a of opts.appointments ?? []) {
    const statusLabel: Record<string, string> = {
      completed: "Concluída",
      scheduled: "Agendada",
      confirmed: "Confirmada",
      cancelled: "Cancelada",
      no_show: "Faltou",
    };
    const statusDot: Record<string, string> = {
      completed: "bg-[#0F6E56]",
      scheduled: "bg-sky-400",
      confirmed: "bg-sky-400",
      cancelled: "bg-[#D3D1C7]",
      no_show: "bg-red-400",
    };
    const st = a.status ?? "scheduled";
    events.push({
      id:       `appt-${a.id}`,
      date:     a.starts_at,
      type:     "appointment",
      title:    "Sessão",
      subtitle: statusLabel[st] ?? st,
      href:     `/schedule/${a.id}/session`,
      badge:    statusLabel[st],
      dotColor: statusDot[st] ?? "bg-[#D3D1C7]",
    });
  }

  // Session notes
  for (const r of opts.sessionRecords ?? []) {
    events.push({
      id:       `note-${r.id}`,
      date:     r.created_at,
      type:     "session_note",
      title:    "Nota de sessão",
      subtitle: r.notes ? r.notes.slice(0, 60) + (r.notes.length > 60 ? "…" : "") : undefined,
      href:     r.appointment_id ? `/schedule/${r.appointment_id}/session` : undefined,
      dotColor: "bg-indigo-400",
    });
  }

  // AI Insights
  for (const i of opts.aiInsights ?? []) {
    const statusLabel: Record<string, string> = {
      pending_review: "Aguardando revisão",
      needs_changes: "Precisa de ajustes",
      final: "Aprovado",
      archived: "Arquivado",
    };
    events.push({
      id:       `insight-${i.id}`,
      date:     i.created_at,
      type:     "insight",
      title:    "Insight IA gerado",
      subtitle: i.output?.structured_summary?.overview?.slice(0, 70) ?? statusLabel[i.review_status],
      href:     `/patients/${patientId}/insights`,
      badge:    statusLabel[i.review_status],
      dotColor: i.review_status === "final" ? "bg-[#0F6E56]" : "bg-amber-400",
    });
  }

  // Assessment responses
  for (const r of opts.assessmentResponses ?? []) {
    events.push({
      id:       `form-${r.id}`,
      date:     r.filled_at,
      type:     "form",
      title:    r.assessment_templates?.name ?? "Formulário respondido",
      subtitle: r.score_percentage != null
        ? `Pontuação: ${Math.round(r.score_percentage)}%`
        : undefined,
      href:     `/patients/${patientId}/forms/${r.id}`,
      dotColor: "bg-blue-400",
    });
  }

  // Exams
  for (const e of opts.exams ?? []) {
    events.push({
      id:       `exam-${e.id}`,
      date:     e.exam_date ?? e.created_at,
      type:     "exam",
      title:    e.name ?? "Exame laboratorial",
      dotColor: "bg-purple-400",
    });
  }

  // Prescriptions
  for (const p of opts.prescriptions ?? []) {
    events.push({
      id:       `rx-${p.id}`,
      date:     p.created_at,
      type:     "prescription",
      title:    p.name ?? "Prescrição",
      subtitle: "Medicamento / suplemento",
      dotColor: "bg-orange-400",
    });
  }

  // Sort reverse chronological, deduplicate by id
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}
