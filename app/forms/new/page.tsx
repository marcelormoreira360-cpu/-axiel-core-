import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { AssessmentFormBuilder } from "@/components/assessment-form-builder";
import { getCurrentUserProfile } from "@/services/user-service";
import { redirect } from "next/navigation";

export default async function NewFormPage() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/forms");
  const t = await getTranslations("forms.new");

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[24px]">
        <BackLink
          fallbackHref="/forms"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {t("title")}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {t("subtitle")}
          </p>
        </div>
      </div>
      <AssessmentFormBuilder clinicId={profile.clinic_id} />
    </Shell>
  );
}
