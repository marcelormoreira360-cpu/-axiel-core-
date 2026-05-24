import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// POST /api/push/subscribe — save a push subscription for the authenticated user
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Sem clínica associada." }, { status: 403 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Dados de subscription inválidos." }, { status: 422 });
  }

  const admin = createSupabaseAdminClient();

  // Upsert by (user_id, endpoint) so re-subscribing updates keys
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({
      user_id:    user.id,
      clinic_id:  profile.clinic_id,
      endpoint,
      p256dh:     keys.p256dh,
      auth:       keys.auth,
      user_agent: userAgent ?? null,
    }, { onConflict: "user_id,endpoint" });

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
