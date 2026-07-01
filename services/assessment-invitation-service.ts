import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { TemplateWithStructure } from "@/lib/types";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export type AssessmentInvitation = {
  id: string;
  token_hash: string;
  template_id: string;
  patient_id: string | null;
  clinic_id: string;
  kind: "patient" | "public";
  is_reusable: boolean;
  label: string | null;
  expires_at: string;
  completed_at: string | null;
  response_id: string | null;
  created_at: string;
};

export async function createAssessmentInvitation(input: {
  template_id: string;
  patient_id: string;
  clinic_id: string;
}): Promise<{ token: string; invitation: AssessmentInvitation }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const token = generateToken();
  const token_hash = hashToken(token);

  const { data, error } = await supabase
    .from("assessment_invitations")
    .insert({
      token_hash,
      template_id: input.template_id,
      patient_id: input.patient_id,
      clinic_id: input.clinic_id,
    })
    .select()
    .single();

  if (error) throw error;
  return { token, invitation: data as AssessmentInvitation };
}

/**
 * Convite PÚBLICO de captação: sem paciente vinculado e reutilizável — o mesmo
 * link serve para várias pessoas. Quem responde preenche os próprios dados e
 * entra como Lead (ver /api/forms/submit). Validade longa (10 anos) porque é um
 * link para compartilhar (bio do Instagram, lista de WhatsApp, etc.).
 */
export async function createPublicCaptureInvitation(input: {
  template_id: string;
  clinic_id: string;
  label?: string | null;
}): Promise<{ token: string; invitation: AssessmentInvitation }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const token = generateToken();
  const token_hash = hashToken(token);
  const expires_at = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("assessment_invitations")
    .insert({
      token_hash,
      template_id: input.template_id,
      patient_id: null,
      clinic_id: input.clinic_id,
      kind: "public",
      is_reusable: true,
      label: input.label ?? null,
      expires_at,
    })
    .select()
    .single();

  if (error) throw error;
  return { token, invitation: data as AssessmentInvitation };
}

export async function getInvitationByToken(token: string): Promise<{
  invitation: AssessmentInvitation;
  template: TemplateWithStructure;
  patientName: string | null;
  isPublic: boolean;
} | null> {
  const supabase = createSupabaseAdminClient();
  const token_hash = hashToken(token);

  const { data: inv } = await supabase
    .from("assessment_invitations")
    .select("*")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (!inv) return null;
  const isPublic = inv.kind === "public";
  // Link público reutilizável nunca "queima"; convite de paciente é de uso único.
  if (!isPublic && inv.completed_at) return null; // already done
  if (new Date(inv.expires_at) < new Date()) return null; // expired

  // Get template structure
  const { data: template } = await supabase
    .from("assessment_templates")
    .select(`*, assessment_sections(*, assessment_questions(*))`)
    .eq("id", inv.template_id)
    .maybeSingle();

  if (!template) return null;

  // Sort sections and questions using the strongly-typed cast
  const structured = template as unknown as TemplateWithStructure;
  structured.assessment_sections.sort((a, b) => a.order_index - b.order_index);
  structured.assessment_sections.forEach((s) =>
    s.assessment_questions.sort((a, b) => a.order_index - b.order_index)
  );

  // Nome do paciente só existe em convite de paciente.
  let patientName: string | null = null;
  if (inv.patient_id) {
    const { data: patient } = await supabase
      .from("patients")
      .select("full_name")
      .eq("id", inv.patient_id)
      .maybeSingle();
    patientName = patient?.full_name ?? "Paciente";
  }

  return {
    invitation: inv as AssessmentInvitation,
    template: structured,
    patientName,
    isPublic,
  };
}

export async function getPatientInvitations(
  patientId: string,
  templateId?: string
): Promise<AssessmentInvitation[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("assessment_invitations")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (templateId) q = q.eq("template_id", templateId);
  const { data } = await q;
  return (data ?? []) as AssessmentInvitation[];
}

export async function completeInvitation(
  tokenHash: string,
  responseId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("assessment_invitations")
    .update({ completed_at: new Date().toISOString(), response_id: responseId })
    .eq("token_hash", tokenHash);
}
