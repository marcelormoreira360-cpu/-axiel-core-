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

// Derives the current step from the number of assistant messages already sent.
// 0 bot replies → step 1 (welcome)
// 1 → step 2 (qualification questions)
// 2 → step 3 (present program + ask city)
// 3 → step 4 (show prices)
// 4 → step 5 (morning/afternoon?)
// 5 → step 6 (ask name)
// 6 → step 7 (confirm + scheduling link)
// 7+ → step 8 (terminal — already confirmed, short reply)
function stepFromHistory(messages: ChatMessage[]): number {
  const botCount = messages.filter((m) => m.role === "assistant").length;
  if (botCount >= 7) return 8;
  return botCount + 1;
}

async function getHistory(
  supabase: SupabaseAdmin,
  phone: string
): Promise<{
  id: string | null;
  messages: ChatMessage[];
  botDisabled: boolean;
  clinicId: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") {
      console.error("[whatsapp] getHistory error:", error.code, error.message);
    }
    const msgs = (data?.messages as ChatMessage[]) ?? [];
    console.log("[whatsapp] getHistory: id=", data?.id ?? "null", "msgs=", msgs.length, "phone=", phone.slice(-4));
    return {
      id: data?.id ?? null,
      messages: msgs,
      botDisabled: false,
      clinicId: null,
    };
  } catch (e) {
    console.error("[whatsapp] getHistory exception:", e);
    return { id: null, messages: [], botDisabled: false, clinicId: null };
  }
}

async function saveHistory(
  supabase: SupabaseAdmin,
  phone: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null
) {
  const payload: Record<string, unknown> = {
    phone,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      // Row exists — UPDATE by ID
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

// ─── Language detection ───────────────────────────────────────────────────────

type Lang = "pt" | "en";

function detectLanguage(messages: ChatMessage[], currentMessage: string): Lang {
  // Use the very first user message (stable — doesn't change mid-conversation)
  const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? currentMessage;
  const lower = firstUserMsg.toLowerCase();

  const enWords = [
    "hello", "hi ", "hey ", "good morning", "good afternoon", "good evening",
    " i ", "i'm", "i have", "i've", "i feel", "i've been", "i am",
    "what", "how ", "my ", "the ", " is ", " are ", " can ", " do ", "please",
    "thank", "help", "looking", "want", "need", "would", "pain", "feel",
    "years", "months", "ago", "treatment", "appointment", "schedule", "book",
    "cost", "price", "available", "when ", "where ", "who ", "anxiety",
    "fatigue", "sleep", "energy", "doctor", "clinic", "health",
  ];
  const ptWords = [
    "olá", "oi ", "bom dia", "boa tarde", "boa noite", "tudo bem",
    "quero", "preciso", "tenho", "estou", "sinto", "dor", "anos", "meses",
    "tratamento", "ajuda", "quanto", "valor", "preço", "agendar", "como ",
    " que ", "meu ", "minha ", "você", "não ", "sim ", "também", "sempre",
    "desde", "muito", "pouco", "porque", "então", "assim",
  ];

  const enScore = enWords.filter((w) => lower.includes(w)).length;
  const ptScore = ptWords.filter((w) => lower.includes(w)).length;

  return enScore > ptScore ? "en" : "pt";
}

// ─── City detection for step 4 ───────────────────────────────────────────────

function detectCity(text: string, locations: PricingLocation[], lang: Lang): PricingLocation {
  const lower = text.toLowerCase();
  const match = locations.find((l) =>
    lower.includes(l.city.toLowerCase().split(" ")[0].toLowerCase())
  );
  if (!match) {
    const usaKeywords =
      lang === "en"
        ? ["florida", "miami", "tampa", "usa", "united states", "orlando", "america", "us ", "u.s"]
        : ["florida", "miami", "tampa", "usa", "eua", "estados unidos", "orlando"];
    if (usaKeywords.some((k) => lower.includes(k))) {
      return locations[0]; // Orlando first
    }
    // English speakers default to Orlando; PT defaults to São Paulo
    if (lang === "en") return locations[0];
    return locations.find((l) => l.city.includes("São Paulo")) ?? locations[0];
  }
  return match;
}

// ─── Build pricing block for a location ──────────────────────────────────────

function buildPricingBlock(location: PricingLocation, lang: Lang): string {
  const label = lang === "en" ? "Investment" : "Investimento";
  const recLabel = lang === "en" ? " ← recommended" : " ← recomendado";
  const lines = location.plans.map(
    (p) => `• ${p.name}: ${p.price}${p.recommended ? recLabel : ""} — ${p.description}`
  );
  return `*${label} — ${location.city}:*\n${lines.join("\n")}`;
}

// ─── Fixed step templates ─────────────────────────────────────────────────────

function buildFixedReply(
  step: number,
  userText: string,
  config: typeof IFWC_DEFAULT_CONFIG,
  lang: Lang
): string {
  const { professional_name, locations } = config;

  if (lang === "en") {
    switch (step) {
      case 1:
        return `Hello! Welcome 🙏 ${professional_name}'s service is a personalized integrative evaluation — not a standalone session. It analyzes the body, nervous system, bioemotional factors, and functional health.\nTell me: what's the main reason you're reaching out today?`;

      case 4: {
        const location = detectCity(userText, locations, lang);
        const pricingBlock = buildPricingBlock(location, lang);
        return `${pricingBlock}\n\nThis includes a full evaluation, extended session, exams, reports, and follow-up care — not a one-time session. The recommended option (←) is best suited for most cases.`;
      }

      case 5:
        return `Based on what you've shared, this format is the most suitable for your case 😊 Would you prefer a morning or afternoon appointment?`;

      case 6:
        return `Great! What's your name so I can reserve your spot? 😊`;

      case 7:
        return `Perfect! I'll forward your contact to ${professional_name} 🙏\n\nIf you'd like to secure your date, you can book directly here:\n👉 https://axiel-core-6ikl.vercel.app/book/ifwc\n\nWe'll be in touch soon to confirm 😊`;

      case 8:
        return `Your contact has already been sent to ${professional_name} 🙏 They'll be in touch soon. If you need anything else, just let me know!`;

      default:
        return "";
    }
  }

  // PT-BR templates
  switch (step) {
    case 1:
      return `Olá! Seja muito bem-vindo(a) 🙏 O atendimento do ${professional_name} é uma avaliação integrativa personalizada — não é uma sessão isolada. Analisa corpo, sistema nervoso, parte bioemocional e fatores funcionais.\nMe conta: qual é o principal motivo que te trouxe aqui agora?`;

    case 4: {
      const location = detectCity(userText, locations, lang);
      const pricingBlock = buildPricingBlock(location, lang);
      return `${pricingBlock}\n\nIsso inclui avaliação, sessão estendida, exames, relatórios e acompanhamento — não é sessão avulsa. O formato recomendado (←) é o mais indicado para a maioria dos casos.`;
    }

    case 5:
      return `Pelo que você me contou, esse formato é o mais indicado para o seu caso 😊 Para você seria melhor no período da manhã ou da tarde?`;

    case 6:
      return `Ótimo! Qual é o seu nome para eu reservar a data? 😊`;

    case 7:
      return `Perfeito! Vou passar seu contato para ${professional_name} 🙏\n\nSe quiser já garantir sua data, você pode agendar diretamente por aqui:\n👉 https://axiel-core-6ikl.vercel.app/book/ifwc\n\nEm breve entraremos em contato para confirmar 😊`;

    case 8:
      return `Seu contato já foi enviado ao ${professional_name} 🙏 Em breve ele entra em contato. Se precisar de algo mais, é só avisar!`;

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
  apiKey: string,
  lang: Lang
): Promise<string> {
  const system =
    lang === "en"
      ? `You are an assistant for ${config.clinic_name}. Respond in English, warm and professional tone, WhatsApp style, short messages. The patient shared their reason for contact. Your task: validate with 1 empathetic sentence + ask 4 questions together in a single numbered message: (1) How long have you been experiencing this? (2) Does this mainly affect pain, sleep, anxiety, energy, digestion, fatigue, or your emotional state? (3) Have you tried other treatments before? (4) What would you most like to improve in the next 60 days? Do not explain the program, do not show prices.`
      : `Você é assistente de ${config.clinic_name}. Responda em português brasileiro, tom acolhedor, estilo WhatsApp, mensagens curtas. O paciente informou o motivo do contato. Sua tarefa: valide em 1 frase de empatia + faça as 4 perguntas juntas numa única mensagem numerada: (1) Há quanto tempo você sente isso? (2) Isso afeta mais dor, sono, ansiedade, energia, intestino, cansaço ou parte emocional? (3) Você já fez outros tratamentos antes? (4) O que você mais gostaria de melhorar nos próximos 60 dias? Não explique programa, não mostre valores.`;
  return generateOpenAIReply(system, userMessage, [], apiKey);
}

// ─── Step 3 — present program + ask city (OpenAI) ────────────────────────────

async function generateStep3Reply(
  userMessage: string,
  history: ChatMessage[],
  config: typeof IFWC_DEFAULT_CONFIG,
  apiKey: string,
  lang: Lang
): Promise<string> {
  const cityList = config.locations.map((l) => l.city).join(", ");
  const system =
    lang === "en"
      ? `You are an assistant for ${config.clinic_name}. Warm, professional tone, WhatsApp style. The patient answered the qualification questions. Your task: validate with empathy in 2-3 sentences, then explain the program: ${config.methodology}. End by asking: 'Are you in ${cityList} or another city?'`
      : `Você é assistente de ${config.clinic_name}. Tom acolhedor, estilo WhatsApp. O paciente respondeu as perguntas de qualificação. Sua tarefa: valide com empatia em 2-3 frases, depois explique o programa: ${config.methodology}. Termine perguntando: 'Você está em ${cityList} ou outra cidade?'`;
  return generateOpenAIReply(system, userMessage, history, apiKey);
}

// ─── Price objection guard ────────────────────────────────────────────────────

function isPriceQuestion(text: string, lang: Lang): boolean {
  const lower = text.toLowerCase();
  if (lang === "en") {
    return ["how much", "what's the cost", "what is the cost", "the price", "pricing", "cost?", "fees", "fee?", "rates", "charges"].some((k) => lower.includes(k));
  }
  return ["quanto custa", "qual o valor", "qual o preço", "preço", "valor", "custa"].some((k) =>
    lower.includes(k)
  );
}

function buildPriceObjectionReply(currentStep: number, config: typeof IFWC_DEFAULT_CONFIG, lang: Lang): string {
  if (lang === "en") {
    const nextQuestions: Record<number, string> = {
      1: "what's the main reason you're reaching out?",
      2: "which symptoms are you hoping to improve?",
      3: "which city are you in?",
      5: "do you prefer mornings or afternoons?",
      6: "what's your name?",
    };
    const nextQ = nextQuestions[currentStep] ?? "how can I best help you?";
    return `Sure! The investment varies based on format and location. It includes a full evaluation, extended session, exams, reports, and follow-up with ${config.professional_name}. To give you the right numbers: ${nextQ}`;
  }
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
              // Peek at history to choose language for the fallback message
              const supabasePeek = createSupabaseAdminClient();
              const { messages: peekHistory } = await getHistory(supabasePeek, fromPhone);
              const peekLang = detectLanguage(peekHistory, "");
              const audioFallback =
                peekLang === "en"
                  ? "Sorry, I couldn't process the audio. Could you type your message? 😊"
                  : "Desculpe, não consegui processar o áudio. Pode digitar sua mensagem? 😊";
              await sendMetaReply(fromPhone, audioFallback, phoneNumberId);
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
          } = await getHistory(supabase, fromPhone);

          const effectiveClinicId = convClinicId ?? clinicId;
          const config = IFWC_DEFAULT_CONFIG;

          // Step derived from message history — never depends on DB column
          const currentStep = stepFromHistory(history);

          // Language — detected from first user message and stable for the whole conversation
          const lang: Lang = detectLanguage(history, incomingText);

          console.log("[whatsapp] step:", currentStep, "| lang:", lang, "| bot msgs:", history.filter(m => m.role === "assistant").length, "| phone:", fromPhone.slice(-4));

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

          // Reset command (accept both languages)
          const resetTrigger = incomingText.toLowerCase().trim();
          if (resetTrigger === "reset" || resetTrigger === "reiniciar") {
            await saveHistory(supabase, fromPhone, convId, [], effectiveClinicId);
            const resetMsg = lang === "en" ? "Conversation reset. 👋 How can I help you?" : "Conversa reiniciada. 👋 Como posso ajudar?";
            await sendMetaReply(fromPhone, resetMsg, phoneNumberId);
            console.log("[whatsapp] conversation reset for phone:", fromPhone.slice(-4));
            continue;
          }

          // Price objection — answer without advancing step
          if (currentStep !== 4 && isPriceQuestion(incomingText, lang)) {
            const objectionReply = buildPriceObjectionReply(currentStep, config, lang);
            const updatedMessages = [
              ...history,
              { role: "user" as const, content: incomingText },
              { role: "assistant" as const, content: objectionReply },
            ];
            await saveHistory(supabase, fromPhone, convId, updatedMessages, effectiveClinicId);
            await sendMetaReply(fromPhone, objectionReply, phoneNumberId);
            continue;
          }

          // ─── Step dispatch ───────────────────────────────────────────────
          let reply = "";
          let nextStep = currentStep;

          if (currentStep === 1) {
            // Fixed welcome template — no OpenAI
            reply = buildFixedReply(1, incomingText, config, lang);
            nextStep = 2;
          } else if (currentStep === 2) {
            // OpenAI: empathy + 4 qualification questions
            reply = await generateStep2Reply(incomingText, config, apiKey, lang);
            nextStep = 3;
          } else if (currentStep === 3) {
            // OpenAI: validate answers + present program + ask city
            reply = await generateStep3Reply(incomingText, history.slice(-2), config, apiKey, lang);
            nextStep = 4;
          } else if (currentStep === 4) {
            // Fixed: show pricing for detected city
            reply = buildFixedReply(4, incomingText, config, lang);
            nextStep = 5;
          } else if (currentStep === 5) {
            // Fixed: morning or afternoon?
            reply = buildFixedReply(5, incomingText, config, lang);
            nextStep = 6;
          } else if (currentStep === 6) {
            // Fixed: ask name
            reply = buildFixedReply(6, incomingText, config, lang);
            nextStep = 7;
          } else if (currentStep === 7) {
            // Fixed: confirm + scheduling link
            reply = buildFixedReply(7, incomingText, config, lang);
            nextStep = 8;
          } else {
            // Step 8+: terminal — already confirmed, short reply
            reply = buildFixedReply(8, incomingText, config, lang);
            nextStep = 8; // stays at 8
          }

          const finalReply = reply || (lang === "en"
            ? "Hello! I received your message. We'll be in touch soon. 😊"
            : "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊");

          // Single save: messages only (step is derived from history, no column needed)
          const updatedHistory = [
            ...history,
            { role: "user" as const, content: incomingText },
            { role: "assistant" as const, content: finalReply },
          ];
          await saveHistory(supabase, fromPhone, convId, updatedHistory, effectiveClinicId);

          console.log("[whatsapp] saved step:", currentStep, "→ next:", nextStep, "| total bot msgs now:", updatedHistory.filter(m => m.role === "assistant").length);
          await sendMetaReply(fromPhone, finalReply, phoneNumberId);
          console.log("[whatsapp] reply sent ok");
        }
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("[whatsapp] webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}
