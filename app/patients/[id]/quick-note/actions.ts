"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Appends a quick voice note (or any text) to patient.notes.
 * Prepends a timestamp so notes stay chronological.
 */
export async function appendPatientNoteAction(
  patientId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Nota vazia." };

  try {
    const supabase = await createSupabaseServerClient();

    // Read current notes
    const { data: patient, error: readErr } = await supabase
      .from("patients")
      .select("notes, clinic_id")
      .eq("id", patientId)
      .maybeSingle();

    if (readErr || !patient) return { ok: false, error: "Paciente não encontrado." };

    const dateLabel = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newEntry = `[${dateLabel}] ${clean}`;
    const existing = patient.notes?.trim() ?? "";
    const merged = existing ? `${existing}\n\n${newEntry}` : newEntry;

    const { error: writeErr } = await supabase
      .from("patients")
      .update({ notes: merged })
      .eq("id", patientId)
      .eq("clinic_id", patient.clinic_id);

    if (writeErr) throw writeErr;

    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}
