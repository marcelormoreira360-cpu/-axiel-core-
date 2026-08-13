import { describe, it, expect } from "vitest";
import {
  isTransitionAllowed,
  classifyCancellationByWindow,
  getStaffQuickActions,
  staffActionToRequested,
  SENSITIVE_STAFF_ACTIONS,
  SESSION_CONSUMING_STATUSES,
  TERMINAL_STATUSES,
} from "@/services/appointment-status-service";

// Testa a lógica PURA do motor de status (sem tocar no banco): máquina de
// transições, autorização por ator e classificação da janela de cancelamento.

describe("máquina de estados do agendamento", () => {
  it("permite as transições da equipe do caminho feliz", () => {
    expect(isTransitionAllowed("scheduled", "confirmed", "staff")).toBe(true);
    expect(isTransitionAllowed("confirmed", "checked_in", "staff")).toBe(true);
    expect(isTransitionAllowed("checked_in", "completed", "staff")).toBe(true);
    expect(isTransitionAllowed("scheduled", "no_show", "staff")).toBe(true);
  });

  it("permite paciente confirmar por pending/scheduled", () => {
    for (const from of ["pending", "scheduled"]) {
      expect(isTransitionAllowed(from, "confirmed", "patient")).toBe(true);
    }
  });

  it("permite paciente cancelar por pending/scheduled/confirmed", () => {
    for (const from of ["pending", "scheduled", "confirmed"]) {
      expect(isTransitionAllowed(from, "cancelled_notice", "patient")).toBe(true);
      expect(isTransitionAllowed(from, "late_cancel", "patient")).toBe(true);
    }
  });

  it("bloqueia o paciente de fazer check-in, concluir ou marcar falta", () => {
    expect(isTransitionAllowed("confirmed", "checked_in", "patient")).toBe(false);
    expect(isTransitionAllowed("checked_in", "completed", "patient")).toBe(false);
    expect(isTransitionAllowed("confirmed", "no_show", "patient")).toBe(false);
  });

  it("bloqueia transições inválidas (ex.: completed -> checked_in)", () => {
    expect(isTransitionAllowed("completed", "checked_in", "staff")).toBe(false);
    expect(isTransitionAllowed("confirmed", "completed", "staff")).toBe(false); // exige checked_in antes
  });

  it("estados terminais não têm saída no fluxo normal", () => {
    for (const from of TERMINAL_STATUSES) {
      expect(isTransitionAllowed(from, "confirmed", "staff")).toBe(false);
      expect(isTransitionAllowed(from, "scheduled", "staff")).toBe(false);
    }
  });

  it("permite correções da equipe (desfazer check-in, reverter falta)", () => {
    expect(isTransitionAllowed("checked_in", "confirmed", "staff")).toBe(true);
    expect(isTransitionAllowed("no_show", "scheduled", "staff")).toBe(true);
    expect(isTransitionAllowed("no_show", "confirmed", "staff")).toBe(true);
  });
});

describe("classificação da janela de cancelamento", () => {
  const starts = "2026-08-20T14:00:00.000Z";

  it("com aviso quando cancela antes de starts_at - janela", () => {
    const now = new Date("2026-08-19T10:00:00.000Z"); // ~28h antes
    expect(classifyCancellationByWindow(starts, 24, now)).toBe("cancelled_notice");
  });

  it("tardio quando cancela dentro da janela", () => {
    const now = new Date("2026-08-20T02:00:00.000Z"); // 12h antes, janela de 24h
    expect(classifyCancellationByWindow(starts, 24, now)).toBe("late_cancel");
  });

  it("respeita janela configurável por clínica (ex.: 48h)", () => {
    const now = new Date("2026-08-19T10:00:00.000Z"); // 28h antes
    expect(classifyCancellationByWindow(starts, 48, now)).toBe("late_cancel");
  });

  it("exatamente no limite conta como tardio (>= prazo)", () => {
    const now = new Date("2026-08-19T14:00:00.000Z"); // exatamente 24h antes
    expect(classifyCancellationByWindow(starts, 24, now)).toBe("late_cancel");
  });
});

describe("ações rápidas da equipe no drawer (getStaffQuickActions)", () => {
  it("pending: confirmar, faltar e cancelar (sem check-in nem concluir)", () => {
    expect(getStaffQuickActions("pending")).toEqual(["confirm", "no_show", "cancel"]);
  });

  it("scheduled: caminho completo (confirmar, check-in, concluir, faltar, cancelar)", () => {
    expect(getStaffQuickActions("scheduled")).toEqual([
      "confirm",
      "check_in",
      "complete",
      "no_show",
      "cancel",
    ]);
  });

  it("null cai no default 'scheduled'", () => {
    expect(getStaffQuickActions(null)).toEqual(getStaffQuickActions("scheduled"));
  });

  it("confirmed: check-in, concluir, faltar, cancelar (sem 'confirmar' de novo)", () => {
    expect(getStaffQuickActions("confirmed")).toEqual(["check_in", "complete", "no_show", "cancel"]);
  });

  it("checked_in: só concluir (não expõe correções que afetam receita)", () => {
    expect(getStaffQuickActions("checked_in")).toEqual(["complete"]);
  });

  it("completed: nenhuma ação rápida (reabrir é gateado a dono/gestor)", () => {
    expect(getStaffQuickActions("completed")).toEqual([]);
  });

  it("no_show: só reverter para confirmado", () => {
    expect(getStaffQuickActions("no_show")).toEqual(["confirm"]);
  });

  it("estados terminais não oferecem ação rápida", () => {
    for (const from of TERMINAL_STATUSES) {
      expect(getStaffQuickActions(from)).toEqual([]);
    }
  });

  it("apenas faltar e cancelar são ações sensíveis (exigem confirmação)", () => {
    expect(SENSITIVE_STAFF_ACTIONS).toEqual(["no_show", "cancel"]);
  });

  it("traduz cada ação rápida para o 'requested' que o wrapper da equipe espera", () => {
    expect(staffActionToRequested("confirm")).toBe("confirmed");
    expect(staffActionToRequested("check_in")).toBe("checked_in");
    expect(staffActionToRequested("complete")).toBe("completed");
    expect(staffActionToRequested("no_show")).toBe("no_show");
    // 'cancel' vira 'cancelled'; a janela decide notice × late no servidor.
    expect(staffActionToRequested("cancel")).toBe("cancelled");
  });
});

describe("consumo de sessão do pacote", () => {
  it("só confirmed/checked_in/completed consomem", () => {
    expect(SESSION_CONSUMING_STATUSES).toEqual(["confirmed", "checked_in", "completed"]);
    for (const s of ["pending", "scheduled", "no_show", "late_cancel", "cancelled_notice", "cancelled"]) {
      expect(SESSION_CONSUMING_STATUSES).not.toContain(s);
    }
  });
});
