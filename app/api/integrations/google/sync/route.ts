import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { syncGoogleCalendarToAxiel } from "@/services/google-calendar-service";

export const runtime = "nodejs";

/**
 * POST /api/integrations/google/sync
 *
 * Manually triggers a Google Calendar → AXIEL bidirectional sync
 * for the authenticated clinic. Uses incremental sync (syncToken) so
 * only changed events since the last sync are processed.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const result = await syncGoogleCalendarToAxiel(profile.clinic_id);
  return NextResponse.json({ ok: true, ...result });
}
