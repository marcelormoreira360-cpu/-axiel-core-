import { describe, it, expect } from "vitest";
import { financeCapabilities } from "@/lib/finance-permissions";
import type { AppRole } from "@/lib/types";

describe("financeCapabilities", () => {
  it("gestor/dono tem acesso completo sem papel financeiro", () => {
    for (const role of ["clinic_owner", "clinic_manager", "admin"] as AppRole[]) {
      const c = financeCapabilities(role, null);
      expect(c).toEqual({ canView: true, canEdit: true, canExport: true, canApprove: true });
    }
  });

  it("não-gestor sem papel financeiro não vê nada", () => {
    const c = financeCapabilities("practitioner", null);
    expect(c).toEqual({ canView: false, canEdit: false, canExport: false, canApprove: false });
  });

  it("CFO (não-gestor) vê, edita, exporta e aprova", () => {
    expect(financeCapabilities("practitioner", "cfo")).toEqual({
      canView: true, canEdit: true, canExport: true, canApprove: true,
    });
  });

  it("controller e billing editam mas não aprovam", () => {
    for (const fr of ["controller", "billing"] as const) {
      const c = financeCapabilities("front_desk", fr);
      expect(c.canEdit).toBe(true);
      expect(c.canApprove).toBe(false);
      expect(c.canView).toBe(true);
    }
  });

  it("pricing e cpa são somente-leitura (com export)", () => {
    for (const fr of ["pricing", "cpa"] as const) {
      const c = financeCapabilities("read_only_staff", fr);
      expect(c.canView).toBe(true);
      expect(c.canExport).toBe(true);
      expect(c.canEdit).toBe(false);
      expect(c.canApprove).toBe(false);
    }
  });

  it("gestor pode ser restringido a somente-leitura via papel cpa/pricing", () => {
    const c = financeCapabilities("clinic_manager", "cpa");
    expect(c.canView).toBe(true);
    expect(c.canEdit).toBe(false);
    expect(c.canApprove).toBe(false);
  });
});
