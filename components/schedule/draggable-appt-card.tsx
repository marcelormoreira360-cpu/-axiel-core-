"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Appointment } from "@/lib/types";
import { formatTime } from "@/modules/schedule/date-utils";
import { HOUR_HEIGHT, apptStyle } from "@/components/schedule/grid";

// ─── Draggable + resizable appointment card (week view) ──────────────────────

export function DraggableApptCard({
  appt,
  isActive,
  onResize,
  onDelete,
}: {
  appt: Appointment;
  isActive: boolean;
  onResize?: (id: string, newDuration: number) => void;
  onDelete?: (id: string) => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("schedule.calendar");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appt.id,
    data: { appt },
  });

  // Resize state — null = not resizing
  const [resizeDuration, setResizeDuration] = useState<number | null>(null);
  const resizeRef = useRef<{ startY: number; origDuration: number } | null>(null);

  const displayDuration = resizeDuration ?? appt.duration_minutes ?? 60;
  const { top, height } = apptStyle(appt.starts_at, displayDuration);
  const name      = appt.patients?.full_name ?? "Paciente";
  const firstName = name.split(" ")[0];
  const isResizing = resizeDuration !== null;
  const isPending = appt.status === "pending";
  const accent = isPending ? "#8A5A06" : "#0F6E56";

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation(); // prevent dnd-kit from activating drag
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { startY: e.clientY, origDuration: appt.duration_minutes ?? 60 };
    setResizeDuration(appt.duration_minutes ?? 60);
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return;
    const deltaY    = e.clientY - resizeRef.current.startY;
    const MINS_PER_PX = 60 / HOUR_HEIGHT;
    const deltaMins = Math.round((deltaY * MINS_PER_PX) / 15) * 15;
    const newDur    = Math.max(15, resizeRef.current.origDuration + deltaMins);
    setResizeDuration(newDur);
  }

  function handleResizePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return;
    const finalDur = resizeDuration ?? (appt.duration_minutes ?? 60);
    resizeRef.current = null;
    setResizeDuration(null);
    if (finalDur !== (appt.duration_minutes ?? 60)) {
      onResize?.(appt.id, finalDur);
    }
  }

  return (
    <Link
      ref={setNodeRef}
      href={`/patients/${appt.patient_id}`}
      onClick={(e) => {
        if (isDragging || isActive || isResizing) e.preventDefault();
      }}
      style={{
        position: "absolute",
        left: 3,
        right: 3,
        top: top + 1,
        height: height - 2,
        zIndex: isDragging ? 50 : 10,
        background: isPending ? (isActive ? "#F6E3BC" : "#FAEEDA") : (isActive ? "#C3EBDB" : "#E1F5EE"),
        border: `1px solid ${isPending ? (isActive || isResizing ? "rgba(217,164,65,0.6)" : "rgba(217,164,65,0.4)") : (isActive || isResizing ? "rgba(15,110,86,0.5)" : "rgba(15,110,86,0.25)")}`,
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
      {onDelete && (
        <div
          role="button"
          aria-label={t("delete")}
          title={t("delete")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(appt.id);
          }}
          style={{
            position: "absolute", top: 2, right: 2, width: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, color: "#B42318", background: "rgba(255,255,255,0.75)",
            fontSize: 13, lineHeight: 1, cursor: "pointer", zIndex: 30,
          }}
        >×</div>
      )}
      <p style={{ fontSize: 10, fontWeight: 700, color: accent, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
        {formatTime(appt.starts_at, locale)}
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
    </Link>
  );
}
