export const SYSTEM_FALLBACK_MESSAGES = {
  ai: "AI insights are temporarily unavailable. The clinical record is still saved and can be reviewed manually.",
  communications: "Message delivery failed. The message was logged and can be retried from Messages.",
  billing: "Billing is temporarily unavailable. Your clinic data is safe and subscription status will sync when Stripe is available.",
  database: "Data could not be loaded right now. Please refresh or try again.",
} as const;

export function buildOperationalFallback(area: keyof typeof SYSTEM_FALLBACK_MESSAGES) {
  return {
    title: "Safe fallback active",
    message: SYSTEM_FALLBACK_MESSAGES[area],
  };
}
