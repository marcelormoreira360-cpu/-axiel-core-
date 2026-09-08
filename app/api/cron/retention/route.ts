import { NextResponse } from "next/server";
import { runRetentionAnonymization } from "@/services/retention-service";
import { CronGuard } from "@/lib/cron-guard";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("cron/retention");

/**
 * Job de retenção de PHI (#9). Anonimiza pacientes cujo prazo por país já passou.
 * Passe ?dryRun=1 para inspecionar (conta elegíveis sem anonimizar). Sem parâmetro,
 * executa de verdade — mas a elegibilidade é conservadora (base recente ⇒ costuma ser 0)
 * e há teto por execução no serviço.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const guard = await CronGuard.start("retention", { windowMs: 12 * 60 * 60_000 });
  if (guard.skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const result = await runRetentionAnonymization({ dryRun });
    await guard.finish(result as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    log.error("unhandled error", error);
    await guard.fail(error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
