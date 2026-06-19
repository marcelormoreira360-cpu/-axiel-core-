"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { uploadPatientDocument } from "@/services/patient-document-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

// ── Validação de upload (rota pública — allowlist + magic bytes) ──────────────
const ALLOWED_UPLOAD_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
]);

function matchesMagicBytes(mime: string, buf: Buffer): boolean {
  if (buf.length < 12) return false;
  switch (mime) {
    case "application/pdf":
      return buf.subarray(0, 4).toString("latin1") === "%PDF";
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case "image/webp":
      return buf.subarray(0, 4).toString("latin1") === "RIFF" &&
             buf.subarray(8, 12).toString("latin1") === "WEBP";
    case "image/heic":
    case "image/heif":
      return buf.subarray(4, 8).toString("latin1") === "ftyp";
    case "text/plain":
      // Sem magic bytes; rejeita se contiver bytes nulos (binário disfarçado)
      return !buf.subarray(0, Math.min(buf.length, 8192)).includes(0);
    default:
      return false;
  }
}

function isAllowedUpload(declaredMime: string, buf: Buffer): boolean {
  const mime = (declaredMime || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_UPLOAD_MIMES.has(mime)) return false;
  return matchesMagicBytes(mime, buf);
}

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

  // Demografia opcional (fonte única do cadastro → flui pra ficha/relatórios).
  const dobRaw    = (formData.get("date_of_birth") as string ?? "").trim();
  const sexRaw    = (formData.get("sex")           as string ?? "").trim().toLowerCase();
  const weightRaw = (formData.get("weight_kg")     as string ?? "").trim();
  const heightRaw = (formData.get("height_cm")     as string ?? "").trim();
  const dob    = /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : null;
  const sex    = ["female", "male", "other"].includes(sexRaw) ? sexRaw : null;
  const weight = weightRaw !== "" && Number.isFinite(Number(weightRaw)) && Number(weightRaw) > 0 && Number(weightRaw) <= 400 ? Number(weightRaw) : null;
  const height = heightRaw !== "" && Number.isFinite(Number(heightRaw)) && Number(heightRaw) > 0 && Number(heightRaw) <= 260 ? Number(heightRaw) : null;
  const demo: Record<string, string | number> = {};
  if (dob !== null)    demo.date_of_birth = dob;
  if (sex !== null)    demo.sex = sex;
  if (weight !== null) demo.weight_kg = weight;
  if (height !== null) demo.height_cm = height;

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
    // the same person booked via phone and now sends documents with an email).
    // Queries separadas com .eq() — nunca interpolar input no DSL .or() (injeção PostgREST).
    const normalizedPhone = phone ? phone.replace(/\D/g, "") : null;

    type ExistingPatient = {
      id: string; email: string | null; phone: string | null;
      date_of_birth: string | null; sex: string | null; weight_kg: number | null; height_cm: number | null;
    };
    let existing: ExistingPatient | null = null;
    {
      const { data } = await supabase
        .from("patients")
        .select("id, email, phone, date_of_birth, sex, weight_kg, height_cm")
        .eq("clinic_id", clinicId)
        .eq("email", email)
        .maybeSingle();
      existing = data ?? null;
    }
    if (!existing && normalizedPhone) {
      const { data } = await supabase
        .from("patients")
        .select("id, email, phone, date_of_birth, sex, weight_kg, height_cm")
        .eq("clinic_id", clinicId)
        .in("phone", [normalizedPhone, phone].filter(Boolean) as string[])
        .limit(1)
        .maybeSingle();
      existing = data ?? null;
    }

    if (existing) {
      patientId = existing.id;
      // Enrich the record with any new information provided
      const updates: Record<string, string | number> = { full_name: name };
      if (email && !existing.email) updates.email = email;
      if (normalizedPhone && !existing.phone) updates.phone = normalizedPhone;
      // Demografia: só preenche o que ainda está vazio (não sobrescreve o terapeuta).
      if (demo.date_of_birth && !existing.date_of_birth) updates.date_of_birth = demo.date_of_birth;
      if (demo.sex && !existing.sex) updates.sex = demo.sex;
      if (demo.weight_kg && existing.weight_kg == null) updates.weight_kg = demo.weight_kg;
      if (demo.height_cm && existing.height_cm == null) updates.height_cm = demo.height_cm;
      await supabase.from("patients").update(updates).eq("id", patientId);
    } else {
      const { data: created, error } = await supabase
        .from("patients")
        .insert({ clinic_id: clinicId, full_name: name, email, phone: normalizedPhone ?? phone, ...demo })
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

  // Server-side file count limit (prevents zip-bomb style abuse)
  if (validFiles.length > 20) {
    return { error: "Máximo de 20 arquivos por envio." };
  }

  for (const file of validFiles) {
    if (file.size > 15 * 1024 * 1024) {
      return { error: `O arquivo "${file.name}" excede o limite de 15 MB.` };
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (!isAllowedUpload(file.type, buffer)) {
      return { error: `Tipo de arquivo não permitido: "${file.name}". Envie PDF, imagem (JPG/PNG/WEBP/HEIC) ou texto.` };
    }
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
