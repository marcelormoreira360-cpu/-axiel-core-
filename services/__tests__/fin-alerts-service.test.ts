import { describe, it, expect } from "vitest";
import { buildAlerts, type AlertInputs } from "@/services/fin-alerts-service";

const zero: AlertInputs = {
  overdueCount: 0, overdueCents: 0, dueSoonCount: 0, dueSoonCents: 0,
  receivable90pCents: 0, netCents: 0, pastDueSubs: 0,
};

describe("buildAlerts", () => {
  it("tudo em dia = nenhum alerta", () => {
    expect(buildAlerts(zero)).toEqual([]);
  });

  it("emite cada tipo de alerta quando o gatilho dispara", () => {
    const a = buildAlerts({
      overdueCount: 2, overdueCents: 30000,
      dueSoonCount: 1, dueSoonCents: 5000,
      receivable90pCents: 12000,
      netCents: -4000,
      pastDueSubs: 1,
    });
    const keys = a.map((x) => x.key);
    expect(keys).toContain("overduePayables");
    expect(keys).toContain("dueSoonPayables");
    expect(keys).toContain("receivableAging");
    expect(keys).toContain("negativeNet");
    expect(keys).toContain("pastDueSubs");
  });

  it("ordena danger antes de warning", () => {
    const a = buildAlerts({ ...zero, dueSoonCount: 1, dueSoonCents: 5000, overdueCount: 1, overdueCents: 9000, pastDueSubs: 1 });
    // dangers primeiro (overduePayables, pastDueSubs), depois warnings (dueSoonPayables)
    expect(a[0].level).toBe("danger");
    expect(a[a.length - 1].level).toBe("warning");
    expect(a[a.length - 1].key).toBe("dueSoonPayables");
  });

  it("resultado zero não dispara negativeNet (só < 0)", () => {
    expect(buildAlerts({ ...zero, netCents: 0 }).length).toBe(0);
    expect(buildAlerts({ ...zero, netCents: -1 }).map((x) => x.key)).toEqual(["negativeNet"]);
  });
});
