import { describe, it, expect } from "vitest";
import {
  generateSlots,
  BOOKING_SLOT_STEP_MINUTES,
  type BookedInterval,
} from "@/lib/booking-utils";

const DATE = "2026-01-15";
// ISO UTC para uma hora:minuto naquele dia (timezone dos testes = "UTC")
const isoAt = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 15, h, m, 0)).toISOString();

describe("generateSlots — passo de 15 min", () => {
  it("passo padrão é 15 minutos", () => {
    expect(BOOKING_SLOT_STEP_MINUTES).toBe(15);
  });

  it("sem agendamentos, oferece horários de 15 em 15 (sessão de 60 min)", () => {
    const slots = generateSlots(DATE, "09:00", "11:00", 60, [], "UTC");
    expect(slots.map((s) => s.time)).toEqual([
      "09:00", "09:15", "09:30", "09:45", "10:00",
    ]);
  });

  it("não oferece horário cuja sessão ultrapasse o fechamento", () => {
    // 09:15 + 60 = 10:15 > 10:00 → só 09:00 cabe
    const slots = generateSlots(DATE, "09:00", "10:00", 60, [], "UTC");
    expect(slots.map((s) => s.time)).toEqual(["09:00"]);
  });

  it("respeita um passo customizado (ex.: 30 min)", () => {
    const slots = generateSlots(DATE, "09:00", "11:00", 60, [], "UTC", 30);
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00"]);
  });
});

describe("generateSlots — conflito por sobreposição (anti double-booking)", () => {
  it("uma sessão de 135 min (09:00–11:15) bloqueia todos os horários que a tocam", () => {
    const booked: BookedInterval[] = [{ starts_at: isoAt(9, 0), duration_minutes: 135 }];
    const times = generateSlots(DATE, "08:00", "13:00", 60, booked, "UTC").map((s) => s.time);

    // O bug que estamos evitando: com passo de 15 min, esses NÃO podem aparecer
    expect(times).not.toContain("09:00");
    expect(times).not.toContain("09:15");
    expect(times).not.toContain("10:30");
    expect(times).not.toContain("11:00"); // 11:00–12:00 ainda toca 09:00–11:15

    // Livres: antes e depois do intervalo ocupado
    expect(times).toContain("08:00"); // 08:00–09:00 encosta, não sobrepõe
    expect(times).toContain("11:15"); // 11:15–12:15 começa exatamente no fim do ocupado
  });

  it("um horário que encosta no fim de um agendamento (sem sobrepor) fica livre", () => {
    const booked: BookedInterval[] = [{ starts_at: isoAt(9, 0), duration_minutes: 60 }]; // 09:00–10:00
    const times = generateSlots(DATE, "09:00", "12:00", 30, booked, "UTC").map((s) => s.time);

    expect(times).not.toContain("09:00"); // sobrepõe
    expect(times).not.toContain("09:30"); // 09:30–10:00 sobrepõe
    expect(times).not.toContain("09:45"); // 09:45–10:15 sobrepõe
    expect(times).toContain("10:00");     // 10:00–10:30 encosta, não sobrepõe
  });

  it("duração ausente no agendamento existente assume 60 min", () => {
    const booked = [{ starts_at: isoAt(9, 0) } as BookedInterval]; // sem duration_minutes
    const times = generateSlots(DATE, "09:00", "12:00", 30, booked, "UTC").map((s) => s.time);
    expect(times).not.toContain("09:30"); // dentro dos 60 min assumidos
    expect(times).toContain("10:00");     // já livre após os 60 min
  });
});
