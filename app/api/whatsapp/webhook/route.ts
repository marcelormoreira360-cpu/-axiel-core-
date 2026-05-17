import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWhatsAppText, sendWhatsAppMedia } from "@/services/whatsapp-service";

// Twilio sends webhook as application/x-www-form-urlencoded
async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => { obj[k] = v; });
  return obj;
}

async function buildPatientContext(patientId: string, supabase: any) {
  const [
    { data: patient },
    { data: exams },
    { data: prescriptions },
    { data: sessions },
    { data: assessments },
  ] = await Promise.all([
    supabase.from("patients").select("full_name, date_of_birth, notes").eq("id", patientId).single(),
    supabase.from("patient_exams").select("*, exam_results(*)").eq("patient_id", patientId).order("exam_date", { ascending: false }).limit(3),
    supabase.from("patient_prescriptions").select("*").eq("patient_id", patientId).eq("is_active", true),
    supabase.from("session_records").select("notes, key_observations, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("assessment_responses").select("*, assessment_templates(name), total_score, max_possible_score, score_percentage").eq("patient_id", patientId).order("filled_at", { ascending: false }).limit(2),
  ]);

  const age = patient?.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

  const meds = (prescriptions ?? []).filter((p: any) => p.type === "medication")
    .map((p: any) => `${p.name} ${p.dosage ?? ""}`).join(", ") || "Nenhum";
  const supps = (prescriptions ?? []).filter((p: any) => p.type === "supplement")
    .map((p: any) => `${p.name} ${p.dosage ?? ""}`).join(", ") || "Nenhum";

  const examsSummary = (exams ?? []).map((e: any) => {
    const results = (e.exam_results ?? []).map((r: any) =>
      `${r.biomarker}: ${r.value}${r.unit ?? ""} (${r.status})`
    ).join(", ");
    return `${e.exam_date}: ${results}`;
  }).join(" | ") || "Sem exames";

  const sessionsSummary = (sessions ?? []).map((s: any) =>
    `[${new Date(s.created_at).toLocaleDateString("pt-BR")}] ${s.notes ?? ""}`
  ).join(" | ") || "Sem sessões";

  return {
    name: patient?.full_name ?? "Paciente",
    age,
    meds,
    supps,
    examsSummary,
    sessionsSummary,
  };
}

async function generateAIReply(
  incomingMessage: string,
  ctx: Awaited<ReturnType<typeof buildPatientContext>>,
  replyWithVoice: boolean,
  apiKey: string
): Promise<string> {
  const systemPrompt = `Você é um assistente de saúde integrativa da clínica AXIEL.
Responda ao paciente de forma acolhedora, clara e em português brasileiro.
Não faça diagnósticos nem prescrições. Limite respostas a 3 frases curtas para WhatsApp.
Se a pergunta for clínica complexa, oriente o paciente a falar com o profissional na próxima sessão.`;

  const userPrompt = `Paciente: ${ctx.name}${ctx.age ? `, ${ctx.age} anos` : ""}
Medicamentos ativos: ${ctx.meds}
Suplementos ativos: ${ctx.supps}
Últimos exames: ${ctx.examsSummary}
Últimas sessões: ${ctx.sessionsSummary}

Mensagem recebida: "${incomingMessage}"

Responda de forma breve e acolhedora.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 200,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "Olá! Recebi sua mensagem. Em breve seu profissional de saúde entrará em contato.";
}

async function generateVoiceReply(text: string, patientId: string, apiKey: string, supabase: any): Promise<string | null> {
  try {
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "tts-1", input: text, voice: "nova", response_format: "mp3" }),
    });

    if (!ttsRes.ok) return null;

    const audioBuffer = await ttsRes.arrayBuffer();
    const fileName = `whatsapp-replies/${patientId}-${Date.now()}.mp3`;

    const { error } = await supabase.storage
      .from("media")
      .upload(fileName, Buffer.from(audioBuffer), { contentType: "audio/mpeg", upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from("media").getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 }); // Always 200 to Twilio

  try {
    const body = await parseBody(req);
    const fromNumber = body["From"]?.replace("whatsapp:", "") ?? "";
    const incomingMessage = body["Body"] ?? "";
    const mediaType = body["MediaContentType0"] ?? "";

    if (!fromNumber || !incomingMessage) return new NextResponse("", { status: 200 });

    const supabase = await createSupabaseServerClient();

    // Find patient by phone number
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("phone", fromNumber)
      .maybeSingle();

    // Detect if patient is asking for voice reply
    const wantsVoice = /voz|áudio|audio|falar|ouv/i.test(incomingMessage);

    let replyText: string;

    if (!patient) {
      replyText = "Olá! Não encontrei seu cadastro em nossa clínica. Por favor, entre em contato diretamente com a recepção. 🌿";
    } else {
      const ctx = await buildPatientContext(patient.id, supabase);
      replyText = await generateAIReply(incomingMessage, ctx, wantsVoice, apiKey);

      // Log the interaction (non-blocking, table may not exist yet)
      void supabase.from("whatsapp_interactions").insert({
        patient_id: patient.id,
        direction: "inbound",
        message: incomingMessage,
        reply: replyText,
        media_type: mediaType || null,
      }).then(null, () => {});
    }

    const toNumber = fromNumber;

    if (patient && wantsVoice) {
      const voiceUrl = await generateVoiceReply(replyText, patient.id, apiKey, supabase);
      if (voiceUrl) {
        await sendWhatsAppMedia(toNumber, replyText, voiceUrl);
        return new NextResponse("", { status: 200 });
      }
    }

    await sendWhatsAppText(toNumber, replyText);
    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return new NextResponse("", { status: 200 }); // Always 200 to Twilio
  }
}

// Twilio verifies the webhook with GET on some configurations
export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
