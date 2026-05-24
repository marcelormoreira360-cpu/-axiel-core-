import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PractitionersList, type PractitionerRow } from "./practitioners-list";

export const metadata = { title: "Profissionais — AXIEL Core" };

export default async function PractitionersPage() {
  const clinic = await getCurrentClinic();
  if (!clinic) {
    return (
      <Shell>
        <p className="text-sm text-black/55">Clínica não encontrada.</p>
      </Shell>
    );
  }

  const supabase = await createSupabaseServerClient();

  // Two separate queries to avoid PostgREST join naming issues
  const { data: cuRows } = await supabase
    .from("clinic_users")
    .select("user_id, display_name, specialty, bio, is_bookable")
    .eq("clinic_id", clinic.id)
    .eq("status", "active")
    .order("created_at");

  const userIds = (cuRows ?? []).map((r) => r.user_id);
  const { data: userRows } = userIds.length
    ? await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };

  const userMap = new Map((userRows ?? []).map((u) => [u.id, u]));

  const practitioners: PractitionerRow[] = (cuRows ?? []).map((r) => {
    const u = userMap.get(r.user_id);
    return {
      user_id: r.user_id,
      display_name: r.display_name ?? null,
      specialty: r.specialty ?? null,
      bio: r.bio ?? null,
      is_bookable: r.is_bookable,
      full_name: u?.full_name ?? null,
      email: u?.email ?? null,
    };
  });

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Configurações</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Profissionais</h1>
          <p className="mt-2 text-sm text-black/55">
            Configure o perfil público de cada profissional da equipe. Ative &quot;Agenda pública&quot; para que
            o paciente possa escolher o profissional ao agendar online.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/settings/equipe"
            className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg"
          >
            + Convidar profissional
          </Link>
          <Link
            href="/settings"
            className="text-[12px] text-black/40 hover:text-black/70 transition"
          >
            ← Voltar
          </Link>
        </div>
      </div>

      <PractitionersList practitioners={practitioners} />
    </Shell>
  );
}
