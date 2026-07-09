"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import type { ScheduleSession } from "@/components/session-card";
import type { SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import {
  buildDayTimeSlots,
  getSlotKey,
  getSlotKeyFromStartsAt,
} from "@/modules/schedule/time-slots";
import { formatTime } from "@/modules/schedule/date-utils";
import {
  HOUR_HEIGHT,
  START_HOUR,
  TOTAL_HOURS,
  GRID_HEIGHT,
  TIME_COL_W,
  BODY_H,
  HOUR_LABELS,
  getNowOffset,
  type ConfirmLinkAction,
  type EmailLinkAction,
} from "@/components/schedule/grid";
import { DraggableDayCard } from "@/components/schedule/draggable-day-card";
import { DroppableHourCell } from "@/components/schedule/droppable-hour-cell";

// ─── Day view ────────────────────────────────────────────────────────────────

export function DayView({
  sessions,
  navDate,
  patients,
  sessionTypes,
  createSessionAction,
  confirmLinkAction,
  emailLinkAction,
  onDelete,
  onOpenSession,
  setSelectedSlot,
  selectedSlot,
  onReschedule,
  onResizeDuration,
}: {
  sessions: ScheduleSession[];
  navDate: Date;
  patients: PatientLite[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
  confirmLinkAction?: ConfirmLinkAction;
  emailLinkAction?: EmailLinkAction;
  onDelete?: (id: string) => Promise<void>;
  onOpenSession: (s: ScheduleSession) => void;
  setSelectedSlot: (s: TimeSlot | null) => void;
  selectedSlot: TimeSlot | null;
  onReschedule?: (id: string, newStartsAt: string) => Promise<void>;
  onResizeDuration?: (id: string, newDuration: number) => Promise<void>;
}) {
  const locale     = useLocale();
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

  // Optimistic local state for drag-and-drop
  const [localSessions, setLocalSessions] = useState<ScheduleSession[]>(sessions);
  useEffect(() => { setLocalSessions(sessions); }, [sessions]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleResize = useCallback((id: string, newDuration: number) => {
    const s = localSessions.find((x) => x.id === id);
    if (!s) return;
    setLocalSessions((prev) =>
      prev.map((x) => x.id === id ? { ...x, duration_minutes: newDuration } : x)
    );
    onResizeDuration?.(id, newDuration).catch(() => {
      setLocalSessions((prev) =>
        prev.map((x) => x.id === id ? { ...x, duration_minutes: s.duration_minutes } : x)
      );
    });
  }, [localSessions, onResizeDuration]);

  const handleDelete = useCallback(async (id: string) => {
    if (!onDelete) return;
    const prev = localSessions;
    setLocalSessions((cur) => cur.filter((x) => x.id !== id));
    try { await onDelete(id); } catch { setLocalSessions(prev); }
  }, [localSessions, onDelete]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !onReschedule) return;

    // overId format: "day__HH__MM"
    const parts = String(over.id).split("__");
    if (parts.length !== 3 || parts[0] !== "day") return;
    const targetHour = parseInt(parts[1], 10);
    const targetMin  = parseInt(parts[2], 10);
    if (isNaN(targetHour) || isNaN(targetMin)) return;

    const sessionId = String(active.id);
    const s         = localSessions.find((x) => x.id === sessionId);
    if (!s) return;

    const orig     = new Date(s.starts_at);
    const newStart = new Date(navDate);
    newStart.setHours(targetHour, targetMin, 0, 0);

    if (newStart.getTime() === orig.getTime()) return;

    const newStartsAt = newStart.toISOString();

    // Optimistic update
    setLocalSessions((prev) =>
      prev.map((x) => x.id === sessionId ? { ...x, starts_at: newStartsAt } : x)
    );

    // Persist
    onReschedule(sessionId, newStartsAt).catch(() => {
      setLocalSessions((prev) =>
        prev.map((x) => x.id === sessionId ? { ...x, starts_at: s.starts_at } : x)
      );
    });
  }, [localSessions, navDate, onReschedule]);

  const activeSession = activeId ? localSessions.find((x) => x.id === activeId) : null;

  const sessionsBySlot = useMemo(() => {
    return localSessions.reduce<Record<string, ScheduleSession[]>>((acc, s) => {
      const key = getSlotKeyFromStartsAt(s.starts_at);
      acc[key] = [...(acc[key] ?? []), s];
      return acc;
    }, {});
  }, [localSessions]);

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* ── Grid ── */}
      <div
        ref={scrollRef}
        className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px]"
        style={{
          display: "flex",
          height: BODY_H,
          overflowY: "auto",
        }}
      >
        {/* Coluna de horários */}
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

          {/* Droppable cells de 30 em 30 min */}
          {HOUR_LABELS.slice(0, TOTAL_HOURS).flatMap((h) =>
            [0, 30].map((m) => (
              <DroppableHourCell
                key={`day-cell-${h}-${m}`}
                id={`day__${h}__${m}`}
                date={navDate}
                hour={h}
                minute={m}
                onClick={() => {
                  if (!activeId) {
                    const slotDate = new Date(navDate);
                    slotDate.setHours(h, m, 0, 0);
                    setSelectedSlot({
                      label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                      hour: h,
                      minute: m,
                      isBusinessHour: h >= 8 && h <= 18,
                      date: slotDate,
                    });
                  }
                }}
              />
            )),
          )}

          {/* Background slot rows (visual only) */}
          {slots.map((slot, i) => {
            const isLast = i === slots.length - 1;
            return (
              <div
                key={slot.label}
                className={[
                  slot.isBusinessHour ? "bg-white dark:bg-[#111827]" : "bg-[#FAFAF8] dark:bg-white/[.02]",
                  isLast ? "" : "border-b border-black/[.05] dark:border-white/[.05]",
                ].join(" ")}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: i * HOUR_HEIGHT,
                  height: HOUR_HEIGHT,
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              >
                {/* Linha 30min */}
                <div
                  className="border-t border-dashed border-black/[.05] dark:border-white/[.06]"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: HOUR_HEIGHT / 2,
                  }}
                />
              </div>
            );
          })}

          {/* Empty slot buttons (shown only when no session in that slot) */}
          {slots.map((slot) => {
            const items = sessionsBySlot[getSlotKey(slot.hour)] ?? [];
            if (items.length > 0) return null;
            return (
              <button
                key={`add-${slot.label}`}
                type="button"
                onClick={() => !activeId && setSelectedSlot(slot)}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: (slot.hour - START_HOUR) * HOUR_HEIGHT,
                  height: HOUR_HEIGHT,
                  zIndex: 2,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "transparent",
                  borderRadius: 6,
                }}
                className="hover:border hover:border-dashed hover:border-[#0F6E56]/25 hover:text-[#0F6E56] hover:bg-[#F0FAF6] dark:hover:bg-[#0F6E56]/[.10] transition"
              >
                {slot.isBusinessHour ? "+ Agendar" : ""}
              </button>
            );
          })}

          {/* Draggable session cards */}
          {localSessions.map((s) => (
            <DraggableDayCard
              key={s.id}
              session={s}
              isActive={activeId === s.id}
              onOpen={onOpenSession}
              onResize={handleResize}
              onDelete={onDelete ? handleDelete : undefined}
            />
          ))}
        </div>
      </div>

      {/* DragOverlay: ghost card while dragging */}
      <DragOverlay>
        {activeSession ? (
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
              {formatTime(activeSession.starts_at, locale)}
            </p>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#C3EBDB", margin: "2px 0 0" }}>
              {(activeSession.patients?.full_name ?? "Paciente").split(" ")[0]}
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
