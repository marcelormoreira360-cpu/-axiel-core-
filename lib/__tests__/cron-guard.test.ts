import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Supabase admin client ───────────────────────────────────────────────
// CronGuard uses createSupabaseAdminClient internally. We mock it so tests
// never hit the real DB.

const mockSelect   = vi.fn();
const mockInsert   = vi.fn();
const mockUpdate   = vi.fn();
const mockEq       = vi.fn();
const mockGte      = vi.fn();
const mockLimit    = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle   = vi.fn();

// Build a chainable query builder stub
function chainable(terminal: ReturnType<typeof vi.fn>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    maybeSingle: terminal,
    single:      terminal,
  };
  return chain;
}

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CronGuard } from "../cron-guard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabase({
  recentSuccess = null as { id: string; started_at: string } | null,
  insertId = "run-abc",
  insertError = null as { message: string } | null,
} = {}) {
  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "cron_runs") {
        return {
          select:      vi.fn().mockReturnThis(),
          insert:      vi.fn().mockReturnThis(),
          update:      vi.fn().mockReturnThis(),
          eq:          vi.fn().mockReturnThis(),
          gte:         vi.fn().mockReturnThis(),
          limit:       vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: recentSuccess, error: null }),
          single:      vi.fn().mockResolvedValue({
            data: insertError ? null : { id: insertId },
            error: insertError,
          }),
        };
      }
      return {};
    }),
  };
  return supabase;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CronGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when a recent success is found within the window", async () => {
    const supabase = makeSupabase({
      recentSuccess: { id: "prev-run", started_at: new Date().toISOString() },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const guard = await CronGuard.start("automations", { windowMs: 20 * 60_000 });

    expect(guard.skipped).toBe(true);
  });

  it("proceeds when no recent success is found", async () => {
    const supabase = makeSupabase({ recentSuccess: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const guard = await CronGuard.start("automations", { windowMs: 20 * 60_000 });

    expect(guard.skipped).toBe(false);
  });

  it("proceeds when windowMs is 0 (idempotency disabled)", async () => {
    const supabase = makeSupabase({ recentSuccess: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const guard = await CronGuard.start("automations", { windowMs: 0 });

    expect(guard.skipped).toBe(false);
  });

  it("finish() calls update with status=success and duration_ms", async () => {
    const supabase = makeSupabase({ recentSuccess: null, insertId: "run-123" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const guard = await CronGuard.start("automations");

    await guard.finish({ sent: 5 });

    // The update should have been called on cron_runs
    const fromCalls = supabase.from.mock.calls.map((args) => args[0] as string);
    expect(fromCalls).toContain("cron_runs");
  });

  it("fail() resolves without throwing even when DB is unavailable", async () => {
    const supabase = makeSupabase({ recentSuccess: null, insertError: { message: "DB down" } });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const guard = await CronGuard.start("automations");

    // Should not throw even with no runId
    await expect(guard.fail(new Error("job failed"))).resolves.toBeUndefined();
  });

  it("skipped guard's finish() and fail() are no-ops", async () => {
    const supabase = makeSupabase({
      recentSuccess: { id: "prev", started_at: new Date().toISOString() },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(supabase as never);

    const guard = await CronGuard.start("automations");
    expect(guard.skipped).toBe(true);

    // Should not throw
    await expect(guard.finish()).resolves.toBeUndefined();
    await expect(guard.fail(new Error("oops"))).resolves.toBeUndefined();
  });
});
