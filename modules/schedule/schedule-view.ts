import type { Appointment } from "@/lib/types";
import { endOfDay, getWeekDays, startOfDay } from "@/modules/schedule/date-utils";

export type ScheduleView = "day" | "week";

export function getAppointmentsForDay(appointments: Appointment[], date: Date) {
  const start = startOfDay(date).getTime();
  const end = endOfDay(date).getTime();

  return appointments
    .filter((appointment) => {
      const time = new Date(appointment.starts_at).getTime();
      return time >= start && time <= end;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

export function groupAppointmentsByWeekDay(appointments: Appointment[], date: Date) {
  return getWeekDays(date).map((day) => ({
    date: day,
    appointments: getAppointmentsForDay(appointments, day),
  }));
}

export function getAppointmentEndTime(appointment: Appointment) {
  const start = new Date(appointment.starts_at);
  return new Date(start.getTime() + appointment.duration_minutes * 60 * 1000);
}
