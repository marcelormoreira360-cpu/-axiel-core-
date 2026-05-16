"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, NotebookText, UserRound } from "lucide-react";
import { ViewDetails } from "@/components/view-details";
import type { Appointment } from "@/lib/types";
import { formatDayLabel, formatShortDate, formatTime } from "@/modules/schedule/date-utils";
import { getAppointmentEndTime, getAppointmentsForDay, groupAppointmentsByWeekDay, type ScheduleView } from "@/modules/schedule/schedule-view";

type Props = {
  appointments: Appointment[];
};

export function ScheduleCalendar({ appointments }: Props) {
  const [view, setView] = useState<ScheduleView>("day");
  const today = useMemo(() => new Date(), []);
  const dayAppointments = getAppointmentsForDay(appointments, today);
  const weekGroups = groupAppointmentsByWeekDay(appointments, today);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-axiel-soft">
            <CalendarDays className="h-5 w-5 text-axiel-gold" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/40">Calendar</p>
            <h2 className="text-xl font-semibold">{formatDayLabel(today)}</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-full bg-axiel-soft p-1">
          {(["day", "week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`rounded-full px-5 py-3 text-sm font-semibold capitalize transition ${
                view === option ? "bg-white text-black shadow-sm" : "text-black/45 hover:text-black"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {view === "day" ? (
        <DayView appointments={dayAppointments} />
      ) : (
        <WeekView groups={weekGroups} />
      )}
    </div>
  );
}

function DayView({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return <EmptySchedule message="No sessions scheduled for today." />;
  }

  return (
    <div className="space-y-3">
      {appointments.slice(0, 5).map((appointment) => (
        <AppointmentCard key={appointment.id} appointment={appointment} size="large" />
      ))}
      {appointments.length > 5 ? (
        <ViewDetails label={`View ${appointments.length - 5} more sessions`}>
          <div className="space-y-3">
            {appointments.slice(5).map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} size="large" />
            ))}
          </div>
        </ViewDetails>
      ) : null}
    </div>
  );
}

function WeekView({ groups }: { groups: { date: Date; appointments: Appointment[] }[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {groups.map((group) => (
        <div key={group.date.toISOString()} className="min-h-64 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-black/35">{group.date.toLocaleDateString("en-US", { weekday: "short" })}</p>
          <h3 className="mt-1 text-lg font-semibold">{formatShortDate(group.date)}</h3>
          <div className="mt-4 space-y-2">
            {group.appointments.length === 0 ? (
              <div className="rounded-2xl bg-axiel-soft p-3 text-sm text-black/40">Open</div>
            ) : (
              <>
                {group.appointments.slice(0, 5).map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}
                {group.appointments.length > 5 ? <div className="rounded-2xl bg-white p-3 text-xs font-semibold text-black/40">+{group.appointments.length - 5} more</div> : null}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppointmentCard({ appointment, size = "compact" }: { appointment: Appointment; size?: "compact" | "large" }) {
  const endTime = getAppointmentEndTime(appointment);
  const patientName = appointment.patients?.full_name ?? "Patient";

  if (size === "large") {
    return (
      <div className="grid gap-4 rounded-xl border border-axiel-line bg-white p-6 shadow-sm md:grid-cols-[130px_1fr_auto] md:items-center">
        <div className="flex h-24 items-center justify-center rounded-3xl bg-axiel-ink text-center text-white">
          <div>
            <p className="text-2xl font-semibold">{formatTime(appointment.starts_at)}</p>
            <p className="mt-1 text-xs text-white/55">{formatTime(endTime.toISOString())}</p>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm text-black/45">
            <UserRound className="h-4 w-4" /> Patient
          </div>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">{patientName}</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-black/50">
            <span className="inline-flex items-center gap-1 rounded-full bg-axiel-soft px-3 py-1">
              <Clock className="h-3.5 w-3.5" /> {appointment.duration_minutes} min
            </span>
            {appointment.notes ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-axiel-soft px-3 py-1">
                <NotebookText className="h-3.5 w-3.5" /> Notes added
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/schedule/${appointment.id}/reminder`} className="inline-flex items-center justify-center rounded-lg border border-axiel-line bg-white px-5 py-3 text-sm font-semibold text-black/70">
            Send reminder
          </Link>
          <Link href={`/schedule/${appointment.id}/session`} className="inline-flex items-center justify-center rounded-lg bg-axiel-blue px-5 py-3 text-sm font-semibold text-white shadow-md">
            Open session <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/schedule/${appointment.id}/session`} className="block rounded-2xl bg-axiel-soft p-3 transition hover:bg-white hover:shadow-sm">
      <p className="text-sm font-semibold">{formatTime(appointment.starts_at)}</p>
      <p className="mt-1 truncate text-sm text-black/60">{patientName}</p>
      <p className="mt-2 text-xs text-black/40">{appointment.duration_minutes} min</p>
    </Link>
  );
}

function EmptySchedule({ message }: { message: string }) {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-white p-8 text-center shadow-sm transition duration-200 hover:shadow-md">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-axiel-soft">
        <CalendarDays className="h-7 w-7 text-axiel-gold" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold">Clear schedule</h3>
      <p className="mt-2 max-w-sm text-black/50">{message}</p>
      <Link href="/schedule/new" className="mt-6 rounded-lg bg-axiel-blue px-6 py-3 text-sm font-semibold text-white shadow-md">
        Create session
      </Link>
    </div>
  );
}
