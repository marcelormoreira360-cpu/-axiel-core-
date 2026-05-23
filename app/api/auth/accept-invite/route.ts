import { NextRequest, NextResponse } from "next/server";
import { acceptInvite } from "@/services/team-service";

// Called right after signup when the user arrived from a team invite link.
// We accept the invite using the admin client (the session may not be fully
// propagated yet in the new tab).
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = (await request.json()) as { token?: string; userId?: string };

    if (!token || !userId) {
      return NextResponse.json({ error: "token and userId are required" }, { status: 400 });
    }

    await acceptInvite(token, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to accept invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
