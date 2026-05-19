export interface TimeSlot {
  time: string; // "09:00"
  iso: string;  // full ISO for the given date
}

export function generateSlots(
  dateStr: string,       // "YYYY-MM-DD"
  opensAt: string,       // "09:00"
  closesAt: string,      // "17:00"
  durationMinutes: number,
  bookedStartsAt: string[] // ISO strings of existing appointments
): TimeSlot[] {
  const [openH, openM] = opensAt.split(":").map(Number);
  const [closeH, closeM] = closesAt.split(":").map(Number);

  const openTotal  = openH  * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  const bookedMinutes = new Set(
    bookedStartsAt.map((iso) => {
      const d = new Date(iso);
      return d.getHours() * 60 + d.getMinutes();
    })
  );

  const slots: TimeSlot[] = [];
  for (let min = openTotal; min + durationMinutes <= closeTotal; min += durationMinutes) {
    if (bookedMinutes.has(min)) continue;

    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    const time = `${h}:${m}`;
    slots.push({ time, iso: `${dateStr}T${time}:00` });
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
