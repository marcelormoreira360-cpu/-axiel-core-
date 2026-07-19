import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAvailableSlots, createPublicBooking } from "@/services/appointment-service";
import { wallClockToUTC } from "@/lib/booking-utils";
import { createLogger } from "@/lib/logger";

const log = createLogger("vapi");

export const runtime = "nodejs";

// Clínica e tipo de sessão fixos do canal de voz (Clara agenda para a IFWC).
const SLUG = "ifwc";
const SESSION_TYPE_ID = "7faeebdf-ceed-4b51-8919-f951bc2f98d3";

// Comparação de segredo em tempo constante (evita timing attack); igual tamanho
// não é garantido, então caímos para o retorno false quando os buffers diferem.
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// O Vapi pode mandar arguments como objeto ou como string JSON: parse defensivo.
function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

type ToolCall = { id: string; function: { name: string; arguments: unknown } };

function collectToolCalls(body: unknown): ToolCall[] {
  const message = (body as { message?: Record<string, unknown> } | null)?.message ?? {};
  const list =
    (message.toolCallList as unknown[] | undefined)
    ?? (message.toolCalls as unknown[] | undefined)
    ?? [];
  const calls: ToolCall[] = [];
  for (const raw of list) {
    const item = raw as { id?: string; function?: { name?: string; arguments?: unknown } };
    if (!item?.function?.name) continue;
    calls.push({
      id: String(item.id ?? ""),
      function: { name: item.function.name, arguments: item.function.arguments },
    });
  }
  return calls;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Normaliza time para "HH:MM" 24h. Aceita "14:00", "09:30", "2 PM", "2:30 pm".
function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = Number(h24[1]);
    const m = Number(h24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return null;
  }
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2] ? Number(ampm[2]) : 0;
    const isPm = /p/i.test(ampm[3]);
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (isPm && h !== 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

// Rótulo falado 12h a partir de um ISO UTC, no fuso da clínica (ex.: "2:00 PM").
function speakTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone,
  });
}

// Rótulo falado de data + hora (ex.: "Monday, July 21 at 2:00 PM").
function speakDateTime(iso: string, timezone: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone });
  return `${dateStr} at ${timeStr}`;
}

async function handleCheckAvailability(args: Record<string, unknown>): Promise<string> {
  const date = typeof args.date === "string" ? args.date.trim() : "";
  if (!YMD.test(date)) {
    return "I need the date in YYYY-MM-DD format (for example 2026-07-21). Which day would you like to check?";
  }

  const result = await getAvailableSlots({ slug: SLUG, date, sessionTypeId: SESSION_TYPE_ID });
  if (!result.ok) {
    return "I couldn't check the schedule right now. Please try again in a moment.";
  }
  if (result.slots.length === 0) {
    return `I don't have any open times on ${date}. Would you like to try another day?`;
  }

  const labels = result.slots.slice(0, 8).map((s) => speakTime(s.iso, result.timezone));
  return `For ${date} I have: ${labels.join(", ")}. Which one works for you?`;
}

async function handleBookAppointment(args: Record<string, unknown>): Promise<string> {
  const fullName = typeof args.full_name === "string" ? args.full_name.trim() : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const email = typeof args.email === "string" && args.email.trim() ? args.email.trim() : null;
  const date = typeof args.date === "string" ? args.date.trim() : "";
  const rawTime = typeof args.time === "string" ? args.time.trim() : "";

  const missing: string[] = [];
  if (!fullName) missing.push("your full name");
  if (!phone) missing.push("a phone number");
  if (!date) missing.push("the date");
  if (!rawTime) missing.push("the time");
  if (missing.length > 0) {
    return `I still need ${missing.join(", ")} to book the appointment. Could you share that?`;
  }

  if (!YMD.test(date)) {
    return "I need the date in YYYY-MM-DD format (for example 2026-07-21). What day should I book?";
  }

  const time = normalizeTime(rawTime);
  if (!time) {
    return "I couldn't read that time. Please give it in HH:MM 24-hour format (for example 14:00).";
  }

  // Confirma que o horário escolhido é de fato um slot livre. Isso barra reservas
  // no passado, fora do expediente ou em dia fechado (o site nunca oferece esses,
  // mas a voz poderia pedir), reusa o MESMO timezone que gerou os slots (sem
  // divergência de fuso) e evita um segundo lookup de clínica.
  const avail = await getAvailableSlots({ slug: SLUG, date, sessionTypeId: SESSION_TYPE_ID });
  if (!avail.ok) {
    return "I couldn't reach the schedule right now. Please try again in a moment.";
  }

  const startsAt = wallClockToUTC(date, time, avail.timezone).toISOString();
  const isFreeSlot = avail.slots.some((s) => s.iso === startsAt);
  if (!isFreeSlot) {
    if (avail.slots.length === 0) {
      return `I don't have any open times on ${date}. Would you like to try another day?`;
    }
    const labels = avail.slots.slice(0, 8).map((s) => speakTime(s.iso, avail.timezone));
    return `That time isn't available. For ${date} I have: ${labels.join(", ")}. Which one works for you?`;
  }

  const result = await createPublicBooking({
    slug: SLUG,
    session_type_id: SESSION_TYPE_ID,
    starts_at: startsAt,
    full_name: fullName,
    phone,
    email,
    source: "direct",
  });

  if (!result.ok) {
    if (result.code === "SLOT_TAKEN") {
      return "That time was just taken. Would you like me to check other openings so we can pick a new time?";
    }
    return "I'm sorry, I couldn't complete the booking right now. Please try again in a moment.";
  }

  return `You're booked for ${speakDateTime(startsAt, avail.timezone)}. You'll get a confirmation by message. See you then!`;
}

async function runTool(call: ToolCall): Promise<string> {
  const args = parseArgs(call.function.arguments);
  try {
    switch (call.function.name) {
      case "check_availability":
        return await handleCheckAvailability(args);
      case "book_appointment":
        return await handleBookAppointment(args);
      default:
        return `Unknown tool "${call.function.name}".`;
    }
  } catch (e) {
    log.error("Vapi tool failed", e as Error, { tool: call.function.name });
    return "Something went wrong on my side. Please try again in a moment.";
  }
}

// POST /api/vapi — webhook de tools do Vapi (auth por x-vapi-secret; sem sessão)
export async function POST(req: NextRequest) {
  const expected = process.env.VAPI_TOOL_SECRET;
  const provided = req.headers.get("x-vapi-secret");
  if (!expected || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const calls = collectToolCalls(body);

  const results = await Promise.all(
    calls.map(async (call) => ({ toolCallId: call.id, result: await runTool(call) })),
  );

  return NextResponse.json({ results });
}
