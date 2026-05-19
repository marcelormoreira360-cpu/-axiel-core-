import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { ViewDetails } from "@/components/view-details";
import { BookingLinkCard } from "@/components/booking-link-card";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { canManageClinicUsers } from "@/modules/auth/roles";

const settings = [
  { href: "/clinics", title: "Clinic setup", text: "Clinic profile and basic configuration." },
  { href: "/settings/whatsapp", title: "WhatsApp Bot", text: "Configure the AI assistant: name, program, pricing and language." },
  { href: "/intake", title: "Intake forms", text: "Questions patients answer before care." },
  { href: "/monetization", title: "Packages", text: "Session packages and memberships." },
  { href: "/follow-ups", title: "Follow-ups", text: "Manual reminders and message placeholders." },
  { href: "/get-started", title: "Setup checklist", text: "Simple onboarding flow." },
  { href: "/billing", title: "Billing", text: "Subscription, trial, upgrades, and invoices." },
];

export default async function SettingsPage() {
  const [clinic, profile] = await Promise.all([
    getCurrentClinic(),
    getCurrentUserProfile(),
  ]);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isAdmin = canManageClinicUsers(profile?.role);

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Keep advanced tools here</h1>
        <p className="mt-3 text-lg text-black/55">Daily users should not need this page often.</p>
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
        <ViewDetails label="View details">
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
                    <h2 className="text-xl font-semibold">Log de Auditoria</h2>
                    <span className="text-[10px] font-medium text-[#0F6E56] bg-[#E1F5EE] px-[7px] py-[2px] rounded-full">Admin</span>
                  </div>
                  <p className="text-sm text-black/55">Histórico completo de ações do sistema e comunicações enviadas.</p>
                </Card>
              </Link>
            )}
          </div>
        </ViewDetails>
      </div>
    </Shell>
  );
}
