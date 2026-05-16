import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DAILY_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const { appointmentId } = await req.json();

    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: `axiel-${appointmentId}-${Date.now()}`,
        properties: {
          enable_screenshare: true,
          enable_chat: false,
          start_video_off: false,
          start_audio_off: false,
          // Room expires 3 hours from now
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.info ?? `Daily.co error ${res.status}`);
    }

    const room = await res.json();
    return NextResponse.json({ url: room.url, name: room.name });
  } catch (err: unknown) {
    console.error("Create room error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar sala" },
      { status: 500 }
    );
  }
}
