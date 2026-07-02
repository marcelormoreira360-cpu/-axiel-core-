import { getCurrentUserProfile } from "@/services/user-service";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";

export const runtime = "nodejs";

function escCsv(val: string | number | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(await (await import("@/lib/require-finance-access")).isFinanceApiAllowed())) {
    return new Response("Forbidden", { status: 403 });
  }

  const clinicId = profile.clinic_id;
  const locale = await resolveClinicLocale(clinicId);
  const t = await getServerT(locale, "pdf");

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // Fetch patients with appointment aggregates in a single query
  const { data: patients, error } = await supabase
    .from("patients")
    .select(
      `id, full_name, email, phone, date_of_birth, city, state, created_at,
       appointments(id, starts_at)`
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response("Internal Server Error", { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const csvHeaders = [
    t("col.name"),
    t("col.email"),
    t("col.phone"),
    t("col.dob"),
    t("col.city"),
    t("col.state"),
    t("col.totalSessions"),
    t("col.lastSession"),
    t("col.registered"),
  ];

  type AppointmentRow = { id: string; starts_at: string };

  const rows = (patients ?? []).map((p) => {
    const appts: AppointmentRow[] = Array.isArray(p.appointments)
      ? (p.appointments as AppointmentRow[])
      : p.appointments
        ? [p.appointments as AppointmentRow]
        : [];

    const totalSessions = appts.length;

    const lastSession =
      appts.length > 0
        ? new Date(
            Math.max(...appts.map((a) => new Date(a.starts_at).getTime()))
          ).toLocaleDateString(locale)
        : "";

    return [
      p.full_name,
      p.email ?? "",
      p.phone ?? "",
      p.date_of_birth
        ? new Date(p.date_of_birth).toLocaleDateString(locale)
        : "",
      p.city ?? "",
      p.state ?? "",
      totalSessions,
      lastSession,
      new Date(p.created_at).toLocaleDateString(locale),
    ];
  });

  const csv = [
    "﻿" + csvHeaders.map(escCsv).join(","),
    ...rows.map((r) => r.map(escCsv).join(",")),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pacientes_${today}.csv"`,
    },
  });
}
