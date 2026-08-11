import { describe, it, expect } from "vitest";
import {
  buildDayTimeSlots,
  getSlotKey,
  getSlotKeyFromStartsAt,
  SLOT_STEP_MINUTES,
} from "@/modules/schedule/time-slots";

describe("buildDayTimeSlots (grade de 15 em 15 min)", () => {
  it("passo padrão é 15 minutos", () => {
    expect(SLOT_STEP_MINUTES).toBe(15);
  });

  it("gera os quatro horários de cada hora (00/15/30/45)", () => {
    const slots = buildDayTimeSlots(6, 22);
    expect(slots[0]).toMatchObject({ hour: 6, minute: 0, label: "06:00" });
    expect(slots[1]).toMatchObject({ hour: 6, minute: 15, label: "06:15" });
    expect(slots[2]).toMatchObject({ hour: 6, minute: 30, label: "06:30" });
    expect(slots[3]).toMatchObject({ hour: 6, minute: 45, label: "06:45" });
    expect(slots[4]).toMatchObject({ hour: 7, minute: 0, label: "07:00" });
  });

  it("endHour é exclusivo: último slot agendável é 21:45", () => {
    const slots = buildDayTimeSlots(6, 22);
    expect(slots[slots.length - 1]).toMatchObject({ hour: 21, minute: 45 });
  });

  it("quantidade = (endHour - startHour) * 4", () => {
    expect(buildDayTimeSlots(6, 22)).toHaveLength((22 - 6) * 4);
  });

  it("respeita um passo customizado (ex.: 30 min)", () => {
    const slots = buildDayTimeSlots(9, 11, 30);
    expect(slots.map((s) => s.label)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });
});

describe("getSlotKey / getSlotKeyFromStartsAt", () => {
  it("getSlotKey inclui hora e minuto", () => {
    expect(getSlotKey(9, 15)).toBe("9:15");
    expect(getSlotKey(9, 0)).toBe("9:0");
  });

  it("arredonda o starts_at para baixo ao bloco de 15 min", () => {
    const at = (h: number, m: number) => new Date(2026, 0, 15, h, m, 0).toISOString();
    expect(getSlotKeyFromStartsAt(at(9, 0))).toBe("9:0");
    expect(getSlotKeyFromStartsAt(at(9, 14))).toBe("9:0");
    expect(getSlotKeyFromStartsAt(at(9, 20))).toBe("9:15");
    expect(getSlotKeyFromStartsAt(at(9, 47))).toBe("9:45");
  });

  it("a chave de um slot bate com a chave do starts_at correspondente", () => {
    const slots = buildDayTimeSlots(9, 10); // 09:00, 09:15, 09:30, 09:45
    const slot = slots[1]; // 09:15
    const startsAt = new Date(2026, 0, 15, slot.hour, slot.minute, 0).toISOString();
    expect(getSlotKeyFromStartsAt(startsAt)).toBe(getSlotKey(slot.hour, slot.minute));
  });
});
