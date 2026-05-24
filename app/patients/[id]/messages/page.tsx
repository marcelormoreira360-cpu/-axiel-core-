import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { Shell } from "@/components/shell";
import { getPatientById } from "@/services/patient-service";
import { ClinicChat } from "@/components/clinic-chat";

export default async function PatientMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;

  const patient = await getPatientById(patientId);
  if (!patient) notFound();

  return (
    <Shell>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
        {/* Back link */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/patients/${patientId}`}
            className="flex items-center gap-1 text-[12px] text-black/40 hover:text-[#0F1A2E] transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Voltar ao paciente
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-[#0F6E56]/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-4 w-4 text-[#0F6E56]" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[#0F1A2E]">{patient.full_name}</h1>
            <p className="text-xs text-black/40">Portal do paciente · chat assíncrono</p>
          </div>
        </div>

        {/* Interactive chat (client component) */}
        <ClinicChat patientId={patientId} patientName={patient.full_name} />
      </div>
    </Shell>
  );
}
