import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Shell } from "@/components/shell";
import { ClinicalInsightView } from "@/components/clinical-insight";
import { getClinicalInsight } from "@/services/insight-export-service";

export default async function ClinicalInsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("insights.page");
  const insight = await getClinicalInsight(id);
  if (!insight) notFound();

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <Link href={`/patients/${id}`} className="inline-flex items-center gap-2 rounded-lg border border-axiel-line bg-white px-4 py-2 text-sm font-semibold text-black/65">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-black/55">{t("subtitle")}</p>
          </div>
          <Link href={`/patients/${id}/reports/clinical-insight/pdf`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-axiel-blue px-6 py-4 text-sm font-semibold text-white shadow-md">
            <Download className="h-5 w-5" /> {t("downloadPdf")}
          </Link>
        </div>
      </header>

      <div className="mb-5 rounded-xl border border-axiel-line bg-white p-6 text-sm leading-6 text-black/60 shadow-sm backdrop-blur">
        <div className="flex items-start gap-3">
          <FileText className="mt-1 h-5 w-5 text-black/35" />
          <p>{t("disclaimer")}</p>
        </div>
      </div>

      <ClinicalInsightView insight={insight} />
    </Shell>
  );
}
