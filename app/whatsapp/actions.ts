"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { setBotDisabled, linkEntityToConversation } from "@/services/whatsapp-conversation-service";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ── Toggle bot disabled for a conversation ─────────────────────────────────

export async function toggleBotAction(
  conversationId: string,
  currentlyDisabled: boolean,
): Promise<void> {
  const profile = await getCurrentUserProfile();
  const name = profile?.full_name ?? "Operador";
  await setBotDisabled(conversationId, !currentlyDisabled, name);
  revalidatePath("/whatsapp");
}

// ── Send manual reply ──────────────────────────────────────────────────────

export async function sendManualReplyAction(
  phone: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!message.trim()) return { ok: false, error: "Mensagem vazia." };
  try {
    await sendWhatsAppText(phone, message.trim());

    // Append to conversation history
    const supabase = createSupabaseAdminClient();
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages")
      .eq("phone", phone)
      .maybeSingle();

    if (conv) {
      const updated = [
        ...(conv.messages as { role: string; content: string }[]),
        { role: "assistant", content: `[MANUAL] ${message.trim()}` },
      ].slice(-20);
      await supabase
        .from("whatsapp_conversations")
        .update({ messages: updated, updated_at: new Date().toISOString() })
        .eq("id", conv.id);
    }

    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar." };
  }
}

// ── Link patient to conversation ───────────────────────────────────────────

export async function linkPatientAction(
  conversationId: string,
  patientId: string,
): Promise<void> {
  await linkEntityToConversation(conversationId, { patientId });
  revalidatePath("/whatsapp");
}
