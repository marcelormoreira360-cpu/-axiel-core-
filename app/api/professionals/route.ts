import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export interface ProfessionalSummary {
  userId: string;
  fullName: string;
  email: string | null;
  displayName: string | null;
  specialty: string | null;
  role: string;
  isBookable: boolean;
  // This month stats
  sessionsThisMonth: number;
  completedThisMonth: number;
  revenueThisMonth: number;      // cents
  avgNps: number | null;
  completionRate: number;        // 0-100
}

// GET /api/professionals — list all bookable team members with this-month KPIs
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Sem clínica associada." }, { status: 403 });
  }

  const clinicId = profile.clinic_id as string;
  const admin = createSupabaseAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // All clinic users
  const { data: clinicUsers } = await admin
    .from("clinic_users")
    .select("user_id, display_name, specialty, role, is_bookable, users(id, full_name, email)")
    .eq("clinic_id", clinicId)
    .eq("status", "active");

  if (!clinicUsers?.length) return NextResponse.json({ professionals: [] });

  const userIds = clinicUsers.map((cu) => cu.user_id as string);

  // This month's appointments per practitioner
  const { data: appts } = await admin
    .from("appointments")
    .select("practitioner_id, status")
    .eq("clinic_id", clinicId)
    .in("practitioner_id", userIds)
    .gte("starts_at", monthStart)
    .lte("starts_at", monthEnd);

  // This month's revenue per practitioner (via appointments → payments)
  const { data: payments } = await admin
    .from("patient_payments")
    .select("amount_cents, appointment_id, appointments!inner(practitioner_id)")
    .eq("clinic_id", clinicId)
    .eq("status", "paid")
    .gte("paid_at", monthStart)
    .lte("paid_at", monthEnd);

  // NPS scores per practitioner (all time, last 50)
  const { data: npsData } = await admin
    .from("session_feedback")
    .select("nps_score, appointments!inner(practitioner_id)")
    .eq("clinic_id", clinicId)
    .in("appointments.practitioner_id" as never, userIds)
    .limit(500);

  // Build maps
  const apptMap = new Map<string, { total: number; completed: number; cancelled: number; noShow: number }>();
  for (const a of appts ?? []) {
    const pid = a.practitioner_id as string;
    if (!apptMap.has(pid)) apptMap.set(pid, { total: 0, completed: 0, cancelled: 0, noShow: 0 });
    const entry = apptMap.get(pid)!;
    entry.total += 1;
    if (a.status === "completed") entry.completed += 1;
    if (a.status === "cancelled") entry.cancelled += 1;
    if (a.status === "no_show") entry.noShow += 1;
  }

  const revenueMap = new Map<string, number>();
  for (const p of payments ?? []) {
    const appt = (p.appointments as unknown) as { practitioner_id: string } | null;
    const pid = appt?.practitioner_id;
    if (!pid) continue;
    revenueMap.set(pid, (revenueMap.get(pid) ?? 0) + (p.amount_cents ?? 0));
  }

  const npsMap = new Map<string, number[]>();
  for (const n of npsData ?? []) {
    const appt = (n.appointments as unknown) as { practitioner_id: string } | null;
    const pid = appt?.practitioner_id;
    if (!pid) continue;
    if (!npsMap.has(pid)) npsMap.set(pid, []);
    npsMap.get(pid)!.push(n.nps_score as number);
  }

  const professionals: ProfessionalSummary[] = clinicUsers.map((cu) => {
    const uid = cu.user_id as string;
    const u = (cu.users as unknown) as { id: string; full_name: string; email: string | null } | null;
    const stats = apptMap.get(uid) ?? { total: 0, completed: 0, cancelled: 0, noShow: 0 };
    const denominator = stats.completed + stats.cancelled + stats.noShow;
    const npsScores = npsMap.get(uid) ?? [];
    const avgNps = npsScores.length > 0
      ? Math.round((npsScores.reduce((s, v) => s + v, 0) / npsScores.length) * 10) / 10
      : null;

    return {
      userId: uid,
      fullName: u?.full_name ?? "—",
      email: u?.email ?? null,
      displayName: cu.display_name as string | null,
      specialty: cu.specialty as string | null,
      role: cu.role as string,
      isBookable: cu.is_bookable as boolean,
      sessionsThisMonth: stats.total,
      completedThisMonth: stats.completed,
      revenueThisMonth: revenueMap.get(uid) ?? 0,
      avgNps,
      completionRate: denominator > 0 ? Math.round((stats.completed / denominator) * 100) : 0,
    };
  });

  return NextResponse.json({ professionals });
}
