import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Shell } from "@/components/shell";
import { AppointmentForm, type ClinicUserOption } from "@/components/appointment-form";
import { EmptyState } from "@/components/empty-state";
import { getPatients } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { createAppointment, getSessionTypes } from "@/services/appointment-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewAppointmentPage() {
  const [profile, patients, sessionTypes, clinic] = await Promise.all([
    getCurrentUserProfile(),
    getPatients(),
    getSessionTypes(),
    getCurrentClinic(),
  ]);

  let clinicUsers: ClinicUserOption[] = [];
  if (clinic) {
    const supabase = await createSupabaseServerClient();
    const { data: cuRaw } = await supabase
      .from("clinic_users")
      .select("user_id, display_name, specialty, users(full_name)")
      .eq("clinic_id", clinic.id)
      .eq("status", "active");
    clinicUsers = (cuRaw ?? []).map((cu) => {
      const usersData = cu.users as unknown as { full_name: string | null } | null;
      return {
        user_id: cu.user_id,
        display_name: cu.display_name ?? null,
        full_name: usersData?.full_name ?? null,
        specialty: cu.specialty ?? null,
      };
    });
  }

  async function createSessionAction(formData: FormData) {
    "use server";

    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic before creating sessions.");

    const patientId = String(formData.get("patient_id") ?? "");
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    const duration = Number(formData.get("duration_minutes") ?? 60);
    const notes           = String(formData.get("notes")           ?? "").trim() || null;
    const videoUrl        = String(formData.get("video_url")       ?? "").trim() || null;
    const sessionTypeId   = String(formData.get("session_type_id") ?? "").trim() || null;
    const practitionerId  = String(formData.get("practitioner_id") ?? "").trim() || null;
    const source = (String(formData.get("source") ?? "direct").trim() || "direct") as import("@/lib/types").AppointmentSource;

    if (!patientId || !date || !time) throw new Error("Paciente, data e horário são obrigatórios.");

    await createAppointment({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      starts_at: new Date(`${date}T${time}:00`).toISOString(),
      duration_minutes: duration,
      session_type_id: sessionTypeId,
      source,
      notes,
      video_url: videoUrl,
      practitioner_id: practitionerId,
    });

    redirect("/schedule");
  }

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-center gap-[10px] mb-[24px]">
        <Link
          href="/schedule"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Agendar sessão</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">Paciente, tratamento, data e horário</p>
        </div>
      </div>

      {!profile?.clinic_id ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[13px] text-[#A09E98]">Usuário precisa estar vinculado a uma clínica.</p>
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-7 w-7" />}
          title="Nenhum paciente ainda"
          text="Cadastre o primeiro paciente antes de agendar uma sessão."
          href="/patients/new"
          action="Cadastrar paciente"
        />
      ) : (
        <AppointmentForm patients={patients} sessionTypes={sessionTypes} action={createSessionAction} clinicUsers={clinicUsers} />
      )}
    </Shell>
  );
}
