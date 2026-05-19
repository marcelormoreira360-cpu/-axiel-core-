import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { generateSlots, dayOfWeekFromDate } from "@/lib/booking-utils";

export const runtime = "nodejs";

// GET /api/book/[slug]/slots?date=YYYY-MM-DD&session_type_id=xxx
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const sessionTypeId = searchParams.get("session_type_id");

  if (!date || !sessionTypeId) {
    return NextResponse.json({ error: "date and session_type_id required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const [{ data: sessionType }, { data: wh }, { data: booked }] = await Promise.all([
    supabase.from("session_types").select("duration_minutes").eq("id", sessionTypeId).eq("clinic_id", clinic.id).maybeSingle(),
    supabase.from("working_hours").select("opens_at, closes_at, is_open").eq("clinic_id", clinic.id).eq("day_of_week", dayOfWeekFromDate(date)).maybeSingle(),
    supabase.from("appointments").select("starts_at").eq("clinic_id", clinic.id).gte("starts_at", `${date}T00:00:00`).lte("starts_at", `${date}T23:59:59`),
  ]);

  if (!sessionType) return NextResponse.json({ error: "Session type not found" }, { status: 404 });

  // Default hours if not configured
  const opensAt  = wh?.opens_at  ?? "09:00";
  const closesAt = wh?.closes_at ?? "17:00";
  const isOpen   = wh?.is_open   ?? (dayOfWeekFromDate(date) !== 0 && dayOfWeekFromDate(date) !== 6);

  if (!isOpen) return NextResponse.json({ slots: [] });

  const slots = generateSlots(
    date,
    opensAt,
    closesAt,
    sessionType.duration_minutes,
    (booked ?? []).map((a) => a.starts_at)
  );

  // Filter out past slots
  const now = new Date();
  const futureSlots = slots.filter((s) => new Date(s.iso) > now);

  return NextResponse.json({ slots: futureSlots });
}
