export interface TimeSlot {
  time: string; // "09:00" — wall-clock time in clinic timezone
  iso: string;  // UTC ISO (ends with Z) for the exact moment this slot starts
}

/**
 * Convert a wall-clock date+time in the given IANA timezone to a UTC Date.
 * Uses the standard "probe + offset" method so DST transitions are handled correctly.
 */
export function wallClockToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [h, m] = timeStr.split(":").map(Number);

  // Treat the wall-clock time as if it were UTC → initial probe
  const probe = new Date(Date.UTC(year, month - 1, day, h, m, 0));

  // Find what local wall-clock that probe corresponds to in the target TZ
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(probe);

  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const probeLocalMs = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));

  // offsetMs = how many ms UTC is ahead of wall-clock (positive for UTC+N zones)
  const offsetMs = probe.getTime() - probeLocalMs;

  return new Date(Date.UTC(year, month - 1, day, h, m, 0) + offsetMs);
}

/**
 * Given a UTC ISO string, return the wall-clock minutes (h*60+m) in the given timezone.
 * Used to match booked appointment UTC timestamps against wall-clock slot times.
 */
function utcToLocalMinutes(iso: string, tz: string): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}

/** Passo dos horários oferecidos no agendamento público/voz, em minutos. */
export const BOOKING_SLOT_STEP_MINUTES = 15;

/** Agendamento existente, para checagem de conflito por sobreposição. */
export interface BookedInterval {
  starts_at: string;        // UTC ISO
  duration_minutes: number; // duração em minutos
}

export function generateSlots(
  dateStr: string,          // "YYYY-MM-DD"
  opensAt: string,          // "09:00"  — wall-clock in clinic timezone
  closesAt: string,         // "17:00"  — wall-clock in clinic timezone
  durationMinutes: number,
  booked: BookedInterval[], // agendamentos existentes (início + duração)
  timezone = "UTC",         // IANA timezone (e.g. "America/Sao_Paulo")
  stepMinutes = BOOKING_SLOT_STEP_MINUTES,
): TimeSlot[] {
  const [openH, openM] = opensAt.split(":").map(Number);
  const [closeH, closeM] = closesAt.split(":").map(Number);

  const openTotal  = openH  * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  // Intervalos ocupados em minutos wall-clock da clínica: [start, end)
  const busy = booked.map((b) => {
    const start = utcToLocalMinutes(b.starts_at, timezone);
    return { start, end: start + (b.duration_minutes ?? 60) };
  });

  const slots: TimeSlot[] = [];
  // Passo fixo (ex.: 15 min), independente da duração da sessão, para permitir
  // inícios flexíveis (ex.: uma sessão de 135 min podendo começar às 09:15).
  for (let min = openTotal; min + durationMinutes <= closeTotal; min += stepMinutes) {
    const slotStart = min;
    const slotEnd   = min + durationMinutes;

    // Rejeita o horário se a sessão candidata [slotStart, slotEnd) sobrepõe
    // QUALQUER agendamento existente. Overlap: início < fimDoOutro && fim > inícioDoOutro.
    // (A checagem por sobreposição, e não apenas pelo minuto de início, é o que
    // evita double-booking quando o passo é menor que a duração das sessões.)
    const overlaps = busy.some((b) => slotStart < b.end && slotEnd > b.start);
    if (overlaps) continue;

    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    const time = `${h}:${m}`;

    // Convert wall-clock → proper UTC ISO so comparisons with `new Date()` are correct
    const utcDate = wallClockToUTC(dateStr, time, timezone);
    slots.push({ time, iso: utcDate.toISOString() });
  }
  return slots;
}

export function isoToDisplay(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

// day_of_week: 0=Sun, 1=Mon ... 6=Sat
export function dayOfWeekFromDate(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay();
}
