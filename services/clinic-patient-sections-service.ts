/**
 * clinic-patient-sections-service.ts — ordem/visibilidade das seções da ficha do
 * paciente, por clínica (migration 106). Espelha o padrão do clinic-assessment-service:
 * seed preguiçoso (clínicas novas), backfill de chaves novas (seções adicionadas no
 * código depois do seed) e reorder por troca de order_index. RLS por clinic_id.
 */
import type { ClinicPatientSection } from "@/lib/types";
import { PATIENT_SECTION_ORDER } from "@/lib/patient-sections";

// ── Seed/backfill preguiçoso (admin client, idempotente) ─────────────────────
export async function ensureClinicPatientSections(clinicId: string): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("clinic_patient_sections")
    .select("section_key, order_index")
    .eq("clinic_id", clinicId);

  const existing = new Set((data ?? []).map((r) => r.section_key as string));
  // Chaves canônicas que ainda não existem para esta clínica (clínica nova, ou seção
  // adicionada no código depois do seed). Acrescenta no fim, preservando a ordem salva.
  const maxOrder = (data ?? []).reduce((m, r) => Math.max(m, r.order_index as number), -1);
  const missing = PATIENT_SECTION_ORDER.filter((k) => !existing.has(k));
  if (missing.length === 0) return;

  const rows = missing.map((section_key, i) => ({
    clinic_id: clinicId,
    section_key,
    // clínica nova: usa a ordem canônica; backfill: anexa após o maior order_index.
    order_index: existing.size === 0 ? PATIENT_SECTION_ORDER.indexOf(section_key) : maxOrder + 1 + i,
  }));
  await admin
    .from("clinic_patient_sections")
    .upsert(rows, { onConflict: "clinic_id,section_key", ignoreDuplicates: true });
}

// ── Leitura ──────────────────────────────────────────────────────────────────
export async function getClinicPatientSections(clinicId: string): Promise<ClinicPatientSection[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const read = async () => {
    const { data, error } = await supabase
      .from("clinic_patient_sections")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ClinicPatientSection[];
  };

  let sections = await read();
  // Semeia (clínica nova) ou faz backfill de chaves faltantes e relê.
  if (sections.length < PATIENT_SECTION_ORDER.length) {
    await ensureClinicPatientSections(clinicId);
    sections = await read();
  }
  return sections;
}

/**
 * Mapa section_key → is_visible na ORDEM configurada, para a ficha renderizar.
 * Resiliente: se a leitura falhar, devolve a ordem padrão (tudo visível).
 */
export async function getPatientSectionLayout(
  clinicId: string,
): Promise<Array<{ key: string; visible: boolean }>> {
  try {
    const rows = await getClinicPatientSections(clinicId);
    return rows.map((r) => ({ key: r.section_key, visible: r.is_visible }));
  } catch {
    return PATIENT_SECTION_ORDER.map((key) => ({ key, visible: true }));
  }
}

// ── Escrita ────────────────────────────────────────────────────────────────
export async function setClinicPatientSectionVisibility(id: string, isVisible: boolean): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clinic_patient_sections")
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Move uma seção para cima/baixo trocando order_index com o vizinho. */
export async function moveClinicPatientSection(
  clinicId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const sections = await getClinicPatientSections(clinicId);
  const idx = sections.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sections.length) return;
  const a = sections[idx];
  const b = sections[swapIdx];
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  await Promise.all([
    supabase.from("clinic_patient_sections").update({ order_index: b.order_index, updated_at: new Date().toISOString() }).eq("id", a.id),
    supabase.from("clinic_patient_sections").update({ order_index: a.order_index, updated_at: new Date().toISOString() }).eq("id", b.id),
  ]);
}
