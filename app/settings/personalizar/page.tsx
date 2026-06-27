import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { getCurrentUserProfile } from "@/services/user-service";

// Recorte "construa do seu jeito": agrega numa só tela tudo que a clínica personaliza.
// Cada card aponta para a tela de edição que já existe (sem lógica nova).
const PERSONALIZE_ITEMS: { href: string; key: string }[] = [
  { href: "/settings/avaliacao", key: "assessmentFields" },
  { href: "/forms", key: "forms" },
  { href: "/settings/session-types", key: "sessionTypes" },
  { href: "/settings/clinical-tests", key: "clinicalTests" },
  { href: "/settings/supplements", key: "supplements" },
  { href: "/settings/branding", key: "branding" },
  { href: "/settings/offers", key: "offers" },
  { href: "/settings/lembretes", key: "lembretes" },
];

export default async function PersonalizeSettingsPage() {
  const t = await getTranslations("settings");
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/dashboard");
  if (!["clinic_owner", "clinic_manager", "admin"].includes(profile.role ?? "")) redirect("/settings");

  const items = PERSONALIZE_ITEMS.map((item) => ({
    href: item.href,
    title: t(`hub.items.${item.key}.title`),
    text: t(`hub.items.${item.key}.text`),
  }));

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
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("personalize.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("personalize.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-black/55">{item.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
