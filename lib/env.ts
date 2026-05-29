/**
 * Centralised environment variable validation.
 * Fails fast at startup if any required variable is missing or malformed.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   env.SUPABASE_URL   // fully typed & guaranteed non-empty
 */
import { z } from "zod";

const serverEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),

  // Auth cron protection
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),

  // Email
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  // Accepts plain "email@domain.com" or display name format "Name <email@domain.com>"
  RESEND_FROM_EMAIL: z.string().min(1).optional(),

  // AI
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  // Stripe (optional in dev but required in production)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Twilio / WhatsApp (optional — feature flag)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // Sentry (optional)
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Zoom (optional)
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_WEBHOOK_SECRET: z.string().optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

function validateEnv(): ServerEnv {
  // Only validate on the server — browsers don't have access to server vars
  if (typeof window !== "undefined") {
    return process.env as unknown as ServerEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`\n\n❌ Invalid environment variables:\n${issues}\n`);
  }

  return result.data;
}

export const env = validateEnv();
