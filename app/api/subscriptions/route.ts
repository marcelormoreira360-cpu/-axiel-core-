import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export interface PatientSubscriptionRow {
  id: string;
  patientId: string;
  patientName: string;
  planName: string;
  amountCents: number;
  currency: string;
  billingInterval: "monthly" | "yearly";
  sessionsPerCycle: number;
  sessionsUsedThisCycle: number;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "paused";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cu } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!cu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clinicId = cu.clinic_id as string;
  const admin = createSupabaseAdminClient();

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status"); // e.g. "active" or "past_due"

  let query = admin
    .from("patient_subscriptions")
    .select("*, patients(full_name)")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: PatientSubscriptionRow[] = (data ?? []).map((row) => {
    const patient = (row.patients as unknown) as { full_name: string } | null;
    return {
      id: row.id as string,
      patientId: row.patient_id as string,
      patientName: patient?.full_name ?? "—",
      planName: row.plan_name as string,
      amountCents: row.amount_cents as number,
      currency: row.currency as string,
      billingInterval: (row.billing_interval as string) === "yearly" ? "yearly" : "monthly",
      sessionsPerCycle: row.sessions_per_cycle as number,
      sessionsUsedThisCycle: row.sessions_used_this_cycle as number,
      status: row.status as PatientSubscriptionRow["status"],
      currentPeriodEnd: row.current_period_end as string | null,
      cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
      createdAt: row.created_at as string,
    };
  });

  // Aggregate stats
  const total = rows.length;
  const activeCount = rows.filter((r) => r.status === "active" || r.status === "trialing").length;
  const pastDueCount = rows.filter((r) => r.status === "past_due").length;
  const mrr = rows
    .filter((r) => r.status === "active" || r.status === "trialing")
    .reduce((sum, r) => sum + (r.billingInterval === "yearly" ? Math.round(r.amountCents / 12) : r.amountCents), 0);

  return NextResponse.json({ rows, stats: { total, activeCount, pastDueCount, mrr } });
}
