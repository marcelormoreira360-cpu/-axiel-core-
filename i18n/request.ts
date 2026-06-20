import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "./get-locale";
import type { Locale } from "./locales";

// Namespaces de mensagens. Ao adicionar um novo módulo, criar o JSON em
// messages/<locale>/<namespace>.json e incluir o nome aqui.
const NAMESPACES = ["common", "nav", "dashboard", "auth", "onboarding", "patients", "patientProfile", "patientPanels", "patientEdit", "schedule", "session", "forms", "finance", "results", "reports", "analytics", "settings", "automations", "portal", "booking", "landing", "pricing", "publicForm", "join", "links", "teleconsulta", "legal", "professionals", "hotmart", "clinicChat", "actions", "admin", "insights", "intake", "referral", "publicRegister", "trends", "confirmBooking", "neuroId"] as const;

async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
