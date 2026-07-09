import crypto from "crypto";
import { NextResponse } from "next/server";
import { getClinicByIcalToken, generateIcalFeed } from "@/services/ical-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

export const runtime = "nodejs";

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Rate limit: 30 req/hora por token+IP (antes de tocar no banco, para conter
  // enumeração de tokens). O token é segredo, então a chave usa um hash dele
  // em vez do valor bruto (não persistir o segredo em rate_limit_buckets).
  const tokenKey = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
  const ip = getClientIp(req);
  if (!(await checkRateLimitDb(`ical:${tokenKey}:${ip}`, 30, 60 * 60_000))) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const clinic = await getClinicByIcalToken(token);
  if (!clinic) return new NextResponse("Not found", { status: 404 });

  const ical = await generateIcalFeed(clinic.id, clinic.name);

  return new NextResponse(ical, {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${clinic.name.replace(/\s/g, "_")}.ics"`,
      "Cache-Control":       "no-cache, no-store",
    },
  });
}
