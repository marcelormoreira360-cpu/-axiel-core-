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
  const practitionerId = searchParams.get("practitioner_id");

  if (!date || !sessionTypeId) {
    return NextResponse.json({ error: "Parâmetros date e session_type_id são obrigatórios." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });

  // Fetch timezone from clinic_settings (fall back to Brasília if not set)
  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  const timezone: string =
    (clinicSettings?.settings as Record<string, unknown> | null)?.timezone as string
    ?? "America/Sao_Paulo";

  // Compute UTC boundaries for the requested wall-clock date in the clinic's TZ.
  // This ensures we capture all appointments that fall within that local day,
  // even when the clinic TZ is behind UTC (e.g. UTC-3 local midnight = UTC 03:00).
  const [year, month, day] = date.split("-").map(Number);
  // 00:00 and 23:59:59 wall-clock → UTC
  const probe00 = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const probe23 = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  const getOffset = (probe: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(probe);
    const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    return probe.getTime() - Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  };
  const dayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + getOffset(probe00)).toISOString();
  const dayEndUTC   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59) + getOffset(probe23)).toISOString();

  let bookedQuery = supabase
    .from("appointments")
    .select("starts_at")
    .eq("clinic_id", clinic.id)
    .not("status", "in", '("cancelled","no_show")')  // A-04: exclude cancelled slots
    .gte("starts_at", dayStartUTC)
    .lte("starts_at", dayEndUTC);

  if (practitionerId) {
    bookedQuery = bookedQuery.eq("practitioner_id", practitionerId);
  }

  const [{ data: sessionType }, { data: wh }, { data: booked }] = await Promise.all([
    supabase.from("session_types").select("duration_minutes").eq("id", sessionTypeId).eq("clinic_id", clinic.id).maybeSingle(),
    supabase.from("working_hours").select("opens_at, closes_at, is_open").eq("clinic_id", clinic.id).eq("day_of_week", dayOfWeekFromDate(date)).maybeSingle(),
    bookedQuery,
  ]);

  if (!sessionType) return NextResponse.json({ error: "Tipo de sessão não encontrado." }, { status: 404 });

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
    (booked ?? []).map((a) => a.starts_at),
    timezone,
  );

  // Filter out past slots — slot.iso is now a proper UTC ISO so comparison with
  // `new Date()` (also UTC) correctly reflects the clinic's local wall-clock time.
  const now = new Date();
  const futureSlots = slots.filter((s) => new Date(s.iso) > now);

  return NextResponse.json({ slots: futureSlots });
}
