import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { Button } from "@/components/button";

export default function BillingSuccessPage() {
  return (
    <Shell>
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Billing updated</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your subscription is being activated</h1>
        <p className="mt-4 text-lg text-black/55">Stripe will confirm the subscription through a secure webhook. Your clinic access will update automatically.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/dashboard"><Button>Go to dashboard</Button></Link>
          <Link href="/billing"><Button variant="secondary">View billing</Button></Link>
        </div>
      </Card>
    </Shell>
  );
}
