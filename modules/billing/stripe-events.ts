export const STRIPE_EVENTS = {
  checkoutCompleted: "checkout.session.completed",
  subscriptionCreated: "customer.subscription.created",
  subscriptionUpdated: "customer.subscription.updated",
  subscriptionDeleted: "customer.subscription.deleted",
  invoicePaid: "invoice.paid",
  invoicePaymentFailed: "invoice.payment_failed",
} as const;

export type StripeBillingEvent = (typeof STRIPE_EVENTS)[keyof typeof STRIPE_EVENTS];

export function mapStripeStatusToAxiel(status: string) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  return "incomplete";
}
