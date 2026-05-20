"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { uploadPatientDocument } from "@/services/patient-document-service";

export async function submitIntakeAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name     = (formData.get("name")      as string ?? "").trim();
  const email    = (formData.get("email")     as string ?? "").toLowerCase().trim();
  const phone    = (formData.get("phone")     as string ?? "").trim() || null;
  const notes    = (formData.get("notes")     as string ?? "").trim() || null;
  const clinicId =  formData.get("clinic_id") as string;

  if (!name || !email || !clinicId) return { error: "Nome e e-mail são obrigatórios." };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { error: "E-mail inválido." };

  const supabase = createSupabaseAdminClient();

  // Find or create patient
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("email", email)
    .maybeSingle();

  let patientId: string;

  if (existing) {
    patientId = existing.id;
    // Update phone if provided and not already set
    if (phone) {
      await supabase
        .from("patients")
        .update({ phone, full_name: name })
        .eq("id", patientId);
    }
  } else {
    const { data: created, error } = await supabase
      .from("patients")
      .insert({ clinic_id: clinicId, full_name: name, email, phone })
      .select("id")
      .single();
    if (error || !created) return { error: "Erro ao identificar paciente. Tente novamente." };
    patientId = created.id;
  }

  // Upload files
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);

  if (validFiles.length === 0 && !notes) {
    return { error: "Envie ao menos um arquivo ou escreva uma observação." };
  }

  for (const file of validFiles) {
    if (file.size > 15 * 1024 * 1024) {
      return { error: `O arquivo "${file.name}" excede o limite de 15 MB.` };
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    try {
      await uploadPatientDocument(
        buffer, file.name, file.type || "application/octet-stream",
        file.size, patientId, clinicId, "intake", notes,
      );
    } catch {
      return { error: `Erro ao enviar "${file.name}". Tente novamente.` };
    }
  }

  // If only notes (no files), save as text file
  if (validFiles.length === 0 && notes) {
    const buf = Buffer.from(notes, "utf-8");
    await uploadPatientDocument(
      buf, "observacoes.txt", "text/plain",
      buf.length, patientId, clinicId, "intake", null,
    ).catch(() => {});
  }

  return { success: true };
}
