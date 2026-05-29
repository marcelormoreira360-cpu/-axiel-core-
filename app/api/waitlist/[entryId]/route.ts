import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/services/user-service";
import { removeFromWaitlist } from "@/services/waitlist-service";

export const runtime = "nodejs";

// DELETE /api/waitlist/[entryId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { entryId } = await params;
  await removeFromWaitlist(entryId);
  return NextResponse.json({ ok: true });
}
