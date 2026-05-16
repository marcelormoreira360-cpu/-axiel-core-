export type TimeSlot = {
  label: string;
  hour: number;
  minute: number;
  isBusinessHour: boolean;
};

export function buildDayTimeSlots(startHour = 6, endHour = 22): TimeSlot[] {
  return Array.from({ length: endHour - startHour + 1 }, (_, index) => {
    const hour = startHour + index;
    return {
      label: formatSlotLabel(hour),
      hour,
      minute: 0,
      isBusinessHour: hour >= 8 && hour <= 18,
    };
  });
}

export function formatSlotLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function buildStartsAtForToday(hour: number, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function getSlotKeyFromStartsAt(value: string) {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return `${date.getHours()}:00`;
}

export function getSlotKey(hour: number) {
  return `${hour}:00`;
}

export function getNowPositionPercent(startHour = 6, endHour = 22) {
  const now = new Date();
  const current = now.getHours() + now.getMinutes() / 60;
  if (current < startHour || current > endHour) return null;
  return ((current - startHour) / (endHour - startHour + 1)) * 100;
}
