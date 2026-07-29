import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  // HIPAA/LGPD: nunca anexar IP/cookies do usuário automaticamente.
  sendDefaultPii: false,
  integrations: [
    // maskAllText/blockAllMedia: o Session Replay não grava textos nem mídia
    // (campos de formulário com nome/e-mail/telefone ficam mascarados na tela).
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  // Remove PHI/PII antes de qualquer evento sair para o Sentry.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});

// Tracks client-side navigation between routes
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
