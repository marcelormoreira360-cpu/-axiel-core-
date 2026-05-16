import { Card } from "@/components/card";

type UsageLimitCardProps = {
  label: string;
  used: number;
  limit: number | null;
};

export function UsageLimitCard({ label, used, limit }: UsageLimitCardProps) {
  const percentage = limit ? Math.min((used / limit) * 100, 100) : 18;

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm text-axiel-text-secondary">{label}</p>
        <p className="text-2xl font-semibold text-axiel-text-primary">
          {used}
          <span className="text-sm font-normal text-axiel-text-secondary">
            {limit === null ? " / Unlimited" : ` / ${limit}`}
          </span>
        </p>
      </div>

      <div className="h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-axiel-secondary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Card>
  );
}
