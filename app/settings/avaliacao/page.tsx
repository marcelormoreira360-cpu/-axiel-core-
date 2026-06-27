import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { getCurrentUserProfile } from "@/services/user-service";
import { getClinicAssessmentFields } from "@/services/clinic-assessment-service";
import { AssessmentFieldsForm } from "@/components/assessment-fields-form";

export default async function AssessmentSettingsPage() {
  const t = await getTranslations("settings");
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/dashboard");
  if (!["clinic_owner", "clinic_manager", "admin"].includes(profile.role ?? "")) redirect("/settings");

  const fields = await getClinicAssessmentFields(profile.clinic_id);

  return (
    <Shell>
      <div className="mb-7">
        <BackLink
          fallbackHref="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("common.eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("assessmentFields.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("assessmentFields.subtitle")}</p>
      </div>

      <Card className="p-6 max-w-3xl">
        <AssessmentFieldsForm initial={fields} />
      </Card>
    </Shell>
  );
}
