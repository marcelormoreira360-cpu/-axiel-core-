import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/inbox/count — returns total unread patient→clinic messages (for sidebar badge)
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) return NextResponse.json({ count: 0 });

  const admin = createSupabaseAdminClient();

  const { count } = await admin
    .from("portal_messages")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id)
    .eq("direction", "patient_to_clinic")
    .is("read_at", null);

  return NextResponse.json({ count: count ?? 0 });
}
