const MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SOURCE_PT: Record<string, string> = {
  direct:    "Direto",
  referral:  "Indicação",
  instagram: "Instagram",
  facebook:  "Facebook",
  google:    "Google",
  website:   "Site",
  package:   "Pacote",
  other:     "Outro",
};

const METHOD_PT: Record<string, string> = {
  pix:          "PIX",
  credit_card:  "Cartão crédito",
  debit_card:   "Cartão débito",
  cash:         "Dinheiro",
  transfer:     "Transferência",
  insurance:    "Convênio",
  other:        "Outro",
};

export type MonthlyPoint = {
  label:         string;   // "Jan"
  fullLabel:     string;   // "Jan 2026"
  monthKey:      string;   // "2026-01"
  revenue_cents: number;
  sessions:      number;
  new_patients:  number;
};

export type MethodBreakdown = {
  label:         string;
  amount_cents:  number;
  count:         number;
};

export type ServiceBreakdownItem = {
  name:          string;
  sessions:      number;
  revenue_cents: number;
};

export type SourceBreakdownItem = {
  source: string;
  count:  number;
};

export type ReportTimeSeries = {
  monthly:        MonthlyPoint[];
  paymentMethods: MethodBreakdown[];
  services:       ServiceBreakdownItem[];
  sources:        SourceBreakdownItem[];
};

export async function getReportTimeSeries(
  clinicId: string,
  months = 12,
): Promise<ReportTimeSeries> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  from.setHours(0, 0, 0, 0);
  const fromISO = from.toISOString();

  const [{ data: payments }, { data: appointments }, { data: patients }] = await Promise.all([
    supabase
      .from("patient_payments")
      .select("amount_cents, payment_method, paid_at")
      .eq("clinic_id", clinicId)
      .gte("paid_at", fromISO)
      .limit(5000),

    supabase
      .from("appointments")
      .select("id, starts_at, source, session_types(name, price_cents)")
      .eq("clinic_id", clinicId)
      .gte("starts_at", fromISO)
      .limit(5000),

    supabase
      .from("patients")
      .select("id, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", fromISO)
      .limit(5000),
  ]);

  // ── Build month buckets (always includes all months even if empty) ──
  const buckets = new Map<string, MonthlyPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      label:         MONTH_PT[d.getMonth()],
      fullLabel:     `${MONTH_PT[d.getMonth()]} ${d.getFullYear()}`,
      monthKey:      key,
      revenue_cents: 0,
      sessions:      0,
      new_patients:  0,
    });
  }

  function monthKey(isoDate: string) {
    const d = new Date(isoDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  for (const p of payments ?? []) {
    const b = buckets.get(monthKey(p.paid_at));
    if (b) b.revenue_cents += p.amount_cents ?? 0;
  }

  for (const a of appointments ?? []) {
    const b = buckets.get(monthKey(a.starts_at));
    if (b) b.sessions += 1;
  }

  for (const p of patients ?? []) {
    const b = buckets.get(monthKey(p.created_at));
    if (b) b.new_patients += 1;
  }

  // ── Payment method breakdown ──
  const methodMap = new Map<string, MethodBreakdown>();
  for (const p of payments ?? []) {
    const key = p.payment_method ?? "other";
    const label = METHOD_PT[key] ?? key;
    const existing = methodMap.get(key) ?? { label, amount_cents: 0, count: 0 };
    existing.amount_cents += p.amount_cents ?? 0;
    existing.count += 1;
    methodMap.set(key, existing);
  }
  const paymentMethods = [...methodMap.values()].sort((a, b) => b.amount_cents - a.amount_cents);

  // ── Service breakdown ──
  const serviceMap = new Map<string, ServiceBreakdownItem>();
  for (const a of appointments ?? []) {
    const raw = a.session_types;
    const st = (Array.isArray(raw) ? raw[0] : raw) as { name: string; price_cents: number } | null;
    const name = st?.name ?? "Sem tipo";
    const existing = serviceMap.get(name) ?? { name, sessions: 0, revenue_cents: 0 };
    existing.sessions += 1;
    existing.revenue_cents += st?.price_cents ?? 0;
    serviceMap.set(name, existing);
  }
  const services = [...serviceMap.values()]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);

  // ── Source breakdown ──
  const sourceMap = new Map<string, number>();
  for (const a of appointments ?? []) {
    const src = (a.source as string | null) ?? "other";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }
  const sources = [...sourceMap.entries()]
    .map(([k, v]) => ({ source: SOURCE_PT[k] ?? k, count: v }))
    .sort((a, b) => b.count - a.count);

  return {
    monthly: [...buckets.values()],
    paymentMethods,
    services,
    sources,
  };
}
