import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export interface InboxConversation {
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: "clinic_to_patient" | "patient_to_clinic";
  unreadCount: number;        // unread patient→clinic (needs clinic action)
  totalMessages: number;
}

// GET /api/inbox — returns all conversations for the clinic, sorted by latest message
export async function GET() {
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

  const admin = createSupabaseAdminClient();

  // Get all messages for this clinic, join patient name
  const { data: messages } = await admin
    .from("portal_messages")
    .select("id, patient_id, direction, body, read_at, created_at, patients(id, full_name)")
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (!messages) return NextResponse.json({ conversations: [] });

  // Group by patient
  const map = new Map<string, InboxConversation>();

  for (const msg of messages) {
    const pid = msg.patient_id as string;
    const patient = (msg.patients as unknown) as { id: string; full_name: string } | null;

    if (!map.has(pid)) {
      map.set(pid, {
        patientId: pid,
        patientName: patient?.full_name ?? "—",
        lastMessage: (msg.body as string).slice(0, 100),
        lastMessageAt: msg.created_at as string,
        lastDirection: msg.direction as "clinic_to_patient" | "patient_to_clinic",
        unreadCount: 0,
        totalMessages: 0,
      });
    }

    const conv = map.get(pid)!;
    conv.totalMessages += 1;

    // Count unread patient→clinic messages (these need the clinic's attention)
    if (msg.direction === "patient_to_clinic" && !msg.read_at) {
      conv.unreadCount += 1;
    }
  }

  // Sort: conversations with unread first, then by latest message
  const conversations = [...map.values()].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return NextResponse.json({ conversations });
}
