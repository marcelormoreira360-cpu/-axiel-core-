import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Supabase admin client ───────────────────────────────────────────────

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

// Mock dynamic imports used inside actions (fire-and-forget, non-blocking)
vi.mock("@/services/push-service", () => ({
  sendPushToClinic: vi.fn().mockResolvedValue(undefined),
}));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requestDataDeletionAction } from "@/app/p/[token]/actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase stub with configurable behaviour for the tables
 * accessed by requestDataDeletionAction:
 *   - patient_portal_links  (getLinkByToken)
 *   - data_deletion_requests (check existing + insert)
 */
function makeSupabase({
  linkData = null as {
    id: string;
    clinic_id: string;
    patient_id: string;
    expires_at: string;
    revoked_at: string | null;
  } | null,
  existingRequest = null as { id: string; status: string } | null,
  insertError = null as { message: string } | null,
} = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "patient_portal_links") {
        return {
          select:      vi.fn().mockReturnThis(),
          eq:          vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: linkData, error: null }),
        };
      }

      if (table === "data_deletion_requests") {
        return {
          select:      vi.fn().mockReturnThis(),
          insert:      vi.fn().mockReturnThis(),
          eq:          vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: existingRequest, error: null }),
          // insert() resolves via the chain — return a resolved promise for the
          // terminal await inside the action
          then: undefined as never,
        };
      }

      return {};
    }),
  };
}

/**
 * A valid future link stub.
 */
const validLink = {
  id: "link-1",
  clinic_id: "clinic-abc",
  patient_id: "patient-xyz",
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  revoked_at: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("requestDataDeletionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna { ok: false } com mensagem de link inválido quando o token não existe", async () => {
    const supabase = makeSupabase({ linkData: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const result = await requestDataDeletionAction("token-invalido");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/link inválido/i);
  });

  it("retorna { ok: false } com mensagem de 'Já existe' quando há request pendente", async () => {
    // Two separate supabase stubs are needed because the action calls
    // createSupabaseAdminClient() twice (once in getLinkByToken, once for the
    // deletion requests query).
    const linkQueryStub = {
      from: vi.fn().mockReturnValue({
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: validLink, error: null }),
      }),
    };

    const deletionQueryStub = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "data_deletion_requests") {
          return {
            select:      vi.fn().mockReturnThis(),
            insert:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "req-1", status: "pending" },
              error: null,
            }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(linkQueryStub as never)
      .mockReturnValueOnce(deletionQueryStub as never);

    const result = await requestDataDeletionAction("token-valido");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/já existe/i);
  });

  it("retorna { ok: true, error: null } em caso de sucesso", async () => {
    const linkQueryStub = {
      from: vi.fn().mockReturnValue({
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: validLink, error: null }),
      }),
    };

    const deletionQueryStub = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "data_deletion_requests") {
          return {
            select:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert:      vi.fn().mockResolvedValue({ data: { id: "new-req" }, error: null }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(linkQueryStub as never)
      .mockReturnValueOnce(deletionQueryStub as never);

    const result = await requestDataDeletionAction("token-valido", "Quero excluir meus dados");

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
  });
});
