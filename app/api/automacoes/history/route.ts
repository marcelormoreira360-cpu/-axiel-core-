import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export interface AutomacaoHistoryItem {
  id: string;
  ruleKey: string;         // d_minus_1 | nps | d_plus_3 | d_plus_30
  ruleTitle: string;
  patientName: string;
  channel: string;
  status: "sent" | "failed" | "skipped";
  sentAt: string;
}

const TAG_TO_KEY: Record<string, string> = {
  "d-1": "d_minus_1",
  "nps": "nps",
  "d+3": "d_plus_3",
  "d+30": "d_plus_30",
};

const TAG_TO_TITLE: Record<string, string> = {
  "d-1": "Lembrete D-1",
  "nps": "NPS Pós-Sessão",
  "d+3": "Acompanhamento D+3",
  "d+30": "Fidelização D+30",
};

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cu } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!cu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clinicId = cu.clinic_id as string;
  const { searchParams } = new URL(request.url);
  const ruleKey = searchParams.get("rule");    // optional filter
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const admin = createSupabaseAdminClient();

  let query = admin
    .from("follow_ups")
    .select("id, notes, status, updated_at, patients(full_name)")
    .eq("clinic_id", clinicId)
    .in("notes", ["d-1", "nps", "d+3", "d+30"])
    .in("status", ["completed", "failed", "canceled"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (ruleKey) {
    // Convert d_plus_3 → d+3 etc.
    const tagFilter = Object.entries(TAG_TO_KEY).find(([, k]) => k === ruleKey)?.[0];
    if (tagFilter) query = query.eq("notes", tagFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items: AutomacaoHistoryItem[] = (data ?? []).map((row) => {
    const tag = row.notes as string;
    const patient = (row.patients as unknown) as { full_name: string } | null;
    return {
      id: row.id as string,
      ruleKey: TAG_TO_KEY[tag] ?? tag,
      ruleTitle: TAG_TO_TITLE[tag] ?? tag,
      patientName: patient?.full_name ?? "—",
      channel: "whatsapp",
      status: row.status === "completed" ? "sent" : row.status === "canceled" ? "skipped" : "failed",
      sentAt: row.updated_at as string,
    };
  });

  return NextResponse.json(items);
}
