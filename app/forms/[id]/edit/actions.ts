"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentUserProfile } from "@/services/user-service";

type QuestionPayload = {
  dbId: string | null;
  text: string;
  type: string;
  maxScore: number;
  minScore: number;
  order_index: number;
};

type SectionPayload = {
  dbId: string | null;
  title: string;
  order_index: number;
  questions: QuestionPayload[];
};

export async function updateFormAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const templateId = String(formData.get("template_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const sendOnFirst = String(formData.get("send_on_first_appointment") ?? "") === "true";
  const reassessDaysRaw = parseInt(String(formData.get("reassessment_interval_days") ?? "0"), 10);
  const reassessDays = isNaN(reassessDaysRaw) || reassessDaysRaw < 0 ? 0 : reassessDaysRaw;

  if (!name || !templateId) throw new Error("Dados obrigatórios ausentes");

  const sections: SectionPayload[] = JSON.parse(String(formData.get("sections") ?? "[]"));
  const deletedSectionIds: string[] = JSON.parse(String(formData.get("deleted_section_ids") ?? "[]"));
  const deletedQuestionIds: string[] = JSON.parse(String(formData.get("deleted_question_ids") ?? "[]"));

  const supabase = await createSupabaseServerClient();

  // Update template metadata
  await supabase
    .from("assessment_templates")
    .update({ name, description, instructions, send_on_first_appointment: sendOnFirst, reassessment_interval_days: reassessDays })
    .eq("id", templateId);

  // Delete removed questions first (avoids FK issues)
  if (deletedQuestionIds.length > 0) {
    await supabase.from("assessment_questions").delete().in("id", deletedQuestionIds);
  }

  // Delete removed sections
  if (deletedSectionIds.length > 0) {
    await supabase.from("assessment_sections").delete().in("id", deletedSectionIds);
  }

  // Upsert sections and questions
  for (const sec of sections) {
    if (!sec.title.trim() && sec.questions.length === 0) continue;

    let sectionId: string;

    if (sec.dbId) {
      // Update existing section
      await supabase
        .from("assessment_sections")
        .update({ title: sec.title, order_index: sec.order_index })
        .eq("id", sec.dbId);
      sectionId = sec.dbId;
    } else {
      // Insert new section
      const { data, error } = await supabase
        .from("assessment_sections")
        .insert({ template_id: templateId, title: sec.title, order_index: sec.order_index })
        .select("id")
        .single();
      if (error) throw error;
      sectionId = data.id;
    }

    // Upsert questions
    for (const q of sec.questions) {
      if (!q.text.trim()) continue;

      if (q.dbId) {
        await supabase
          .from("assessment_questions")
          .update({
            text: q.text,
            question_type: q.type,
            min_score: q.minScore ?? 0,
            max_score: q.maxScore ?? 4,
            order_index: q.order_index,
            section_id: sectionId,
          })
          .eq("id", q.dbId);
      } else {
        await supabase.from("assessment_questions").insert({
          template_id: templateId,
          section_id: sectionId,
          text: q.text,
          question_type: q.type,
          min_score: q.minScore ?? 0,
          max_score: q.maxScore ?? 4,
          order_index: q.order_index,
        });
      }
    }
  }

  redirect(`/forms/${templateId}`);
}
