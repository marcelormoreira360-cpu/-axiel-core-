// ── Máquina de estados do agendamento (lógica PURA, sem dependência de servidor) ─
// Vive num módulo separado do appointment-status-service para poder ser importada
// com segurança por componentes de cliente (o drawer da agenda) SEM arrastar o
// admin client / service-role key para o bundle do navegador.
// Ver TICKET_Status_Agendamento_SelfService.md §3. 'cancelled' é legado.

export type AppointmentStatus =
  | "pending"
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled_notice"
  | "late_cancel"
  | "cancelled";

export type ActorType = "staff" | "patient" | "system";

export const CANCEL_TARGETS: AppointmentStatus[] = ["cancelled_notice", "late_cancel"];

/** Status que consomem sessão do pacote (espelha o trigger da migration 141). */
export const SESSION_CONSUMING_STATUSES: AppointmentStatus[] = ["confirmed", "checked_in", "completed"];

/** Estados terminais: não aceitam mais transição no fluxo normal. */
export const TERMINAL_STATUSES: AppointmentStatus[] = ["cancelled_notice", "late_cancel", "cancelled"];

// Mapa: de qual status, para quais status, e quais atores podem fazer.
// [staff]=equipe autenticada · [patient]=paciente via link · [system]=job/regra.
type TransitionRule = { to: AppointmentStatus; actors: ActorType[] };

const TRANSITIONS: Record<string, TransitionRule[]> = {
  pending: [
    { to: "confirmed", actors: ["patient", "staff"] },
    { to: "cancelled_notice", actors: ["patient", "staff"] },
    { to: "late_cancel", actors: ["patient", "staff"] },
    { to: "scheduled", actors: ["system"] }, // expira token → volta a "agendado"
    { to: "no_show", actors: ["staff", "system"] },
  ],
  scheduled: [
    { to: "confirmed", actors: ["staff", "patient"] },
    { to: "checked_in", actors: ["staff"] },
    { to: "cancelled_notice", actors: ["staff", "patient"] },
    { to: "late_cancel", actors: ["staff", "patient"] },
    { to: "no_show", actors: ["staff", "system"] },
  ],
  confirmed: [
    { to: "checked_in", actors: ["staff"] },
    { to: "cancelled_notice", actors: ["staff", "patient"] },
    { to: "late_cancel", actors: ["staff", "patient"] },
    { to: "no_show", actors: ["staff", "system"] },
  ],
  checked_in: [
    { to: "completed", actors: ["staff"] },
    { to: "confirmed", actors: ["staff"] }, // desfazer check-in (correção)
  ],
  completed: [
    { to: "confirmed", actors: ["staff"] }, // correção rara (afeta receita) — gatear no UI a dono/gestor
  ],
  no_show: [
    { to: "scheduled", actors: ["staff"] },
    { to: "confirmed", actors: ["staff"] },
  ],
  // terminais: cancelled_notice, late_cancel, cancelled → sem saída
};

export function isTransitionAllowed(from: string | null, to: AppointmentStatus, actor: ActorType): boolean {
  const rules = TRANSITIONS[from ?? "scheduled"];
  if (!rules) return false;
  return rules.some((r) => r.to === to && r.actors.includes(actor));
}

// ── Classificação da janela de cancelamento (regra pura) ────────────────────────

export const DEFAULT_CANCELLATION_WINDOW_HOURS = 24;

/**
 * Regra PURA (testável) da janela: com aviso se `agora < starts_at - janela`,
 * senão tardio. A classificação é da REGRA, não de quem cancela.
 */
export function classifyCancellationByWindow(
  startsAt: string,
  windowHours: number,
  now: Date = new Date(),
): "cancelled_notice" | "late_cancel" {
  const start = new Date(startsAt).getTime();
  const deadline = start - windowHours * 60 * 60_000; // starts_at - janela
  return now.getTime() < deadline ? "cancelled_notice" : "late_cancel";
}

// ── Ações rápidas da equipe (menu do drawer da agenda, estilo Vagaro) ───────────
// Deriva, a partir do status atual, quais botões de ação a equipe pode ver. Reflete
// a máquina de estados (esconde as inválidas) e adota o "caminho para frente":
// não expõe correções que afetam receita (desfazer check-in, reabrir concluído) no
// menu rápido — essas ficam para um fluxo gateado a dono/gestor.

export type StaffQuickAction = "confirm" | "check_in" | "complete" | "no_show" | "cancel";

/** Ações sensíveis: exigem diálogo de confirmação antes de aplicar (dado de paciente real). */
export const SENSITIVE_STAFF_ACTIONS: StaffQuickAction[] = ["no_show", "cancel"];

/**
 * Lista as ações rápidas da equipe disponíveis a partir do status atual. Pura e
 * testável. Espelha `changeAppointmentStatusForStaff`:
 *  - 'complete' aparece de scheduled/confirmed (o wrapper faz check-in automático)
 *    e de checked_in (direto).
 *  - 'cancel' cobre cancelled_notice/late_cancel (a janela decide qual no servidor).
 *  - 'confirm' só no sentido "para frente" (pending/scheduled) ou revertendo falta
 *    (no_show → confirmed); não é oferecido como "desfazer" de check-in/concluído.
 */
export function getStaffQuickActions(currentStatus: string | null): StaffQuickAction[] {
  const from = (currentStatus ?? "scheduled") as AppointmentStatus;
  const actions: StaffQuickAction[] = [];

  if (
    isTransitionAllowed(from, "confirmed", "staff") &&
    (from === "pending" || from === "scheduled" || from === "no_show")
  ) {
    actions.push("confirm");
  }
  if (isTransitionAllowed(from, "checked_in", "staff")) {
    actions.push("check_in");
  }
  if (isTransitionAllowed(from, "completed", "staff") || from === "scheduled" || from === "confirmed") {
    actions.push("complete");
  }
  if (isTransitionAllowed(from, "no_show", "staff")) {
    actions.push("no_show");
  }
  if (isTransitionAllowed(from, "cancelled_notice", "staff")) {
    actions.push("cancel");
  }
  return actions;
}

/** Traduz a ação rápida do menu para o status "requested" que o wrapper da equipe espera. */
export function staffActionToRequested(action: StaffQuickAction): string {
  switch (action) {
    case "confirm":
      return "confirmed";
    case "check_in":
      return "checked_in";
    case "complete":
      return "completed";
    case "no_show":
      return "no_show";
    case "cancel":
      return "cancelled"; // o wrapper classifica pela janela (cancelled_notice | late_cancel)
  }
}
