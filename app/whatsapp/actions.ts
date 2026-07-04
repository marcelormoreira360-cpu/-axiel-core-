"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { pauseAi, resumeAi, linkEntityToConversation } from "@/services/whatsapp-conversation-service";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ── Passagem de bastão: pausar IA / devolver para a Clara ──────────────────

export async function pauseAiAction(conversationId: string): Promise<void> {
  const profile = await getCurrentUserProfile();
  const name = profile?.full_name ?? "Operador";
  await pauseAi(conversationId, name);
  revalidatePath("/whatsapp");
}

export async function resumeAiAction(conversationId: string): Promise<void> {
  await resumeAi(conversationId);
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
      // Passagem de bastão: registra a resposta humana. Com isso o bot
      // conversacional fica em silêncio nesta conversa por 24h (lib/whatsapp-handoff).
      await supabase
        .from("whatsapp_conversations")
        .update({
          messages: updated,
          last_human_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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
