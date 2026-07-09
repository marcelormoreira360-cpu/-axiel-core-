"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ScheduleSession } from "@/components/session-card";
import { formatTime } from "@/modules/schedule/date-utils";
import { HOUR_HEIGHT, apptStyle } from "@/components/schedule/grid";

// ─── Draggable session card (day view) ───────────────────────────────────────

export function DraggableDayCard({
  session,
  isActive,
  onOpen,
  onResize,
  onDelete,
}: {
  session: ScheduleSession;
  isActive: boolean;
  onOpen: (s: ScheduleSession) => void;
  onResize?: (id: string, newDuration: number) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("schedule.calendar");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  });

  const [resizeDuration, setResizeDuration] = useState<number | null>(null);
  const resizeRef = useRef<{ startY: number; origDuration: number } | null>(null);

  const displayDuration = resizeDuration ?? session.duration_minutes ?? 60;
  const { top, height } = apptStyle(session.starts_at, displayDuration);
  const name      = session.patients?.full_name ?? "Paciente";
  const firstName = name.split(" ")[0];
  const isResizing = resizeDuration !== null;

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { startY: e.clientY, origDuration: session.duration_minutes ?? 60 };
    setResizeDuration(session.duration_minutes ?? 60);
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return;
    const deltaY    = e.clientY - resizeRef.current.startY;
    const MINS_PER_PX = 60 / HOUR_HEIGHT;
    const deltaMins = Math.round((deltaY * MINS_PER_PX) / 15) * 15;
    const newDur    = Math.max(15, resizeRef.current.origDuration + deltaMins);
    setResizeDuration(newDur);
  }

  function handleResizePointerUp(_e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return;
    const finalDur = resizeDuration ?? (session.duration_minutes ?? 60);
    resizeRef.current = null;
    setResizeDuration(null);
    if (finalDur !== (session.duration_minutes ?? 60)) {
      onResize?.(session.id, finalDur);
    }
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => {
        if (!isDragging && !isActive && !isResizing) onOpen(session);
      }}
      style={{
        position: "absolute",
        left: 3,
        right: 3,
        top: top + 1,
        height: height - 2,
        zIndex: isDragging ? 50 : 10,
        background: isActive ? "#C3EBDB" : "#E1F5EE",
        border: `1px solid ${isActive || isResizing ? "rgba(15,110,86,0.5)" : "rgba(15,110,86,0.25)"}`,
        borderRadius: 6,
        padding: "4px 6px",
        overflow: "hidden",
        display: "block",
        textAlign: "left",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.35 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
      }}
      {...listeners}
      {...attributes}
    >
      {onDelete && (
        <div
          role="button"
          aria-label={t("delete")}
          title={t("delete")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(session.id);
          }}
          style={{
            position: "absolute", top: 2, right: 2, width: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, color: "#B42318", background: "rgba(255,255,255,0.75)",
            fontSize: 13, lineHeight: 1, cursor: "pointer", zIndex: 30,
          }}
        >×</div>
      )}
      <p style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
        {formatTime(session.starts_at, locale)}
      </p>
      <p style={{ fontSize: 11, fontWeight: 500, color: "#0F1A2E", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }}>
        {firstName}
      </p>
      {height >= 48 && (
        <p style={{ fontSize: 9, color: "#6B6A66", lineHeight: 1.2, margin: 0 }}>
          {displayDuration} min
        </p>
      )}

      {/* ── Resize handle ── */}
      <div
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isResizing ? "rgba(15,110,86,0.15)" : "transparent",
          borderRadius: "0 0 6px 6px",
          touchAction: "none",
        }}
      >
        <div style={{
          width: 20,
          height: 2,
          borderRadius: 1,
          background: isResizing ? "#0F6E56" : "rgba(15,110,86,0.3)",
          transition: "background 0.15s",
        }} />
      </div>
    </button>
  );
}
