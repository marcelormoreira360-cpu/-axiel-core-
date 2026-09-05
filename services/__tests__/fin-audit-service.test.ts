import { describe, it, expect } from "vitest";
import { extractAuditAmountCents } from "@/services/fin-audit-service";

describe("extractAuditAmountCents", () => {
  it("lê snake_case (razão) e camelCase (contas a pagar)", () => {
    expect(extractAuditAmountCents({ amount_cents: 15000 })).toBe(15000);
    expect(extractAuditAmountCents({ amountCents: 22000, description: "Aluguel" })).toBe(22000);
  });

  it("retorna null quando não há valor ou diff inválido", () => {
    expect(extractAuditAmountCents({ fin_entry_id: "abc" })).toBeNull();
    expect(extractAuditAmountCents(null)).toBeNull();
    expect(extractAuditAmountCents("x")).toBeNull();
    expect(extractAuditAmountCents({ amount_cents: "nope" })).toBeNull();
  });
});
