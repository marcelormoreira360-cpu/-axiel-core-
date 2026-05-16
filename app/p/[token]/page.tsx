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

export default async function PublicPatientDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPatientPortalDataByToken(token);

  if (!data) notFound();

  return <PatientPortalDashboard data={data} />;
}
