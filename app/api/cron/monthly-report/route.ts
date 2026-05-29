import { NextResponse } from "next/server";
import { sendMonthlyReports } from "@/services/monthly-report-service";
import { CronGuard } from "@/lib/cron-guard";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("cron/monthly-report");

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotency window: 2h — the retry fires 1h after the primary cron.
  // If the primary succeeded, the retry sees the recent success and skips.
  // If the primary failed, the retry proceeds normally.
  const guard = await CronGuard.start("monthly-report", { windowMs: 2 * 60 * 60_000 });
  if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const result = await sendMonthlyReports();
    await guard.finish(result as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("unhandled error", error);
    await guard.fail(error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
