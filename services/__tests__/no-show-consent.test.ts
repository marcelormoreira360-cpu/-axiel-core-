import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa o gate de consentimento da política de no-show:
//   1. O guard PURO de servidor (bloqueia sem aceite quando a clínica cobra).
//   2. O registro do aceite em patient_consents (consent_type='no_show_policy',
//      policy_version, appointment_id).
//   3. A leitura "quais agendamentos têm aceite em arquivo" (fila de decisão, Lex 2.3).

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  shouldBlockBookingForPolicyConsent,
  recordNoShowPolicyConsent,
  getNoShowConsentAppointments,
  getNoShowPolicyConsent,
  hasAcceptedNoShowPolicy,
  NO_SHOW_CONSENT_TYPE,
} from "@/services/no-show-consent-service";
import { NO_SHOW_POLICY_VERSION } from "@/modules/no-show-policy/policy-text";

// ── 1. Guard PURO ──────────────────────────────────────────────────────────────
describe("shouldBlockBookingForPolicyConsent — guard de servidor", () => {
  it("bloqueia: canal exige, clínica cobra, sem aceite", () => {
    expect(shouldBlockBookingForPolicyConsent({ enforce: true, clinicCharges: true, accepted: false })).toBe(true);
  });

  it("libera quando o aceite veio", () => {
    expect(shouldBlockBookingForPolicyConsent({ enforce: true, clinicCharges: true, accepted: true })).toBe(false);
  });

  it("libera quando a clínica NÃO cobra (modo none)", () => {
    expect(shouldBlockBookingForPolicyConsent({ enforce: true, clinicCharges: false, accepted: false })).toBe(false);
  });

  it("não bloqueia canal sem enforce (ex.: voz/Vapi), mesmo cobrando e sem aceite", () => {
    expect(shouldBlockBookingForPolicyConsent({ enforce: false, clinicCharges: true, accepted: false })).toBe(false);
  });
});

// ── Fake stateful mínimo de patient_consents ────────────────────────────────────
type ConsentRow = {
  clinic_id: string;
  patient_id: string;
  consent_type: string;
  granted: boolean;
  policy_version: string | null;
  appointment_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  source: string;
  notes: string | null;
  created_at: string;
};

function makeStore() {
  const consents: ConsentRow[] = [];
  let seq = 0;

  function client() {
    return {
      from(table: string) {
        const b: Record<string, unknown> = {};
        let op: "select" | "insert" = "select";
        let insertPayload: Record<string, unknown> | null = null;
        const eqFilters: { col: string; val: unknown }[] = [];
        let inFilter: { col: string; vals: unknown[] } | null = null;
        let orderDesc = false;

        b.select = () => b;
        b.insert = (payload: Record<string, unknown>) => { op = "insert"; insertPayload = payload; return b; };
        b.eq = (col: string, val: unknown) => { eqFilters.push({ col, val }); return b; };
        b.in = (col: string, vals: unknown[]) => { inFilter = { col, vals }; return b; };
        b.order = () => b;
        b.limit = () => b;

        function query(): ConsentRow[] {
          if (table !== "patient_consents") return [];
          let rows = consents.filter((r) =>
            eqFilters.every((f) => (r as unknown as Record<string, unknown>)[f.col] === f.val),
          );
          if (inFilter) {
            rows = rows.filter((r) => inFilter!.vals.includes((r as unknown as Record<string, unknown>)[inFilter!.col]));
          }
          rows = [...rows].sort((a, z) => (orderDesc ? z.created_at.localeCompare(a.created_at) : 0));
          return rows;
        }

        b.maybeSingle = () => {
          orderDesc = true;
          const rows = query();
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        };
        // insert().select()... ou terminação por await direto
        b.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          if (op === "insert" && insertPayload && table === "patient_consents") {
            consents.push({
              clinic_id: insertPayload.clinic_id as string,
              patient_id: insertPayload.patient_id as string,
              consent_type: insertPayload.consent_type as string,
              granted: insertPayload.granted as boolean,
              policy_version: (insertPayload.policy_version as string | null) ?? null,
              appointment_id: (insertPayload.appointment_id as string | null) ?? null,
              ip_address: (insertPayload.ip_address as string | null) ?? null,
              user_agent: (insertPayload.user_agent as string | null) ?? null,
              source: insertPayload.source as string,
              notes: (insertPayload.notes as string | null) ?? null,
              created_at: `2026-08-13T00:00:${String(seq++).padStart(2, "0")}.000Z`,
            });
            return Promise.resolve(resolve({ data: null, error: null }));
          }
          return Promise.resolve(resolve({ data: query(), error: null }));
        };
        return b;
      },
    };
  }

  return { consents, client };
}

describe("no-show-consent-service — registro e leitura", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => store.client());
  });

  it("recordNoShowPolicyConsent grava a prova (tipo, versão, appointment, canal)", async () => {
    await recordNoShowPolicyConsent({
      clinicId: "c1",
      patientId: "p1",
      appointmentId: "a1",
      source: "website",
      ip: "1.2.3.4",
      userAgent: "UA",
    });

    expect(store.consents).toHaveLength(1);
    const row = store.consents[0];
    expect(row.consent_type).toBe(NO_SHOW_CONSENT_TYPE);
    expect(row.granted).toBe(true);
    expect(row.policy_version).toBe(NO_SHOW_POLICY_VERSION); // versão do servidor
    expect(row.appointment_id).toBe("a1");
    expect(row.ip_address).toBe("1.2.3.4");
  });

  it("getNoShowConsentAppointments devolve só os agendamentos COM aceite granted", async () => {
    await recordNoShowPolicyConsent({ clinicId: "c1", patientId: "p1", appointmentId: "a1" });
    await recordNoShowPolicyConsent({ clinicId: "c1", patientId: "p2", appointmentId: "a2", granted: false });

    const present = await getNoShowConsentAppointments(["a1", "a2", "a3"]);
    expect(present.has("a1")).toBe(true);  // aceito
    expect(present.has("a2")).toBe(false); // revogado (granted=false)
    expect(present.has("a3")).toBe(false); // interno, sem aceite
  });

  it("hasAcceptedNoShowPolicy exige a versão vigente quando informada", async () => {
    await recordNoShowPolicyConsent({ clinicId: "c1", patientId: "p1", appointmentId: "a1" });

    expect(await hasAcceptedNoShowPolicy("p1")).toBe(true);
    expect(await hasAcceptedNoShowPolicy("p1", NO_SHOW_POLICY_VERSION)).toBe(true);
    expect(await hasAcceptedNoShowPolicy("p1", "no_show_v9.9")).toBe(false); // versão mudou -> reaceite
  });

  it("getNoShowPolicyConsent devolve o estado mais recente do paciente", async () => {
    await recordNoShowPolicyConsent({ clinicId: "c1", patientId: "p1", appointmentId: "a1" });
    const state = await getNoShowPolicyConsent("p1");
    expect(state?.granted).toBe(true);
    expect(state?.appointmentId).toBe("a1");
  });
});
