import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import { getIntakeFormWithQuestionsById } from "@/services/intake-service";
import { IntakeFormEditor } from "@/components/intake-form-editor";

export default async function IntakeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("intake");
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/dashboard");
  if (!["clinic_owner", "clinic_manager", "admin"].includes(profile.role ?? "")) redirect("/intake");

  const form = await getIntakeFormWithQuestionsById(id, profile.clinic_id);
  if (!form) notFound();

  return (
    <Shell>
      <div className="mb-7">
        <Link href="/intake" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("editTitle")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("editSubtitle")}</p>
      </div>

      <IntakeFormEditor form={form} />
    </Shell>
  );
}
