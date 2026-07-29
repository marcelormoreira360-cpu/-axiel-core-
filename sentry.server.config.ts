import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
  // HIPAA/LGPD: nunca anexar IP, cookies ou dados do usuário automaticamente.
  sendDefaultPii: false,
  // Remove PHI/PII (e-mail, telefone, nome, IDs de paciente em URLs, respostas)
  // antes de qualquer evento sair para o Sentry.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
