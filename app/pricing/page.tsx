import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Planos — AXIEL Core",
  description:
    "Infraestrutura premium com IA para clínicas integrativas e wellness. Planos a partir de R$ 147/mês.",
  openGraph: {
    title: "Planos — AXIEL Core",
    description:
      "Infraestrutura premium com IA para clínicas integrativas e wellness.",
    type: "website",
  },
};

export default function PricingPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return <PricingClient appUrl={appUrl} />;
}
