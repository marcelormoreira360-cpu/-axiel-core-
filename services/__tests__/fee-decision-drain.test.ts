import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa a IDEMPOTÊNCIA do consumidor (drain) de fee_decision_pending com um fake
// stateful do Supabase: o unique index em appointment_id (simulado via 23505) e o
// consumed_at garantem que reprocessar NÃO cria pendência duplicada.

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { drainFeeDecisionEvents } from "@/services/fee-decision-service";

type LifecycleEvent = {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string | null;
  event_type: string;
  trigger_status: string | null;
  consumed_at: string | null;
};

type FeeDecision = { id: string; appointment_id: string };

// Store em memória compartilhado entre as duas passadas do drain.
function makeStore() {
  const events: LifecycleEvent[] = [];
  const feeDecisions: FeeDecision[] = [];
  let seq = 0;

  function client() {
    return {
      from(table: string) {
        const b: {
          _op: "select" | "insert" | "update";
          _filters: { col: string; val: unknown }[];
          _inList: { col: string; vals: unknown[] } | null;
          _isNull: string[];
          _insert: Record<string, unknown> | null;
          _update: Record<string, unknown> | null;
          select: (...a: unknown[]) => typeof b;
          insert: (payload: Record<string, unknown>) => typeof b;
          update: (payload: Record<string, unknown>) => typeof b;
          eq: (col: string, val: unknown) => typeof b;
          in: (col: string, vals: unknown[]) => typeof b;
          is: (col: string, _val: null) => typeof b;
          order: () => Promise<{ data: unknown; error: unknown }>;
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
        } = {
          _op: "select",
          _filters: [],
          _inList: null,
          _isNull: [],
          _insert: null,
          _update: null,
          select() { return b; },
          insert(payload) { b._op = "insert"; b._insert = payload; return b; },
          update(payload) { b._op = "update"; b._update = payload; return b; },
          eq(col, val) { b._filters.push({ col, val }); return b; },
          in(col, vals) { b._inList = { col, vals }; return b; },
          is(col) { b._isNull.push(col); return b; },
          order() { return Promise.resolve(run()); },
          maybeSingle() { return Promise.resolve(run()); },
          then(resolve) { return Promise.resolve(run()).then(resolve); },
        };

        function run(): { data: unknown; error: unknown } {
          if (table === "clinic_settings") {
            return { data: { default_currency: "USD", settings: null }, error: null };
          }
          if (table === "appointment_lifecycle_events") {
            if (b._op === "select") {
              const data = events.filter((e) => {
                const okFilters = b._filters.every((f) => (e as Record<string, unknown>)[f.col] === f.val);
                const okNull = b._isNull.every((c) => (e as Record<string, unknown>)[c] === null);
                return okFilters && okNull;
              });
              return { data, error: null };
            }
            if (b._op === "update") {
              const ids = (b._inList?.vals ?? []) as string[];
              for (const e of events) {
                if (ids.includes(e.id)) e.consumed_at = (b._update?.consumed_at as string) ?? new Date().toISOString();
              }
              return { data: null, error: null };
            }
          }
          if (table === "appointment_fee_decisions") {
            if (b._op === "insert") {
              const apptId = b._insert?.appointment_id as string;
              if (feeDecisions.some((d) => d.appointment_id === apptId)) {
                return { data: null, error: { code: "23505", message: "duplicate key" } };
              }
              const row = { id: `fd-${++seq}`, appointment_id: apptId };
              feeDecisions.push(row);
              return { data: { id: row.id }, error: null };
            }
          }
          return { data: null, error: null };
        }

        return b;
      },
    };
  }

  return { events, feeDecisions, client };
}

describe("drainFeeDecisionEvents — idempotência", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => store.client());
  });

  it("materializa 1 pendência por evento e marca consumed_at", async () => {
    store.events.push({
      id: "ev1", clinic_id: "c1", appointment_id: "a1", patient_id: "p1",
      event_type: "fee_decision_pending", trigger_status: "no_show", consumed_at: null,
    });

    const res = await drainFeeDecisionEvents("c1");
    expect(res.materialized).toBe(1);
    expect(store.feeDecisions).toHaveLength(1);
    expect(store.events[0].consumed_at).not.toBeNull();
  });

  it("abrir a fila 2x NÃO duplica pendência (consumed_at filtra o reprocesso)", async () => {
    store.events.push({
      id: "ev1", clinic_id: "c1", appointment_id: "a1", patient_id: "p1",
      event_type: "fee_decision_pending", trigger_status: "no_show", consumed_at: null,
    });

    await drainFeeDecisionEvents("c1");
    const second = await drainFeeDecisionEvents("c1");

    expect(second.materialized).toBe(0); // nada novo: evento já consumido
    expect(store.feeDecisions).toHaveLength(1);
  });

  it("evento duplicado do MESMO appointment (23505) não cria 2ª pendência", async () => {
    // Dois eventos não consumidos apontando para o mesmo agendamento.
    store.events.push(
      { id: "ev1", clinic_id: "c1", appointment_id: "a1", patient_id: "p1", event_type: "fee_decision_pending", trigger_status: "no_show", consumed_at: null },
      { id: "ev2", clinic_id: "c1", appointment_id: "a1", patient_id: "p1", event_type: "fee_decision_pending", trigger_status: "no_show", consumed_at: null },
    );

    await drainFeeDecisionEvents("c1");

    expect(store.feeDecisions).toHaveLength(1); // unique index protege
    expect(store.events.every((e) => e.consumed_at !== null)).toBe(true);
  });

  it("evento malformado (sem appointment) é consumido sem criar pendência", async () => {
    store.events.push({
      id: "ev1", clinic_id: "c1", appointment_id: null, patient_id: null,
      event_type: "fee_decision_pending", trigger_status: "no_show", consumed_at: null,
    });

    const res = await drainFeeDecisionEvents("c1");
    expect(res.materialized).toBe(0);
    expect(store.feeDecisions).toHaveLength(0);
    expect(store.events[0].consumed_at).not.toBeNull();
  });
});
