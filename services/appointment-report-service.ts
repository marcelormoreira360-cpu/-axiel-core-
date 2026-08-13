import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Relatório de ciclo de status do agendamento (Fase 1). Fonte: appointments no
// período (por starts_at) + session_types(price_cents) para a receita perdida.
// Escopo por clínica (RLS) e filtro opcional por profissional.

export type StatusReportRow = {
  practitioner_id: string | null;
  name: string;
  completed: number;
  checked_in: number;
  sessions_done: number; // completed + checked_in (proxy de ocupação da Fase 1)
  no_show: number;
  late_cancel: number;
  cancelled_notice: number;
  lost_revenue_cents: number;
};

export type StatusReport = {
  period: { from: string | null; to: string | null };
  currency: string;
  totals: {
    total: number;      // todos os agendamentos não excluídos no período
    considered: number; // exclui 'pending' (não deveria ocorrer ainda)
    completed: number;
    checked_in: number;
    confirmed: number;
    scheduled: number;
    pending: number;
    no_show: number;
    cancelled_notice: number;
    late_cancel: number;
    cancelled_legacy: number;
  };
  rates: {
    no_show_rate: number;      // no_show / considered
    cancellation_rate: number; // (cancelled_notice + late_cancel) / considered
    notice_rate: number;
    late_rate: number;
  };
  lost_revenue_cents: number;   // no_show + late_cancel (valor esperado)
  lost_revenue_unpriced: number; // qtde sem preço por sessão (a apurar)
  by_practitioner: StatusReportRow[];
};

type ApptRow = {
  status: string | null;
  practitioner_id: string | null;
  created_by: string | null;
  session_types: { price_cents?: number | null } | { price_cents?: number | null }[] | null;
};

function priceOf(st: ApptRow["session_types"]): number | null {
  const s = Array.isArray(st) ? st[0] : st;
  const cents = s?.price_cents;
  return typeof cents === "number" && cents > 0 ? cents : null;
}

async function resolveCurrency(clinicId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("clinic_settings")
    .select("default_currency, settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const fromCol = (data?.default_currency as string | null) ?? null;
  const fromJson = ((data?.settings as Record<string, unknown> | null)?.default_currency as string | undefined) ?? null;
  return fromCol ?? fromJson ?? "BRL";
}

export async function getAppointmentStatusReport(opts: {
  clinicId: string;
  from?: string | null;
  to?: string | null;
  practitionerId?: string | null;
}): Promise<StatusReport> {
  const { clinicId } = opts;
  const from = opts.from ?? null;
  const to = opts.to ?? null;

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("appointments")
    .select("status, practitioner_id, created_by, session_types(price_cents)")
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(20000);

  if (from) q = q.gte("starts_at", from);
  if (to) q = q.lte("starts_at", to);
  if (opts.practitionerId) q = q.eq("practitioner_id", opts.practitionerId);

  const { data } = await q;
  const rows = (data ?? []) as ApptRow[];

  const totals = {
    total: 0, considered: 0, completed: 0, checked_in: 0, confirmed: 0,
    scheduled: 0, pending: 0, no_show: 0, cancelled_notice: 0, late_cancel: 0, cancelled_legacy: 0,
  };
  let lostRevenueCents = 0;
  let lostRevenueUnpriced = 0;

  // Agrega por profissional (practitioner_id, fallback created_by).
  const byPract = new Map<string | null, StatusReportRow>();
  const ensure = (id: string | null): StatusReportRow => {
    if (!byPract.has(id)) {
      byPract.set(id, {
        practitioner_id: id, name: "", completed: 0, checked_in: 0, sessions_done: 0,
        no_show: 0, late_cancel: 0, cancelled_notice: 0, lost_revenue_cents: 0,
      });
    }
    return byPract.get(id)!;
  };

  for (const r of rows) {
    const s = (r.status ?? "scheduled") as string;
    totals.total += 1;
    if (s !== "pending") totals.considered += 1;

    const pid = r.practitioner_id ?? r.created_by ?? null;
    const bucket = ensure(pid);
    const price = priceOf(r.session_types);

    switch (s) {
      case "completed": totals.completed += 1; bucket.completed += 1; bucket.sessions_done += 1; break;
      case "checked_in": totals.checked_in += 1; bucket.checked_in += 1; bucket.sessions_done += 1; break;
      case "confirmed": totals.confirmed += 1; break;
      case "scheduled": totals.scheduled += 1; break;
      case "pending": totals.pending += 1; break;
      case "no_show":
        totals.no_show += 1; bucket.no_show += 1;
        if (price != null) { lostRevenueCents += price; bucket.lost_revenue_cents += price; } else lostRevenueUnpriced += 1;
        break;
      case "late_cancel":
        totals.late_cancel += 1; bucket.late_cancel += 1;
        if (price != null) { lostRevenueCents += price; bucket.lost_revenue_cents += price; } else lostRevenueUnpriced += 1;
        break;
      case "cancelled_notice": totals.cancelled_notice += 1; bucket.cancelled_notice += 1; break;
      case "cancelled": totals.cancelled_legacy += 1; break;
      default: break;
    }
  }

  // Nomes dos profissionais (uma consulta).
  const ids = [...byPract.keys()].filter((x): x is string => !!x);
  if (ids.length > 0) {
    const { data: users } = await supabase.from("users").select("id, full_name").in("id", ids);
    const nameById = new Map((users ?? []).map((u: { id: string; full_name: string | null }) => [u.id, u.full_name ?? ""]));
    for (const [id, row] of byPract) {
      if (id) row.name = nameById.get(id) ?? "Profissional";
      else row.name = "Sem profissional";
    }
  } else {
    for (const [, row] of byPract) row.name = "Sem profissional";
  }

  const considered = totals.considered || 1; // evita divisão por zero
  const currency = await resolveCurrency(clinicId);

  return {
    period: { from, to },
    currency,
    totals,
    rates: {
      no_show_rate: totals.no_show / considered,
      cancellation_rate: (totals.cancelled_notice + totals.late_cancel) / considered,
      notice_rate: totals.cancelled_notice / considered,
      late_rate: totals.late_cancel / considered,
    },
    lost_revenue_cents: lostRevenueCents,
    lost_revenue_unpriced: lostRevenueUnpriced,
    by_practitioner: [...byPract.values()].sort((a, b) => b.sessions_done - a.sessions_done),
  };
}
