"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_CLINIC_COOKIE } from "@/services/clinic-service";

export async function switchClinicAction(clinicId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
