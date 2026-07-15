import { NextResponse } from "next/server";
import { CronGuard } from "@/lib/cron-guard";
import { createLogger } from "@/lib/logger";
import { processOutboundMediaJobs } from "@/services/outbound-media-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("cron/media-worker");

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fila: sem janela de idempotência (sempre drena o pendente). O índice único
  // de 'running' do cron-guard garante um worker por vez; run morto é reclamado
  // após 5 min.
  const guard = await CronGuard.start("media-worker", { windowMs: 0, runningWindowMs: 5 * 60_000 });
  if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const result = await processOutboundMediaJobs();
    await guard.finish(result as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("unhandled error", error);
    await guard.fail(error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
