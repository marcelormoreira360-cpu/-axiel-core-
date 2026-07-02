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

export function generateSlots(
  dateStr: string,          // "YYYY-MM-DD"
  opensAt: string,          // "09:00"  — wall-clock in clinic timezone
  closesAt: string,         // "17:00"  — wall-clock in clinic timezone
  durationMinutes: number,
  bookedStartsAt: string[], // UTC ISO strings of existing appointments
  timezone = "UTC",         // IANA timezone (e.g. "America/Sao_Paulo")
): TimeSlot[] {
  const [openH, openM] = opensAt.split(":").map(Number);
  const [closeH, closeM] = closesAt.split(":").map(Number);

  const openTotal  = openH  * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  // Extract booked minutes in the clinic's wall-clock time (not UTC)
  const bookedMinutes = new Set(
    bookedStartsAt.map((iso) => utcToLocalMinutes(iso, timezone)),
  );

  const slots: TimeSlot[] = [];
  for (let min = openTotal; min + durationMinutes <= closeTotal; min += durationMinutes) {
    if (bookedMinutes.has(min)) continue;

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
