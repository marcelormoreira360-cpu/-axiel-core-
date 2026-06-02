// Tradutor i18n standalone para contextos FORA do request (e-mails, PDFs,
// cron, webhooks). Não usa cookie nem getRequestConfig — carrega os JSON de
// mensagens diretamente para o locale informado e usa createTranslator do
// next-intl (versão não-hook, utilizável em qualquer lugar do servidor).

import { createTranslator } from "next-intl";
import { type Locale, DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { EmailT } from "@/components/email/base-email";

// Tipo de retorno do tradutor server-side. Reusa o tipo estrutural EmailT
// (callable + rich + markup) — vale tanto para o namespace "emails" quanto "pdf".
export type ServerT = EmailT;

// Namespaces usados por e-mails e PDFs.
const SERVER_NS = ["emails", "pdf"] as const;

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    SERVER_NS.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Retorna um translator escopado a um namespace, para o locale informado.
 * Uso: const t = await getServerT("pt-BR", "emails"); t("appointmentConfirmation.subject", { clinic })
 */
export async function getServerT(locale: string | null | undefined, namespace: string): Promise<ServerT> {
  const safe: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const messages = await loadMessages(safe);
  const t = createTranslator({ locale: safe, messages, namespace });
  // createTranslator infere as chaves do generic de `messages`; como carregamos
  // o JSON dinamicamente (Record<string, unknown>), as chaves ficam `never`.
  // Expomos o tipo estrutural ServerT (chaves string) para uso nos serviços.
  return t as unknown as ServerT;
}

/**
 * Resolve o "idioma da clínica" = preferred_locale do dono da clínica
 * (clinic_owner). Fallback para pt-BR. Usa admin client pois roda em
 * contextos sem sessão (cron/webhook).
 */
export async function resolveClinicLocale(clinicId: string | null | undefined): Promise<Locale> {
  if (!clinicId) return DEFAULT_LOCALE;
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("users")
      .select("preferred_locale, role")
      .eq("clinic_id", clinicId)
      .in("role", ["clinic_owner", "clinic_manager"])
      .order("role", { ascending: true }) // clinic_manager < clinic_owner alfabeticamente; ambos servem
      .limit(1)
      .maybeSingle();
    const loc = (data?.preferred_locale as string | null) ?? null;
    return isLocale(loc) ? loc : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
