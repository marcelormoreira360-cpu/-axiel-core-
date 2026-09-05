"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceEdit } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getClinicCurrency } from "@/services/finance-service";
import {
  createPayable,
  payPayable,
  deletePayable,
  createRecurring,
  setRecurringActive,
  deleteRecurring,
  generateRecurringForCurrentMonth,
  upsertSupplier,
  deleteSupplier,
} from "@/services/fin-payables-service";

const PATH = "/financeiro/pagar";

function parseAmount(v: FormDataEntryValue | null): number {
  return parseFloat(String(v ?? "0").replace(",", "."));
}

async function financeContext() {
  await requireFinanceEdit();
  const clinic = await getCurrentClinic();
  if (!clinic) return null;
  const [profile, currency] = await Promise.all([
    getCurrentUserProfile(),
    getClinicCurrency(clinic.id),
  ]);
  return { clinicId: clinic.id, userId: profile?.id ?? null, currency };
}

// Resolve fornecedor: id existente OU nome digitado (cria/reaproveita). Opcional.
async function resolveSupplier(clinicId: string, formData: FormData, userId: string | null): Promise<string | null> {
  const id = String(formData.get("supplier_id") ?? "").trim();
  if (id) return id;
  const name = String(formData.get("supplier_name") ?? "").trim();
  if (!name) return null;
  return upsertSupplier({ clinicId, name, createdBy: userId });
}

// ── Contas a pagar ──────────────────────────────────────────────────────────

export async function addPayableAction(formData: FormData) {
  const ctx = await financeContext();
  if (!ctx) return;
  const amount = parseAmount(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  if (!(amount > 0) || !description) return;

  const supplierId = await resolveSupplier(ctx.clinicId, formData, ctx.userId);
  await createPayable({
    clinicId: ctx.clinicId,
    description,
    amountCents: Math.round(amount * 100),
    currency: ctx.currency,
    dueDate: String(formData.get("due_date") ?? "") || new Date().toISOString().slice(0, 10),
    supplierId,
    category: String(formData.get("category") ?? "") || null,
    method: String(formData.get("method") ?? "") || null,
    createdBy: ctx.userId,
  });
  revalidatePath(PATH);
}

export async function payPayableAction(id: string, formData: FormData) {
  const ctx = await financeContext();
  if (!ctx) return;
  await payPayable(id, ctx.clinicId, {
    method: String(formData.get("method") ?? "") || null,
    byUser: ctx.userId,
  });
  revalidatePath(PATH);
  revalidatePath("/financeiro/executivo");
  revalidatePath("/financeiro/fluxo-caixa");
}

export async function deletePayableAction(id: string) {
  const ctx = await financeContext();
  if (!ctx) return;
  await deletePayable(id, ctx.clinicId, ctx.userId);
  revalidatePath(PATH);
}

// ── Recorrentes ─────────────────────────────────────────────────────────────

export async function addRecurringAction(formData: FormData) {
  const ctx = await financeContext();
  if (!ctx) return;
  const amount = parseAmount(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  if (!(amount > 0) || !description) return;

  const supplierId = await resolveSupplier(ctx.clinicId, formData, ctx.userId);
  await createRecurring({
    clinicId: ctx.clinicId,
    description,
    amountCents: Math.round(amount * 100),
    currency: ctx.currency,
    dayOfMonth: parseInt(String(formData.get("day_of_month") ?? "1"), 10) || 1,
    supplierId,
    category: String(formData.get("category") ?? "") || null,
    method: String(formData.get("method") ?? "") || null,
    createdBy: ctx.userId,
  });
  revalidatePath(PATH);
}

export async function toggleRecurringAction(id: string, active: boolean) {
  const ctx = await financeContext();
  if (!ctx) return;
  await setRecurringActive(id, ctx.clinicId, active);
  revalidatePath(PATH);
}

export async function deleteRecurringAction(id: string) {
  const ctx = await financeContext();
  if (!ctx) return;
  await deleteRecurring(id, ctx.clinicId);
  revalidatePath(PATH);
}

export async function generateRecurringAction() {
  const ctx = await financeContext();
  if (!ctx) return;
  await generateRecurringForCurrentMonth(ctx.clinicId, ctx.userId);
  revalidatePath(PATH);
}

// ── Fornecedores ────────────────────────────────────────────────────────────

export async function deleteSupplierAction(id: string) {
  const ctx = await financeContext();
  if (!ctx) return;
  await deleteSupplier(id, ctx.clinicId);
  revalidatePath(PATH);
}
