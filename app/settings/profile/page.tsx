import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const t = await getTranslations("settings");
  return (
    <Shell>
      <div className="mb-7">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("common.eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("profile.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("profile.subtitle")}</p>
      </div>
      <ProfileForm />
    </Shell>
  );
}
