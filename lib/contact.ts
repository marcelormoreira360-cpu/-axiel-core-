/**
 * Contato público da IFWC — fonte ÚNICA usada tanto na tela de resultado do
 * formulário público (`components/public-assessment-form.tsx`) quanto no e-mail
 * de resultado do MSQ (`services/msq-result-email-service.ts`).
 *
 * ⚠️ Sem import de `env` — este arquivo é seguro para Client e Server Components.
 * Se o site/telefone mudar, altere AQUI (a tela e o e-mail acompanham juntos).
 */

/** Nome completo da clínica (bloco de contato do e-mail de resultado). */
export const CONTACT_CLINIC_NAME = "Integrative & Functional Wellness Center";

/** Telefone em dígitos (para link tel:). A copy exibe o número formatado. */
export const CONTACT_PHONE_DIGITS = "6892803705";

/** Número formatado exibido ao respondente. */
export const CONTACT_PHONE_DISPLAY = "(689) 280-3705";

/** Site público de contato. */
export const CONTACT_SITE_URL = "https://jifwc.com";

/** Rótulo do site (sem protocolo) para exibição. */
export const CONTACT_SITE_LABEL = "jifwc.com";
