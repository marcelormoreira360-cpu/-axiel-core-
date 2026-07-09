"use client";

import { useTranslations } from "next-intl";
import { useDroppable } from "@dnd-kit/core";
import { HOUR_HEIGHT, START_HOUR } from "@/components/schedule/grid";

// ─── Droppable hour cell (week view) ─────────────────────────────────────────

export function DroppableHourCell({
  id,
  date,
  hour,
  minute,
  onClick,
  children,
}: {
  id: string;
  date: Date;
  hour: number;
  minute: number;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("schedule.calendar");
  const { setNodeRef, isOver } = useDroppable({ id, data: { date, hour, minute } });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: (hour - START_HOUR) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT,
        height: HOUR_HEIGHT / 2,
        background: isOver ? "rgba(15,110,86,0.06)" : "transparent",
        border: isOver ? "1px dashed rgba(15,110,86,0.35)" : "1px solid transparent",
        borderRadius: 4,
        cursor: "pointer",
        zIndex: 1,
        transition: "background 0.1s, border-color 0.1s",
      }}
      onClick={onClick}
      title={t("scheduleAt", { time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` })}
    >
      {children}
    </div>
  );
}
