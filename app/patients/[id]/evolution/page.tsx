import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getPatientById } from "@/services/patient-service";
import { getPatientEvolution } from "@/services/evolution-service";
import { getCurrentClinic } from "@/services/clinic-service";
import dynamic from "next/dynamic";
const EvolutionCharts = dynamic(
  () => import("@/components/evolution-charts").then((m) => m.EvolutionCharts),
  { loading: () => <div className="h-48 rounded-[12px] bg-black/[.03] dark:bg-white/[.04] animate-pulse" /> },
);

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default async function PatientEvolutionPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("patientProfile.evolution");
  const { id } = await params;
  // A-06: scope getPatientById to the caller's clinic
  const clinic = await getCurrentClinic();
  const [patient, evolution] = await Promise.all([
    getPatientById(id, clinic?.id),
    getPatientEvolution(id),
  ]);

  if (!patient) notFound();

  const hasData = evolution.biomarkers.length > 0 || evolution.assessments.length > 0 || evolution.vitals.length > 0;

  return (
    <Shell>
      {/* Back */}
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        {patient.full_name}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/20 flex items-center justify-center text-[13px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] shrink-0">
          {initials(patient.full_name)}
        </div>
        <div>
          <p className="text-[17px] font-medium tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</p>
          <p className="text-[12px] text-[#A09E98]">{patient.full_name}</p>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[40px] text-center">
          <p className="text-[13px] text-[#A09E98]">
            {t("emptyTitle")}
          </p>
          <p className="text-[12px] text-[#D3D1C7] dark:text-white/25 mt-[6px]">
            {t("emptyHint")}
          </p>
          <div className="flex justify-center gap-3 mt-5">
            <Link
              href={`/patients/${id}`}
              className="text-[12px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] hover:text-[#085041] dark:hover:text-[#9FE1CB] transition"
            >
              {t("goToProfile")}
            </Link>
          </div>
        </div>
      ) : (
        <EvolutionCharts biomarkers={evolution.biomarkers} assessments={evolution.assessments} vitals={evolution.vitals} />
      )}
    </Shell>
  );
}
