"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CreateSessionModal } from "@/components/create-session-modal";
import { SessionCard, type ScheduleSession } from "@/components/session-card";
import { SessionDrawer } from "@/components/session-drawer";
import type { Patient, SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import {
  buildDayTimeSlots,
  getNowPositionPercent,
  getSlotKey,
  getSlotKeyFromStartsAt,
} from "@/modules/schedule/time-slots";
import {
  getAppointmentsForDay,
  groupAppointmentsByWeekDay,
} from "@/modules/schedule/schedule-view";
import {
  addDays,
  addMonths,
  formatTime,
  formatMonthYear,
  formatShortDate,
  getMonthGrid,
  getWeekDays,
  isSameDay,
  startOfWeek,
} from "@/modules/schedule/date-utils";
import type { Appointment } from "@/lib/types";

type View = "dia" | "semana" | "mes";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Day view ────────────────────────────────────────────────────────────────

function DayView({
  sessions,
  patients,
  sessionTypes,
  createSessionAction,
  onOpenSession,
  setSelectedSlot,
  selectedSlot,
}: {
  sessions: ScheduleSession[];
  patients: Patient[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  onOpenSession: (s: ScheduleSession) => void;
  setSelectedSlot: (s: TimeSlot | null) => void;
  selectedSlot: TimeSlot | null;
}) {
  const slots = useMemo(() => buildDayTimeSlots(), []);
  const nowPercent = getNowPositionPercent();

  const sessionsBySlot = useMemo(() => {
    return sessions.reduce<Record<string, ScheduleSession[]>>((acc, session) => {
      const key = getSlotKeyFromStartsAt(session.starts_at);
      acc[key] = [...(acc[key] ?? []), session];
      return acc;
    }, {});
  }, [sessions]);

  return (
    <>
      <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden relative">
        {nowPercent !== null && (
          <div
            className="pointer-events-none absolute left-[72px] right-0 z-10 border-t border-[#0F6E56]/40"
            style={{ top: `${nowPercent}%` }}
          >
            <span className="-mt-[9px] ml-[-8px] inline-flex items-center justify-center w-[6px] h-[6px] rounded-full bg-[#0F6E56]" />
          </div>
        )}

        {slots.map((slot, i) => {
          const items = sessionsBySlot[getSlotKey(slot.hour)] ?? [];
          const isEmpty = items.length === 0;
          const isLast = i === slots.length - 1;

          return (
            <div
              key={slot.label}
              className={[
                "grid grid-cols-[72px_1fr] min-h-[72px]",
                !isLast ? "border-b border-black/[.05]" : "",
                slot.isBusinessHour ? "bg-white" : "bg-[#FAFAF8]",
              ].join(" ")}
            >
              <div className="flex items-start pt-[14px] pl-[14px] shrink-0">
                <span className={`text-[11px] font-medium ${slot.isBusinessHour ? "text-[#A09E98]" : "text-[#D3D1C7]"}`}>
                  {slot.label}
                </span>
              </div>
              <div className="p-[10px]">
                {isEmpty ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className="w-full h-full min-h-[52px] flex items-center justify-center rounded-[8px] border border-dashed border-black/[.08] text-[11px] text-[#D3D1C7] hover:border-[#0F6E56]/30 hover:text-[#0F6E56] hover:bg-[#F0FAF6] transition"
                  >
                    {slot.isBusinessHour ? "+ Agendar" : ""}
                  </button>
                ) : (
                  <div className="space-y-[6px]">
                    {items.map((session) => (
                      <SessionCard key={session.id} session={session} onOpen={onOpenSession} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateSessionModal
        slot={selectedSlot}
        patients={patients}
        sessionTypes={sessionTypes}
        onClose={() => setSelectedSlot(null)}
        action={createSessionAction}
      />
    </>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  appointments,
  navDate,
  onDayClick,
}: {
  appointments: Appointment[];
  navDate: Date;
  onDayClick: (date: Date) => void;
}) {
  const today = new Date();
  const weekDays = getWeekDays(navDate);
  const groups = weekDays.map((day) => ({
    date: day,
    appointments: getAppointmentsForDay(appointments, day),
  }));

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-black/[.07]">
        {groups.map(({ date, appointments: appts }) => {
          const isToday = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onDayClick(date)}
              className={[
                "flex flex-col items-center py-[10px] border-r border-black/[.05] last:border-r-0 transition hover:bg-[#F4F3EF]",
                isToday ? "bg-[#F0FAF6]" : "",
              ].join(" ")}
            >
              <span className="text-[9px] font-medium tracking-[.08em] uppercase text-[#A09E98]">
                {date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </span>
              <span className={[
                "text-[16px] font-semibold mt-[2px] w-7 h-7 flex items-center justify-center rounded-full",
                isToday ? "bg-[#0F6E56] text-white" : "text-[#0F1A2E]",
              ].join(" ")}>
                {date.getDate()}
              </span>
              {appts.length > 0 && (
                <span className="mt-[4px] text-[9px] text-[#0F6E56] font-medium">{appts.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="grid grid-cols-7 min-h-[400px] divide-x divide-black/[.05]">
        {groups.map(({ date, appointments: appts }) => {
          const isToday = isSameDay(date, today);
          return (
            <div
              key={date.toISOString()}
              className={["p-[8px] space-y-[5px]", isToday ? "bg-[#F0FAF6]/50" : ""].join(" ")}
            >
              {appts.length === 0 ? (
                <div className="h-full min-h-[60px] flex items-center justify-center">
                  <span className="text-[10px] text-[#D3D1C7]">—</span>
                </div>
              ) : (
                appts.map((appt) => {
                  const name = appt.patients?.full_name ?? "Paciente";
                  return (
                    <Link
                      key={appt.id}
                      href={`/patients/${appt.patient_id}`}
                      className="block bg-white border border-black/[.07] rounded-[6px] px-[7px] py-[5px] hover:border-[#0F6E56]/30 hover:bg-[#F0FAF6] transition"
                    >
                      <p className="text-[10px] font-medium text-[#0F6E56]">{formatTime(appt.starts_at)}</p>
                      <p className="text-[11px] font-medium text-[#0F1A2E] truncate mt-[1px]">{name}</p>
                      <p className="text-[9px] text-[#A09E98] mt-[1px]">{appt.duration_minutes} min</p>
                    </Link>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({
  appointments,
  navDate,
  onDayClick,
}: {
  appointments: Appointment[];
  navDate: Date;
  onDayClick: (date: Date) => void;
}) {
  const today = new Date();
  const cells = useMemo(() => getMonthGrid(navDate), [navDate]);
  const currentMonth = navDate.getMonth();

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-black/[.07]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-[8px] text-center text-[9px] font-medium tracking-[.08em] uppercase text-[#A09E98] border-r border-black/[.05] last:border-r-0">
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const dayAppts = getAppointmentsForDay(appointments, date);
          const isToday = isSameDay(date, today);
          const isCurrentMonth = date.getMonth() === currentMonth;
          const isLast = i === cells.length - 1;
          const isLastRow = i >= cells.length - 7;

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onDayClick(date)}
              className={[
                "flex flex-col items-start p-[8px] min-h-[80px] border-r border-black/[.05] last:border-r-0 text-left transition hover:bg-[#F4F3EF]",
                !isLastRow ? "border-b border-black/[.05]" : "",
                isToday ? "bg-[#F0FAF6]" : "",
                !isCurrentMonth ? "opacity-40" : "",
              ].join(" ")}
            >
              <span className={[
                "text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full mb-[4px]",
                isToday ? "bg-[#0F6E56] text-white" : "text-[#0F1A2E]",
              ].join(" ")}>
                {date.getDate()}
              </span>

              {dayAppts.slice(0, 2).map((appt) => (
                <span
                  key={appt.id}
                  className="text-[9px] font-medium text-[#0F6E56] bg-[#E1F5EE] rounded-[3px] px-[4px] py-[1px] mb-[2px] truncate w-full"
                >
                  {formatTime(appt.starts_at)} {appt.patients?.full_name?.split(" ")[0]}
                </span>
              ))}

              {dayAppts.length > 2 && (
                <span className="text-[9px] text-[#A09E98]">+{dayAppts.length - 2} mais</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main container ───────────────────────────────────────────────────────────

export function ScheduleContainer({
  sessions,
  allAppointments,
  patients,
  sessionTypes,
  createSessionAction,
}: {
  sessions: ScheduleSession[];
  allAppointments: Appointment[];
  patients: Patient[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
}) {
  const [view, setView] = useState<View>("dia");
  const [navDate, setNavDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);

  function navigatePrev() {
    if (view === "semana") setNavDate((d) => addDays(d, -7));
    else if (view === "mes") setNavDate((d) => addMonths(d, -1));
  }

  function navigateNext() {
    if (view === "semana") setNavDate((d) => addDays(d, 7));
    else if (view === "mes") setNavDate((d) => addMonths(d, 1));
  }

  function goToday() {
    setNavDate(new Date());
  }

  function onDayClick(date: Date) {
    setNavDate(date);
    setView("dia");
  }

  // Navigation label
  const navLabel = useMemo(() => {
    if (view === "dia") {
      const today = new Date();
      return isSameDay(navDate, today)
        ? "Hoje"
        : navDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    }
    if (view === "semana") {
      const start = startOfWeek(navDate);
      const end = addDays(start, 6);
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    }
    return formatMonthYear(navDate);
  }, [view, navDate]);

  const showNav = view !== "dia";

  return (
    <div className="space-y-[12px]">
      {/* View toggle + navigation */}
      <div className="flex items-center justify-between">
        {/* Nav arrows */}
        <div className="flex items-center gap-[6px]">
          {showNav && (
            <>
              <button
                type="button"
                onClick={navigatePrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[12px] font-medium text-[#0F1A2E] min-w-[140px] text-center capitalize">
                {navLabel}
              </span>
              <button
                type="button"
                onClick={navigateNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="ml-[4px] text-[11px] font-medium text-[#0F6E56] hover:underline transition"
              >
                Hoje
              </button>
            </>
          )}
          {!showNav && (
            <span className="text-[12px] font-medium text-[#0F1A2E] capitalize">{navLabel}</span>
          )}
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-[2px] bg-[#F4F3EF] rounded-[8px] p-[3px]">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "text-[11px] font-medium px-[10px] py-[5px] rounded-[6px] capitalize transition",
                view === v
                  ? "bg-white text-[#0F1A2E] shadow-sm border border-black/[.06]"
                  : "text-[#6B6A66] hover:text-[#0F1A2E]",
              ].join(" ")}
            >
              {v === "mes" ? "Mês" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {view === "dia" && (
        <DayView
          sessions={sessions}
          patients={patients}
          sessionTypes={sessionTypes}
          createSessionAction={createSessionAction}
          onOpenSession={setSelectedSession}
          setSelectedSlot={setSelectedSlot}
          selectedSlot={selectedSlot}
        />
      )}

      {view === "semana" && (
        <WeekView
          appointments={allAppointments}
          navDate={navDate}
          onDayClick={onDayClick}
        />
      )}

      {view === "mes" && (
        <MonthView
          appointments={allAppointments}
          navDate={navDate}
          onDayClick={onDayClick}
        />
      )}

      <SessionDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
    </div>
  );
}
