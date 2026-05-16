import { NextResponse } from "next/server";
import { z } from "zod";
import { sendCommunication } from "@/services/communication-service";
import { getCurrentUserProfile } from "@/services/user-service";

const payloadSchema = z.object({
  patient_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  follow_up_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  channel: z.enum(["email", "sms"]),
  use_case: z.enum(["appointment_reminder", "follow_up", "lead_nurturing"]),
  recipient: z.string().min(1),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
});

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Clinic required." }, { status: 403 });

  const payload = payloadSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

  try {
    const log = await sendCommunication({ clinic_id: profile.clinic_id, ...payload.data });
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Communication failed." }, { status: 500 });
  }
}
