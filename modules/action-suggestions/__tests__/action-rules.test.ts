import { describe, it, expect } from "vitest";
import { buildActionSuggestions } from "../action-rules";
import type { ActionSuggestionDraft, PendingAiReviewActionInput } from "../action-rules";
import type { Patient, Lead, Appointment, FollowUp } from "@/lib/types";

const BASE_CLINIC = "clinic-1";

// ─── Minimal object factories ─────────────────────────────────────────────────

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pat-1",
    clinic_id: BASE_CLINIC,
    created_by: null,
    full_name: "Ana Silva",
    first_name: "Ana",
    last_name: "Silva",
    email: null,
    phone: null,
    cpf: null,
    date_of_birth: null,
    status: "active",
    notes: null,
    address_line: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    clinic_id: BASE_CLINIC,
    created_by: null,
    converted_patient_id: null,
    full_name: "Bruno Costa",
    email: null,
    phone: null,
    source: "other",
    stage: "new_lead",
    main_complaint: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appt-1",
    clinic_id: BASE_CLINIC,
    patient_id: "pat-1",
    created_by: null,
    practitioner_id: null,
    session_type_id: null,
    patient_offer_id: null,
    source: null,
    starts_at: new Date().toISOString(),
    duration_minutes: 60,
    notes: null,
    video_url: null,
    status: "completed",
    zoom_meeting_id: null,
    zoom_join_url: null,
    zoom_start_url: null,
    google_event_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 3); // 3 days from now by default
  return {
    id: "fu-1",
    clinic_id: BASE_CLINIC,
    patient_id: "pat-1",
    appointment_id: null,
    created_by: null,
    title: "Retorno de acompanhamento",
    due_at: dueAt.toISOString(),
    status: "pending",
    channel: "none",
    message_subject: null,
    message_body: null,
    notes: null,
    ai_suggested_timing: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildActionSuggestions", () => {
  it("returns empty array when all inputs are empty", () => {
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [],
    });
    expect(result).toEqual([]);
  });

  // ── Follow-ups ──────────────────────────────────────────────────────────────

  it("includes a suggestion for a pending follow-up due within 7 days", () => {
    const fu = makeFollowUp({ id: "fu-soon", due_at: daysFromNow(5) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [fu],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys).toContain("follow_up:fu-soon");
  });

  it("does NOT include a suggestion for a pending follow-up due more than 7 days away", () => {
    const fu = makeFollowUp({ id: "fu-far", due_at: daysFromNow(10) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [fu],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys).not.toContain("follow_up:fu-far");
  });

  it("does NOT include a suggestion for a completed follow-up", () => {
    const fu = makeFollowUp({ id: "fu-done", status: "completed", due_at: daysFromNow(1) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [fu],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys).not.toContain("follow_up:fu-done");
  });

  it("overdue follow-ups (daysUntilDue <= 0) have priority 'high'", () => {
    const fu = makeFollowUp({ id: "fu-overdue", due_at: daysAgo(2) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [fu],
    });
    const suggestion = result.find((r) => r.action_key === "follow_up:fu-overdue");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("high");
  });

  it("follow-up due today (daysUntilDue = 0) has priority 'high'", () => {
    // Due exactly now — daysUntilDue will be 0
    const fu = makeFollowUp({ id: "fu-today", due_at: new Date().toISOString() });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [fu],
    });
    const suggestion = result.find((r) => r.action_key === "follow_up:fu-today");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("high");
  });

  it("follow-up due in 3 days has priority 'medium'", () => {
    const fu = makeFollowUp({ id: "fu-medium", due_at: daysFromNow(3) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [fu],
    });
    const suggestion = result.find((r) => r.action_key === "follow_up:fu-medium");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("medium");
  });

  // ── Leads ───────────────────────────────────────────────────────────────────

  it("new_lead generates a suggestion with action_key new_lead:<id>", () => {
    const lead = makeLead({ id: "lead-new", stage: "new_lead" });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [lead],
      appointments: [],
      followUps: [],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys).toContain("new_lead:lead-new");
  });

  it("scheduled lead generates a lead_ready suggestion with priority 'high'", () => {
    const lead = makeLead({ id: "lead-sched", stage: "scheduled" });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [lead],
      appointments: [],
      followUps: [],
    });
    const suggestion = result.find((r) => r.action_key === "lead_ready:lead-sched:scheduled");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("high");
  });

  it("contacted lead generates a lead_ready suggestion with priority 'medium'", () => {
    const lead = makeLead({ id: "lead-cont", stage: "contacted" });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [lead],
      appointments: [],
      followUps: [],
    });
    const suggestion = result.find((r) => r.action_key === "lead_ready:lead-cont:contacted");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("medium");
  });

  it("converted_to_patient lead does NOT appear in suggestions", () => {
    const lead = makeLead({ id: "lead-conv", stage: "converted_to_patient" });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [lead],
      appointments: [],
      followUps: [],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys.some((k) => k.includes("lead-conv"))).toBe(false);
  });

  // ── Patients ────────────────────────────────────────────────────────────────

  it("active patient with no appointments generates 'patient_no_session' suggestion", () => {
    const patient = makePatient({ id: "pat-nosess", status: "active" });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [patient],
      leads: [],
      appointments: [],
      followUps: [],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys).toContain("patient_no_session:pat-nosess");
  });

  it("inactive patient generates no suggestion", () => {
    const patient = makePatient({ id: "pat-inactive", status: "inactive" });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [patient],
      leads: [],
      appointments: [],
      followUps: [],
    });
    expect(result).toHaveLength(0);
  });

  it("active patient with a recent appointment (10 days ago) generates no no-return suggestion", () => {
    const patient = makePatient({ id: "pat-recent" });
    const appt = makeAppointment({ patient_id: "pat-recent", starts_at: daysAgo(10) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [patient],
      leads: [],
      appointments: [appt],
      followUps: [],
    });
    const keys = result.map((r) => r.action_key);
    expect(keys).not.toContain("patient_no_return_30:pat-recent");
    expect(keys).not.toContain("patient_no_session:pat-recent");
  });

  it("active patient with last appointment 35 days ago generates 'patient_no_return_30' with medium priority", () => {
    const patient = makePatient({ id: "pat-stale" });
    const appt = makeAppointment({ patient_id: "pat-stale", starts_at: daysAgo(35) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [patient],
      leads: [],
      appointments: [appt],
      followUps: [],
    });
    const suggestion = result.find((r) => r.action_key === "patient_no_return_30:pat-stale");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("medium");
  });

  it("active patient with last appointment 50 days ago generates priority 'high'", () => {
    const patient = makePatient({ id: "pat-long-gone" });
    const appt = makeAppointment({ patient_id: "pat-long-gone", starts_at: daysAgo(50) });
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [patient],
      leads: [],
      appointments: [appt],
      followUps: [],
    });
    const suggestion = result.find((r) => r.action_key === "patient_no_return_30:pat-long-gone");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("high");
  });

  // ── AI reviews ──────────────────────────────────────────────────────────────

  it("pending ai review generates a suggestion with priority 'medium'", () => {
    const review: PendingAiReviewActionInput = {
      id: "rev-1",
      patient_id: "pat-1",
      patient_name: "Ana Silva",
      review_status: "pending_review",
      created_at: new Date().toISOString(),
    };
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [],
      aiReviews: [review],
    });
    const suggestion = result.find((r) => r.action_key === "ai_review:rev-1");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("medium");
  });

  it("needs_changes ai review generates a suggestion with priority 'high'", () => {
    const review: PendingAiReviewActionInput = {
      id: "rev-2",
      patient_id: "pat-2",
      patient_name: "Carlos Mendes",
      review_status: "needs_changes",
      created_at: new Date().toISOString(),
    };
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients: [],
      leads: [],
      appointments: [],
      followUps: [],
      aiReviews: [review],
    });
    const suggestion = result.find((r) => r.action_key === "ai_review:rev-2");
    expect(suggestion).toBeDefined();
    expect(suggestion!.priority).toBe("high");
  });

  // ── action_key uniqueness ───────────────────────────────────────────────────

  it("all action_keys in the result are unique", () => {
    const patients = [
      makePatient({ id: "p1" }),
      makePatient({ id: "p2" }),
    ];
    const leads = [
      makeLead({ id: "l1", stage: "new_lead" }),
      makeLead({ id: "l2", stage: "scheduled" }),
    ];
    const followUps = [
      makeFollowUp({ id: "fu1", due_at: daysFromNow(2), patient_id: "p1" }),
      makeFollowUp({ id: "fu2", due_at: daysFromNow(4), patient_id: "p2" }),
    ];
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients,
      leads,
      appointments: [],
      followUps,
    });
    const keys = result.map((r) => r.action_key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  // ── Hard cap at 20 ──────────────────────────────────────────────────────────

  it("never returns more than 20 suggestions", () => {
    const patients = Array.from({ length: 25 }, (_, i) =>
      makePatient({ id: `p${i}`, status: "active" })
    );
    const result = buildActionSuggestions({
      clinicId: BASE_CLINIC,
      patients,
      leads: [],
      appointments: [],
      followUps: [],
    });
    expect(result.length).toBeLessThanOrEqual(20);
  });

  // ── clinic_id propagation ───────────────────────────────────────────────────

  it("all suggestions carry the correct clinic_id", () => {
    const lead = makeLead({ id: "lcid", stage: "new_lead" });
    const result = buildActionSuggestions({
      clinicId: "my-clinic",
      patients: [],
      leads: [lead],
      appointments: [],
      followUps: [],
    });
    expect(result.every((r) => r.clinic_id === "my-clinic")).toBe(true);
  });
});
