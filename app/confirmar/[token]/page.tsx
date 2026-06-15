import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAppointmentByConfirmToken } from "@/services/appointment-service";
import { ConfirmClient } from "./confirm-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("confirmBooking");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getAppointmentByConfirmToken(token);
  const invalid = !info || info.status !== "pending" || info.expired;

  return (
    <ConfirmClient
      token={token}
      invalid={invalid}
      clinicName={info?.clinic?.name ?? null}
      logoUrl={info?.clinic?.logo_url ?? null}
      primaryColor={info?.clinic?.primary_color ?? "#0B1F3A"}
      startsAt={info?.starts_at ?? null}
      durationMinutes={info?.duration_minutes ?? null}
      sessionTypeName={info?.session_type_name ?? null}
      patientName={info?.patient?.full_name ?? ""}
      patientEmail={info?.patient?.email ?? ""}
      patientPhone={info?.patient?.phone ?? ""}
    />
  );
}
