import { describe, it, expect } from "vitest";
import { getLeadPriority, nextLeadAction } from "../lead-scoring";
import type { Lead } from "@/lib/types";

// ─── Minimal factory ──────────────────────────────────────────────────────────

function makeLead(stage: Lead["stage"]): Lead {
  return {
    id: "lead-1",
    clinic_id: "clinic-1",
    created_by: null,
    converted_patient_id: null,
    full_name: "Test Lead",
    email: null,
    phone: null,
    source: "other",
    stage,
    main_complaint: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── getLeadPriority ──────────────────────────────────────────────────────────

describe("getLeadPriority", () => {
  it("scheduled leads are high priority", () => {
    expect(getLeadPriority(makeLead("scheduled"))).toBe("high");
  });

  it("contacted leads are medium priority", () => {
    expect(getLeadPriority(makeLead("contacted"))).toBe("medium");
  });

  it("new_lead is medium priority", () => {
    expect(getLeadPriority(makeLead("new_lead"))).toBe("medium");
  });

  it("converted_to_patient is low priority", () => {
    expect(getLeadPriority(makeLead("converted_to_patient"))).toBe("low");
  });

  it("covers all valid LeadStage values without returning undefined", () => {
    const stages: Lead["stage"][] = ["new_lead", "contacted", "scheduled", "converted_to_patient"];
    for (const stage of stages) {
      const result = getLeadPriority(makeLead(stage));
      expect(["high", "medium", "low"]).toContain(result);
    }
  });
});

// ─── nextLeadAction ───────────────────────────────────────────────────────────

describe("nextLeadAction", () => {
  it("new_lead → Contact today", () => {
    expect(nextLeadAction(makeLead("new_lead"))).toBe("Contact today");
  });

  it("contacted → Schedule consultation", () => {
    expect(nextLeadAction(makeLead("contacted"))).toBe("Schedule consultation");
  });

  it("scheduled → Prepare intake", () => {
    expect(nextLeadAction(makeLead("scheduled"))).toBe("Prepare intake");
  });

  it("converted_to_patient → Continue as patient", () => {
    expect(nextLeadAction(makeLead("converted_to_patient"))).toBe("Continue as patient");
  });

  it("returns a non-empty string for every valid stage", () => {
    const stages: Lead["stage"][] = ["new_lead", "contacted", "scheduled", "converted_to_patient"];
    for (const stage of stages) {
      const result = nextLeadAction(makeLead(stage));
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
