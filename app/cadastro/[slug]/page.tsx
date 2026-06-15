import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getClinicBySlug } from "@/services/clinic-service";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  const t = await getTranslations("publicRegister");
  return {
    title: clinic ? `${clinic.name} — ${t("metaTitle")}` : t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function SelfRegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  return (
    <RegisterClient
      clinicId={clinic.id}
      clinicName={clinic.name}
      logoUrl={clinic.logo_url ?? null}
      primaryColor={clinic.primary_color ?? "#0B1F3A"}
    />
  );
}
