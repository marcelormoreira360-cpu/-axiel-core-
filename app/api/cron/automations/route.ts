import { NextResponse } from "next/server";
import { processAutomations, checkLowPackageNotifications } from "@/services/automation-service";
import { processDunning } from "@/services/dunning-service";
import { CronGuard } from "@/lib/cron-guard";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("cron/automations");

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotency window: 20 min — prevents double-run if Vercel retries within the hour
  const guard = await CronGuard.start("automations", { windowMs: 20 * 60_000 });
  if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const { processReassessments } = await import("@/services/onboarding-assessment-service");
    const { processTrialExpiryEmails } = await import("@/services/trial-expiry-service");
    const [automations, packageAlerts, dunning, reassessments, trialExpiry] = await Promise.all([
      processAutomations(),
      checkLowPackageNotifications(),
      processDunning(),
      processReassessments(),
      // Isolado: falha no aviso de trial não derruba as demais automações
      processTrialExpiryEmails().catch((error) => {
        log.error("trialExpiry failed", error);
        return { sent: 0, skipped: 0, failed: 0, error: String(error) };
      }),
    ]);

    const result = { automations, packageAlerts, dunning, reassessments, trialExpiry };
    await guard.finish(result as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("unhandled error", error);
    await guard.fail(error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
