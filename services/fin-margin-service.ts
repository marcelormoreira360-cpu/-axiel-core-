import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicCurrency } from "@/services/finance-service";

// Módulo Financeiro (ERP) — Fase 4. Margem & Precificação (read-only).
// Ancora a margem por DRIVER, cada um da sua própria fonte (evita double-count):
//   • Serviços → repasse_ledger (bruto − repasse = margem de trabalho).
//   • Produtos → product_order_items pagos no mês × products.cost_cents.
// A Clínica (#2 do brief) já vive em /analytics; Programas (#3) fica p/ fase futura
// (margem real de programa exige custear o consumo de sessão, ainda não modelado).

export type ProfessionalMargin = {
  userId: string;
  name: string;
  sessions: number;
  grossCents: number;
  repasseCents: number;
  marginCents: number;
  marginPct: number; // 0–100
};

export type ProductMargin = {
  productId: string | null;
  name: string;
  units: number;
  revenueCents: number;
  costCents: number;
  marginCents: number;
  marginPct: number;   // 0–100
  costKnown: boolean;  // false quando o produto não tem cost_cents cadastrado
};

export type MarginTotals = {
  servicesGrossCents: number;
  servicesRepasseCents: number;
  servicesMarginCents: number;
  servicesMarginPct: number;
  productsRevenueCents: number;
  productsCostCents: number;
  productsMarginCents: number;
  productsMarginPct: number;
  totalMarginCents: number;
};

export type MarginDashboard = MarginTotals & {
  currency: string;
  periodMonth: string; // 'YYYY-MM'
  professionals: ProfessionalMargin[];
  products: ProductMargin[];
};

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10; // 1 casa decimal
}

/** Matemática pura dos totais de margem (testável sem banco). */
export function computeMarginTotals(
  professionals: { grossCents: number; repasseCents: number }[],
  products: { revenueCents: number; costCents: number }[],
): MarginTotals {
  const servicesGrossCents = professionals.reduce((s, p) => s + p.grossCents, 0);
  const servicesRepasseCents = professionals.reduce((s, p) => s + p.repasseCents, 0);
  const servicesMarginCents = servicesGrossCents - servicesRepasseCents;
  const productsRevenueCents = products.reduce((s, p) => s + p.revenueCents, 0);
  const productsCostCents = products.reduce((s, p) => s + p.costCents, 0);
  const productsMarginCents = productsRevenueCents - productsCostCents;
  return {
    servicesGrossCents,
    servicesRepasseCents,
    servicesMarginCents,
    servicesMarginPct: pct(servicesMarginCents, servicesGrossCents),
    productsRevenueCents,
    productsCostCents,
    productsMarginCents,
    productsMarginPct: pct(productsMarginCents, productsRevenueCents),
    totalMarginCents: servicesMarginCents + productsMarginCents,
  };
}

function currentPeriodMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getMarginDashboard(clinicId: string): Promise<MarginDashboard> {
  const periodMonth = currentPeriodMonth();
  const monthStart = `${periodMonth}-01T00:00:00`;

  const [currency, professionals, products] = await Promise.all([
    getClinicCurrency(clinicId),
    getProfessionalMargins(clinicId, periodMonth),
    getProductMargins(clinicId, monthStart),
  ]);

  const totals = computeMarginTotals(
    professionals.map((p) => ({ grossCents: p.grossCents, repasseCents: p.repasseCents })),
    products.map((p) => ({ revenueCents: p.revenueCents, costCents: p.costCents })),
  );

  return { currency, periodMonth, professionals, products, ...totals };
}

// ── Serviços: margem por profissional (repasse_ledger do mês) ───────────────
async function getProfessionalMargins(clinicId: string, periodMonth: string): Promise<ProfessionalMargin[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("repasse_ledger")
    .select("user_id, sessions_count, gross_revenue_cents, repasse_cents")
    .eq("clinic_id", clinicId)
    .eq("period_month", periodMonth);
  if (error) throw error;
  const rows = (data ?? []) as {
    user_id: string;
    sessions_count: number;
    gross_revenue_cents: number;
    repasse_cents: number;
  }[];
  if (rows.length === 0) return [];

  const names = await namesFor(clinicId, rows.map((r) => r.user_id));
  return rows
    .map((r) => {
      const gross = r.gross_revenue_cents ?? 0;
      const repasse = r.repasse_cents ?? 0;
      const margin = gross - repasse;
      return {
        userId: r.user_id,
        name: names.get(r.user_id) ?? "—",
        sessions: r.sessions_count ?? 0,
        grossCents: gross,
        repasseCents: repasse,
        marginCents: margin,
        marginPct: pct(margin, gross),
      };
    })
    .sort((a, b) => b.marginCents - a.marginCents);
}

async function namesFor(clinicId: string, userIds: string[]): Promise<Map<string, string>> {
  const supabase = createSupabaseAdminClient();
  const uniq = [...new Set(userIds)];
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .in("id", uniq);
  return new Map((data ?? []).map((u) => [u.id as string, (u.full_name as string) || "—"]));
}

// ── Produtos: margem por produto (itens pagos no mês × custo) ────────────────
async function getProductMargins(clinicId: string, monthStart: string): Promise<ProductMargin[]> {
  const supabase = createSupabaseAdminClient();

  // Pedidos pagos criados no mês corrente.
  const { data: orders, error: ordErr } = await supabase
    .from("product_orders")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("payment_status", "paid")
    .gte("created_at", monthStart);
  if (ordErr) throw ordErr;
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) return [];

  const { data: items, error: itErr } = await supabase
    .from("product_order_items")
    .select("product_id, name, quantity, line_total_cents")
    .eq("clinic_id", clinicId)
    .in("order_id", orderIds);
  if (itErr) throw itErr;
  const rows = (items ?? []) as {
    product_id: string | null;
    name: string;
    quantity: number;
    line_total_cents: number;
  }[];
  if (rows.length === 0) return [];

  // Custo unitário atual dos produtos citados.
  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean) as string[])];
  const costMap = new Map<string, number | null>();
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, cost_cents")
      .eq("clinic_id", clinicId)
      .in("id", productIds);
    for (const p of prods ?? []) costMap.set(p.id as string, (p.cost_cents as number | null) ?? null);
  }

  // Agrega por produto.
  const agg = new Map<string, ProductMargin>();
  for (const r of rows) {
    const key = r.product_id ?? `name:${r.name}`;
    const rawCost = r.product_id ? costMap.get(r.product_id) : null;
    const costKnown = rawCost != null;
    const unitCost = rawCost ?? 0;
    const cur = agg.get(key) ?? {
      productId: r.product_id,
      name: r.name,
      units: 0,
      revenueCents: 0,
      costCents: 0,
      marginCents: 0,
      marginPct: 0,
      costKnown,
    };
    cur.units += r.quantity ?? 0;
    cur.revenueCents += r.line_total_cents ?? 0;
    cur.costCents += unitCost * (r.quantity ?? 0);
    cur.costKnown = cur.costKnown && costKnown;
    agg.set(key, cur);
  }

  return [...agg.values()]
    .map((p) => ({
      ...p,
      marginCents: p.revenueCents - p.costCents,
      marginPct: pct(p.revenueCents - p.costCents, p.revenueCents),
    }))
    .sort((a, b) => b.marginCents - a.marginCents);
}
