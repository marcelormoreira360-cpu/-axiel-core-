import { cn } from "@/lib/utils";

export type BadgeStatus = "review" | "final";

const styles: Record<BadgeStatus, string> = {
  review: "bg-yellow-100 text-yellow-700",
  final: "bg-green-100 text-green-700",
};

const labels: Record<BadgeStatus, string> = {
  review: "In Review",
  final: "Final",
};

export function Badge({
  status,
  className,
}: {
  status: BadgeStatus;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs", styles[status], className)}>
      {labels[status]}
    </span>
  );
}

export type StatusBadgeTone = BadgeStatus | "neutral";

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusBadgeTone;
  className?: string;
}) {
  if (tone === "review" || tone === "final") {
    return <Badge status={tone} className={className} />;
  }

  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600", className)}>
      {label}
    </span>
  );
}
