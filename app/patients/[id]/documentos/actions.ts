"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { deletePatientDocument } from "@/services/patient-document-service";
import { isManager } from "@/services/team-service";

export async function deleteDocumentAction(
  docId: string,
  patientId: string,
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { error: "Sem permissão." };
  // Managers and practitioners can delete documents
  if (profile.role === "read_only_staff") return { error: "Sem permissão para excluir." };

  try {
    await deletePatientDocument(docId);
    revalidatePath(`/patients/${patientId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir documento." };
  }
}
