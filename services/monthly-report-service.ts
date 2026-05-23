import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function sendMonthlyReports(): Promise<{ sent: number; failed: number; skipped: number }> {
  const supabase = createSupabaseAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

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
    const [sessionsRes, newPatientsRes, packagesRes, recentSessionsRes, totalActiveRes] = await Promise.all([
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

    const rows: Array<[string, string, string?]> = [
      ["📅", `Sessões realizadas em ${monthName}`, sessions.toString()],
      ["👤", "Novos pacientes no mês", newPatients.toString()],
      ["📦", "Pacotes ativos", activePackages.toString()],
      ["💤", "Pacientes sem sessão há 30+ dias", inactive.toString()],
    ];

    const tableHtml = rows
      .map(([icon, label, value]) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0">${icon} ${label}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${value}</td>
        </tr>`)
      .join("");

    const inactiveAlert = inactive > 0
      ? `<p style="margin-top:20px;padding:14px 18px;background:#fffbeb;border-radius:12px;font-size:14px;color:#92400e">
          💡 Você tem <strong>${inactive} paciente(s)</strong> sem sessão há mais de 30 dias — uma boa oportunidade de reengajamento.
         </p>`
      : "";

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
        <p style="font-size:12px;font-weight:600;letter-spacing:0.15em;color:#888;text-transform:uppercase">AXIEL Core</p>
        <h1 style="font-size:24px;font-weight:600;margin:8px 0 4px">Relatório de ${monthName}</h1>
        <p style="color:#666;font-size:15px;margin-bottom:24px">${clinic.name}</p>

        <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8">
          <tbody>${tableHtml}</tbody>
        </table>

        ${inactiveAlert}

        <p style="margin-top:28px">
          <a href="${appUrl}/dashboard"
             style="display:inline-block;background:#0B1F3A;color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;text-decoration:none">
            Acessar dashboard →
          </a>
        </p>

        <p style="margin-top:32px;font-size:12px;color:#999">Este relatório é enviado automaticamente no início de cada mês.</p>
      </div>
    `.trim();

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
