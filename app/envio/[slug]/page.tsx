import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClinicBySlug } from "@/services/clinic-service";
import { IntakeClient } from "./intake-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  return {
    title: clinic ? `${clinic.name} — Envio de documentos` : "Envio de documentos",
    robots: { index: false, follow: false },
  };
}

export default async function IntakePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  return (
    <IntakeClient
      clinicId={clinic.id}
      clinicName={clinic.name}
      logoUrl={clinic.logo_url ?? null}
      primaryColor={clinic.primary_color ?? "#0B1F3A"}
    />
  );
}
