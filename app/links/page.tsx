import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { LinksHub } from "./links-hub";

export const metadata = { title: "Links de Agendamento — AXIEL Core" };

export default async function LinksPage() {
  const [profile, clinic] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentClinic(),
  ]);

  if (!clinic?.slug) {
    return (
      <Shell>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[24px] text-center">
          <p className="text-[13px] text-[#A09E98] mb-[4px]">Clínica sem slug configurado.</p>
          <p className="text-[11px] text-[#D3D1C7]">
            Configure o slug da clínica em Configurações → Perfil para ativar os links de agendamento.
          </p>
        </div>
      </Shell>
    );
  }

  // Get base URL from request headers
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  // Load all clinic_users (bookable or not) with zoom_personal_url
  const supabase = await createSupabaseServerClient();
  const { data: cuRows } = await supabase
    .from("clinic_users")
    .select("user_id, display_name, specialty, is_bookable, zoom_personal_url")
    .eq("clinic_id", clinic.id)
    .eq("status", "active")
    .order("created_at");

  const userIds = (cuRows ?? []).map((r) => r.user_id);
  const { data: userRows } = userIds.length
    ? await supabase.from("users").select("id, full_name").in("id", userIds)
    : { data: [] };

  const userMap = new Map((userRows ?? []).map((u) => [u.id, u]));
  const practitioners = (cuRows ?? []).map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name as string | null,
    specialty: r.specialty as string | null,
    is_bookable: r.is_bookable as boolean,
    zoom_personal_url: (r.zoom_personal_url as string | null) ?? null,
    full_name: (userMap.get(r.user_id)?.full_name as string | null) ?? null,
  }));

  // Find current user's own zoom URL
  const myRow = profile ? practitioners.find((p) => p.user_id === profile.id) : null;
  const myZoomUrl = myRow?.zoom_personal_url ?? null;

  async function saveZoomUrlAction(formData: FormData) {
    "use server";
    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) return;

    const url = String(formData.get("zoom_url") ?? "").trim() || null;
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("clinic_users")
      .update({ zoom_personal_url: url })
      .eq("clinic_id", profile.clinic_id)
      .eq("user_id", profile.id);

    revalidatePath("/links");
  }

  return (
    <Shell>
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Links de Agendamento</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            Copie e compartilhe com seus pacientes
          </p>
        </div>
      </div>

      <LinksHub
        baseUrl={baseUrl}
        clinicSlug={clinic.slug}
        clinicName={clinic.name}
        practitioners={practitioners.filter((p) => p.is_bookable)}
        myZoomUrl={myZoomUrl}
        saveZoomUrlAction={saveZoomUrlAction}
      />
    </Shell>
  );
}
