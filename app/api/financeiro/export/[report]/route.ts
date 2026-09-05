import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentClinic } from "@/services/clinic-service";
import { isFinanceApiAllowed } from "@/lib/require-finance-access";
import { resolveClinicLocale } from "@/lib/email-i18n";
import { getClinicCurrency } from "@/services/finance-service";
import { formatMoney } from "@/lib/finance-utils";
import { buildTablePdf, pdfResponse } from "@/lib/pdf-report";
import { toCsv, csvResponse } from "@/lib/csv-export";
import { getExecutiveSummary, getCashFlow, getReceivables } from "@/services/fin-ledger-service";
import { getPayablesSummary, listPayables } from "@/services/fin-payables-service";
import { getMarginDashboard } from "@/services/fin-margin-service";
import { getRecurringDashboard } from "@/services/fin-saas-service";
import { getMonthlyClose } from "@/services/fin-monthly-close-service";

export const runtime = "nodejs";

type ReportData = { title: string; headers: string[]; rows: (string | number | null)[][]; summary?: string };

const REPORTS = ["executivo", "fluxo-caixa", "receber", "pagar", "margem", "recorrencia", "fechamento"] as const;
type ReportKey = (typeof REPORTS)[number];

export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!REPORTS.includes(report as ReportKey)) {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
  if (!(await isFinanceApiAllowed())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clinic = await getCurrentClinic();
  if (!clinic) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "pdf";

  const [locale, currency, t] = await Promise.all([
    resolveClinicLocale(clinic.id),
    getClinicCurrency(clinic.id),
    getTranslations("finance.export"),
  ]);
  const money = (c: number) => formatMoney(c, currency, locale);
  const date = (iso: string) => new Date(iso.length <= 10 ? iso + "T12:00:00" : iso).toLocaleDateString(locale);

  const data = await buildReport(report as ReportKey, clinic.id, { t, money, date });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `financeiro_${report}_${stamp}.${format}`;

  if (format === "csv") {
    return csvResponse(toCsv(data.headers, data.rows), filename);
  }
  const buffer = await buildTablePdf({
    title: data.title,
    clinicName: clinic.name ?? "Clínica",
    headers: data.headers,
    rows: data.rows,
    summary: data.summary,
    locale,
  });
  return pdfResponse(buffer, filename);
}

type Ctx = {
  t: Awaited<ReturnType<typeof getTranslations>>;
  money: (c: number) => string;
  date: (iso: string) => string;
};

async function buildReport(report: ReportKey, clinicId: string, ctx: Ctx): Promise<ReportData> {
  const { t, money, date } = ctx;
  switch (report) {
    case "executivo": {
      const s = await getExecutiveSummary(clinicId);
      return {
        title: t("executivo"),
        headers: [t("indicator"), t("value")],
        rows: [
          [t("revenue"), money(s.revenueCents)],
          [t("expense"), money(s.expenseCents)],
          [t("net"), money(s.netCents)],
          [t("receivable"), money(s.receivableCents)],
        ],
        summary: `${t("net")}: ${money(s.netCents)}`,
      };
    }
    case "fluxo-caixa": {
      const c = await getCashFlow(clinicId);
      return {
        title: t("fluxoCaixa"),
        headers: [t("month"), t("inflow"), t("outflow"), t("result")],
        rows: c.months.map((m) => [m.month, money(m.inCents), money(m.outCents), money(m.netCents)]),
        summary: `${t("result")}: ${money(c.totalNet)} (${money(c.totalIn)} − ${money(c.totalOut)})`,
      };
    }
    case "receber": {
      const r = await getReceivables(clinicId);
      return {
        title: t("receber"),
        headers: [t("patient"), t("service"), t("date"), t("daysOverdue"), t("value")],
        rows: r.sessions.map((s) => [
          s.patient_name ?? "—",
          s.session_type_name ?? "—",
          date(s.starts_at),
          s.daysOverdue,
          money(s.price_cents ?? 0),
        ]),
        summary: `${t("total")}: ${money(r.totalCents)}`,
      };
    }
    case "pagar": {
      const [summary, open] = await Promise.all([
        getPayablesSummary(clinicId),
        listPayables(clinicId, { status: "open", limit: 500 }),
      ]);
      return {
        title: t("pagar"),
        headers: [t("description"), t("supplier"), t("dueDate"), t("category"), t("value")],
        rows: open.map((p) => [
          p.description,
          p.supplier_name ?? "—",
          date(p.due_date),
          p.category ?? "—",
          money(p.amount_cents),
        ]),
        summary: `${t("open")}: ${money(summary.openCents)} · ${t("overdue")}: ${money(summary.overdueCents)}`,
      };
    }
    case "margem": {
      const m = await getMarginDashboard(clinicId);
      return {
        title: t("margem"),
        headers: [t("professional"), t("sessions"), t("gross"), t("repasse"), t("margin"), t("marginPct")],
        rows: m.professionals.map((p) => [
          p.name,
          p.sessions,
          money(p.grossCents),
          money(p.repasseCents),
          money(p.marginCents),
          `${p.marginPct}%`,
        ]),
        summary: `${t("margin")}: ${money(m.totalMarginCents)}`,
      };
    }
    case "recorrencia": {
      const r = await getRecurringDashboard(clinicId);
      return {
        title: t("recorrencia"),
        headers: [t("plan"), t("subscribers"), t("mrr")],
        rows: r.saas.byPlan.map((p) => [p.plan, p.subscribers, money(p.mrrCents)]),
        summary: `MRR: ${money(r.saas.mrrCents)} · ARR: ${money(r.saas.arrCents)}`,
      };
    }
    case "fechamento": {
      const c = await getMonthlyClose(clinicId);
      const monthLabel = new Date(c.year, c.month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      return {
        title: `${t("fechamento")} — ${monthLabel}`,
        headers: [t("indicator"), t("value")],
        rows: [
          [t("revenue"), money(c.revenueCents)],
          [t("expense"), money(c.expenseCents)],
          [t("net"), money(c.netCents)],
          [t("openPayable"), money(c.openPayableCents)],
          ["MRR", money(c.mrrCents)],
        ],
        summary: `${t("net")}: ${money(c.netCents)}`,
      };
    }
  }
}
