import { NextResponse } from "next/server";
import { CronGuard } from "@/lib/cron-guard";
import { createLogger } from "@/lib/logger";
import { notifySupplementRegenerationWork } from "@/services/supplement-regeneration-nudge-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("cron/supplement-regeneration-nudge");

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Janela de idempotência de 12h: se o cron disparar 2x, não notifica em dobro.
  const guard = await CronGuard.start("supplement-regeneration-nudge", {
    windowMs: 12 * 60 * 60_000,
    runningWindowMs: 5 * 60_000,
  });
  if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const result = await notifySupplementRegenerationWork();
    await guard.finish(result as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("unhandled error", error);
    await guard.fail(error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
