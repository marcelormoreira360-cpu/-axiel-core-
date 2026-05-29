import { describe, it, expect } from "vitest";
import {
  addDays,
  isSameDay,
  getWeekDays,
} from "@/modules/schedule/date-utils";

describe("addDays", () => {
  it("adiciona dias corretamente", () => {
    const base = new Date(2026, 0, 1); // 2026-01-01
    const result = addDays(base, 5);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(6);
  });

  it("subtrai dias quando o valor é negativo", () => {
    const base = new Date(2026, 0, 10);
    const result = addDays(base, -3);
    expect(result.getDate()).toBe(7);
  });

  it("não muta a data original", () => {
    const base = new Date(2026, 0, 1);
    addDays(base, 10);
    expect(base.getDate()).toBe(1);
  });

  it("cruza mês corretamente", () => {
    const base = new Date(2026, 0, 30); // 30 jan
    const result = addDays(base, 5);   // 4 fev
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(4);
  });
});

describe("isSameDay", () => {
  it("retorna true para o mesmo dia", () => {
    const a = new Date(2026, 4, 15, 8, 0);
    const b = new Date(2026, 4, 15, 23, 59);
    expect(isSameDay(a, b)).toBe(true);
  });

  it("retorna false para dias diferentes no mesmo mês", () => {
    const a = new Date(2026, 4, 15);
    const b = new Date(2026, 4, 16);
    expect(isSameDay(a, b)).toBe(false);
  });

  it("retorna false para o mesmo dia em meses diferentes", () => {
    const a = new Date(2026, 4, 15);
    const b = new Date(2026, 5, 15);
    expect(isSameDay(a, b)).toBe(false);
  });

  it("retorna false para o mesmo dia em anos diferentes", () => {
    const a = new Date(2025, 4, 15);
    const b = new Date(2026, 4, 15);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe("getWeekDays", () => {
  it("retorna exatamente 7 dias", () => {
    const week = getWeekDays(new Date(2026, 4, 20)); // quarta
    expect(week).toHaveLength(7);
  });

  it("começa na segunda-feira", () => {
    const week = getWeekDays(new Date(2026, 4, 20)); // quarta 20/05/2026
    expect(week[0].getDay()).toBe(1); // 1 = segunda
  });

  it("termina no domingo", () => {
    const week = getWeekDays(new Date(2026, 4, 20));
    expect(week[6].getDay()).toBe(0); // 0 = domingo
  });

  it("os 7 dias são consecutivos", () => {
    const week = getWeekDays(new Date(2026, 4, 20));
    for (let i = 1; i < 7; i++) {
      const diff = week[i].getTime() - week[i - 1].getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("quando a entrada é uma segunda-feira, retorna a própria semana", () => {
    const monday = new Date(2026, 4, 18); // segunda 18/05/2026
    const week = getWeekDays(monday);
    expect(isSameDay(week[0], monday)).toBe(true);
  });

  it("quando a entrada é um domingo, retorna a semana cujo início é a segunda anterior", () => {
    const sunday = new Date(2026, 4, 17); // domingo 17/05/2026
    const week = getWeekDays(sunday);
    const expectedMonday = new Date(2026, 4, 11); // segunda 11/05/2026
    expect(isSameDay(week[0], expectedMonday)).toBe(true);
  });
});
