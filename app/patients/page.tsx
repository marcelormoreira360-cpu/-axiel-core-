import Link from "next/link";
import { Shell } from "@/components/shell";
import { EmptyState } from "@/components/empty-state";
import { getPatients } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { isPractitioner } from "@/services/team-service";
import { UserPlus } from "lucide-react";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function statusBadge(status: string) {
  if (status === "active") return { label: "Ativo", classes: "bg-[#E1F5EE] text-[#085041]" };
  if (status === "archived") return { label: "Arquivado", classes: "bg-[#F4F3EF] text-[#A09E98]" };
  return { label: "Inativo", classes: "bg-[#FAEEDA] text-[#633806]" };
}

function avatarColor(name: string) {
  const colors = [
    { bg: "#E1F5EE", text: "#0F6E56" },
    { bg: "#E6F1FB", text: "#0C447C" },
    { bg: "#FAEEDA", text: "#633806" },
    { bg: "#F0E8FB", text: "#5C2D91" },
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default async function PatientsPage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const practitionerId = profile && isPractitioner(profile.role) ? profile.id : undefined;
  const patients = await getPatients(clinicId, practitionerId);

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Pacientes</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {patients.length > 0
              ? `${patients.length} paciente${patients.length !== 1 ? "s" : ""}${practitionerId ? " atendidos por você" : " na clínica"}`
              : "Nenhum paciente ainda"}
          </p>
        </div>
        <Link
          href="/patients/new"
          className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
        >
          + Novo paciente
        </Link>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-7 w-7" />}
          title="Nenhum paciente ainda"
          text="Cadastre seu primeiro paciente para começar a gerenciar atendimentos."
          href="/patients/new"
          action="Cadastrar paciente"
        />
      ) : (
        <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
          {patients.map((patient, i) => {
            const av = avatarColor(patient.full_name);
            const badge = statusBadge(patient.status);
            const since = new Date(patient.created_at).toLocaleDateString([], { month: "short", year: "numeric" });

            return (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className={[
                  "flex items-center gap-[12px] px-[15px] py-[12px] hover:bg-[#F4F3EF] transition group",
                  i !== patients.length - 1 ? "border-b border-black/[.05]" : "",
                ].join(" ")}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-medium shrink-0"
                  style={{ background: av.bg, color: av.text }}
                >
                  {initials(patient.full_name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{patient.full_name}</p>
                  <p className="text-[11px] text-[#A09E98] mt-[1px]">
                    {patient.email ?? "No email"}
                    {patient.phone ? ` · ${patient.phone}` : ""}
                    {` · Since ${since}`}
                  </p>
                </div>

                {/* Status badge */}
                <span className={`text-[10px] px-2 py-[2px] rounded-full shrink-0 ${badge.classes}`}>
                  {badge.label}
                </span>

                {/* Arrow */}
                <svg className="w-3.5 h-3.5 text-[#D3D1C7] group-hover:text-[#0F6E56] transition shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
