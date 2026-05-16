import type { BusinessInsight, ResultsMetric } from "@/modules/results/analytics-types";

function getNumericValue(metrics: ResultsMetric[], key: string) {
  const metric = metrics.find((item) => item.key === key);
  if (!metric) return 0;

  const normalized = metric.value.replace(/[^0-9.]/g, "");
  return Number(normalized || 0);
}

export function buildBusinessInsights(metrics: ResultsMetric[]): BusinessInsight[] {
  const pendingFollowUps = getNumericValue(metrics, "pending_follow_ups");
  const newLeads = getNumericValue(metrics, "new_leads");
  const productsSold = getNumericValue(metrics, "products_sold");

  const insights: BusinessInsight[] = [];

  if (pendingFollowUps > 0) {
    insights.push({
      title: "Follow-ups need attention",
      message: "Some follow-ups are still open. Reviewing them can help keep patients engaged.",
      actionLabel: "Review follow-ups",
      tone: "attention",
    });
  }

  if (newLeads > 0) {
    insights.push({
      title: "New leads are waiting",
      message: "You have new leads in the clinic flow. A simple contact can help move them forward.",
      actionLabel: "Review leads",
      tone: "calm",
    });
  }

  if (productsSold > 0) {
    insights.push({
      title: "Product Support is active",
      message: "Products are being used as part of patient support. Review inventory when possible.",
      actionLabel: "View products",
      tone: "positive",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Everything looks calm",
      message: "No urgent business item needs attention right now.",
      actionLabel: "View details",
      tone: "calm",
    });
  }

  return insights.slice(0, 5);
}
