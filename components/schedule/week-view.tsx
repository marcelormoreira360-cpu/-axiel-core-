"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PatientLite } from "@/services/patient-service";
import { useLocale } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CreateSessionModal } from "@/components/create-session-modal";
import type { Appointment, SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";
import {
  formatTime,
  getWeekDays,
  isSameDay,
} from "@/modules/schedule/date-utils";
import {
  HOUR_HEIGHT,
  START_HOUR,
  TOTAL_HOURS,
  GRID_HEIGHT,
  TIME_COL_W,
  HEADER_H,
  BODY_H,
  HOUR_LABELS,
  getNowOffset,
  type ConfirmLinkAction,
  type EmailLinkAction,
} from "@/components/schedule/grid";
import { DraggableApptCard } from "@/components/schedule/draggable-appt-card";
import { DroppableHourCell } from "@/components/schedule/droppable-hour-cell";

// ─── Week view — time grid ────────────────────────────────────────────────────

export function WeekView({
  appointments,
  navDate,
  onDayClick,
  patients,
  sessionTypes,
  createSessionAction,
  confirmLinkAction,
  emailLinkAction,
  onDelete,
  onReschedule,
  onResizeDuration,
}: {
  appointments: Appointment[];
  navDate: Date;
  onDayClick: (date: Date) => void;
  patients: PatientLite[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  confirmLinkAction?: ConfirmLinkAction;
  emailLinkAction?: EmailLinkAction;
  onDelete?: (id: string) => Promise<void>;
  onReschedule?: (id: string, newStartsAt: string) => Promise<void>;
  onResizeDuration?: (id: string, newDuration: number) => Promise<void>;
}) {
  const locale   = useLocale();
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

  const handleResize = useCallback((id: string, newDuration: number) => {
    const appt = localAppts.find((a) => a.id === id);
    if (!appt) return;
    setLocalAppts((prev) => prev.map((a) => a.id === id ? { ...a, duration_minutes: newDuration } : a));
    onResizeDuration?.(id, newDuration).catch(() => {
      setLocalAppts((prev) => prev.map((a) => a.id === id ? { ...a, duration_minutes: appt.duration_minutes } : a));
    });
  }, [localAppts, onResizeDuration]);

  const handleDelete = useCallback(async (id: string) => {
    if (!onDelete) return;
    const prev = localAppts;
    setLocalAppts((cur) => cur.filter((a) => a.id !== id));
    try { await onDelete(id); } catch { setLocalAppts(prev); }
  }, [localAppts, onDelete]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !onReschedule) return;

    // overId format: "YYYY-MM-DDTHH:mm:ss.sssZ__HH__MM"
    const parts = String(over.id).split("__");
    if (parts.length !== 3) return;
    const [dateIso, hourStr, minStr] = parts;
    const targetDate = new Date(dateIso);
    const targetHour = parseInt(hourStr, 10);
    const targetMin  = parseInt(minStr, 10);
    if (isNaN(targetHour) || isNaN(targetMin)) return;

    const apptId    = String(active.id);
    const appt      = localAppts.find((a) => a.id === apptId);
    if (!appt) return;

    const orig      = new Date(appt.starts_at);
    const newStart  = new Date(targetDate);
    newStart.setHours(targetHour, targetMin, 0, 0);

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

  function handleCellClick(date: Date, hour: number, minute = 0) {
    const slotDate = new Date(date);
    slotDate.setHours(hour, minute, 0, 0);
    const adjusted: TimeSlot = {
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      hour,
      minute,
      isBusinessHour: hour >= 8 && hour <= 18,
      date: slotDate,
    };
    setSelectedSlot(adjusted);
  }

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div
        className="border-b border-black/[.07] dark:border-white/[.07]"
        style={{
          display: "flex",
          height: HEADER_H,
        }}
      >
        {/* Canto */}
        <div
          className="bg-[#F4F3EF] dark:bg-white/[.04] border-r border-black/[.07] dark:border-white/[.07]"
          style={{
            width: TIME_COL_W,
            flexShrink: 0,
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
              className={isToday ? "bg-[#F0FAF6] dark:bg-[#0F6E56]/[.12]" : "bg-white dark:bg-[#111827]"}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: "pointer",
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
                className={isToday ? "" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}
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
                  color: isToday ? "#fff" : undefined,
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
          className="bg-[#F4F3EF] dark:bg-white/[.04] border-r border-black/[.07] dark:border-white/[.07]"
          style={{
            width: TIME_COL_W,
            flexShrink: 0,
            height: GRID_HEIGHT,
            position: "relative",
          }}
        >
          {HOUR_LABELS.map((h) => (
            <div
              key={h}
              className="text-[#0F1A2E] dark:text-[#E8E6E2]"
              style={{
                position: "absolute",
                top: (h - START_HOUR) * HOUR_HEIGHT + 4,
                right: 8,
                fontSize: 11,
                fontWeight: 600,
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
                className={`border-r border-black/[.05] dark:border-white/[.05] ${isToday ? "bg-[#F8FFFE] dark:bg-[#0F6E56]/[.06]" : "bg-white dark:bg-[#111827]"}`}
                style={{
                  flex: 1,
                  position: "relative",
                  height: GRID_HEIGHT,
                }}
              >
                {/* Células clicáveis e droppable de 30 em 30 min */}
                {HOUR_LABELS.slice(0, TOTAL_HOURS).flatMap((h) =>
                  [0, 30].map((m) => (
                    <DroppableHourCell
                      key={`cell-${h}-${m}`}
                      id={`${date.toISOString()}__${h}__${m}`}
                      date={date}
                      hour={h}
                      minute={m}
                      onClick={() => !activeId && handleCellClick(date, h, m)}
                    />
                  )),
                )}

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

                {/* Linha sólida na hora cheia (alinhada ao rótulo) */}
                {HOUR_LABELS.slice(0, TOTAL_HOURS).map((h, i) => (
                  <div
                    key={`hr-${h}`}
                    className="border-t border-black/[.08] dark:border-white/[.08]"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: i * HOUR_HEIGHT,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  />
                ))}
                {/* Linha tracejada leve na meia hora */}
                {HOUR_LABELS.slice(0, TOTAL_HOURS).map((h, i) => (
                  <div
                    key={`hh-${h}`}
                    className="border-t border-dashed border-black/[.05] dark:border-white/[.06]"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  />
                ))}

                {/* Agendamentos — draggable + resizable */}
                {appts.map((appt) => (
                  <DraggableApptCard
                    key={appt.id}
                    appt={appt}
                    isActive={activeId === appt.id}
                    onResize={handleResize}
                    onDelete={onDelete ? handleDelete : undefined}
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
            {formatTime(activeAppt.starts_at, locale)}
          </p>
          <p style={{ fontSize: 11, fontWeight: 500, color: "#C3EBDB", margin: "2px 0 0" }}>
            {(activeAppt.patients?.full_name ?? "Paciente").split(" ")[0]}
          </p>
        </div>
      ) : null}
    </DragOverlay>

    </DndContext>

    {selectedSlot && (
      <CreateSessionModal
        slot={selectedSlot}
        patients={patients}
        sessionTypes={sessionTypes}
        onClose={() => setSelectedSlot(null)}
        action={createSessionAction}
        confirmLinkAction={confirmLinkAction}
        emailLinkAction={emailLinkAction}
      />
    )}
    </>
  );
}
