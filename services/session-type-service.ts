import { revalidateTag } from "next/cache";
import type { SessionType } from "@/lib/types";

export async function getSessionTypesForClinic(clinicId: string): Promise<SessionType[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSessionType(input: {
  clinic_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_online: boolean;
}): Promise<SessionType> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .insert({ ...input, is_active: true })
    .select("*")
    .single();
  if (error) throw error;
  revalidateTag("session-types", {}); // bust the getSessionTypes cache
  return data;
}

export async function updateSessionType(
  id: string,
  fields: Partial<Pick<SessionType, "name" | "duration_minutes" | "price_cents" | "is_active" | "is_online" | "is_recorded">>,
): Promise<SessionType> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  revalidateTag("session-types", {}); // bust the getSessionTypes cache
  return data;
}

export async function deleteSessionType(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("session_types").delete().eq("id", id);
  if (error) throw error;
  revalidateTag("session-types", {}); // bust the getSessionTypes cache
}
