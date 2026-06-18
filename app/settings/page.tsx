import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { ViewDetails } from "@/components/view-details";
import { BookingLinkCard } from "@/components/booking-link-card";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { canManageClinicUsers } from "@/modules/auth/roles";

const SETTINGS_ITEMS: { href: string; key: string }[] = [
  { href: "/settings/profile", key: "profile" },
  { href: "/settings/equipe", key: "equipe" },
  { href: "/settings/practitioners", key: "practitioners" },
  { href: "/settings/branding", key: "branding" },
  { href: "/settings/regional", key: "regional" },
  { href: "/clinics", key: "clinic" },
  { href: "/settings/integrations", key: "integrations" },
  { href: "/settings/lgpd", key: "lgpd" },
  { href: "/settings/usage", key: "usage" },
  { href: "/settings/session-types", key: "sessionTypes" },
  { href: "/settings/clinical-tests", key: "clinicalTests" },
  { href: "/settings/supplements", key: "supplements" },
  { href: "/settings/offers", key: "offers" },
  { href: "/settings/lembretes", key: "lembretes" },
  { href: "/settings/whatsapp", key: "whatsapp" },
  { href: "/settings/voice", key: "voice" },
  { href: "/intake", key: "intake" },
  { href: "/monetization", key: "monetization" },
  { href: "/follow-ups", key: "followUps" },
  { href: "/get-started", key: "getStarted" },
  { href: "/billing", key: "billing" },
];

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const [clinic, profile] = await Promise.all([
    getCurrentClinic(),
    getCurrentUserProfile(),
  ]);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isAdmin = canManageClinicUsers(profile?.role);
  const settings = SETTINGS_ITEMS.map((item) => ({
    href: item.href,
    title: t(`hub.items.${item.key}.title`),
    text: t(`hub.items.${item.key}.text`),
  }));

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">{t("common.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t("hub.title")}</h1>
        <p className="mt-3 text-lg text-black/55">{t("hub.subtitle")}</p>
      </div>

      {clinic?.slug && (
        <BookingLinkCard slug={clinic.slug} baseUrl={baseUrl} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {settings.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-black/55">{item.text}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <ViewDetails label={t("hub.viewAll")}>
          <div className="grid gap-4 md:grid-cols-2">
            {settings.slice(5).map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm text-black/55">{item.text}</p>
                </Card>
              </Link>
            ))}

            {/* Admin-only: Audit log */}
            {isAdmin && (
              <Link href="/admin/audit">
                <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm border-[#0F6E56]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold">{t("hub.auditTitle")}</h2>
                    <span className="text-[10px] font-medium text-[#0F6E56] bg-[#E1F5EE] px-[7px] py-[2px] rounded-full">{t("hub.auditBadge")}</span>
                  </div>
                  <p className="text-sm text-black/55">{t("hub.auditText")}</p>
                </Card>
              </Link>
            )}
          </div>
        </ViewDetails>
      </div>
    </Shell>
  );
}
