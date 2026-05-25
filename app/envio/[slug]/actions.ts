"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { uploadPatientDocument } from "@/services/patient-document-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

export async function lookupPatientAction(
  email: string,
  clinicId: string,
): Promise<{ found: boolean; name?: string; patientId?: string }> {
  const normalised = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalised)) return { found: false };

  const supabase = createSupabaseAdminClient();

  // Search by email (primary) — also try the normalised e-mail without dots
  // in case the booking was saved with slight formatting differences
  const { data } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("email", normalised)
    .maybeSingle();

  if (data) return { found: true, name: data.full_name, patientId: data.id };
  return { found: false };
}

export async function submitIntakeAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name         = (formData.get("name")       as string ?? "").trim();
  const email        = (formData.get("email")      as string ?? "").toLowerCase().trim();
  const phone        = (formData.get("phone")      as string ?? "").trim() || null;
  const notes        = (formData.get("notes")      as string ?? "").trim() || null;
  const clinicId     =  formData.get("clinic_id")  as string;
  const prePatientId = (formData.get("patient_id") as string ?? "").trim() || null;

  if (!clinicId) return { error: "Clínica inválida." };

  // Rate limit: 50 intake submissions per clinic per hour
  if (!(await checkRateLimitDb(`intake-submit:${clinicId}`, 50, 60 * 60_000))) {
    return { error: "Muitas solicitações. Tente novamente em alguns minutos." };
  }

  const supabase = createSupabaseAdminClient();
  let patientId: string;

  if (prePatientId) {
    // Patient was already identified in the lookup step — skip find-or-create
    patientId = prePatientId;
  } else {
    // New patient flow: name + email required
    if (!name || !email) return { error: "Nome e e-mail são obrigatórios." };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return { error: "E-mail inválido." };

    // Find existing patient by email OR phone (prevents duplicate records when
    // the same person booked via phone and now sends documents with an email)
    const normalizedPhone = phone ? phone.replace(/\D/g, "") : null;
    const orFilter = [
      `email.eq.${email}`,
      ...(normalizedPhone ? [`phone.eq.${normalizedPhone}`, `phone.eq.${phone}`] : []),
    ].join(",");

    const { data: existing } = await supabase
      .from("patients")
      .select("id, email, phone")
      .eq("clinic_id", clinicId)
      .or(orFilter)
      .maybeSingle();

    if (existing) {
      patientId = existing.id;
      // Enrich the record with any new information provided
      const updates: Record<string, string> = { full_name: name };
      if (email && !existing.email) updates.email = email;
      if (normalizedPhone && !existing.phone) updates.phone = normalizedPhone;
      await supabase.from("patients").update(updates).eq("id", patientId);
    } else {
      const { data: created, error } = await supabase
        .from("patients")
        .insert({ clinic_id: clinicId, full_name: name, email, phone: normalizedPhone ?? phone })
        .select("id")
        .single();
      if (error || !created) return { error: "Erro ao identificar paciente. Tente novamente." };
      patientId = created.id;
    }
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
