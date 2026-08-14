import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa a montagem da config de apresentação da política de no-show a partir das
// colunas de public.clinics: (a) clinicCharges (algum modo != 'none'); (b) o nome
// legal usa legal_entity_name com fallback em name; (c) defaults (janela 24h, pcts null).

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicPolicyPresentation } from "@/services/no-show-policy-presentation";

function mockClinicRow(row: Record<string, unknown> | null) {
  const client = {
    from() {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: row, error: null });
      return b;
    },
  };
  (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => client);
}

describe("getClinicPolicyPresentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clínica que cobra: clinicCharges=true e config espelha os percentuais", async () => {
    mockClinicRow({
      name: "IFWC",
      legal_entity_name: "Moreira & Angeli LLC",
      cancellation_window_hours: 24,
      no_show_fee_mode: "percent",
      no_show_fee_percent: 100,
      late_cancel_fee_mode: "percent",
      late_cancel_fee_percent: 50,
    });
    const pres = await getClinicPolicyPresentation("c1");
    expect(pres.clinicCharges).toBe(true);
    expect(pres.config.clinicName).toBe("Moreira & Angeli LLC");
    expect(pres.config.windowHours).toBe(24);
    expect(pres.config.noShowPct).toBe(100);
    expect(pres.config.latePct).toBe(50);
    expect(pres.config.noShowChargeable).toBe(true);
    expect(pres.config.lateChargeable).toBe(true);
  });

  it("nome legal ausente cai no nome comercial (fallback)", async () => {
    mockClinicRow({
      name: "Acme Wellness",
      legal_entity_name: null,
      cancellation_window_hours: null,
      no_show_fee_mode: "none",
      no_show_fee_percent: null,
      late_cancel_fee_mode: "none",
      late_cancel_fee_percent: null,
    });
    const pres = await getClinicPolicyPresentation("c2");
    expect(pres.config.clinicName).toBe("Acme Wellness");
    // ambos os modos 'none' => não cobra e cai no default de janela
    expect(pres.clinicCharges).toBe(false);
    expect(pres.config.windowHours).toBe(24);
    expect(pres.config.noShowChargeable).toBe(false);
    expect(pres.config.lateChargeable).toBe(false);
  });

  it("cobra se só um dos modos != none", async () => {
    mockClinicRow({
      name: "Solo",
      legal_entity_name: "   ",
      cancellation_window_hours: 48,
      no_show_fee_mode: "percent",
      no_show_fee_percent: 80,
      late_cancel_fee_mode: "none",
      late_cancel_fee_percent: null,
    });
    const pres = await getClinicPolicyPresentation("c3");
    expect(pres.clinicCharges).toBe(true);
    // legal_entity_name só com espaços => fallback no name
    expect(pres.config.clinicName).toBe("Solo");
    expect(pres.config.windowHours).toBe(48);
    expect(pres.config.noShowChargeable).toBe(true);
    expect(pres.config.lateChargeable).toBe(false);
  });
});
