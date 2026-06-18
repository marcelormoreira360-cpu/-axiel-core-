"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createSupplementCatalogItem,
  updateSupplementCatalogItem,
  deleteSupplementCatalogItem,
  type SupplementSource,
  type SupplementCountry,
} from "@/services/supplement-service";

export type CatalogState = { ok?: boolean; error?: string } | null;

const SOURCES: SupplementSource[] = [
  "manipulacao_br",
  "dfh",
  "pure_encapsulations",
  "fullscript",
  "outro",
];
const COUNTRIES: SupplementCountry[] = ["BR", "US"];

function isManagerRole(role: string | null | undefined): boolean {
  return ["clinic_owner", "clinic_manager", "admin"].includes(role ?? "");
}

export async function createSupplementCatalogAction(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { error: "Não autorizado." };
  if (!isManagerRole(profile.role)) return { error: "Sem permissão." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome do suplemento." };

  const rawSource = String(formData.get("source") ?? "outro");
  const source: SupplementSource = SOURCES.includes(rawSource as SupplementSource)
    ? (rawSource as SupplementSource)
    : "outro";

  const rawCountry = String(formData.get("country") ?? "BR");
  const country: SupplementCountry = COUNTRIES.includes(rawCountry as SupplementCountry)
    ? (rawCountry as SupplementCountry)
    : "BR";

  const buyUrl = String(formData.get("buy_url") ?? "").trim() || null;
  // US precisa de link de compra; BR (manipulação) não usa.
  if (country === "US" && !buyUrl) {
    return { error: "Itens dos EUA precisam de um link de compra." };
  }

  try {
    await createSupplementCatalogItem({
      clinic_id:      profile.clinic_id,
      name,
      source,
      country,
      sku:            String(formData.get("sku") ?? "").trim() || null,
      buy_url:        country === "BR" ? null : buyUrl,
      default_dosage: String(formData.get("default_dosage") ?? "").trim() || null,
      form:           String(formData.get("form") ?? "").trim() || null,
      notes:          String(formData.get("notes") ?? "").trim() || null,
    });
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/settings/supplements");
  return { ok: true };
}

export async function toggleSupplementCatalogActiveAction(id: string, active: boolean) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManagerRole(profile.role)) throw new Error("Sem permissão.");
  await updateSupplementCatalogItem(id, { active });
  revalidatePath("/settings/supplements");
}

export async function deleteSupplementCatalogAction(id: string) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManagerRole(profile.role)) throw new Error("Sem permissão.");
  await deleteSupplementCatalogItem(id);
  revalidatePath("/settings/supplements");
}
