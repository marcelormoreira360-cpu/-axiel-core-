/**
 * Application-wide constants derived from validated environment variables.
 *
 * Import from here instead of reading process.env directly in services/routes.
 * This ensures:
 *   1. A single fallback value per constant (no diverging defaults)
 *   2. Type safety — env is validated by lib/env.ts at startup
 *   3. Easy to grep/audit all usages
 *
 * ⚠️  Server-only — do not import in Client Components.
 */

import { env } from "@/lib/env";

/** The "from" address used for all transactional emails sent via Resend. */
export const DEFAULT_FROM_EMAIL: string = env.RESEND_FROM_EMAIL ?? "no-reply@axielcore.com";

/** Root URL of the application (e.g. https://axiel-core-6ikl.vercel.app). No trailing slash. */
export const APP_URL: string = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

/** VAPID subject used for Web Push notifications. */
export const VAPID_SUBJECT: string =
  process.env.VAPID_SUBJECT ?? "mailto:suporte@axielcore.com";
