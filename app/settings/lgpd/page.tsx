import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getCurrentUserProfile } from "@/services/user-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { LgpdRequestsClient } from "@/components/lgpd-requests-client";

export default async function LgpdPage() {
  const t = await getTranslations("settings");
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/dashboard");
  if (!["clinic_owner", "clinic_manager"].includes(profile.role ?? "")) redirect("/settings");

  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from("data_deletion_requests")
    .select("id, status, reason, requested_at, reviewed_at, patients(full_name, email, phone)")
    .eq("clinic_id", profile.clinic_id)
    .order("requested_at", { ascending: false });

  return (
    <Shell>
      <div className="mb-6">
        <BackLink
          fallbackHref="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[4px]">{t("common.eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
          {t("lgpd.title")}
        </h1>
        <p className="text-[13px] text-[#A09E98] mt-[3px]">
          {t("lgpd.subtitle")}
        </p>
      </div>
      <LgpdRequestsClient requests={requests ?? []} clinicId={profile.clinic_id} />
    </Shell>
  );
}
