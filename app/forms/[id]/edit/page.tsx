import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getTemplateWithStructure } from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { AssessmentFormEditor } from "@/components/assessment-form-editor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditFormPage({ params }: Props) {
  const { id } = await params;
  const [template, profile] = await Promise.all([
    getTemplateWithStructure(id),
    getCurrentUserProfile(),
  ]);
  if (!template || !profile?.clinic_id) notFound();
  const t = await getTranslations("forms.edit");

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[24px]">
        <BackLink
          fallbackHref={`/forms/${id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">{template.name}</p>
        </div>
      </div>
      <AssessmentFormEditor template={template} />
    </Shell>
  );
}
