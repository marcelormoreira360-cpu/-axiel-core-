import { describe, it, expect } from "vitest";
import {
  roleLabels,
  platformRoles,
  clinicManagerRoles,
  clinicWriteRoles,
  canManagePlatform,
  canSupportPlatform,
  canManageClinics,
  canManageClinicUsers,
  canWriteClinicData,
  canDeleteRecords,
  canViewOnly,
} from "../roles";
import type { AppRole } from "@/lib/types";

// ─── roleLabels ───────────────────────────────────────────────────────────────

describe("roleLabels", () => {
  it("has a label for every AppRole", () => {
    const allRoles: AppRole[] = [
      "admin",
      "platform_admin",
      "platform_support",
      "clinic_owner",
      "clinic_manager",
      "practitioner",
      "front_desk",
      "read_only_staff",
      "staff",
    ];
    for (const role of allRoles) {
      expect(roleLabels[role]).toBeDefined();
      expect(typeof roleLabels[role]).toBe("string");
      expect(roleLabels[role].length).toBeGreaterThan(0);
    }
  });

  it("admin has label 'Platform Admin'", () => {
    expect(roleLabels["admin"]).toBe("Platform Admin");
  });

  it("clinic_owner has label 'Clinic Owner'", () => {
    expect(roleLabels["clinic_owner"]).toBe("Clinic Owner");
  });

  it("read_only_staff has label 'Read-only Staff'", () => {
    expect(roleLabels["read_only_staff"]).toBe("Read-only Staff");
  });
});

// ─── role arrays ──────────────────────────────────────────────────────────────

describe("platformRoles", () => {
  it("contains admin, platform_admin, platform_support", () => {
    expect(platformRoles).toContain("admin");
    expect(platformRoles).toContain("platform_admin");
    expect(platformRoles).toContain("platform_support");
  });
});

describe("clinicManagerRoles", () => {
  it("contains clinic_owner and clinic_manager", () => {
    expect(clinicManagerRoles).toContain("clinic_owner");
    expect(clinicManagerRoles).toContain("clinic_manager");
  });
});

describe("clinicWriteRoles", () => {
  it("contains practitioner, front_desk, staff", () => {
    expect(clinicWriteRoles).toContain("practitioner");
    expect(clinicWriteRoles).toContain("front_desk");
    expect(clinicWriteRoles).toContain("staff");
  });

  it("does NOT contain read_only_staff", () => {
    expect(clinicWriteRoles).not.toContain("read_only_staff");
  });
});

// ─── canManagePlatform ────────────────────────────────────────────────────────

describe("canManagePlatform", () => {
  it("returns true for admin", () => {
    expect(canManagePlatform("admin")).toBe(true);
  });

  it("returns true for platform_admin", () => {
    expect(canManagePlatform("platform_admin")).toBe(true);
  });

  it("returns false for platform_support", () => {
    expect(canManagePlatform("platform_support")).toBe(false);
  });

  it("returns false for clinic_owner", () => {
    expect(canManagePlatform("clinic_owner")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canManagePlatform(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(canManagePlatform(undefined)).toBe(false);
  });
});

// ─── canSupportPlatform ───────────────────────────────────────────────────────

describe("canSupportPlatform", () => {
  it("returns true for admin", () => {
    expect(canSupportPlatform("admin")).toBe(true);
  });

  it("returns true for platform_admin", () => {
    expect(canSupportPlatform("platform_admin")).toBe(true);
  });

  it("returns true for platform_support", () => {
    expect(canSupportPlatform("platform_support")).toBe(true);
  });

  it("returns false for clinic_owner", () => {
    expect(canSupportPlatform("clinic_owner")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canSupportPlatform(null)).toBe(false);
  });
});

// ─── canManageClinics ─────────────────────────────────────────────────────────

describe("canManageClinics", () => {
  it("returns true for admin", () => {
    expect(canManageClinics("admin")).toBe(true);
  });

  it("returns true for platform_admin", () => {
    expect(canManageClinics("platform_admin")).toBe(true);
  });

  it("returns false for clinic_owner (not a platform role)", () => {
    expect(canManageClinics("clinic_owner")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canManageClinics(null)).toBe(false);
  });
});

// ─── canManageClinicUsers ─────────────────────────────────────────────────────

describe("canManageClinicUsers", () => {
  it("returns true for admin", () => {
    expect(canManageClinicUsers("admin")).toBe(true);
  });

  it("returns true for clinic_owner", () => {
    expect(canManageClinicUsers("clinic_owner")).toBe(true);
  });

  it("returns true for clinic_manager", () => {
    expect(canManageClinicUsers("clinic_manager")).toBe(true);
  });

  it("returns false for practitioner", () => {
    expect(canManageClinicUsers("practitioner")).toBe(false);
  });

  it("returns false for front_desk", () => {
    expect(canManageClinicUsers("front_desk")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canManageClinicUsers(null)).toBe(false);
  });
});

// ─── canWriteClinicData ───────────────────────────────────────────────────────

describe("canWriteClinicData", () => {
  it("returns true for admin", () => {
    expect(canWriteClinicData("admin")).toBe(true);
  });

  it("returns true for clinic_owner", () => {
    expect(canWriteClinicData("clinic_owner")).toBe(true);
  });

  it("returns true for practitioner", () => {
    expect(canWriteClinicData("practitioner")).toBe(true);
  });

  it("returns true for front_desk", () => {
    expect(canWriteClinicData("front_desk")).toBe(true);
  });

  it("returns true for staff", () => {
    expect(canWriteClinicData("staff")).toBe(true);
  });

  it("returns false for read_only_staff", () => {
    expect(canWriteClinicData("read_only_staff")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canWriteClinicData(null)).toBe(false);
  });
});

// ─── canDeleteRecords ─────────────────────────────────────────────────────────

describe("canDeleteRecords", () => {
  it("returns true for admin", () => {
    expect(canDeleteRecords("admin")).toBe(true);
  });

  it("returns true for clinic_owner", () => {
    expect(canDeleteRecords("clinic_owner")).toBe(true);
  });

  it("returns true for clinic_manager", () => {
    expect(canDeleteRecords("clinic_manager")).toBe(true);
  });

  it("returns false for practitioner", () => {
    expect(canDeleteRecords("practitioner")).toBe(false);
  });

  it("returns false for front_desk", () => {
    expect(canDeleteRecords("front_desk")).toBe(false);
  });

  it("returns false for read_only_staff", () => {
    expect(canDeleteRecords("read_only_staff")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canDeleteRecords(null)).toBe(false);
  });
});

// ─── canViewOnly ──────────────────────────────────────────────────────────────

describe("canViewOnly", () => {
  it("returns true for read_only_staff", () => {
    expect(canViewOnly("read_only_staff")).toBe(true);
  });

  it("returns false for staff (write role)", () => {
    expect(canViewOnly("staff")).toBe(false);
  });

  it("returns false for clinic_owner", () => {
    expect(canViewOnly("clinic_owner")).toBe(false);
  });

  it("returns false for admin", () => {
    expect(canViewOnly("admin")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canViewOnly(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(canViewOnly(undefined)).toBe(false);
  });
});
