"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { decidirCobrar, decidirDispensar, type FeeMode } from "@/services/fee-decision-service";

// Gate financeiro: só dono/gestor/admin decide taxa. Retorna erro legível
// (server actions mascaram exceções em produção).
async function requireFinanceOrError(): Promise<
  { ok: true; clinicId: string; userId: string | null } | { ok: false; error: string }
> {
  const profile = await getCurrentUserProfile();
  if (!profile || !isManager(profile.role)) {
    return { ok: false, error: "Sem acesso ao módulo financeiro." };
  }
  const clinic = await getCurrentClinic();
  if (!clinic) return { ok: false, error: "Clínica não encontrada." };
  return { ok: true, clinicId: clinic.id, userId: profile.id ?? null };
}

export async function decidirCobrarAction(input: {
  decisionId: string;
  amount: string; // valor em unidade monetária (ex.: "75,00")
  notes?: string | null;
}): Promise<{ error?: string }> {
  const gate = await requireFinanceOrError();
  if (!gate.ok) return { error: gate.error };

  const amountCents = Math.round(parseFloat(String(input.amount).replace(",", ".")) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return { error: "Valor inválido." };
  }

  const res = await decidirCobrar({
    decisionId: input.decisionId,
    clinicId: gate.clinicId,
    amountCents,
    decidedByUser: gate.userId,
    notes: input.notes ?? null,
  });
  if (!res.ok) return { error: res.error };

  revalidatePath("/financeiro/taxas");
  revalidatePath("/financeiro");
  return {};
}

// ── Política de taxa da clínica (config das colunas de public.clinics) ─────────
// A decisão humana sempre pode sobrescrever; isto só ajusta o valor SUGERIDO.

const MODES: FeeMode[] = ["percent", "fixed", "none"];

function toMode(v: FormDataEntryValue | null): FeeMode {
  const s = String(v ?? "");
  return (MODES.includes(s as FeeMode) ? s : "percent") as FeeMode;
}

function toInt(v: FormDataEntryValue | null, fallback: number): number {
  const n = Math.round(Number(String(v ?? "").replace(",", ".")));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function saveFeePolicyAction(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const gate = await requireFinanceOrError();
  if (!gate.ok) return { error: gate.error };

  const patch = {
    no_show_fee_mode: toMode(formData.get("no_show_fee_mode")),
    no_show_fee_percent: toInt(formData.get("no_show_fee_percent"), 50),
    no_show_fee_min_cents: toInt(formData.get("no_show_fee_min"), 0) * 100,
    no_show_fee_max_cents: toInt(formData.get("no_show_fee_max"), 0) * 100,
    late_cancel_fee_mode: toMode(formData.get("late_cancel_fee_mode")),
    late_cancel_fee_percent: toInt(formData.get("late_cancel_fee_percent"), 25),
    late_cancel_fee_min_cents: toInt(formData.get("late_cancel_fee_min"), 0) * 100,
    late_cancel_fee_max_cents: toInt(formData.get("late_cancel_fee_max"), 0) * 100,
    first_miss_courtesy: formData.get("first_miss_courtesy") === "on",
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("clinics").update(patch).eq("id", gate.clinicId);
  if (error) return { error: "Não foi possível salvar a política." };

  revalidatePath("/financeiro/taxas");
  revalidatePath("/financeiro/taxas/config");
  return { ok: true };
}

export async function decidirDispensarAction(input: {
  decisionId: string;
  notes?: string | null;
}): Promise<{ error?: string }> {
  const gate = await requireFinanceOrError();
  if (!gate.ok) return { error: gate.error };

  const res = await decidirDispensar({
    decisionId: input.decisionId,
    clinicId: gate.clinicId,
    decidedByUser: gate.userId,
    notes: input.notes ?? null,
  });
  if (!res.ok) return { error: res.error };

  revalidatePath("/financeiro/taxas");
  return {};
}
