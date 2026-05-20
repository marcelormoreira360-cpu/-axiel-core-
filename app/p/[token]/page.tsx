import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PatientPortalDashboard } from "@/components/patient-portal/patient-portal-dashboard";
import { getPatientPortalDataByToken } from "@/services/patient-portal-service";

export const metadata: Metadata = {
  title: "Patient Dashboard | AXIEL Core",
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
  const data = await getPatientPortalDataByToken(token);

  if (!data) notFound();

  const purchaseSuccess = resolvedSearch.compra === "sucesso";

  return <PatientPortalDashboard data={data} rawToken={token} purchaseSuccess={purchaseSuccess} />;
}
