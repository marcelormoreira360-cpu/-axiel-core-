import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PortalAccessForm } from "./portal-access-form";

export const metadata: Metadata = {
  title: "Portal do Paciente | AXIEL Core",
  robots: { index: false, follow: false },
};

export default async function PatientPortalLoginPage() {
  const t = await getTranslations("portal.login");
  return (
    <main className="min-h-screen bg-[#F8FAF9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / brand */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/35 mb-3">
            AXIEL Core
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F1A2E]">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-black/50">
            {t("subtitle")}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-black/[.07] p-6">
          <PortalAccessForm />
        </div>

        <p className="text-center text-xs text-black/35">
          {t("noAccount")}
        </p>

        <p className="text-center text-[11px] text-black/30 leading-relaxed">
          {t.rich("lgpdNote", {
            a: (c) => <a href="/privacidade" className="underline hover:text-black/50 transition" target="_blank" rel="noopener noreferrer">{c}</a>,
          })}
        </p>
      </div>
    </main>
  );
}
