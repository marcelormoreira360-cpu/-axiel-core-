"use client";

import { useState, useMemo, useTransition } from "react";
import type { PatientLite } from "@/services/patient-service";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ScheduleSession } from "@/components/session-card";
import { buildPatientSnapshot } from "@/modules/patient-journey/snapshot-builder";
import { SessionDrawer } from "@/components/session-drawer";
import type { SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";
import {
  addDays,
  addMonths,
  formatMonthYear,
  formatShortDate,
  isSameDay,
  startOfWeek,
} from "@/modules/schedule/date-utils";
import type { Appointment } from "@/lib/types";
import { DayView, type BlockView } from "@/components/schedule/day-view";
import { WeekView } from "@/components/schedule/week-view";
import { MonthView } from "@/components/schedule/month-view";
import type { ConfirmLinkAction, EmailLinkAction } from "@/components/schedule/grid";

type View = "dia" | "semana" | "mes";

// ─── Main container ───────────────────────────────────────────────────────────

export type { ConfirmLinkAction, EmailLinkAction } from "@/components/schedule/grid";

export function ScheduleContainer({
  sessions,
  allAppointments,
  patients,
  sessionTypes,
  createSessionAction,
  createConfirmationLinkAction,
  emailConfirmationLinkAction,
  updateStatusAction,
  enrichSessionAction,
  deleteSessionAction,
  rescheduleAction,
  rescheduleSmartAction,
  resizeDurationAction,
  practitioners,
  cancellationWindowHours,
  clinicTimezone,
  timeBlocks = [],
  createBlockAction,
  deleteBlockAction,
}: {
  sessions: ScheduleSession[];
  allAppointments: Appointment[];
  patients: PatientLite[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  createConfirmationLinkAction?: ConfirmLinkAction;
  emailConfirmationLinkAction?: EmailLinkAction;
  updateStatusAction?: (id: string, status: string) => Promise<{ error?: string }>;
  /** Enriquece um agendamento leve (visão Semana) para o ScheduleSession do drawer. */
  enrichSessionAction?: (appointmentId: string) => Promise<ScheduleSession | null>;
  deleteSessionAction?: (id: string) => Promise<void>;
  rescheduleAction?: (id: string, newStartsAt: string, notify?: boolean) => Promise<void>;
  /** Reagendamento inteligente (move futuro / cria novo se passado/no-show). */
  rescheduleSmartAction?: (id: string, dateStr: string, timeStr: string, notify?: boolean) => Promise<{ error?: string; created?: boolean }>;
  resizeDurationAction?: (id: string, newDuration: number) => Promise<void>;
  practitioners?: { id: string; name: string }[];
  cancellationWindowHours?: number;
  /** Fuso IANA da clínica — pré-preenche o reagendamento no wall-clock certo. */
  clinicTimezone?: string;
  /** Bloqueios de horário (indisponibilidade) para render na agenda. */
  timeBlocks?: BlockView[];
  createBlockAction?: (formData: FormData) => Promise<void>;
  deleteBlockAction?: (id: string) => Promise<void>;
}) {
  const t = useTranslations("schedule.calendar");
  const tSnap = useTranslations("patientSnapshot");
  const locale = useLocale();
  const [view, setView]                       = useState<View>("semana");
  const [navDate, setNavDate]                 = useState(new Date());
  const [selectedSlot, setSelectedSlot]       = useState<TimeSlot | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [, startEnrich] = useTransition();
  const [filterPractitionerId, setFilterPractitionerId] = useState<string>("all");

  // Confirmação pós-arrasto (padrão Vagaro): o card move na hora (otimista) e um
  // diálogo pergunta se confirma o novo horário e se notifica o paciente. "Desfazer"
  // reverte o card; "Confirmar" persiste com a escolha de notificação.
  const [pendingMove, setPendingMove] = useState<
    { id: string; newStartsAt: string; label: string; revert: () => void } | null
  >(null);
  const [notifyOnMove, setNotifyOnMove] = useState(true);
  const [isConfirmingMove, startConfirmMove] = useTransition();

  function requestReschedule(id: string, newStartsAt: string, revert: () => void) {
    const label = new Date(newStartsAt).toLocaleString(locale, {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
      timeZone: clinicTimezone,
    });
    setNotifyOnMove(true);
    setPendingMove({ id, newStartsAt, label, revert });
  }

  function undoPendingMove() {
    pendingMove?.revert();
    setPendingMove(null);
  }

  function confirmPendingMove() {
    if (!pendingMove || !rescheduleAction) { setPendingMove(null); return; }
    const { id, newStartsAt, revert } = pendingMove;
    startConfirmMove(async () => {
      try {
        await rescheduleAction(id, newStartsAt, notifyOnMove);
      } catch {
        revert();
      }
      setPendingMove(null);
    });
  }

  // Abre o drawer a partir de um agendamento leve (visão Semana): mostra na hora o
  // que já temos (nome, status, ações) e enriquece sob demanda (sessões anteriores,
  // snapshot, insight). Se o enriquecimento falhar, o drawer degrada com o mínimo.
  function openAppointment(appt: Appointment) {
    const minimal: ScheduleSession = {
      ...appt,
      latestInsightStatus: "review",
      previousSessions: [],
      snapshot: buildPatientSnapshot({ appointment: appt, previousSessions: [], latestInsightText: null }, tSnap),
    };
    setSelectedSession(minimal);
    if (!enrichSessionAction) return;
    setDrawerLoading(true);
    startEnrich(async () => {
      try {
        const enriched = await enrichSessionAction(appt.id);
        // Só aplica se o drawer ainda mostra o MESMO agendamento (evita corrida).
        if (enriched) {
          setSelectedSession((cur) => (cur && cur.id === enriched.id ? enriched : cur));
        }
      } finally {
        setDrawerLoading(false);
      }
    });
  }

  function closeDrawer() {
    setSelectedSession(null);
    setDrawerLoading(false);
  }

  function navigatePrev() {
    if (view === "dia") setNavDate((d) => addDays(d, -1));
    else if (view === "semana") setNavDate((d) => addDays(d, -7));
    else if (view === "mes") setNavDate((d) => addMonths(d, -1));
  }
  function navigateNext() {
    if (view === "dia") setNavDate((d) => addDays(d, 1));
    else if (view === "semana") setNavDate((d) => addDays(d, 7));
    else if (view === "mes") setNavDate((d) => addMonths(d, 1));
  }
  function goToday()                { setNavDate(new Date()); }
  function onDayClick(date: Date)   { setNavDate(date); setView("dia"); }

  const navLabel = useMemo(() => {
    if (view === "dia") {
      const now = new Date();
      return isSameDay(navDate, now)
        ? t("today")
        : navDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    }
    if (view === "semana") {
      const start = startOfWeek(navDate);
      const end   = addDays(start, 6);
      return `${formatShortDate(start, locale)} – ${formatShortDate(end, locale)}`;
    }
    return formatMonthYear(navDate, locale);
  }, [view, navDate, locale, t]);

  const showNav = true; // navigation always visible in all views

  // Client-side filter by practitioner for clinic owners
  const filteredSessions = filterPractitionerId === "all"
    ? sessions
    : sessions.filter((s) => s.practitioner_id === filterPractitionerId);

  // For day view on non-today dates, derive sessions from allAppointments
  const today = new Date();
  const isNavToday = isSameDay(navDate, today);
  const emptySnapshot = {
    patient_name: "",
    patient_status: "active",
    latest_insight_title: "",
    latest_insight_summary: "",
    latest_insight_status: "Not ready" as const,
    last_session_date: null,
    last_session_summary: "",
    key_notes: [],
    next_step: "",
    attention_needed: "",
    pending_reviews_count: 0,
    follow_up_status: "Clear",
    pending_follow_ups_count: 0,
  };
  const dayViewSessions: ScheduleSession[] = useMemo(() => {
    if (isNavToday) return filteredSessions;
    // Map bare Appointment → minimal ScheduleSession for other days
    const dayAppts = getAppointmentsForDay(
      filterPractitionerId === "all"
        ? allAppointments
        : allAppointments.filter((a) => a.practitioner_id === filterPractitionerId),
      navDate,
    );
    return dayAppts.map((a) => ({
      ...a,
      latestInsightStatus: "review" as const,
      previousSessions: [],
      snapshot: emptySnapshot,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavToday, filteredSessions, allAppointments, navDate, filterPractitionerId]);

  return (
    <div className="space-y-[10px]">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]">
          {showNav && (
            <>
              <button
                type="button"
                onClick={navigatePrev}
                aria-label={t("prevPeriod")}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] min-w-[150px] text-center capitalize">
                {navLabel}
              </span>
              <button
                type="button"
                onClick={navigateNext}
                aria-label={t("nextPeriod")}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="ml-[4px] text-[11px] font-medium text-[#0F6E56] hover:underline"
              >
                {t("today")}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {practitioners && practitioners.length > 1 && (
            <select
              value={filterPractitionerId}
              onChange={(e) => setFilterPractitionerId(e.target.value)}
              className="h-7 rounded-lg border border-black/[.08] dark:border-white/[.08] bg-[#F4F3EF] dark:bg-white/[.06] px-2 text-[11px] text-[#6B6A66] dark:text-[#9E9C97] font-medium outline-none focus:border-[#0F6E56]/40 transition"
            >
              <option value="all">{t("all")}</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-[2px] bg-[#F4F3EF] dark:bg-white/[.06] rounded-[8px] p-[3px]">
            {(["dia", "semana", "mes"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={[
                  "text-[11px] font-medium px-[10px] py-[5px] rounded-[6px] capitalize transition",
                  view === v
                    ? "bg-white dark:bg-white/[.10] text-[#0F1A2E] dark:text-[#E8E6E2] shadow-sm border border-black/[.06] dark:border-white/[.06]"
                    : "text-[#6B6A66] dark:text-[#9E9C97] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2]",
                ].join(" ")}
              >
                {t(`views.${v}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Views ── */}
      {view === "dia" && (
        <DayView
          sessions={dayViewSessions}
          navDate={navDate}
          patients={patients}
          sessionTypes={sessionTypes}
          createSessionAction={createSessionAction}
          confirmLinkAction={createConfirmationLinkAction}
          emailLinkAction={emailConfirmationLinkAction}
          onDelete={deleteSessionAction}
          onOpenSession={setSelectedSession}
          setSelectedSlot={setSelectedSlot}
          selectedSlot={selectedSlot}
          onReschedule={rescheduleAction}
          onRescheduleRequest={requestReschedule}
          onResizeDuration={resizeDurationAction}
          timeBlocks={timeBlocks}
          blockAction={createBlockAction}
          onDeleteBlock={deleteBlockAction}
        />
      )}
      {view === "semana" && (
        <WeekView
          appointments={filterPractitionerId === "all"
            ? allAppointments
            : allAppointments.filter((a) => a.practitioner_id === filterPractitionerId)}
          navDate={navDate}
          onDayClick={onDayClick}
          patients={patients}
          sessionTypes={sessionTypes}
          createSessionAction={createSessionAction}
          confirmLinkAction={createConfirmationLinkAction}
          emailLinkAction={emailConfirmationLinkAction}
          onDelete={deleteSessionAction}
          onReschedule={rescheduleAction}
          onRescheduleRequest={requestReschedule}
          onResizeDuration={resizeDurationAction}
          onOpenAppointment={openAppointment}
        />
      )}
      {view === "mes" && (
        <MonthView
          appointments={filterPractitionerId === "all"
            ? allAppointments
            : allAppointments.filter((a) => a.practitioner_id === filterPractitionerId)}
          navDate={navDate}
          onDayClick={onDayClick}
        />
      )}

      <SessionDrawer
        session={selectedSession}
        onClose={closeDrawer}
        updateStatusAction={updateStatusAction}
        rescheduleSmartAction={rescheduleSmartAction}
        cancellationWindowHours={cancellationWindowHours}
        clinicTimezone={clinicTimezone}
        enriching={drawerLoading}
      />

      {/* Confirmação de reagendamento (arrastar-e-soltar) com opção de notificar. */}
      {pendingMove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-[420px] rounded-[14px] bg-white dark:bg-[#111827] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("moveTitle")}</h2>
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {t("moveBody", { time: pendingMove.label })}
            </p>
            <label className="mt-5 flex items-center gap-[8px] cursor-pointer select-none">
              <input
                type="checkbox" checked={notifyOnMove} onChange={(e) => setNotifyOnMove(e.target.checked)}
                className="h-[15px] w-[15px] rounded-[3px] accent-[#0F6E56]"
              />
              <span className="text-sm text-[#0F1A2E] dark:text-[#E8E6E2]">{t("notifyCustomer")}</span>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button" onClick={undoPendingMove} disabled={isConfirmingMove}
                className="rounded-[8px] border border-black/[.12] dark:border-white/[.14] px-4 py-2 text-sm font-medium text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition disabled:opacity-50"
              >
                {t("moveUndo")}
              </button>
              <button
                type="button" onClick={confirmPendingMove} disabled={isConfirmingMove}
                className="rounded-[8px] bg-[#0F6E56] px-4 py-2 text-sm font-medium text-white hover:bg-[#085041] transition disabled:opacity-50"
              >
                {isConfirmingMove ? "…" : t("moveConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
