// Locales suportados pelo app. Adicionar um novo idioma = incluir aqui +
// criar a pasta messages/<locale>/ espelhando os namespaces existentes.

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

// Cookie usado em áreas públicas (booking, portal) e como fast-path do locale.
// Para usuário logado, a fonte da verdade é users.preferred_locale (sincronizado
// no cookie pela Server Action setLocale).
export const LOCALE_COOKIE = "AXIEL_LOCALE";

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
