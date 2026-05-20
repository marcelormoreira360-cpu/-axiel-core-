import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import { getSessionTypesForClinic, createSessionType, updateSessionType, deleteSessionType } from "@/services/session-type-service";
import { SessionTypeList } from "@/components/session-type-list";

export default async function SessionTypesPage() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/dashboard");

  const sessionTypes = await getSessionTypesForClinic(profile.clinic_id);

  async function createAction(formData: FormData) {
    "use server";
    const p = await getCurrentUserProfile();
    if (!p?.clinic_id) return;
    await createSessionType({
      clinic_id:        p.clinic_id,
      name:             String(formData.get("name") ?? "").trim(),
      duration_minutes: Number(formData.get("duration_minutes") ?? 60),
      price_cents:      Math.round(Number(formData.get("price_brl") ?? 0) * 100),
      is_online:        formData.get("is_online") === "true",
    });
    revalidatePath("/settings/session-types");
  }

  async function toggleOnlineAction(id: string, isOnline: boolean) {
    "use server";
    await updateSessionType(id, { is_online: isOnline });
    revalidatePath("/settings/session-types");
  }

  async function toggleActiveAction(id: string, isActive: boolean) {
    "use server";
    await updateSessionType(id, { is_active: isActive });
    revalidatePath("/settings/session-types");
  }

  async function deleteAction(id: string) {
    "use server";
    await deleteSessionType(id);
    revalidatePath("/settings/session-types");
  }

  return (
    <Shell>
      <div className="mb-7">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Tipos de sessão</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Gerencie modalidades, durações e preços. Ative &quot;Online&quot; para criar reunião Zoom automaticamente.
        </p>
      </div>

      <SessionTypeList
        sessionTypes={sessionTypes}
        createAction={createAction}
        toggleOnlineAction={toggleOnlineAction}
        toggleActiveAction={toggleActiveAction}
        deleteAction={deleteAction}
      />
    </Shell>
  );
}
