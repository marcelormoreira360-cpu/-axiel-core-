import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { Shell } from "@/components/shell";
import { InboxClient } from "@/components/inbox-client";
import type { InboxConversation } from "@/app/api/inbox/route";

async function getInboxData(clinicId: string): Promise<InboxConversation[]> {
  const admin = createSupabaseAdminClient();

  const { data: messages } = await admin
    .from("portal_messages")
    .select("id, patient_id, direction, body, read_at, created_at, patients(id, full_name)")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (!messages) return [];

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

    if (msg.direction === "patient_to_clinic" && !msg.read_at) {
      conv.unreadCount += 1;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let conversations: InboxConversation[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("clinic_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.clinic_id) {
      conversations = await getInboxData(profile.clinic_id);
    }
  }

  return (
    <Shell>
      <InboxClient initialConversations={conversations} />
    </Shell>
  );
}
