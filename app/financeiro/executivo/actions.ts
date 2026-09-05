"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getClinicCurrency } from "@/services/finance-service";
import { createFinEntry, deleteFinEntry, type FinKind } from "@/services/fin-ledger-service";

export async function addFinEntryAction(formData: FormData) {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) return;
  const profile = await getCurrentUserProfile();

  const kind: FinKind = String(formData.get("kind") ?? "expense") === "revenue" ? "revenue" : "expense";
  const amount = parseFloat(String(formData.get("amount") ?? "0").replace(",", "."));
  if (!(amount > 0)) return; // valor inválido — o form já exige min; no-op em vez de derrubar a página

  const currency = await getClinicCurrency(clinic.id);
  await createFinEntry({
    clinicId: clinic.id,
    kind,
    amountCents: Math.round(amount * 100),
    currency,
    entryDate: String(formData.get("entry_date") ?? "") || new Date().toISOString().slice(0, 10),
    category: String(formData.get("category") ?? "") || null,
    method: String(formData.get("method") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    createdBy: profile?.id ?? null,
  });
  revalidatePath("/financeiro/executivo");
}

export async function deleteFinEntryAction(id: string) {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) return;
  const profile = await getCurrentUserProfile();
  await deleteFinEntry(id, clinic.id, profile?.id ?? null);
  revalidatePath("/financeiro/executivo");
}
