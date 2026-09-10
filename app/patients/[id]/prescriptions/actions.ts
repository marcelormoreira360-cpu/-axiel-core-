"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { createPrescription, deactivatePrescription, deletePrescription, getPatientPrescriptions } from "@/services/exams-service";

export async function addPrescriptionAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const type = String(formData.get("type") ?? "supplement") as "medication" | "supplement";
  const name = String(formData.get("name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim() || null;
  const frequency = String(formData.get("frequency") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return;

  await createPrescription({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    type,
    name,
    dosage,
    frequency,
    start_date: startDate,
    notes,
  });

  revalidatePath(`/patients/${patientId}`);
}

/**
 * Puxa para a lista de Medicamentos e suplementos os itens que o paciente informou
 * no QRM (já separados pela IA em remédios × suplementos no bloco "Medicação (carga)"
 * da Avaliação). Deduplica pelo nome contra o que já está ATIVO, para clicar de novo
 * não duplicar. `note` (opcional) marca a procedência ("Informado pelo paciente (QRM)"),
 * vindo do cliente para respeitar o idioma. Retorna quantos itens foram criados.
 */
export async function addPrescriptionsFromExtractionAction(
  patientId: string,
  input: { medications?: string[]; supplements?: string[]; note?: string },
): Promise<{ added: number }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");
  if (!patientId) return { added: 0 };

  const norm = (s: string) => s.trim().toLowerCase();
  const existing = await getPatientPrescriptions(patientId);
  const activeNames = new Set(existing.filter((p) => p.is_active).map((p) => norm(p.name)));

  const items: { type: "medication" | "supplement"; name: string }[] = [
    ...(input.medications ?? []).map((name) => ({ type: "medication" as const, name })),
    ...(input.supplements ?? []).map((name) => ({ type: "supplement" as const, name })),
  ];

  const note = input.note?.trim() || null;
  let added = 0;
  try {
    for (const it of items) {
      const name = it.name.trim();
      if (!name) continue;
      const key = norm(name);
      if (activeNames.has(key)) continue; // não duplica o que já está ativo na lista
      activeNames.add(key);
      await createPrescription({
        patient_id: patientId,
        clinic_id: profile.clinic_id,
        type: it.type,
        name,
        notes: note,
      });
      added += 1;
    }
  } finally {
    // Revalida mesmo em falha parcial: linhas já criadas antes do erro aparecem na ficha.
    if (added > 0) revalidatePath(`/patients/${patientId}`);
  }
  return { added };
}

export async function deactivatePrescriptionAction(id: string, patientId: string) {
  await deactivatePrescription(id);
  revalidatePath(`/patients/${patientId}`);
}

export async function deletePrescriptionAction(id: string, patientId: string) {
  await deletePrescription(id);
  revalidatePath(`/patients/${patientId}`);
}
