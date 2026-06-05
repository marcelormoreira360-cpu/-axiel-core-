import { describe, it, expect } from "vitest";
import {
  getSuggestedFollowUpTimingPlaceholder,
  getFollowUpReviewPrompts,
  FOLLOW_UP_AI_LABEL,
} from "../ai-placeholder";
import type { Patient, Appointment, FollowUp } from "@/lib/types";

// ─── Minimal factories ────────────────────────────────────────────────────────

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    clinic_id: "c1",
    created_by: null,
    full_name: "Maria Santos",
    first_name: "Maria",
    last_name: "Santos",
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

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    clinic_id: "c1",
    patient_id: "p1",
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
  return {
    id: "f1",
    clinic_id: "c1",
    patient_id: "p1",
    appointment_id: null,
    created_by: null,
    title: "Follow-up",
    due_at: new Date().toISOString(),
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

// ─── getSuggestedFollowUpTimingPlaceholder ────────────────────────────────────

describe("getSuggestedFollowUpTimingPlaceholder", () => {
  it("suggests scheduling first follow-up when no appointments exist", () => {
    const result = getSuggestedFollowUpTimingPlaceholder({
      patient: makePatient(),
      appointments: [],
      followUps: [],
    });
    // Actual text: "Sugestão de timing: agende o primeiro acompanhamento após a criação da sessão inicial."
    expect(result).toContain("primeiro acompanhamento");
  });

  it("returns a timing window message when a last appointment exists", () => {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = getSuggestedFollowUpTimingPlaceholder({
      patient: makePatient(),
      appointments: [makeAppointment({ starts_at: lastWeek })],
      followUps: [],
    });
    // Actual text: "Sugestão de timing: revise este paciente entre 7 e 14 dias após a última sessão."
    expect(result).toContain("7");
    expect(result).toContain("14");
  });

  it("warns about existing pending follow-up", () => {
    const result = getSuggestedFollowUpTimingPlaceholder({
      patient: makePatient(),
      appointments: [],
      followUps: [makeFollowUp({ status: "pending" })],
    });
    // Actual text: "Já existe um acompanhamento pendente. Revise-o antes de criar outro lembrete."
    expect(result.toLowerCase()).toContain("pendente");
  });

  it("pending follow-up check takes precedence over existing appointment", () => {
    const result = getSuggestedFollowUpTimingPlaceholder({
      patient: makePatient(),
      appointments: [makeAppointment()],
      followUps: [makeFollowUp({ status: "pending" })],
    });
    // Pending follow-up is checked first in the function
    expect(result.toLowerCase()).toContain("pendente");
  });

  it("completed follow-up does NOT trigger the pending warning", () => {
    const result = getSuggestedFollowUpTimingPlaceholder({
      patient: makePatient(),
      appointments: [],
      followUps: [makeFollowUp({ status: "completed" })],
    });
    expect(result.toLowerCase()).not.toContain("pendente");
    // Falls through to the "no appointment" branch
    expect(result).toContain("primeiro acompanhamento");
  });

  it("returns a non-empty string when appointments and followUps are undefined", () => {
    const result = getSuggestedFollowUpTimingPlaceholder({
      patient: makePatient(),
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // No appointment → first follow-up suggestion
    expect(result).toContain("primeiro acompanhamento");
  });
});

// ─── FOLLOW_UP_AI_LABEL ────────────────────────────────────────────────────────

describe("FOLLOW_UP_AI_LABEL", () => {
  it("is a non-empty string", () => {
    expect(typeof FOLLOW_UP_AI_LABEL).toBe("string");
    expect(FOLLOW_UP_AI_LABEL.length).toBeGreaterThan(0);
  });

  it("does not claim to be AI-generated", () => {
    // Must not contain the word " ia" (isolated, lowercased)
    expect(FOLLOW_UP_AI_LABEL.toLowerCase()).not.toContain(" ia");
  });

  it("contains the word 'sugestão' (rule-based, not AI)", () => {
    // Actual value: "Sugestão: próximo acompanhamento"
    expect(FOLLOW_UP_AI_LABEL.toLowerCase()).toContain("sugestão");
  });
});

// ─── getFollowUpReviewPrompts ──────────────────────────────────────────────────

describe("getFollowUpReviewPrompts", () => {
  it("returns an array with at least one prompt", () => {
    const prompts = getFollowUpReviewPrompts();
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("every prompt is a non-empty string", () => {
    const prompts = getFollowUpReviewPrompts();
    for (const p of prompts) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it("returns 3 review prompts", () => {
    // Actual implementation returns exactly 3 entries
    expect(getFollowUpReviewPrompts()).toHaveLength(3);
  });
});
