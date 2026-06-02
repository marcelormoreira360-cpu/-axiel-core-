import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { getAssessmentTemplates, getTemplateWithStructure } from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { AssessmentFillForm } from "@/components/assessment-fill-form";
import { submitFormAction } from "./actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
};

export default async function FillFormPage({ params, searchParams }: Props) {
  const { id: patientId } = await params;
  const { template: templateId } = await searchParams;
  const t = await getTranslations("forms.fillPicker");

  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const templates = await getAssessmentTemplates(clinicId);

  let template = null;
  if (templateId) {
    template = await getTemplateWithStructure(templateId);
    if (!template) notFound();
  }

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[24px]">
        <Link
          href={`/patients/${patientId}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {template ? template.name : t("pickTitle")}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {template ? t("fillSubtitle") : t("pickSubtitle")}
          </p>
        </div>
      </div>

      {!template ? (
        <div className="space-y-[8px]">
          {templates.length === 0 && (
            <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
              <p className="text-[13px] text-[#A09E98]">
                {t.rich("emptyHint", {
                  a: (c) => <Link href="/forms/new" className="text-[#0F6E56] hover:underline">{c}</Link>,
                })}
              </p>
            </div>
          )}
          {templates.map((tpl) => (
            <Link
              key={tpl.id}
              href={`/patients/${patientId}/forms/new?template=${tpl.id}`}
              className="block bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] hover:border-[#0F6E56]/30 hover:bg-[#F0FAF6] transition"
            >
              <p className="text-[13px] font-medium text-[#0F1A2E]">{tpl.name}</p>
              {tpl.description && (
                <p className="text-[11px] text-[#A09E98] mt-[2px]">{tpl.description}</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <AssessmentFillForm template={template} patientId={patientId} action={submitFormAction} />
      )}
    </Shell>
  );
}
