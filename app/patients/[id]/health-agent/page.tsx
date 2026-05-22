import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { getPatientById } from "@/services/patient-service";
import { HealthAgentPanel } from "@/components/health-agent-panel";

type Props = { params: Promise<{ id: string }> };

export default async function HealthAgentPage({ params }: Props) {
  const { id } = await params;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-[10px] mb-[20px]">
        <Link
          href={`/patients/${id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            Agente de Saúde
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {patient.full_name}{age ? ` · ${age} anos` : ""}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-[10px] px-[14px] py-[10px] mb-[16px] flex items-start gap-[8px]">
        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-[1px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          <strong>Gerado por inteligência artificial.</strong> Não substitui avaliação clínica, diagnóstico médico ou prescrição profissional. Revise sempre com julgamento clínico próprio antes de qualquer conduta.
        </p>
      </div>

      {/* Data context chips */}
      <div className="flex flex-wrap gap-[6px] mb-[16px]">
        {[
          { label: "Exames laboratoriais", icon: "🔬" },
          { label: "Medicamentos ativos", icon: "💊" },
          { label: "Suplementos", icon: "🌿" },
          { label: "Notas das sessões", icon: "📋" },
          { label: "Formulários respondidos", icon: "📊" },
          { label: "Anamnese inicial", icon: "📝" },
        ].map(({ label, icon }) => (
          <span
            key={label}
            className="text-[10px] font-medium text-[#6B6A66] bg-[#F4F3EF] px-[8px] py-[3px] rounded-full"
          >
            {icon} {label}
          </span>
        ))}
      </div>

      {/* Panel */}
      <HealthAgentPanel patientId={id} />
    </Shell>
  );
}
