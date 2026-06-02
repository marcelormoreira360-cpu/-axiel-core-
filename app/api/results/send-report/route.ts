import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentAuthUser } from "@/services/user-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";
import { MonthlyReportEmail } from "@/components/email/monthly-report-email";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";

export async function POST() {
  try {
    const [clinic, authUser] = await Promise.all([getCurrentClinic(), getCurrentAuthUser()]);

    if (!clinic) {
      return NextResponse.json({ ok: false, error: "Clínica não encontrada." }, { status: 404 });
    }
    if (!authUser?.email) {
      return NextResponse.json({ ok: false, error: "Usuário não autenticado." }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // Use last month as the report period
    const now = new Date();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startISO = firstOfLastMonth.toISOString();
    const endISO = firstOfThisMonth.toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const locale = await resolveClinicLocale(clinic.id);
    const t = await getServerT(locale, "emails");
    const monthName = firstOfLastMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });

    const [sessionsRes, newPatientsRes, packagesRes, recentSessionsRes, totalActiveRes, paymentsRes] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("starts_at", startISO)
          .lt("starts_at", endISO),

        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("created_at", startISO)
          .lt("created_at", endISO),

        supabase
          .from("patient_packages")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .eq("is_active", true),

        supabase
          .from("appointments")
          .select("patient_id")
          .eq("clinic_id", clinic.id)
          .gte("starts_at", thirtyDaysAgo),

        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .eq("status", "active"),

        supabase
          .from("patient_payments")
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
    const revenueStr =
      revenueCents > 0
        ? (revenueCents / 100).toLocaleString(locale, { style: "currency", currency: "BRL" })
        : "—";

    const html = await render(
      MonthlyReportEmail({
        clinicName: clinic.name,
        monthName,
        appUrl: APP_URL,
        metrics: {
          revenue: revenueStr,
          sessions,
          newPatients,
          activePackages,
          inactivePatients: inactive,
        },
        t,
        locale,
      })
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: authUser.email,
      subject: t("monthly.subject", { month: monthName, clinic: clinic.name }),
      html,
    });

    return NextResponse.json({ ok: true, email: authUser.email });
  } catch (e) {
    console.error("[send-report] error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar relatório." },
      { status: 500 }
    );
  }
}
