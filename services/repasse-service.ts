import { createSupabaseAdminClient } from "@/lib/supabase-admin";
// ── Types ─────────────────────────────────────────────────────────

export type RepasseRule = {
  id: string;
  clinic_id: string;
  user_id: string;
  professional_name: string | null;
  professional_email: string | null;
  percentage: number; // 0–100
  created_at: string;
  updated_at: string;
};

export type RepasseEntry = {
  id: string;
  clinic_id: string;
  user_id: string;
  professional_name: string | null;
  period_month: string;   // e.g. "2024-05"
  sessions_count: number;
  gross_revenue_cents: number;
  repasse_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

// ── Rules CRUD ────────────────────────────────────────────────────

export async function getRepasseRules(clinicId: string): Promise<RepasseRule[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("repasse_rules")
    .select("*, users(full_name, email)")
    .eq("clinic_id", clinicId)
    .order("created_at");
  if (error) throw error;

  return (data ?? []).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return {
      ...r,
      professional_name: (u as { full_name?: string } | null)?.full_name ?? null,
      professional_email: (u as { email?: string } | null)?.email ?? null,
    } as RepasseRule;
  });
}

export async function upsertRepasseRule(
  clinicId: string,
  userId: string,
  percentage: number,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("repasse_rules")
    .upsert(
      { clinic_id: clinicId, user_id: userId, percentage, updated_at: new Date().toISOString() },
      { onConflict: "clinic_id,user_id" },
    );
  if (error) throw error;
}

export async function deleteRepasseRule(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("repasse_rules").delete().eq("id", id);
  if (error) throw error;
}

// ── Ledger ────────────────────────────────────────────────────────

export async function getRepasseHistory(clinicId: string): Promise<RepasseEntry[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("repasse_ledger")
    .select("*, users(full_name)")
    .eq("clinic_id", clinicId)
    .order("period_month", { ascending: false })
    .limit(24);
  if (error) throw error;

  return (data ?? []).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    return {
      ...r,
      professional_name: (u as { full_name?: string } | null)?.full_name ?? null,
    } as RepasseEntry;
  });
}

export async function markRepasseAsPaid(
  ledgerId: string,
  notes?: string,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("repasse_ledger")
    .update({ status: "paid", paid_at: new Date().toISOString(), notes: notes ?? null })
    .eq("id", ledgerId);
  if (error) throw error;
}

// ── Calculate repasse for a given month ───────────────────────────

export async function calculateMonthRepasse(
  clinicId: string,
  periodMonth: string, // "2024-05"
): Promise<RepasseEntry[]> {
  const supabase = createSupabaseAdminClient();

  const [year, month] = periodMonth.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString();
  const to   = new Date(year, month, 0, 23, 59, 59).toISOString();

  // Get repasse rules for this clinic
  const { data: rules } = await supabase
    .from("repasse_rules")
    .select("user_id, percentage")
    .eq("clinic_id", clinicId);

  if (!rules?.length) return [];

  const entries: RepasseEntry[] = [];

  // PERF: fetch all payments once, then filter per rule in memory (avoids N+1)
  const { data: allPayments } = await supabase
    .from("patient_payments")
    .select("amount_cents, appointments(created_by)")
    .eq("clinic_id", clinicId)
    .gte("paid_at", from)
    .lte("paid_at", to)
    .limit(10000);

  for (const rule of rules) {
    const filtered = (allPayments ?? []).filter((p) => {
      const appt = Array.isArray(p.appointments) ? p.appointments[0] : p.appointments;
      return (appt as { created_by?: string } | null)?.created_by === rule.user_id;
    });

    const grossCents = filtered.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
    const repasseCents = Math.round(grossCents * rule.percentage / 100);

    // Upsert into ledger
    const { data: entry, error } = await supabase
      .from("repasse_ledger")
      .upsert({
        clinic_id: clinicId,
        user_id: rule.user_id,
        period_month: periodMonth,
        sessions_count: filtered.length,
        gross_revenue_cents: grossCents,
        repasse_cents: repasseCents,
        status: "pending",
      }, { onConflict: "clinic_id,user_id,period_month" })
      .select("*, users(full_name)")
      .single();

    if (!error && entry) {
      const u = Array.isArray(entry.users) ? entry.users[0] : entry.users;
      entries.push({
        ...entry,
        professional_name: (u as { full_name?: string } | null)?.full_name ?? null,
      } as RepasseEntry);
    }
  }

  return entries;
}

// ── Professionals (users in the same clinic) ──────────────────────

export type ClinicProfessional = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

export async function getClinicProfessionals(clinicId: string): Promise<ClinicProfessional[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .eq("clinic_id", clinicId)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as ClinicProfessional[];
}
