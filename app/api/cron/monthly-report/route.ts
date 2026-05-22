import { NextResponse } from "next/server";
import { sendMonthlyReports } from "@/services/monthly-report-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendMonthlyReports();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/monthly-report] error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
