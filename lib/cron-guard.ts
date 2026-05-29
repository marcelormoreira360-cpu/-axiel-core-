/**
 * cron-guard — idempotency and observability for scheduled jobs.
 *
 * Usage:
 *
 *   const guard = await CronGuard.start("automations", { windowMs: 20 * 60_000 });
 *   if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });
 *
 *   try {
 *     const result = await doWork();
 *     await guard.finish(result);
 *   } catch (err) {
 *     await guard.fail(err);
 *     throw err;
 *   }
 *
 * How it works:
 *  1. Queries cron_runs for a recent 'success' within windowMs → skips if found.
 *  2. Inserts a 'running' row to mark the job as in-flight.
 *  3. On finish(): updates the row to 'success' with duration + result JSON.
 *  4. On fail(): updates the row to 'error' with the error message.
 *
 * This prevents double-runs when:
 *  - A monthly-report retry fires 1h later but the first run succeeded.
 *  - Vercel re-invokes a cron due to a transient network timeout.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-guard");

export interface CronGuardHandle {
  /** True when the job was skipped (recent success found). */
  skipped: boolean;
  /** Marks the run as successful and records the result payload. */
  finish(result?: Record<string, unknown>): Promise<void>;
  /** Marks the run as failed and records the error message. */
  fail(err: unknown): Promise<void>;
}

export class CronGuard {
  /**
   * Starts a guarded cron run.
   *
   * @param jobName   Unique name for the job, e.g. "automations"
   * @param options.windowMs  How far back to look for a recent success (default 20 min).
   *                          Set to 0 to disable idempotency (always run).
   */
  static async start(
    jobName: string,
    { windowMs = 20 * 60_000 }: { windowMs?: number } = {}
  ): Promise<CronGuardHandle> {
    const supabase = createSupabaseAdminClient();
    const startedAt = Date.now();

    // ── 1. Idempotency check ────────────────────────────────────────────────
    if (windowMs > 0) {
      const cutoff = new Date(startedAt - windowMs).toISOString();
      const { data: recent } = await supabase
        .from("cron_runs")
        .select("id, started_at")
        .eq("job_name", jobName)
        .eq("status", "success")
        .gte("started_at", cutoff)
        .limit(1)
        .maybeSingle();

      if (recent) {
        log.info("skipping — recent success found", {
          job: jobName,
          last_run: recent.started_at,
        });
        return {
          skipped: true,
          finish: async () => {},
          fail: async () => {},
        };
      }
    }

    // ── 2. Insert 'running' row ─────────────────────────────────────────────
    const { data: row, error } = await supabase
      .from("cron_runs")
      .insert({ job_name: jobName, status: "running" })
      .select("id")
      .single();

    if (error || !row) {
      // Non-blocking: if we can't write the log, still let the job run
      log.warn("could not insert cron_runs row — running without idempotency guard", {
        job: jobName,
        error: error?.message,
      });
    }

    const runId: string | null = row?.id ?? null;

    log.info("started", { job: jobName, run_id: runId ?? "untracked" });

    // ── 3. Return handle ────────────────────────────────────────────────────
    return {
      skipped: false,

      async finish(result = {}) {
        const durationMs = Date.now() - startedAt;
        log.info("finished", { job: jobName, duration_ms: durationMs, run_id: runId ?? "untracked" });
        if (!runId) return;
        await supabase
          .from("cron_runs")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            duration_ms: durationMs,
            result,
          })
          .eq("id", runId);
      },

      async fail(err: unknown) {
        const durationMs = Date.now() - startedAt;
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.error("failed", err, { job: jobName, duration_ms: durationMs });
        if (!runId) return;
        await supabase
          .from("cron_runs")
          .update({
            status: "error",
            finished_at: new Date().toISOString(),
            duration_ms: durationMs,
            error_message: errorMessage,
          })
          .eq("id", runId);
      },
    };
  }
}
