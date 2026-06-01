"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

/**
 * Troca o idioma da interface: grava o cookie AXIEL_LOCALE e, se houver usuário
 * logado, persiste em users.preferred_locale (fonte da verdade entre dispositivos).
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({ preferred_locale: locale }).eq("id", user.id);
    }
  } catch {
    // Persistência no banco é best-effort; o cookie já garante a troca imediata.
  }

  revalidatePath("/", "layout");
}
