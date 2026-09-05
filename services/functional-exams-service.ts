export type FunctionalExamType = "neurometria" | "biorressonancia" | "teste_capilar" | "outro";

export type PatientFunctionalExam = {
  id: string;
  clinic_id: string;
  patient_id: string;
  exam_type: FunctionalExamType;
  title: string | null;
  summary: string | null;
  findings: Record<string, unknown> | null;
  exam_date: string;
  file_path: string | null;
  ai_analysis: string | null;
  /** Rascunho da IA { metric_code: valor bruto } extraído do PDF (auditoria; gate humano). */
  metrics_draft: Record<string, number> | null;
  /** Valores revisados/confirmados pelo terapeuta — entram na pirâmide Bio³. */
  metrics_values: Record<string, number> | null;
  /** Carimbo da revisão (gate). Null = pendente. */
  metrics_reviewed_at: string | null;
  metrics_reviewed_by: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getPatientFunctionalExams(patientId: string): Promise<PatientFunctionalExam[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_functional_exams")
    .select("*")
    .eq("patient_id", patientId)
    .order("exam_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientFunctionalExam[];
}

/**
 * Conta exames com métricas EXTRAÍDAS (metrics_draft não vazio) mas ainda NÃO
 * confirmadas pelo gate humano (metrics_reviewed_at nulo). Enquanto pendentes, os
 * números não entram no relatório (input-builder exige metrics_reviewed_at) — este
 * contador alimenta o aviso na mesa de revisão para acabar com a degradação silenciosa.
 */
export async function countExamsPendingMetricsReview(patientId: string): Promise<number> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_functional_exams")
    .select("id, metrics_draft, metrics_reviewed_at")
    .eq("patient_id", patientId)
    .is("metrics_reviewed_at", null);
  if (error) throw error;
  return (data ?? []).filter(
    (e) => e.metrics_draft && Object.keys(e.metrics_draft as Record<string, unknown>).length > 0,
  ).length;
}

/** Sobe o PDF do exame para o bucket patient-docs e devolve o caminho. */
export async function uploadFunctionalExamFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  patientId: string,
  clinicId: string,
): Promise<string> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const { randomUUID } = await import("crypto");
  const supabase = createSupabaseAdminClient();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const filePath = `${clinicId}/${patientId}/exams/${randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("patient-docs")
    .upload(filePath, fileBuffer, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return filePath;
}

/** Prefixo canônico do arquivo de exame de um paciente (usado para validar o path). */
export function functionalExamPathPrefix(clinicId: string, patientId: string): string {
  return `${clinicId}/${patientId}/exams/`;
}

/**
 * Cria um "ticket" de upload direto (URL assinada) para o navegador subir o PDF
 * do exame DIRETO no storage, sem passar pela função da Vercel — que corta o
 * corpo em ~4,5 MB. Exames Neuro ID costumam ter 5–10 MB. O admin client gera a
 * URL num path fixo (dono = clínica/paciente); o cliente só pode gravar ali.
 */
export async function createFunctionalExamUploadTicket(
  originalName: string,
  patientId: string,
  clinicId: string,
): Promise<{ path: string; token: string }> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const { randomUUID } = await import("crypto");
  const supabase = createSupabaseAdminClient();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "exame.pdf";
  const path = `${functionalExamPathPrefix(clinicId, patientId)}${randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage
    .from("patient-docs")
    .createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Não foi possível preparar o upload.");
  return { path: data.path, token: data.token };
}

/** Baixa os bytes de um arquivo de exame do storage (server-side, p/ a IA ler). */
export async function downloadFunctionalExamFile(path: string): Promise<Buffer> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from("patient-docs").download(path);
  if (error || !data) throw error ?? new Error("Arquivo do exame não encontrado.");
  return Buffer.from(await data.arrayBuffer());
}

export async function createPatientFunctionalExam(input: {
  clinic_id: string;
  patient_id: string;
  exam_type: FunctionalExamType;
  title?: string | null;
  summary?: string | null;
  findings?: Record<string, unknown> | null;
  exam_date: string;
  file_path?: string | null;
  ai_analysis?: string | null;
  /** Rascunho de métricas extraídas pela IA (gate humano: fica pendente até revisão). */
  metrics_draft?: Record<string, number> | null;
}): Promise<PatientFunctionalExam> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const draft = input.metrics_draft && Object.keys(input.metrics_draft).length > 0 ? input.metrics_draft : null;
  const { data, error } = await supabase
    .from("patient_functional_exams")
    .insert({
      clinic_id:     input.clinic_id,
      patient_id:    input.patient_id,
      exam_type:     input.exam_type,
      title:         input.title ?? null,
      summary:       input.summary ?? null,
      findings:      input.findings ?? null,
      exam_date:     input.exam_date,
      file_path:     input.file_path ?? null,
      ai_analysis:   input.ai_analysis ?? null,
      metrics_draft: draft,
      created_by:    user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PatientFunctionalExam;
}

/**
 * Gate humano: grava os valores das métricas revisados/confirmados pelo terapeuta
 * (estes entram na pirâmide Bio³). `values` já vem saneado por code (coerceExamMetricsDraft).
 */
export async function reviewExamMetrics(
  examId: string,
  values: Record<string, number>,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("patient_functional_exams")
    .update({
      metrics_values:      Object.keys(values).length > 0 ? values : null,
      metrics_reviewed_at: new Date().toISOString(),
      metrics_reviewed_by: user?.id ?? null,
    })
    .eq("id", examId);
  if (error) throw error;
}

export async function deletePatientFunctionalExam(examId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("patient_functional_exams").delete().eq("id", examId);
  if (error) throw error;
}
