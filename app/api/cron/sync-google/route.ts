import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncGoogleCalendarToAxiel } from "@/services/google-calendar-service";
import { CronGuard } from "@/lib/cron-guard";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("cron/sync-google");

/**
 * GET /api/cron/sync-google
 *
 * Syncs Google Calendar → AXIEL for all clinics with Google Calendar connected.
 * Runs daily at 04:00 UTC via Vercel Cron.
 *
 * Idempotency window: 20 min — prevents double-run if Vercel retries within the hour.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guard = await CronGuard.start("sync-google", { windowMs: 20 * 60_000 });
  if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });

  const supabase = createSupabaseAdminClient();

  const { data: integrations, error } = await supabase
    .from("calendar_integrations")
    .select("clinic_id")
    .eq("provider", "google");

  if (error) {
    log.error("failed to fetch integrations", error);
    await guard.fail(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clinicIds = (integrations ?? []).map((r) => r.clinic_id as string);
  const results: Record<string, { updated: number; cancelled: number; errors: number }> = {};

  for (const clinicId of clinicIds) {
    try {
      results[clinicId] = await syncGoogleCalendarToAxiel(clinicId);
    } catch (err) {
      log.error("sync error for clinic", err, { clinic_id: clinicId });
      results[clinicId] = { updated: 0, cancelled: 0, errors: 1 };
    }
  }

  const totalUpdated   = Object.values(results).reduce((s, r) => s + r.updated, 0);
  const totalCancelled = Object.values(results).reduce((s, r) => s + r.cancelled, 0);
  const totalErrors    = Object.values(results).reduce((s, r) => s + r.errors, 0);

  const summary = { clinics: clinicIds.length, updated: totalUpdated, cancelled: totalCancelled, errors: totalErrors };
  await guard.finish(summary);
  return NextResponse.json({ ok: true, ...summary });
}
