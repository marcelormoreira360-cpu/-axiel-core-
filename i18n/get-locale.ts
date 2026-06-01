import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

/**
 * Resolve o locale ativo na ordem:
 *   1. Cookie AXIEL_LOCALE (setado no login e pela troca de idioma; reflete users.preferred_locale)
 *   2. Header Accept-Language do navegador
 *   3. DEFAULT_LOCALE (pt-BR)
 *
 * Mantido barato de propósito (sem query ao banco) — é chamado a cada request
 * pelo getRequestConfig do next-intl.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

/** Deriva o locale a partir do header Accept-Language. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const primary = header.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("pt")) return "pt-BR";
  if (primary.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}
