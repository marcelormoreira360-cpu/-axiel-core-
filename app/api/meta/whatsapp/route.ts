import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { IFWC_DEFAULT_CONFIG } from "@/services/whatsapp-bot-service";
import type { PricingLocation } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

// ─── Meta message types ──────────────────────────────────────────────────────

type MetaTextMessage = { type: "text"; text: { body: string } };
type MetaAudioMessage = { type: "audio"; audio: { id: string; mime_type: string } };
type MetaMessage = (MetaTextMessage | MetaAudioMessage) & {
  from: string;
  id: string;
  timestamp: string;
};

type MetaWebhookBody = {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: MetaMessage[];
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  phone: string
): Promise<{
  id: string | null;
  messages: ChatMessage[];
  botDisabled: boolean;
  clinicId: string | null;
  currentStep: number;
}> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, clinic_id, current_step")
      .eq("phone", phone)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
      clinicId: data?.clinic_id ?? null,
      currentStep: data?.current_step ?? 1,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false, clinicId: null, currentStep: 1 };
  }
}

async function saveHistory(
  supabase: SupabaseAdmin,
  phone: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null,
  currentStep?: number
) {
  const payload: Record<string, unknown> = {
    phone,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
    ...(currentStep !== undefined && { current_step: currentStep }),
  };
  try {
    if (id) {
      // Row exists — UPDATE by ID (fastest, no conflict needed)
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update(payload)
        .eq("id", id);
      if (error) console.error("[whatsapp] saveHistory UPDATE error:", error.message);
    } else {
      // New row — UPSERT on phone (safe against concurrent first messages)
      if (clinicId) payload.clinic_id = clinicId;
      const { error } = await supabase
        .from("whatsapp_conversations")
        .upsert(payload, { onConflict: "phone" });
      if (error) console.error("[whatsapp] saveHistory UPSERT error:", error.message);
    }
  } catch (e) { console.error("[whatsapp] saveHistory exception:", e); }
}

async function autoCreateLead(
  supabase: SupabaseAdmin,
  phone: string,
  clinicId: string,
  name: string,
  firstMessage: string
) {
  try {
    const [{ count: patientCount }, { count: leadCount }] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
    ]);
    if ((patientCount ?? 0) > 0 || (leadCount ?? 0) > 0) return;

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: name || `WhatsApp ${phone.slice(-4)}`,
      phone,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via WhatsApp (Meta API).\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    console.error("auto-create lead (Meta) failed:", e);
  }
}

// ─── Send reply via Meta Graph API ───────────────────────────────────────────

async function sendMetaReply(to: string, body: string, phoneNumberId: string): Promise<void> {
  const token = process.env.META_WHATSAPP_TOKEN;
  if (!token) throw new Error("META_WHATSAPP_TOKEN not set");

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body, preview_url: false },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("Meta send error:", JSON.stringify(err));
    throw new Error(`Meta API error: ${res.status}`);
  }
}

// ─── Download audio from Meta and transcribe via Whisper ─────────────────────

async function transcribeMetaAudio(mediaId: string, apiKey: string): Promise<string> {
  const token = process.env.META_WHATSAPP_TOKEN;
  if (!token) return "";

  try {
    // 1. Get media URL from Meta
    const urlRes = await fetch(
      `https://graph.facebook.com/v20.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!urlRes.ok) return "";
    const { url: mediaUrl } = await urlRes.json();
    if (!mediaUrl) return "";

    // 2. Download the audio file
    const audioRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) return "";

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });

    // 3. Transcribe via OpenAI Whisper
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) return "";
    const data = await whisperRes.json();
    return data.text?.trim() ?? "";
  } catch (err) {
    console.error("Meta audio transcription error:", err);
    return "";
  }
}

// ─── City detection for step 4 ───────────────────────────────────────────────

function detectCity(text: string, locations: PricingLocation[]): PricingLocation {
  const lower = text.toLowerCase();
  const match = locations.find((l) =>
    lower.includes(l.city.toLowerCase().split(" ")[0].toLowerCase())
  );
  if (!match) {
    const usaKeywords = ["florida", "miami", "tampa", "usa", "eua", "estados unidos", "orlando", "us"];
    if (usaKeywords.some((k) => lower.includes(k))) {
      return locations[0]; // Orlando primeiro
    }
    return locations.find((l) => l.city.includes("São Paulo")) ?? locations[0];
  }
  return match;
}

// ─── Build pricing block for a location ──────────────────────────────────────

function buildPricingBlock(location: PricingLocation): string {
  const lines = location.plans.map(
    (p) =>
      `• ${p.name}: ${p.price}${p.recommended ? " ← recomendado" : ""} — ${p.description}`
  );
  return `*Investimento — ${location.city}:*\n${lines.join("\n")}`;
}

// ─── Fixed step templates ─────────────────────────────────────────────────────

function buildFixedReply(step: number, userText: string, config: typeof IFWC_DEFAULT_CONFIG): string {
  const { professional_name, locations } = config;

  switch (step) {
    case 1:
      return `Olá! Seja muito bem-vindo(a) 🙏 O atendimento do ${professional_name} é uma avaliação integrativa personalizada — não é uma sessão isolada. Analisa corpo, sistema nervoso, parte bioemocional e fatores funcionais.\nMe conta: qual é o principal motivo que te trouxe aqui agora?`;

    case 4: {
      const location = detectCity(userText, locations);
      const pricingBlock = buildPricingBlock(location);
      return `${pricingBlock}\n\nIsso inclui avaliação, sessão estendida, exames, relatórios e acompanhamento — não é sessão avulsa. O formato recomendado (←) é o mais indicado para a maioria dos casos.`;
    }

    case 5:
      return `Pelo que você me contou, esse formato é o mais indicado para o seu caso 😊 Para você seria melhor no período da manhã ou da tarde?`;

    case 6:
      return `Ótimo! Qual é o seu nome para eu reservar a data? 😊`;

    case 7:
      return `Perfeito! Vou passar seu contato para ${professional_name} confirmar o agendamento. Em breve entraremos em contato 🙏`;

    default:
      return "";
  }
}

// ─── AI reply helper ─────────────────────────────────────────────────────────

async function generateOpenAIReply(
  systemPrompt: string,
  userMessage: string,
  historyContext: ChatMessage[],
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyContext.slice(-2),
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 450,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenAI error (Meta webhook):", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Step 2 — qualification questions (OpenAI) ────────────────────────────────

async function generateStep2Reply(
  userMessage: string,
  config: typeof IFWC_DEFAULT_CONFIG,
  apiKey: string
): Promise<string> {
  const system = `Você é assistente de ${config.clinic_name}. Responda em português brasileiro, tom acolhedor, estilo WhatsApp, mensagens curtas. O paciente informou o motivo do contato. Sua tarefa: valide em 1 frase de empatia + faça as 4 perguntas juntas numa única mensagem numerada: (1) Há quanto tempo você sente isso? (2) Isso afeta mais dor, sono, ansiedade, energia, intestino, cansaço ou parte emocional? (3) Você já fez outros tratamentos antes? (4) O que você mais gostaria de melhorar nos próximos 60 dias? Não explique programa, não mostre valores.`;
  return generateOpenAIReply(system, userMessage, [], apiKey);
}

// ─── Step 3 — present program + ask city (OpenAI) ────────────────────────────

async function generateStep3Reply(
  userMessage: string,
  history: ChatMessage[],
  config: typeof IFWC_DEFAULT_CONFIG,
  apiKey: string
): Promise<string> {
  const cityList = config.locations.map((l) => l.city).join(", ");
  const system = `Você é assistente de ${config.clinic_name}. Tom acolhedor, estilo WhatsApp. O paciente respondeu as perguntas de qualificação. Sua tarefa: valide com empatia em 2-3 frases, depois explique o programa: ${config.methodology}. Termine perguntando: 'Você está em ${cityList} ou outra cidade?'`;
  return generateOpenAIReply(system, userMessage, history, apiKey);
}

// ─── Price objection guard ────────────────────────────────────────────────────

function isPriceQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return ["quanto custa", "qual o valor", "qual o preço", "preço", "valor", "custa"].some((k) =>
    lower.includes(k)
  );
}

function buildPriceObjectionReply(currentStep: number, config: typeof IFWC_DEFAULT_CONFIG): string {
  const nextQuestions: Record<number, string> = {
    1: "qual é o principal motivo que te trouxe aqui?",
    2: "quais sintomas você quer melhorar?",
    3: "você está em qual cidade?",
    5: "você prefere manhã ou tarde?",
    6: "qual é o seu nome?",
  };
  const nextQ = nextQuestions[currentStep] ?? "como posso te ajudar melhor?";
  return `Claro! O investimento varia conforme o formato e a cidade. Inclui avaliação, sessão estendida, exames, relatórios e acompanhamento de ${config.professional_name}. Para te passar os valores certos: ${nextQ}`;
}

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Meta webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("Meta webhook verification failed — token mismatch or missing params");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming WhatsApp messages ───────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log("[whatsapp] POST received");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp] OPENAI_API_KEY not set");
    return new NextResponse("", { status: 200 });
  }

  try {
    const rawBody = await req.text();
    console.log("[whatsapp] raw body length:", rawBody.length);

    // Validate Meta signature
    const signature = req.headers.get("x-hub-signature-256");
    if (!validateMetaSignature(signature, Buffer.from(rawBody))) {
      console.warn("[whatsapp] invalid signature — rejected. META_APP_SECRET set:", !!process.env.META_APP_SECRET);
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.log("[whatsapp] signature valid");

    const body: MetaWebhookBody = JSON.parse(rawBody);

    if (body.object !== "whatsapp_business_account") {
      return new NextResponse("", { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];

        for (const message of messages) {
          const fromPhone = message.from;
          const contactName = contacts.find((c) => c.wa_id === fromPhone)?.profile?.name ?? "";

          let incomingText = "";

          if (message.type === "text") {
            incomingText = (message as MetaTextMessage).text.body.trim();
          } else if (message.type === "audio") {
            const audioMsg = message as MetaAudioMessage;
            const transcribed = await transcribeMetaAudio(audioMsg.audio.id, apiKey);
            if (transcribed) {
              incomingText = transcribed;
            } else {
              await sendMetaReply(
                fromPhone,
                "Desculpe, não consegui processar o áudio. Pode digitar sua mensagem? 😊",
                phoneNumberId
              );
              continue;
            }
          } else {
            continue;
          }

          if (!incomingText) continue;

          const supabase = createSupabaseAdminClient();
          const clinicId = null; // TODO: look up clinic by Meta phone_number_id

          const {
            id: convId,
            messages: history,
            botDisabled,
            clinicId: convClinicId,
            currentStep,
          } = await getHistory(supabase, fromPhone);

          const effectiveClinicId = convClinicId ?? clinicId;
          const config = IFWC_DEFAULT_CONFIG;

          console.log("[whatsapp] db step:", currentStep, "for phone:", fromPhone.slice(-4));

          // Human takeover — save message, don't reply
          if (botDisabled) {
            await saveHistory(supabase, fromPhone, convId, [
              ...history,
              { role: "user", content: incomingText },
            ], effectiveClinicId);
            continue;
          }

          // Auto-create lead for new contacts
          if (effectiveClinicId && !convId) {
            void autoCreateLead(supabase, fromPhone, effectiveClinicId, contactName, incomingText);
          }

          // Reset command
          if (incomingText.toLowerCase().trim() === "reset") {
            await saveHistory(supabase, fromPhone, convId, [], effectiveClinicId, 1);
            await sendMetaReply(fromPhone, "Conversa reiniciada. 👋 Como posso ajudar?", phoneNumberId);
            console.log("[whatsapp] conversation reset for phone:", fromPhone.slice(-4));
            continue;
          }

          // Price objection — answer without advancing step
          if (currentStep !== 4 && isPriceQuestion(incomingText)) {
            const objectionReply = buildPriceObjectionReply(currentStep, config);
            const updatedMessages = [
              ...history,
              { role: "user" as const, content: incomingText },
              { role: "assistant" as const, content: objectionReply },
            ];
            await saveHistory(supabase, fromPhone, convId, updatedMessages, effectiveClinicId, currentStep);
            await sendMetaReply(fromPhone, objectionReply, phoneNumberId);
            console.log("[whatsapp] price objection handled at step:", currentStep);
            continue;
          }

          // ─── Step dispatch ───────────────────────────────────────────────
          let reply = "";
          let nextStep = currentStep;

          if (currentStep === 1) {
            // Fixed welcome template — no OpenAI
            reply = buildFixedReply(1, incomingText, config);
            nextStep = 2;
          } else if (currentStep === 2) {
            // OpenAI: empathy + 4 qualification questions
            reply = await generateStep2Reply(incomingText, config, apiKey);
            nextStep = 3;
          } else if (currentStep === 3) {
            // OpenAI: validate answers + present program + ask city
            reply = await generateStep3Reply(incomingText, history.slice(-2), config, apiKey);
            nextStep = 4;
          } else if (currentStep === 4) {
            // Fixed: show pricing for detected city
            reply = buildFixedReply(4, incomingText, config);
            nextStep = 5;
          } else if (currentStep === 5) {
            // Fixed: morning or afternoon?
            reply = buildFixedReply(5, incomingText, config);
            nextStep = 6;
          } else if (currentStep === 6) {
            // Fixed: ask name
            reply = buildFixedReply(6, incomingText, config);
            nextStep = 7;
          } else {
            // Step 7+: end of flow — confirm scheduling
            reply = buildFixedReply(7, incomingText, config);
            nextStep = 7; // stays at 7 (terminal)
          }

          const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

          // Save full exchange with new step
          await saveHistory(
            supabase,
            fromPhone,
            convId,
            [
              ...history,
              { role: "user", content: incomingText },
              { role: "assistant", content: finalReply },
            ],
            effectiveClinicId,
            nextStep
          );

          console.log("[whatsapp] sending reply at step:", currentStep, "→ next step:", nextStep);
          await sendMetaReply(fromPhone, finalReply, phoneNumberId);
          console.log("[whatsapp] reply sent successfully");
        }
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("[whatsapp] webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}
