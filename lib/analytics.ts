// Helpers de analytics (PostHog via window.posthog — sem dependência npm).
// Seguros em qualquer contexto: viram no-op no servidor ou quando o PostHog
// não está carregado (NEXT_PUBLIC_POSTHOG_KEY ausente).

type PostHogClient = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

/** Registra um evento de produto. No-op se o PostHog não estiver ativo. */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.posthog?.capture(event, props);
}

/** Associa os eventos ao usuário logado. No-op se o PostHog não estiver ativo. */
export function identify(userId: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.posthog?.identify(userId, props);
}
