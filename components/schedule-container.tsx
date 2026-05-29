"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
const HOUR_HEIGHT  = 64;
const START_HOUR   = 6;
const END_HOUR     = 22;
const TOTAL_HOURS  = END_HOUR - START_HOUR;
const GRID_HEIGHT  = TOTAL_HOURS * HOUR_HEIGHT;   // 1024 px
const TIME_COL_W   = 64;                          // px
const HEADER_H     = 56;                          // px
const BODY_H       = 640;                         // px (visible + scrollável)
const HOUR_LABELS  = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

function apptStyle(startsAt: string, duration: number) {
  const d = new Date(startsAt);
  const startMins = d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
  return {
    top:    Math.max(0, (startMins / 60) * HOUR_HEIGHT),
    height: Math.max((duration / 60) * HOUR_HEIGHT, 24),
  };
}

function getNowOffset(): number | null {
  const now  = new Date();
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
  const slots      = useMemo(() => buildDayTimeSlots(), []);
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_HEIGHT - 16);
  }, []);

  const [nowOffset, setNowOffset] = useState<number | null>(getNowOffset);
  useEffect(() => {
    const id = setInterval(() => setNowOffset(getNowOffset()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sessionsBySlot = useMemo(() => {
    return sessions.reduce<Record<string, ScheduleSession[]>>((acc, s) => {
      const key = getSlotKeyFromStartsAt(s.starts_at);
      acc[key] = [...(acc[key] ?? []), s];
      return acc;
    }, {});
  }, [sessions]);

  return (
    <>
      {/* ── Grid ── */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          height: BODY_H,
          overflowY: "auto",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 12,
        }}
      >
        {/* Coluna de horários */}
        <div
          style={{
            width: TIME_COL_W,
            flexShrink: 0,
            height: GRID_HEIGHT,
            position: "relative",
            background: "#F4F3EF",
            borderRight: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          {HOUR_LABELS.map((h) => (
            <div
              key={h}
              style={{
                position: "absolute",
                top: (h - START_HOUR) * HOUR_HEIGHT + 4,
                right: 8,
                fontSize: 11,
                fontWeight: 600,
                color: "#0F1A2E",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Coluna de sessões */}
        <div style={{ flex: 1, position: "relative", height: GRID_HEIGHT }}>
          {/* Indicador agora */}
          {nowOffset !== null && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: nowOffset,
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#0F6E56",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, borderTop: "1.5px solid #0F6E56" }} />
            </div>
          )}

          {slots.map((slot, i) => {
            const items  = sessionsBySlot[getSlotKey(slot.hour)] ?? [];
            const isLast = i === slots.length - 1;
            return (
              <div
                key={slot.label}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: i * HOUR_HEIGHT,
                  height: HOUR_HEIGHT,
                  background: slot.isBusinessHour ? "#fff" : "#FAFAF8",
                  borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                {/* Linha 30min */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: HOUR_HEIGHT / 2,
                    borderTop: "1px dashed rgba(0,0,0,0.05)",
                  }}
                />
                <div style={{ padding: 6, height: "100%" }}>
                  {items.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className="w-full h-full flex items-center justify-center rounded-[6px] text-[10px] text-transparent hover:border hover:border-dashed hover:border-[#0F6E56]/25 hover:text-[#0F6E56] hover:bg-[#F0FAF6] transition"
                    >
                      {slot.isBusinessHour ? "+ Agendar" : ""}
                    </button>
                  ) : (
                    <div className="space-y-[4px]">
                      {items.map((s) => (
                        <SessionCard key={s.id} session={s} onOpen={onOpenSession} />
                      ))}
                    </div>
                  )}
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

// ─── Draggable appointment card (week view) ───────────────────────────────────

function DraggableApptCard({
  appt,
  isActive,
}: {
  appt: Appointment;
  isActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appt.id,
    data: { appt },
  });
  const { top, height } = apptStyle(appt.starts_at, appt.duration_minutes ?? 60);
  const name      = appt.patients?.full_name ?? "Paciente";
  const firstName = name.split(" ")[0];

  return (
    <Link
      ref={setNodeRef}
      href={`/patients/${appt.patient_id}`}
      onClick={(e) => {
        // Prevent navigation if this was a real drag (transform indicates movement)
        if (isDragging || isActive) e.preventDefault();
      }}
      style={{
        position: "absolute",
        left: 3,
        right: 3,
        top: top + 1,
        height: height - 2,
        zIndex: isDragging ? 50 : 10,
        background: isActive ? "#C3EBDB" : "#E1F5EE",
        border: `1px solid ${isActive ? "rgba(15,110,86,0.5)" : "rgba(15,110,86,0.25)"}`,
        borderRadius: 6,
        padding: "4px 6px",
        overflow: "hidden",
        display: "block",
        textDecoration: "none",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.35 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
      }}
      {...listeners}
      {...attributes}
    >
      <p style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
        {formatTime(appt.starts_at)}
      </p>
      <p style={{ fontSize: 11, fontWeight: 500, color: "#0F1A2E", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }}>
        {firstName}
      </p>
      {height >= 48 && (
        <p style={{ fontSize: 9, color: "#6B6A66", lineHeight: 1.2, margin: 0 }}>
          {appt.duration_minutes} min
        </p>
      )}
    </Link>
  );
}

// ─── Droppable hour cell (week view) ─────────────────────────────────────────

function DroppableHourCell({
  id,
  date,
  hour,
  onClick,
  children,
}: {
  id: string;
  date: Date;
  hour: number;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { date, hour } });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: (hour - START_HOUR) * HOUR_HEIGHT,
        height: HOUR_HEIGHT,
        background: isOver ? "rgba(15,110,86,0.06)" : "transparent",
        border: isOver ? "1px dashed rgba(15,110,86,0.35)" : "1px solid transparent",
        borderRadius: 4,
        cursor: "pointer",
        zIndex: 1,
        transition: "background 0.1s, border-color 0.1s",
      }}
      onClick={onClick}
      title={`Agendar às ${String(hour).padStart(2, "0")}:00`}
    >
      {children}
    </div>
  );
}

// ─── Week view — time grid ────────────────────────────────────────────────────

function WeekView({
  appointments,
  navDate,
  onDayClick,
  patients,
  sessionTypes,
  createSessionAction,
  onReschedule,
}: {
  appointments: Appointment[];
  navDate: Date;
  onDayClick: (date: Date) => void;
  patients: Patient[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  onReschedule?: (id: string, newStartsAt: string) => Promise<void>;
}) {
  const today    = new Date();
  const weekDays = getWeekDays(navDate);

  // Optimistic local state for drag-and-drop
  const [localAppts, setLocalAppts] = useState<Appointment[]>(appointments);
  useEffect(() => { setLocalAppts(appointments); }, [appointments]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const groups = weekDays.map((day) => ({
    date: day,
    appointments: getAppointmentsForDay(localAppts, day),
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !onReschedule) return;

    // overId format: "YYYY-MM-DDTHH:mm:ss.sssZ__HH"
    const parts = String(over.id).split("__");
    if (parts.length !== 2) return;
    const [dateIso, hourStr] = parts;
    const targetDate = new Date(dateIso);
    const targetHour = parseInt(hourStr, 10);
    if (isNaN(targetHour)) return;

    const apptId    = String(active.id);
    const appt      = localAppts.find((a) => a.id === apptId);
    if (!appt) return;

    const orig      = new Date(appt.starts_at);
    const newStart  = new Date(targetDate);
    newStart.setHours(targetHour, orig.getMinutes(), 0, 0);

    // Skip if same time
    if (newStart.getTime() === orig.getTime()) return;

    const newStartsAt = newStart.toISOString();

    // Optimistic update
    setLocalAppts((prev) =>
      prev.map((a) => a.id === apptId ? { ...a, starts_at: newStartsAt } : a)
    );

    // Persist
    onReschedule(apptId, newStartsAt).catch(() => {
      // Revert on error
      setLocalAppts((prev) =>
        prev.map((a) => a.id === apptId ? { ...a, starts_at: appt.starts_at } : a)
      );
    });
  }, [localAppts, onReschedule]);

  const activeAppt = activeId ? localAppts.find((a) => a.id === activeId) : null;

  const [nowOffset, setNowOffset] = useState<number | null>(getNowOffset);
  useEffect(() => {
    const id = setInterval(() => setNowOffset(getNowOffset()), 60_000);
    return () => clearInterval(id);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = Math.max(0, (8 - START_HOUR) * HOUR_HEIGHT - 16);
  }, []);

  const isCurrentWeek = weekDays.some((d) => isSameDay(d, today));
  const todayColIdx   = isCurrentWeek ? weekDays.findIndex((d) => isSameDay(d, today)) : -1;

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  function handleCellClick(date: Date, hour: number) {
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
    const slot = buildDayTimeSlots().find((s) => s.hour === hour);
    if (slot) {
      const adjusted: TimeSlot = { ...slot, date: slotDate };
      setSelectedSlot(adjusted);
    }
  }

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* ── Cabeçalho ── */}
      <div
        style={{
          display: "flex",
          height: HEADER_H,
          borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}
      >
        {/* Canto */}
        <div
          style={{
            width: TIME_COL_W,
            flexShrink: 0,
            background: "#F4F3EF",
            borderRight: "1px solid rgba(0,0,0,0.07)",
          }}
        />
        {/* Dias */}
        {groups.map(({ date, appointments: appts }) => {
          const isToday = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onDayClick(date)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: "pointer",
                background: isToday ? "#F0FAF6" : "#fff",
                borderRight: "1px solid rgba(0,0,0,0.05)",
                border: "none",
                padding: "8px 0",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#A09E98",
                }}
              >
                {date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: isToday ? "#0F6E56" : "transparent",
                  color: isToday ? "#fff" : "#0F1A2E",
                }}
              >
                {date.getDate()}
              </span>
              {appts.length > 0 && (
                <span style={{ fontSize: 9, color: "#0F6E56", fontWeight: 600 }}>
                  {appts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Body scrollável ── */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          height: BODY_H,
          overflowY: "auto",
        }}
      >
        {/* ── Coluna de horários ── */}
        <div
          style={{
            width: TIME_COL_W,
            flexShrink: 0,
            height: GRID_HEIGHT,
            position: "relative",
            background: "#F4F3EF",
            borderRight: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          {HOUR_LABELS.map((h) => (
            <div
              key={h}
              style={{
                position: "absolute",
                top: (h - START_HOUR) * HOUR_HEIGHT + 4,
                right: 8,
                fontSize: 11,
                fontWeight: 600,
                color: "#0F1A2E",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* ── Colunas dos dias ── */}
        <div style={{ flex: 1, display: "flex", height: GRID_HEIGHT }}>
          {groups.map(({ date, appointments: appts }, colIdx) => {
            const isToday = isSameDay(date, today);
            return (
              <div
                key={date.toISOString()}
                style={{
                  flex: 1,
                  position: "relative",
                  height: GRID_HEIGHT,
                  background: isToday ? "#F8FFFE" : "#fff",
                  borderRight: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                {/* Células clicáveis e droppable por hora */}
                {HOUR_LABELS.slice(0, TOTAL_HOURS).map((h) => (
                  <DroppableHourCell
                    key={`cell-${h}`}
                    id={`${date.toISOString()}__${h}`}
                    date={date}
                    hour={h}
                    onClick={() => !activeId && handleCellClick(date, h)}
                  />
                ))}

                {/* Linha "agora" */}
                {isCurrentWeek && colIdx === todayColIdx && nowOffset !== null && (
                  <div
                    style={{
                      position: "absolute",
                      left: -4,
                      right: 0,
                      top: nowOffset,
                      zIndex: 20,
                      display: "flex",
                      alignItems: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#0F6E56",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, borderTop: "1.5px solid #0F6E56" }} />
                  </div>
                )}

                {/* Linhas 30 min (over the cells) */}
                {HOUR_LABELS.slice(0, TOTAL_HOURS).map((h, i) => (
                  <div
                    key={`hh-${h}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                      borderTop: "1px dashed rgba(0,0,0,0.04)",
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  />
                ))}

                {/* Agendamentos — draggable */}
                {appts.map((appt) => (
                  <DraggableApptCard
                    key={appt.id}
                    appt={appt}
                    isActive={activeId === appt.id}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* DragOverlay: ghost card while dragging */}
    <DragOverlay>
      {activeAppt ? (
        <div
          style={{
            background: "#0F6E56",
            borderRadius: 6,
            padding: "6px 8px",
            opacity: 0.9,
            boxShadow: "0 4px 16px rgba(15,110,86,0.35)",
            minWidth: 80,
            cursor: "grabbing",
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, color: "#fff", margin: 0 }}>
            {formatTime(activeAppt.starts_at)}
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#C3EBDB", margin: "2px 0 0" }}>
            {(activeAppt.patients?.full_name ?? "Paciente").split(" ")[0]}
          </p>
        </div>
      ) : null}
    </DragOverlay>

    </DndContext>

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
  const today        = new Date();
  const cells        = useMemo(() => getMonthGrid(navDate), [navDate]);
  const currentMonth = navDate.getMonth();

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
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

      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const dayAppts       = getAppointmentsForDay(appointments, date);
          const isToday        = isSameDay(date, today);
          const isCurrentMonth = date.getMonth() === currentMonth;
          const isLastRow      = i >= cells.length - 7;

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
  rescheduleAction,
  practitioners,
}: {
  sessions: ScheduleSession[];
  allAppointments: Appointment[];
  patients: Patient[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  updateStatusAction?: (id: string, status: string) => Promise<void>;
  rescheduleAction?: (id: string, newStartsAt: string) => Promise<void>;
  practitioners?: { id: string; name: string }[];
}) {
  const [view, setView]                       = useState<View>("semana");
  const [navDate, setNavDate]                 = useState(new Date());
  const [selectedSlot, setSelectedSlot]       = useState<TimeSlot | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [filterPractitionerId, setFilterPractitionerId] = useState<string>("all");

  function navigatePrev() {
    if (view === "semana") setNavDate((d) => addDays(d, -7));
    else if (view === "mes") setNavDate((d) => addMonths(d, -1));
  }
  function navigateNext() {
    if (view === "semana") setNavDate((d) => addDays(d, 7));
    else if (view === "mes") setNavDate((d) => addMonths(d, 1));
  }
  function goToday()                { setNavDate(new Date()); }
  function onDayClick(date: Date)   { setNavDate(date); setView("dia"); }

  const navLabel = useMemo(() => {
    if (view === "dia") {
      const t = new Date();
      return isSameDay(navDate, t)
        ? "Hoje"
        : navDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    }
    if (view === "semana") {
      const start = startOfWeek(navDate);
      const end   = addDays(start, 6);
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    }
    return formatMonthYear(navDate);
  }, [view, navDate]);

  const showNav = view !== "dia";

  // Client-side filter by practitioner for clinic owners
  const filteredSessions = filterPractitionerId === "all"
    ? sessions
    : sessions.filter((s) => s.practitioner_id === filterPractitionerId);

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
                className="ml-[4px] text-[11px] font-medium text-[#0F6E56] hover:underline"
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

        <div className="flex items-center gap-2">
          {practitioners && practitioners.length > 1 && (
            <select
              value={filterPractitionerId}
              onChange={(e) => setFilterPractitionerId(e.target.value)}
              className="h-7 rounded-lg border border-black/[.08] bg-[#F4F3EF] px-2 text-[11px] text-[#6B6A66] font-medium outline-none focus:border-[#0F6E56]/40 transition"
            >
              <option value="all">Todos</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
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
      </div>

      {/* ── Views ── */}
      {view === "dia" && (
        <DayView
          sessions={filteredSessions}
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
          appointments={filterPractitionerId === "all"
            ? allAppointments
            : allAppointments.filter((a) => a.practitioner_id === filterPractitionerId)}
          navDate={navDate}
          onDayClick={onDayClick}
          patients={patients}
          sessionTypes={sessionTypes}
          createSessionAction={createSessionAction}
          onReschedule={rescheduleAction}
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
        onClose={() => setSelectedSession(null)}
        updateStatusAction={updateStatusAction}
      />
    </div>
  );
}
