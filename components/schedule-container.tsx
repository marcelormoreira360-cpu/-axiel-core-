"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CreateSessionModal } from "@/components/create-session-modal";
import { SessionCard, type ScheduleSession } from "@/components/session-card";
import { SessionDrawer } from "@/components/session-drawer";
import type { Patient, SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import {
  buildDayTimeSlots,
  getSlotKey,
  getSlotKeyFromStartsAt,
} from "@/modules/schedule/time-slots";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";
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

// ─── Time grid constants ──────────────────────────────────────────────────────
const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 1024px
const HOURS_RANGE = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

function apptStyle(startsAt: string, duration: number): { top: number; height: number } {
  const d = new Date(startsAt);
  const startMins = d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
  const top = Math.max(0, (startMins / 60) * HOUR_HEIGHT);
  const height = Math.max((duration / 60) * HOUR_HEIGHT, 24);
  return { top, height };
}

function getNowOffset(): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  if (mins < 0 || mins > TOTAL_HOURS * 60) return null;
  return (mins / 60) * HOUR_HEIGHT;
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to business hours on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTarget = (8 - START_HOUR) * HOUR_HEIGHT - 16;
      containerRef.current.scrollTop = Math.max(0, scrollTarget);
    }
  }, []);

  const [nowOffset, setNowOffset] = useState<number | null>(getNowOffset);

  useEffect(() => {
    const id = setInterval(() => setNowOffset(getNowOffset()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sessionsBySlot = useMemo(() => {
    return sessions.reduce<Record<string, ScheduleSession[]>>((acc, session) => {
      const key = getSlotKeyFromStartsAt(session.starts_at);
      acc[key] = [...(acc[key] ?? []), session];
      return acc;
    }, {});
  }, [sessions]);

  return (
    <>
      <div
        ref={containerRef}
        className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden overflow-y-auto max-h-[calc(100vh-220px)]"
      >
        <div className="relative" style={{ minHeight: GRID_HEIGHT }}>
          {/* "Now" indicator */}
          {nowOffset !== null && (
            <div
              className="pointer-events-none absolute left-[64px] right-0 z-20 flex items-center"
              style={{ top: nowOffset }}
            >
              <span className="w-[8px] h-[8px] rounded-full bg-[#0F6E56] shrink-0 -ml-[4px]" />
              <div className="flex-1 border-t border-[#0F6E56]/50" />
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
                  "grid",
                  !isLast ? "border-b border-black/[.05]" : "",
                  slot.isBusinessHour ? "bg-white" : "bg-[#FAFAF8]",
                ].join(" ")}
                style={{ gridTemplateColumns: "64px 1fr", height: HOUR_HEIGHT }}
              >
                {/* Time label */}
                <div className="flex items-start pt-[10px] pl-[10px] shrink-0 border-r border-black/[.05]">
                  <span className={`text-[10px] font-medium ${slot.isBusinessHour ? "text-[#A09E98]" : "text-[#D3D1C7]"}`}>
                    {slot.label}
                  </span>
                </div>

                {/* Slot content */}
                <div className="relative">
                  {/* 30-min line */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-black/[.04]"
                    style={{ top: HOUR_HEIGHT / 2 }}
                  />

                  <div className="p-[6px] h-full">
                    {isEmpty ? (
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className="w-full h-full flex items-center justify-center rounded-[6px] border border-dashed border-transparent text-[10px] text-transparent hover:border-[#0F6E56]/20 hover:text-[#0F6E56] hover:bg-[#F0FAF6] transition group"
                      >
                        <span className="opacity-0 group-hover:opacity-100 transition">
                          {slot.isBusinessHour ? "+ Agendar" : ""}
                        </span>
                      </button>
                    ) : (
                      <div className="space-y-[4px]">
                        {items.map((session) => (
                          <SessionCard key={session.id} session={session} onOpen={onOpenSession} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

// ─── Week view — time grid ────────────────────────────────────────────────────

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

  const [nowOffset, setNowOffset] = useState<number | null>(getNowOffset);

  useEffect(() => {
    const id = setInterval(() => setNowOffset(getNowOffset()), 60_000);
    return () => clearInterval(id);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to ~8am on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_HEIGHT - 16);
    }
  }, []);

  const isCurrentWeek = weekDays.some((d) => isSameDay(d, today));
  const todayColIdx = isCurrentWeek ? weekDays.findIndex((d) => isSameDay(d, today)) : -1;

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden flex flex-col">
      {/* ── Day header row ── */}
      <div
        className="grid border-b border-black/[.07] shrink-0"
        style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}
      >
        {/* Corner */}
        <div className="border-r border-black/[.07]" />
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
              <span
                className={[
                  "text-[15px] font-semibold mt-[2px] w-7 h-7 flex items-center justify-center rounded-full",
                  isToday ? "bg-[#0F6E56] text-white" : "text-[#0F1A2E]",
                ].join(" ")}
              >
                {date.getDate()}
              </span>
              {appts.length > 0 && (
                <span className="mt-[3px] text-[9px] text-[#0F6E56] font-medium">
                  {appts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable time grid ── */}
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 260px)", minHeight: 400 }}
      >
        <div
          className="relative grid"
          style={{ height: GRID_HEIGHT, gridTemplateColumns: `56px repeat(7, 1fr)` }}
        >
          {/* ── Time labels column ── */}
          <div className="relative border-r border-black/[.07] bg-white z-10">
            {HOURS_RANGE.map((h) => (
              <div
                key={h}
                className="absolute w-full flex justify-end pr-[8px]"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8 }}
              >
                <span className="text-[10px] text-[#D3D1C7] font-medium select-none">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* ── Day columns ── */}
          {groups.map(({ date, appointments: appts }, colIdx) => {
            const isToday = isSameDay(date, today);
            return (
              <div
                key={date.toISOString()}
                className={[
                  "relative border-r border-black/[.05] last:border-r-0",
                  isToday ? "bg-[#F8FFFE]" : "",
                ].join(" ")}
              >
                {/* ── Grid lines ── */}
                {HOURS_RANGE.map((h, i) => (
                  <div key={h}>
                    {/* Hour line */}
                    <div
                      className="absolute left-0 right-0 border-t border-black/[.05]"
                      style={{ top: i * HOUR_HEIGHT }}
                    />
                    {/* 30-min line */}
                    {i < TOTAL_HOURS && (
                      <div
                        className="absolute left-0 right-0 border-t border-black/[.03] border-dashed"
                        style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      />
                    )}
                  </div>
                ))}

                {/* ── "Now" line — only on today's column ── */}
                {isCurrentWeek && colIdx === todayColIdx && nowOffset !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowOffset }}
                  >
                    <span className="w-[8px] h-[8px] rounded-full bg-[#0F6E56] shrink-0 -ml-[4px]" />
                    <div className="flex-1 border-t-[1.5px] border-[#0F6E56]" />
                  </div>
                )}

                {/* ── Appointments ── */}
                {appts.map((appt) => {
                  const { top, height } = apptStyle(appt.starts_at, appt.duration_minutes ?? 60);
                  const name = appt.patients?.full_name ?? "Paciente";
                  const firstName = name.split(" ")[0];
                  return (
                    <Link
                      key={appt.id}
                      href={`/patients/${appt.patient_id}`}
                      className="absolute left-[3px] right-[3px] z-10 rounded-[6px] bg-[#E1F5EE] border border-[#0F6E56]/20 px-[6px] py-[4px] hover:bg-[#C8EEE2] hover:border-[#0F6E56]/40 transition overflow-hidden group"
                      style={{ top: top + 1, height: height - 2 }}
                    >
                      <p className="text-[10px] font-semibold text-[#0F6E56] leading-tight truncate">
                        {formatTime(appt.starts_at)}
                      </p>
                      <p className="text-[11px] font-medium text-[#0F1A2E] leading-tight truncate mt-[1px]">
                        {firstName}
                      </p>
                      {height >= 48 && (
                        <p className="text-[9px] text-[#6B6A66] leading-tight truncate">
                          {appt.duration_minutes} min
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
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
          <div
            key={label}
            className="py-[8px] text-center text-[9px] font-medium tracking-[.08em] uppercase text-[#A09E98] border-r border-black/[.05] last:border-r-0"
          >
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
          const isLastRow = i >= cells.length - 7;

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onDayClick(date)}
              className={[
                "flex flex-col items-start p-[8px] min-h-[88px] border-r border-black/[.05] last:border-r-0 text-left transition hover:bg-[#F4F3EF]",
                !isLastRow ? "border-b border-black/[.05]" : "",
                isToday ? "bg-[#F0FAF6]" : "",
                !isCurrentMonth ? "opacity-35" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full mb-[4px]",
                  isToday ? "bg-[#0F6E56] text-white" : "text-[#0F1A2E]",
                ].join(" ")}
              >
                {date.getDate()}
              </span>

              {dayAppts.slice(0, 3).map((appt) => (
                <span
                  key={appt.id}
                  className="text-[9px] font-medium text-[#0F6E56] bg-[#E1F5EE] rounded-[3px] px-[4px] py-[1px] mb-[2px] truncate w-full"
                >
                  {formatTime(appt.starts_at)}{" "}
                  {appt.patients?.full_name?.split(" ")[0]}
                </span>
              ))}

              {dayAppts.length > 3 && (
                <span className="text-[9px] text-[#A09E98]">
                  +{dayAppts.length - 3} mais
                </span>
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
  updateStatusAction,
}: {
  sessions: ScheduleSession[];
  allAppointments: Appointment[];
  patients: Patient[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  updateStatusAction?: (id: string, status: string) => Promise<void>;
}) {
  const [view, setView] = useState<View>("semana");
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

  const navLabel = useMemo(() => {
    if (view === "dia") {
      const today = new Date();
      return isSameDay(navDate, today)
        ? "Hoje"
        : navDate.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
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
    <div className="space-y-[10px]">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
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
              <span className="text-[12px] font-medium text-[#0F1A2E] min-w-[150px] text-center capitalize">
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
            <span className="text-[12px] font-medium text-[#0F1A2E] capitalize">
              {navLabel}
            </span>
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

      {/* ── Views ── */}
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

      <SessionDrawer
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        updateStatusAction={updateStatusAction}
      />
    </div>
  );
}
