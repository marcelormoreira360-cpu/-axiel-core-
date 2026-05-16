import { NextResponse } from "next/server";
import { stripe, getAppUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  const clinic = await getCurrentClinic();
  if (!clinic) return NextResponse.redirect(`${getAppUrl()}/onboarding`);

  const supabase = await createSupabaseServerClient();
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("external_customer_id")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (error || !subscription?.external_customer_id) {
    return NextResponse.redirect(`${getAppUrl()}/billing`);
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.external_customer_id,
    return_url: `${getAppUrl()}/billing`,
  });

  return NextResponse.redirect(portalSession.url, 303);
}
