import { NextResponse } from "next/server";
import { processAutomations, checkLowPackageNotifications } from "@/services/automation-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const [automations, packageAlerts] = await Promise.all([
      processAutomations(),
      checkLowPackageNotifications(),
    ]);
    return NextResponse.json({ ok: true, automations, packageAlerts });
  } catch (error) {
    console.error("[cron/automations] error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
