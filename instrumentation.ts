import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.2,
      // HIPAA/LGPD: nunca anexar IP, cookies ou dados do usuário automaticamente.
      sendDefaultPii: false,
      // Remove PHI/PII antes de qualquer evento sair para o Sentry.
      beforeSend: (event) => scrubSentryEvent(event),
      beforeSendTransaction: (event) => scrubSentryEvent(event),
    });
  }
}

// Captures errors thrown in React Server Components and server actions
export const onRequestError = Sentry.captureRequestError;
