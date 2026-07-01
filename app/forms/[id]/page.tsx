import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getTemplateWithStructure } from "@/services/assessment-service";
import { getPatients } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { FormPatientPicker } from "@/components/form-patient-picker";
import { FormInvitationPanel } from "@/components/form-invitation-panel";
import { PublicCaptureLinkPanel } from "@/components/public-capture-link-panel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FormDetailPage({ params }: Props) {
  const { id } = await params;
  const [template, profile] = await Promise.all([
    getTemplateWithStructure(id),
    getCurrentUserProfile(),
  ]);
  if (!template) notFound();

  const clinicId = profile?.clinic_id ?? undefined;
  const patients = await getPatients(clinicId);
  const t = await getTranslations("forms.detail");

  const totalQuestions = template.assessment_sections.reduce(
    (sum, s) => sum + s.assessment_questions.length,
    0
  );
  const maxScore = template.assessment_sections.reduce(
    (sum, s) => sum + s.assessment_questions.reduce((qs, q) => qs + (q.max_score ?? 4), 0),
    0
  );

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-center justify-between mb-[24px]">
        <div className="flex items-center gap-[10px]">
          <BackLink
            fallbackHref="/forms"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </BackLink>
          <div>
            <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">{template.name}</h1>
            <p className="text-[12px] text-[#A09E98] mt-[1px]">
              {t("meta", { sections: template.assessment_sections.length, questions: totalQuestions, max: maxScore })}
            </p>
          </div>
        </div>
        <Link
          href={`/forms/${id}/edit`}
          className="flex items-center gap-[5px] text-[11px] text-[#6B6A66] border border-black/[.08] hover:bg-[#F4F3EF] rounded-[6px] px-[10px] py-[5px] transition"
        >
          <Pencil className="h-3 w-3" /> {t("editForm")}
        </Link>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-[1fr_340px]">
        {/* Form structure preview */}
        <div className="space-y-[10px]">
          {template.assessment_sections.map((section) => (
            <div key={section.id} className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
              <div className="flex items-center justify-between px-[14px] py-[9px] bg-[#F4F3EF]">
                <p className="text-[11px] font-medium tracking-[.06em] uppercase text-[#6B6A66]">
                  {section.title}
                </p>
                <span className="text-[10px] text-[#A09E98]">
                  {t("sectionMeta", { count: section.assessment_questions.length, pts: section.assessment_questions.reduce((s, q) => s + q.max_score, 0) })}
                </span>
              </div>
              <div className="divide-y divide-black/[.04]">
                {section.assessment_questions.map((q) => (
                  <div key={q.id} className="flex items-center justify-between px-[14px] py-[9px] gap-[12px]">
                    <p className="text-[12px] text-[#0F1A2E] flex-1">{q.text}</p>
                    <span className="text-[10px] text-[#A09E98] shrink-0">
                      {q.question_type === "yes_no"
                        ? t("qYesNo")
                        : q.question_type === "text"
                        ? t("qText")
                        : t("qScale", { max: q.max_score })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Patient picker */}
        <div className="space-y-[12px]">
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <p className="text-[11px] font-medium text-[#6B6A66] mb-[10px]">{t("fillFor")}</p>
            <FormPatientPicker patients={patients} templateId={id} />
          </div>

          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <p className="text-[11px] font-medium text-[#6B6A66] mb-[10px]">{t("sendLink")}</p>
            <FormInvitationPanel patients={patients} templateId={id} />
          </div>

          <div className="bg-white border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[14px]">
            <PublicCaptureLinkPanel templateId={id} />
          </div>

          {template.instructions && (
            <div className="bg-[#F4F3EF] rounded-[12px] px-[14px] py-[12px]">
              <p className="text-[10px] font-medium text-[#6B6A66] mb-[6px]">{t("instructions")}</p>
              <p className="text-[12px] text-[#0F1A2E] leading-relaxed">{template.instructions}</p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
