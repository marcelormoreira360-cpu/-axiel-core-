import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getClinicCurrency } from "@/services/finance-service";

// Módulo Financeiro (ERP) — Fase 6.6. Programas & Pacotes (read-only).
// patient_packages não tem preço nem custo; então em vez de "margem líquida"
// (que exigiria custo por sessão, ainda não modelado), medimos o que É honesto:
//   • Utilização: sessões entregues ÷ vendidas.
//   • Passivo de sessões: sessões vendidas ainda NÃO entregues (obrigação futura).
//   • Valor a entregar (estimado): passivo × preço/sessão do catálogo
//     (monetization_offers casado por nome). É receita já recebida a "pagar" em
//     serviço — não é margem.

export type ProgramRow = {
  name: string;
  packages: number;
  soldSessions: number;
  usedSessions: number;
  pendingSessions: number;
  utilizationPct: number;              // 0–100
  pendingValueCents: number | null;    // null quando não há preço de catálogo
};

export type ProgramTotals = {
  activePackages: number;
  soldSessions: number;
  usedSessions: number;
  pendingSessions: number;
  utilizationPct: number;
  pendingValueCents: number;           // soma do que tem preço conhecido
};

type PkgLite = { name: string; sessions_total: number; sessions_used: number };

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Agrega pacotes ativos por nome de programa (puro, testável). `pricePerSession`
 * mapeia nome (lower) → preço/sessão em cents; ausente = valor desconhecido.
 */
export function computeProgramTotals(
  packages: PkgLite[],
  pricePerSession: Map<string, number>,
): { rows: ProgramRow[]; totals: ProgramTotals } {
  const groups = new Map<string, ProgramRow>();
  for (const p of packages) {
    const sold = Math.max(0, p.sessions_total ?? 0);
    const used = Math.max(0, Math.min(p.sessions_used ?? 0, sold));
    const pending = sold - used;
    const cur = groups.get(p.name) ?? {
      name: p.name,
      packages: 0,
      soldSessions: 0,
      usedSessions: 0,
      pendingSessions: 0,
      utilizationPct: 0,
      pendingValueCents: null,
    };
    cur.packages += 1;
    cur.soldSessions += sold;
    cur.usedSessions += used;
    cur.pendingSessions += pending;
    groups.set(p.name, cur);
  }

  const rows: ProgramRow[] = [];
  const totals: ProgramTotals = {
    activePackages: 0,
    soldSessions: 0,
    usedSessions: 0,
    pendingSessions: 0,
    utilizationPct: 0,
    pendingValueCents: 0,
  };

  for (const g of groups.values()) {
    g.utilizationPct = pct(g.usedSessions, g.soldSessions);
    const price = pricePerSession.get(g.name.toLowerCase());
    if (price != null) {
      g.pendingValueCents = price * g.pendingSessions;
      totals.pendingValueCents += g.pendingValueCents;
    }
    rows.push(g);
    totals.activePackages += g.packages;
    totals.soldSessions += g.soldSessions;
    totals.usedSessions += g.usedSessions;
    totals.pendingSessions += g.pendingSessions;
  }
  totals.utilizationPct = pct(totals.usedSessions, totals.soldSessions);
  rows.sort((a, b) => b.pendingSessions - a.pendingSessions);
  return { rows, totals };
}

export type ProgramsDashboard = ProgramTotals & {
  currency: string;
  rows: ProgramRow[];
};

export async function getProgramsDashboard(clinicId: string): Promise<ProgramsDashboard> {
  const supabase = createSupabaseAdminClient();
  const [currency, pkgRes, offerRes] = await Promise.all([
    getClinicCurrency(clinicId),
    supabase
      .from("patient_packages")
      .select("name, sessions_total, sessions_used")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("monetization_offers")
      .select("name, price_cents, number_of_sessions")
      .eq("clinic_id", clinicId)
      .eq("offer_type", "session_package"),
  ]);

  const pricePerSession = new Map<string, number>();
  for (const o of (offerRes.data ?? []) as { name: string; price_cents: number; number_of_sessions: number }[]) {
    const n = o.number_of_sessions ?? 0;
    if (n > 0 && o.name) pricePerSession.set(o.name.toLowerCase(), Math.round((o.price_cents ?? 0) / n));
  }

  const { rows, totals } = computeProgramTotals((pkgRes.data ?? []) as PkgLite[], pricePerSession);
  return { currency, rows, ...totals };
}
