import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { getTranslations, getLocale } from "next-intl/server";
import { PatientPortalDashboard } from "@/components/patient-portal/patient-portal-dashboard";
import { getPatientPortalDataByToken } from "@/services/patient-portal-service";
import { getClinicCurrency } from "@/services/finance-service";
import { CurrencyProvider } from "@/components/currency-provider";

const PatientPushPrompt = nextDynamic(
  () => import("@/components/patient-portal/patient-push-prompt").then((m) => m.PatientPushPrompt),
  { loading: () => null },
);

export const metadata: Metadata = {
  title: "Portal do Paciente | AXIEL Core",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PublicPatientDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, resolvedSearch] = await Promise.all([params, searchParams]);

  let data;
  try {
    data = await getPatientPortalDataByToken(token);
  } catch {
    data = null;
  }

  // Show a friendly expired-link page instead of generic 404
  if (!data) {
    const t = await getTranslations("portal.tokenExpired");
    return (
      <main className="min-h-screen bg-[#F8F7F4] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-black/[.07] p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#FAEEDA] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#C97B1A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h1 className="text-[18px] font-semibold text-[#0F1A2E] mb-2">{t("title")}</h1>
          <p className="text-[13px] text-[#6B6A66] leading-relaxed">
            {t("desc")}
          </p>
          <p className="text-[12px] text-[#A09E98] mt-3">
            {t("contact")}
          </p>
        </div>
      </main>
    );
  }

  const purchaseSuccess = resolvedSearch.compra === "sucesso";
  const paymentSuccess = resolvedSearch.pagamento === "sucesso";
  const subscriptionSuccess = resolvedSearch.assinatura === "sucesso";

  const clinicCurrency = await getClinicCurrency(data.clinic.id);
  const portalLocale = await getLocale();

  return (
    <>
      <CurrencyProvider currency={clinicCurrency} locale={portalLocale}>
        <PatientPortalDashboard
          data={data}
          rawToken={token}
          purchaseSuccess={purchaseSuccess}
          paymentSuccess={paymentSuccess}
          subscriptionSuccess={subscriptionSuccess}
        />
      </CurrencyProvider>
      {/* Push notification prompt — rendered outside the dashboard scroll so it's always visible */}
      <div className="fixed bottom-4 left-4 right-4 max-w-sm mx-auto z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <PatientPushPrompt token={token} />
        </div>
      </div>
    </>
  );
}
