import { render } from "@react-email/render";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";
import { MonthlyReportEmail } from "@/components/email/monthly-report-email";

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
  const monthName = firstOfLastMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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

    const { data: authUser } = await supabase.auth.admin.getUserById(owners[0].id);
    const ownerEmail = authUser?.user?.email;
    if (!ownerEmail) return "skipped";

    // Compute metrics in parallel
    const [sessionsRes, newPatientsRes, packagesRes, recentSessionsRes, totalActiveRes, paymentsRes] = await Promise.all([
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

      supabase.from("patient_payments")
        .select("amount_cents")
        .eq("clinic_id", clinic.id)
        .gte("paid_at", startISO)
        .lt("paid_at", endISO),
    ]);

    const sessions = sessionsRes.count ?? 0;
    const newPatients = newPatientsRes.count ?? 0;
    const activePackages = packagesRes.count ?? 0;
    const recentPatientIds = new Set((recentSessionsRes.data ?? []).map((r) => r.patient_id));
    const totalActive = totalActiveRes.count ?? 0;
    const inactive = Math.max(0, totalActive - recentPatientIds.size);
    const revenueCents = (paymentsRes.data ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
    const revenueStr = revenueCents > 0
      ? (revenueCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";

    const html = await render(
      MonthlyReportEmail({
        clinicName: clinic.name,
        monthName,
        appUrl,
        metrics: {
          revenue: revenueStr,
          sessions,
          newPatients,
          activePackages,
          inactivePatients: inactive,
        },
      })
    );

    await resend.emails.send({
      from: fromAddress,
      to: ownerEmail,
      subject: `Relatório ${monthName} — ${clinic.name}`,
      html,
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
      console.error("[monthly-report] clinic failed:", r.reason);
      failed++;
    }
  }

  return { sent, failed, skipped };
}
