import { describe, it, expect } from "vitest";
import { canUseFeature, checkUsageLimit, getPlanLimit } from "../feature-access";

// ─── canUseFeature ────────────────────────────────────────────────────────────

describe("canUseFeature", () => {
  it("returns true for features included in starter plan", () => {
    expect(canUseFeature({ planSlug: "starter" }, "leads")).toBe(true);
    expect(canUseFeature({ planSlug: "starter" }, "schedule")).toBe(true);
    expect(canUseFeature({ planSlug: "starter" }, "forms")).toBe(true);
    expect(canUseFeature({ planSlug: "starter" }, "patient_snapshot")).toBe(true);
    // audio_transcription foi habilitado no starter (commit b7ef9ed).
    expect(canUseFeature({ planSlug: "starter" }, "audio_transcription")).toBe(true);
  });

  it("returns false for features not in starter plan", () => {
    expect(canUseFeature({ planSlug: "starter" }, "ai_insights")).toBe(false);
    expect(canUseFeature({ planSlug: "starter" }, "whatsapp_automation")).toBe(false);
    expect(canUseFeature({ planSlug: "starter" }, "patient_portal")).toBe(false);
    expect(canUseFeature({ planSlug: "starter" }, "advanced_reports")).toBe(false);
    expect(canUseFeature({ planSlug: "starter" }, "audio_transcription")).toBe(false);
  });

  it("returns true for features included in professional plan", () => {
    expect(canUseFeature({ planSlug: "professional" }, "ai_insights")).toBe(true);
    expect(canUseFeature({ planSlug: "professional" }, "patient_portal")).toBe(true);
    expect(canUseFeature({ planSlug: "professional" }, "audio_transcription")).toBe(true);
    expect(canUseFeature({ planSlug: "professional" }, "membership")).toBe(true);
    expect(canUseFeature({ planSlug: "professional" }, "stripe_checkout")).toBe(true);
  });

  it("returns false for features not in professional plan", () => {
    expect(canUseFeature({ planSlug: "professional" }, "whatsapp_automation")).toBe(false);
    expect(canUseFeature({ planSlug: "professional" }, "advanced_reports")).toBe(false);
    expect(canUseFeature({ planSlug: "professional" }, "multi_clinic")).toBe(false);
    expect(canUseFeature({ planSlug: "professional" }, "white_label")).toBe(false);
  });

  it("returns true for all features in scale plan", () => {
    expect(canUseFeature({ planSlug: "scale" }, "ai_insights")).toBe(true);
    expect(canUseFeature({ planSlug: "scale" }, "whatsapp_automation")).toBe(true);
    expect(canUseFeature({ planSlug: "scale" }, "advanced_reports")).toBe(true);
    expect(canUseFeature({ planSlug: "scale" }, "advanced_permissions")).toBe(true);
    // multi_clinic and white_label are false on scale
    expect(canUseFeature({ planSlug: "scale" }, "multi_clinic")).toBe(false);
    expect(canUseFeature({ planSlug: "scale" }, "white_label")).toBe(false);
  });

  it("returns true for all features in enterprise plan", () => {
    expect(canUseFeature({ planSlug: "enterprise" }, "multi_clinic")).toBe(true);
    expect(canUseFeature({ planSlug: "enterprise" }, "white_label")).toBe(true);
    expect(canUseFeature({ planSlug: "enterprise" }, "whatsapp_automation")).toBe(true);
    expect(canUseFeature({ planSlug: "enterprise" }, "advanced_reports")).toBe(true);
  });

  it("featureOverrides false takes precedence over plan features that are enabled", () => {
    expect(
      canUseFeature(
        { planSlug: "professional", featureOverrides: { ai_insights: false } },
        "ai_insights"
      )
    ).toBe(false);

    expect(
      canUseFeature(
        { planSlug: "scale", featureOverrides: { whatsapp_automation: false } },
        "whatsapp_automation"
      )
    ).toBe(false);
  });

  it("featureOverrides true takes precedence and enables a feature starter does not include", () => {
    expect(
      canUseFeature(
        { planSlug: "starter", featureOverrides: { ai_insights: true } },
        "ai_insights"
      )
    ).toBe(true);

    expect(
      canUseFeature(
        { planSlug: "starter", featureOverrides: { whatsapp_automation: true } },
        "whatsapp_automation"
      )
    ).toBe(true);
  });

  it("defaults to starter plan when planSlug is null", () => {
    expect(canUseFeature({ planSlug: null }, "leads")).toBe(true);
    expect(canUseFeature({ planSlug: null }, "ai_insights")).toBe(false);
  });

  it("defaults to starter plan when planSlug is undefined (empty context)", () => {
    expect(canUseFeature({}, "leads")).toBe(true);
    expect(canUseFeature({}, "ai_insights")).toBe(false);
  });

  it("defaults to starter plan for an unknown planSlug", () => {
    // getPlanConfig falls back to starter for unknown slugs
    expect(canUseFeature({ planSlug: "unknown-plan" }, "leads")).toBe(true);
    expect(canUseFeature({ planSlug: "unknown-plan" }, "ai_insights")).toBe(false);
  });
});

// ─── getPlanLimit ─────────────────────────────────────────────────────────────

describe("getPlanLimit", () => {
  it("starter plan has a patients limit of 150", () => {
    expect(getPlanLimit({ planSlug: "starter" }, "patients")).toBe(150);
  });

  it("starter plan has a users limit of 3", () => {
    expect(getPlanLimit({ planSlug: "starter" }, "users")).toBe(3);
  });

  it("starter plan has an ai_insights limit of 0", () => {
    expect(getPlanLimit({ planSlug: "starter" }, "ai_insights")).toBe(0);
  });

  it("professional plan has a patients limit of 1000", () => {
    expect(getPlanLimit({ planSlug: "professional" }, "patients")).toBe(1000);
  });

  it("scale plan has unlimited (null) patients", () => {
    expect(getPlanLimit({ planSlug: "scale" }, "patients")).toBeNull();
  });

  it("scale plan has unlimited (null) users", () => {
    expect(getPlanLimit({ planSlug: "scale" }, "users")).toBeNull();
  });

  it("enterprise plan has unlimited (null) for everything", () => {
    expect(getPlanLimit({ planSlug: "enterprise" }, "patients")).toBeNull();
    expect(getPlanLimit({ planSlug: "enterprise" }, "users")).toBeNull();
    expect(getPlanLimit({ planSlug: "enterprise" }, "ai_insights")).toBeNull();
  });
});

// ─── checkUsageLimit ──────────────────────────────────────────────────────────

describe("checkUsageLimit", () => {
  it("reports correct used count when usage is provided", () => {
    const result = checkUsageLimit(
      { planSlug: "starter", usage: { patients: 50 } },
      "patients"
    );
    expect(result.used).toBe(50);
    expect(result.limit).toBe(150);
  });

  it("reports used = 0 when usage is not provided", () => {
    const result = checkUsageLimit({ planSlug: "starter" }, "patients");
    expect(result.used).toBe(0);
    expect(result.isAllowed).toBe(true);
    expect(result.isAtLimit).toBe(false);
  });

  it("remaining decrements correctly", () => {
    const result = checkUsageLimit(
      { planSlug: "starter", usage: { patients: 20 } },
      "patients"
    );
    expect(result.remaining).toBe(130); // 150 - 20
  });

  it("isAtLimit is true when usage meets the limit", () => {
    const result = checkUsageLimit(
      { planSlug: "starter", usage: { patients: 150 } },
      "patients"
    );
    expect(result.isAtLimit).toBe(true);
    expect(result.isAllowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("isAtLimit is true when usage exceeds the limit", () => {
    const result = checkUsageLimit(
      { planSlug: "starter", usage: { patients: 200 } },
      "patients"
    );
    expect(result.isAtLimit).toBe(true);
    expect(result.isAllowed).toBe(false);
    // remaining is clamped to 0 (Math.max)
    expect(result.remaining).toBe(0);
  });

  it("isAllowed is false when at limit", () => {
    const limit = getPlanLimit({ planSlug: "starter" }, "patients")!;
    const result = checkUsageLimit(
      { planSlug: "starter", usage: { patients: limit } },
      "patients"
    );
    expect(result.isAllowed).toBe(false);
    expect(result.isAtLimit).toBe(true);
  });

  it("isUnlimited is true for scale plan patients", () => {
    const result = checkUsageLimit({ planSlug: "scale" }, "patients");
    expect(result.isUnlimited).toBe(true);
    expect(result.remaining).toBeNull();
    expect(result.isAtLimit).toBe(false);
    expect(result.isAllowed).toBe(true);
  });

  it("isUnlimited is true for enterprise plan on all limits", () => {
    const result = checkUsageLimit(
      { planSlug: "enterprise", usage: { patients: 999999 } },
      "patients"
    );
    expect(result.isUnlimited).toBe(true);
    expect(result.isAllowed).toBe(true);
    expect(result.isAtLimit).toBe(false);
    expect(result.remaining).toBeNull();
  });

  it("starter plan ai_insights limit is 0 → isAtLimit when used = 0", () => {
    // limit is 0, used is 0 → 0 >= 0, so isAtLimit = true
    const result = checkUsageLimit({ planSlug: "starter" }, "ai_insights");
    expect(result.limit).toBe(0);
    expect(result.isAtLimit).toBe(true);
    expect(result.isAllowed).toBe(false);
  });

  it("professional plan ai_insights limit allows usage below 500", () => {
    const result = checkUsageLimit(
      { planSlug: "professional", usage: { ai_insights: 100 } },
      "ai_insights"
    );
    expect(result.limit).toBe(500);
    expect(result.isAllowed).toBe(true);
    expect(result.remaining).toBe(400);
  });
});
