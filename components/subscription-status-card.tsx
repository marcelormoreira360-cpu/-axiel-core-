import { Card } from "@/components/card";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";

type SubscriptionStatusCardProps = {
  planName: string;
  status: string;
  trialEndsAt?: string | null;
};

export function SubscriptionStatusCard({
  planName,
  status,
  trialEndsAt,
}: SubscriptionStatusCardProps) {
  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm text-axiel-text-secondary">Current plan</p>
        <h2 className="mt-1 text-2xl font-semibold text-axiel-text-primary">{planName}</h2>
        <p className="mt-2 text-sm text-axiel-text-secondary">
          Status: <span className="capitalize text-axiel-text-primary">{status}</span>
        </p>
        {trialEndsAt ? (
          <p className="mt-1 text-sm text-axiel-text-secondary">Trial ends: {trialEndsAt}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <ButtonPrimary>Manage plan</ButtonPrimary>
        <ButtonSecondary>View usage</ButtonSecondary>
      </div>
    </Card>
  );
}
