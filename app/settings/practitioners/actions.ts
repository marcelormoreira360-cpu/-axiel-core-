"use server";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function updatePractitionerAction(
  userId: string,
  fields: { display_name?: string; specialty?: string; bio?: string; is_bookable?: boolean }
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clinic_users")
    .update(fields)
    .eq("clinic_id", clinic.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  // A lista de perfis agora vive na aba "Perfil público" de /settings/equipe.
  revalidatePath("/settings/equipe");
  return {};
}
