import { render } from "@react-email/render";
import { Resend } from "resend";
import { getClinicCurrency } from "@/services/finance-service";
import { getMonthlyClose } from "@/services/fin-monthly-close-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";
import { MonthlyReportEmail } from "@/components/email/monthly-report-email";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import { createLogger } from "@/lib/logger";

const log = createLogger("monthly-report");

export async function sendMonthlyReports(): Promise<{ sent: number; failed: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = DEFAULT_FROM_EMAIL;
  const appUrl = APP_URL;

  const now = new Date();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startISO = firstOfLastMonth.toISOString();
  const endISO = firstOfThisMonth.toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: clinics, error: clinicsError } = await supabase.from("clinics").select("id, name");
  if (clinicsError) throw clinicsError;

  async function processClinic(clinic: { id: string; name: string }): Promise<"sent" | "skipped"> {
    // Find clinic owner
    const { data: owners } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinic.id)
      .in("role", ["clinic_owner", "admin", "platform_admin"])
      .limit(1);

    if (!owners || owners.length === 0) return "skipped";

    // Dedup por clínica/mês: se o cron rodar 2x (retry, timeout no meio do
    // lote), o dono não recebe o relatório em dobro.
    const { data: alreadySent } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("use_case", "monthly_report")
      .gte("created_at", firstOfThisMonth.toISOString())
      .limit(1)
      .maybeSingle();
    if (alreadySent) return "skipped";

    // Destinatários: dono + quem tem papel financeiro de aprovação (CFO).
    const { data: cfos } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("finance_role", "cfo");
    const recipientIds = [...new Set([owners[0].id, ...(cfos ?? []).map((u) => u.id as string)])];
    const emails = await Promise.all(
      recipientIds.map(async (id) => (await supabase.auth.admin.getUserById(id)).data?.user?.email ?? null),
    );
    const recipients = [...new Set(emails.filter((e): e is string => !!e))];
    if (recipients.length === 0) return "skipped";

    const locale = await resolveClinicLocale(clinic.id);
    const __cur = await getClinicCurrency(clinic.id);
    const t = await getServerT(locale, "emails");
    const monthName = firstOfLastMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });

    // Compute metrics in parallel (fechamento financeiro + operação)
    const [close, sessionsRes, newPatientsRes, packagesRes, recentSessionsRes, totalActiveRes] = await Promise.all([
      getMonthlyClose(clinic.id),

      supabase.from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .gte("starts_at", startISO)
        .lt("starts_at", endISO),

      supabase.from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .gte("created_at", startISO)
        .lt("created_at", endISO),

      supabase.from("patient_packages")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("is_active", true),

      supabase.from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinic.id)
        .gte("starts_at", thirtyDaysAgo),

      supabase.from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("status", "active"),
    ]);

    const sessions = sessionsRes.count ?? 0;
    const newPatients = newPatientsRes.count ?? 0;
    const activePackages = packagesRes.count ?? 0;
    const recentPatientIds = new Set((recentSessionsRes.data ?? []).map((r) => r.patient_id));
    const totalActive = totalActiveRes.count ?? 0;
    const inactive = Math.max(0, totalActive - recentPatientIds.size);
    const fmt = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: __cur });
    const revenueStr = close.revenueCents > 0 ? fmt(close.revenueCents) : "—";
    const expenseStr = fmt(close.expenseCents);
    const netStr = fmt(close.netCents);

    const html = await render(
      MonthlyReportEmail({
        clinicName: clinic.name,
        monthName,
        appUrl,
        metrics: {
          revenue: revenueStr,
          expense: expenseStr,
          net: netStr,
          sessions,
          newPatients,
          activePackages,
          inactivePatients: inactive,
        },
        t,
        locale,
      })
    );

    await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject: t("monthly.subject", { month: monthName, clinic: clinic.name }),
      html,
    });

    await supabase.from("communication_logs").insert({
      clinic_id: clinic.id,
      channel: "email",
      use_case: "monthly_report",
      recipient: recipients.join(", "),
      body: t("monthly.subject", { month: monthName, clinic: clinic.name }),
      status: "sent",
      provider: "resend",
    });

    return "sent";
  }

  // Process all clinics in parallel — one failure won't block others
  const results = await Promise.allSettled((clinics ?? []).map((c) => processClinic(c)));

  let sent = 0, failed = 0, skipped = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      r.value === "sent" ? sent++ : skipped++;
    } else {
      log.error("clinic failed", r.reason);
      failed++;
    }
  }

  return { sent, failed, skipped };
}
