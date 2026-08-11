export type TimeSlot = {
  label: string;
  hour: number;
  minute: number;
  isBusinessHour: boolean;
  /** Quando definida, o slot é para esta data específica (ex: semana view) */
  date?: Date;
};

/** Passo padrão da grade da agenda, em minutos (horários de 15 em 15). */
export const SLOT_STEP_MINUTES = 15;

/**
 * Gera os horários agendáveis do dia, de `stepMinutes` em `stepMinutes`.
 * `endHour` é exclusivo: marca o fim do expediente, não um horário agendável
 * (ex.: com 6→22 e passo 15, o último slot é 21:45).
 */
export function buildDayTimeSlots(
  startHour = 6,
  endHour = 22,
  stepMinutes = SLOT_STEP_MINUTES,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let total = startHour * 60; total < endHour * 60; total += stepMinutes) {
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    slots.push({
      label: formatSlotLabel(hour, minute),
      hour,
      minute,
      isBusinessHour: hour >= 8 && hour <= 18,
    });
  }
  return slots;
}

export function formatSlotLabel(hour: number, minute = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function buildStartsAtForToday(hour: number, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** Gera starts_at para uma data específica (usado na semana view) */
export function buildStartsAtForDate(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Chave do slot a partir de um starts_at, arredondando para baixo ao bloco de
 * `stepMinutes` (ex.: 09:20 → "9:15"). Usada para saber se um slot já está ocupado.
 */
export function getSlotKeyFromStartsAt(value: string, stepMinutes = SLOT_STEP_MINUTES) {
  const date = new Date(value);
  const snapped = Math.floor(date.getMinutes() / stepMinutes) * stepMinutes;
  return `${date.getHours()}:${snapped}`;
}

export function getSlotKey(hour: number, minute = 0) {
  return `${hour}:${minute}`;
}

export function getNowPositionPercent(startHour = 6, endHour = 22) {
  const now = new Date();
  const current = now.getHours() + now.getMinutes() / 60;
  if (current < startHour || current > endHour) return null;
  return ((current - startHour) / (endHour - startHour + 1)) * 100;
}
