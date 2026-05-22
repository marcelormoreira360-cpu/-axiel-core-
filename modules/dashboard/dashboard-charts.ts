export interface RevenuePoint {
  month: string;    // "2025-01"
  label: string;   // "jan/25"
  revenue: number; // in cents
  sessions: number;
}

export async function getRevenueChartData(
  clinicId: string,
  months = 6,
): Promise<RevenuePoint[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const now = new Date();

  // Build month slots
  const points: RevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const raw = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    // "jan. de 25" → "jan/25"
    const label = raw.replace(/\.\s*de\s*/i, "/").replace(".", "");
    points.push({ month: monthKey, label, revenue: 0, sessions: 0 });
  }

  const fromDate = new Date(
    now.getFullYear(),
    now.getMonth() - months + 1,
    1,
  ).toISOString();

  const [{ data: payments }, { data: appts }] = await Promise.all([
    supabase
      .from("patient_payments")
      .select("amount_cents, paid_at")
      .eq("clinic_id", clinicId)
      .gte("paid_at", fromDate),

    supabase
      .from("appointments")
      .select("starts_at")
      .eq("clinic_id", clinicId)
      .gte("starts_at", fromDate),
  ]);

  for (const p of payments ?? []) {
    if (!p.paid_at) continue;
    const d = new Date(p.paid_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const pt = points.find((x) => x.month === key);
    if (pt) pt.revenue += p.amount_cents ?? 0;
  }

  for (const a of appts ?? []) {
    const d = new Date(a.starts_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const pt = points.find((x) => x.month === key);
    if (pt) pt.sessions += 1;
  }

  return points;
}
