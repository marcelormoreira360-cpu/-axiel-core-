"use client";

import { useMemo, useState } from "react";
import { CreateSessionModal } from "@/components/create-session-modal";
import { SessionCard, type ScheduleSession } from "@/components/session-card";
import { SessionDrawer } from "@/components/session-drawer";
import type { Patient, SessionType } from "@/lib/types";
import {
  buildDayTimeSlots,
  getNowPositionPercent,
  getSlotKey,
  getSlotKeyFromStartsAt,
  type TimeSlot,
} from "@/modules/schedule/time-slots";

export function ScheduleDayView({
  sessions,
  patients,
  sessionTypes,
  createSessionAction,
}: {
  sessions: ScheduleSession[];
  patients: Patient[];
  sessionTypes: SessionType[];
  createSessionAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
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
        {/* "Now" indicator */}
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
              {/* Time label */}
              <div className="flex items-start pt-[14px] pl-[14px] shrink-0">
                <span className={`text-[11px] font-medium ${slot.isBusinessHour ? "text-[#A09E98]" : "text-[#D3D1C7]"}`}>
                  {slot.label}
                </span>
              </div>

              {/* Slot content */}
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
                      <SessionCard key={session.id} session={session} onOpen={setSelectedSession} />
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

      <SessionDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
    </>
  );
}
