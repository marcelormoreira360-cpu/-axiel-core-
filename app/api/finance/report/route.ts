import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export interface SessionTypeRevenue {
  sessionTypeId: string | null;
  sessionTypeName: string;
  totalCents: number;
  count: number;
  avgTicketCents: number;
}

export interface TopPatient {
  patientId: string;
  patientName: string;
  totalCents: number;
  paymentCount: number;
}

export interface PaymentRow {
  id: string;
  patientName: string;
  amountCents: number;
  method: string;
  sessionTypeName: string;
  paidAt: string;
  notes: string;
}

export interface MonthlyTrendPoint {
  month: string; // e.g. "Jan", "Fev", ...
  totalCents: number;
}

export interface FinanceReportData {
  period: { from: string; to: string; label: string };
  totalRevenueCents: number;
  paymentCount: number;
  avgTicketCents: number;
  bySessionType: SessionTypeRevenue[];
  topPatients: TopPatient[];
  payments: PaymentRow[];
  monthlyTrend: MonthlyTrendPoint[];
}

// ── GET /api/finance/report?period=this_month|last_month|last_3m|last_6m|this_year
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Financeiro restrito a dono/admin — também no endpoint, não só na UI.
  const { isFinanceApiAllowed } = await import("@/lib/require-finance-access");
  if (!(await isFinanceApiAllowed())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Sem clínica associada." }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? "this_month";
  const { from, to, label } = resolvePeriod(period);

  const admin = createSupabaseAdminClient();

  // Fetch all paid payments in period with joins
  const { data: payments } = await admin
    .from("patient_payments")
    .select(`
      id,
      amount_cents,
      payment_method,
      paid_at,
      notes,
      patients(id, full_name),
      appointments(
        session_types(id, name)
      )
    `)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "paid")
    .gte("paid_at", from)
    .lte("paid_at", to)
    .order("paid_at", { ascending: false })
    .limit(2000);

  const rows = payments ?? [];
  const totalRevenueCents = rows.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const paymentCount = rows.length;
  const avgTicketCents = paymentCount > 0 ? Math.round(totalRevenueCents / paymentCount) : 0;

  // Revenue by session type
  const typeMap = new Map<string, SessionTypeRevenue>();
  for (const p of rows) {
    const appt = (p.appointments as unknown) as { session_types: { id: string; name: string } | null } | null;
    const st = appt?.session_types;
    const key = st?.id ?? "none";
    const name = st?.name ?? "Sessão avulsa";

    if (!typeMap.has(key)) {
      typeMap.set(key, { sessionTypeId: st?.id ?? null, sessionTypeName: name, totalCents: 0, count: 0, avgTicketCents: 0 });
    }
    const entry = typeMap.get(key)!;
    entry.totalCents += p.amount_cents ?? 0;
    entry.count += 1;
  }
  const bySessionType = [...typeMap.values()]
    .map((e) => ({ ...e, avgTicketCents: e.count > 0 ? Math.round(e.totalCents / e.count) : 0 }))
    .sort((a, b) => b.totalCents - a.totalCents);

  // Top patients
  const patientMap = new Map<string, TopPatient>();
  for (const p of rows) {
    const patient = (p.patients as unknown) as { id: string; full_name: string } | null;
    const pid = patient?.id ?? "unknown";
    if (!patientMap.has(pid)) {
      patientMap.set(pid, { patientId: pid, patientName: patient?.full_name ?? "—", totalCents: 0, paymentCount: 0 });
    }
    const entry = patientMap.get(pid)!;
    entry.totalCents += p.amount_cents ?? 0;
    entry.paymentCount += 1;
  }
  const topPatients = [...patientMap.values()]
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  // Monthly trend — group payments by year-month, sorted chronologically
  const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthMap = new Map<string, number>(); // key: "YYYY-MM"
  for (const p of rows) {
    const d = new Date(p.paid_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + (p.amount_cents ?? 0));
  }
  const monthlyTrend: MonthlyTrendPoint[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totalCents]) => {
      const [, mm] = key.split("-");
      return { month: MONTH_LABELS_PT[parseInt(mm, 10) - 1], totalCents };
    });

  // Payment rows for table/export
  const PAYMENT_LABELS: Record<string, string> = {
    cash: "Dinheiro", pix: "Pix", credit_card: "Cartão crédito",
    debit_card: "Cartão débito", transfer: "Transferência", insurance: "Convênio", other: "Outro",
  };
  const paymentRows: PaymentRow[] = rows.map((p) => {
    const patient = (p.patients as unknown) as { id: string; full_name: string } | null;
    const appt = (p.appointments as unknown) as { session_types: { id: string; name: string } | null } | null;
    return {
      id: p.id as string,
      patientName: patient?.full_name ?? "—",
      amountCents: p.amount_cents ?? 0,
      method: PAYMENT_LABELS[(p.payment_method as string) ?? ""] ?? p.payment_method ?? "—",
      sessionTypeName: appt?.session_types?.name ?? "—",
      paidAt: p.paid_at as string,
      notes: (p.notes as string) ?? "",
    };
  });

  const data: FinanceReportData = {
    period: { from, to, label },
    totalRevenueCents,
    paymentCount,
    avgTicketCents,
    bySessionType,
    topPatients,
    payments: paymentRows,
    monthlyTrend,
  };

  return NextResponse.json(data);
}

// ── Period helpers ────────────────────────────────────────────────────────────
function resolvePeriod(period: string): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return {
        from: new Date(ly, lm, 1).toISOString(),
        to: new Date(ly, lm + 1, 0, 23, 59, 59).toISOString(),
        label: new Date(ly, lm, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      };
    }
    case "last_3m":
      return {
        from: new Date(y, m - 2, 1).toISOString(),
        to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        label: "Últimos 3 meses",
      };
    case "last_6m":
      return {
        from: new Date(y, m - 5, 1).toISOString(),
        to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        label: "Últimos 6 meses",
      };
    case "this_year":
      return {
        from: new Date(y, 0, 1).toISOString(),
        to: new Date(y, 11, 31, 23, 59, 59).toISOString(),
        label: `Ano ${y}`,
      };
    default: // this_month
      return {
        from: new Date(y, m, 1).toISOString(),
        to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      };
  }
}
