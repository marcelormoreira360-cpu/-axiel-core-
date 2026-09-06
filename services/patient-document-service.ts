import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

export type PatientDocument = {
  id: string;
  patient_id: string;
  clinic_id: string;
  file_name: string;
  file_path: string;
  file_type: "pdf" | "image" | "text" | "other";
  file_size: number | null;
  source: "clinic" | "intake" | "portal";
  notes: string | null;
  created_at: string;
};

const BUCKET = "patient-docs";

export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  // Lazy import to avoid pulling next/headers into the client bundle
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_documents")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientDocument[];
}

export async function getSignedDocumentUrl(filePath: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);
  return data?.signedUrl ?? null;
}

export async function uploadPatientDocument(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  fileSize: number,
  patientId: string,
  clinicId: string,
  source: "clinic" | "intake" | "portal",
  notes: string | null,
): Promise<PatientDocument> {
  const supabase = createSupabaseAdminClient();

  const fileType: PatientDocument["file_type"] =
    mimeType === "application/pdf" ? "pdf" :
    mimeType.startsWith("image/") ? "image" :
    mimeType === "text/plain" ? "text" : "other";

  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const filePath = `${clinicId}/${patientId}/${randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, fileBuffer, { contentType: mimeType, upsert: false });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("patient_documents")
    .insert({
      patient_id: patientId,
      clinic_id: clinicId,
      file_name: originalName,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      source,
      notes,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PatientDocument;
}

/**
 * Cria um "ticket" de upload direto (URL assinada) para o navegador subir o arquivo
 * DIRETO no storage, sem passar pela função da Vercel — que corta o corpo em ~4,5 MB.
 * Mesmo padrão dos exames (PRs #144/#145). O path é fixado pelo servidor (dono =
 * prefixo informado); o cliente só grava ali. Não persiste nada no banco ainda.
 */
export async function createDocumentUploadTicket(
  pathPrefix: string,
  originalName: string,
): Promise<{ path: string; token: string }> {
  const supabase = createSupabaseAdminClient();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "arquivo";
  const path = `${pathPrefix}${randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Não foi possível preparar o upload.");
  return { path: data.path, token: data.token };
}

/** Baixa os bytes de um documento já no storage (server-side, p/ validação). */
export async function downloadPatientDocumentBytes(filePath: string): Promise<Buffer> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
  if (error || !data) throw error ?? new Error("Arquivo não encontrado no storage.");
  return Buffer.from(await data.arrayBuffer());
}

/** Remove um arquivo do storage (best-effort). Usado p/ limpar upload órfão. */
export async function removePatientDocumentFile(filePath: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(BUCKET).remove([filePath]);
}

/**
 * Registra em patient_documents um arquivo QUE JÁ ESTÁ no storage (subido direto
 * pelo navegador via ticket), sem re-upload. O caminho precisa começar pelo prefixo
 * esperado (validado pelo chamador) para não referenciar arquivo de outra clínica.
 */
export async function recordPatientDocumentFromPath(
  filePath: string,
  originalName: string,
  mimeType: string,
  fileSize: number,
  patientId: string,
  clinicId: string,
  source: "clinic" | "intake" | "portal",
  notes: string | null,
): Promise<PatientDocument> {
  const supabase = createSupabaseAdminClient();

  const fileType: PatientDocument["file_type"] =
    mimeType === "application/pdf" ? "pdf" :
    mimeType.startsWith("image/") ? "image" :
    mimeType === "text/plain" ? "text" : "other";

  const { data, error } = await supabase
    .from("patient_documents")
    .insert({
      patient_id: patientId,
      clinic_id: clinicId,
      file_name: originalName,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      source,
      notes,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PatientDocument;
}

export async function deletePatientDocument(docId: string, clinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Scoped por clinic_id: o admin client bypassa RLS, então o tenant-check é aqui
  const { data: doc } = await supabase
    .from("patient_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("clinic_id", clinicId)
    .single();

  if (!doc) throw new Error("Documento não encontrado.");

  if (doc.file_path) {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
  }

  await supabase
    .from("patient_documents")
    .delete()
    .eq("id", docId)
    .eq("clinic_id", clinicId);
}
