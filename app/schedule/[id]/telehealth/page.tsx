import { notFound } from "next/navigation";
import { getAppointmentById } from "@/services/appointment-service";
import { TelehealthRoom } from "@/components/telehealth-room";

type Props = { params: Promise<{ id: string }> };

export default async function TelehealthPage({ params }: Props) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  return <TelehealthRoom appointment={appointment} />;
}
