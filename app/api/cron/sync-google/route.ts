import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncGoogleCalendarToAxiel } from "@/services/google-calendar-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-google
 *
 * Cron job: syncs Google Calendar → AXIEL for ALL clinics that have
 * Google Calendar connected. Run every 15–30 minutes via Vercel Cron.
 *
 * vercel.json cron schedule: every 15 minutes ("schedule": "0,15,30,45 * * * *")
 */
export async function GET(request: Request) {
  // Require CRON_SECRET to prevent unauthorized triggers
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch all clinics with Google Calendar connected
  const { data: integrations, error } = await supabase
    .from("calendar_integrations")
    .select("clinic_id")
    .eq("provider", "google");

  if (error) {
    console.error("sync-google cron: failed to fetch integrations", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clinicIds = (integrations ?? []).map((r) => r.clinic_id as string);
  const results: Record<string, { updated: number; cancelled: number; errors: number }> = {};

  // Sync each clinic sequentially to avoid rate-limit issues
  for (const clinicId of clinicIds) {
    try {
      results[clinicId] = await syncGoogleCalendarToAxiel(clinicId);
    } catch (err) {
      console.error(`sync-google cron: error for clinic ${clinicId}`, err);
      results[clinicId] = { updated: 0, cancelled: 0, errors: 1 };
    }
  }

  const totalUpdated = Object.values(results).reduce((s, r) => s + r.updated, 0);
  const totalCancelled = Object.values(results).reduce((s, r) => s + r.cancelled, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors, 0);

  // Result is returned in the JSON response — no need for console.log here

  return NextResponse.json({
    clinics: clinicIds.length,
    updated: totalUpdated,
    cancelled: totalCancelled,
    errors: totalErrors,
  });
}
