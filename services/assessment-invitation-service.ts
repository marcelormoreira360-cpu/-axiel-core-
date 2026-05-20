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
  patient_id: string;
  clinic_id: string;
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

export async function getInvitationByToken(token: string): Promise<{
  invitation: AssessmentInvitation;
  template: TemplateWithStructure;
  patientName: string;
} | null> {
  const supabase = createSupabaseAdminClient();
  const token_hash = hashToken(token);

  const { data: inv } = await supabase
    .from("assessment_invitations")
    .select("*")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (!inv) return null;
  if (inv.completed_at) return null; // already done
  if (new Date(inv.expires_at) < new Date()) return null; // expired

  // Get template structure
  const { data: template } = await supabase
    .from("assessment_templates")
    .select(`*, assessment_sections(*, assessment_questions(*))`)
    .eq("id", inv.template_id)
    .maybeSingle();

  if (!template) return null;

  // Sort sections and questions
  template.assessment_sections.sort((a: any, b: any) => a.order_index - b.order_index);
  template.assessment_sections.forEach((s: any) =>
    s.assessment_questions.sort((a: any, b: any) => a.order_index - b.order_index)
  );

  // Get patient name
  const { data: patient } = await supabase
    .from("patients")
    .select("full_name")
    .eq("id", inv.patient_id)
    .maybeSingle();

  return {
    invitation: inv as AssessmentInvitation,
    template: template as TemplateWithStructure,
    patientName: patient?.full_name ?? "Paciente",
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
