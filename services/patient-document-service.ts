import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

export async function deletePatientDocument(docId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: doc } = await supabase
    .from("patient_documents")
    .select("file_path")
    .eq("id", docId)
    .single();

  if (doc?.file_path) {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
  }

  await supabase.from("patient_documents").delete().eq("id", docId);
}
