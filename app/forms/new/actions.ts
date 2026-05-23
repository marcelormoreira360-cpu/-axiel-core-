"use server";

import { redirect } from "next/navigation";
import {
  createAssessmentTemplate,
  createAssessmentSection,
  createAssessmentQuestion,
} from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getBillingContext } from "@/services/billing-service";
import { checkUsageLimit } from "@/modules/billing/feature-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createFormAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clinic required");

  // ── Usage gate: forms limit ───────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("assessment_templates")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id);
  const billingCtx = await getBillingContext(profile.clinic_id, { forms: count ?? 0 });
  const formsCheck = checkUsageLimit(billingCtx, "forms");
  if (formsCheck.isAtLimit) {
    redirect(`/forms/new?error=${encodeURIComponent(`Limite de ${formsCheck.limit} formulários atingido. Faça upgrade para adicionar mais.`)}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const sectionsJson = String(formData.get("sections") ?? "[]");

  if (!name) throw new Error("Nome obrigatório");

  const sections: Array<{
    title: string;
    questions: Array<{ text: string; type: string; maxScore: number; minScore: number }>;
  }> = JSON.parse(sectionsJson);

  const template = await createAssessmentTemplate({
    clinic_id: profile.clinic_id,
    name,
    description,
    instructions,
    scale_labels: [
      "Nunca ou quase nunca",
      "Ocasionalmente, efeito leve",
      "Ocasionalmente, efeito severo",
      "Frequentemente, efeito leve",
      "Frequentemente, efeito severo",
    ],
  });

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const section = await createAssessmentSection({
      template_id: template.id,
      title: sec.title,
      order_index: si,
    });
    for (let qi = 0; qi < sec.questions.length; qi++) {
      const q = sec.questions[qi];
      await createAssessmentQuestion({
        template_id: template.id,
        section_id: section.id,
        text: q.text,
        question_type: q.type,
        min_score: q.minScore ?? 0,
        max_score: q.maxScore ?? 4,
        order_index: qi,
      });
    }
  }

  redirect("/forms");
}
