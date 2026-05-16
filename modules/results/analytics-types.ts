export type ResultsMetricKey =
  | "revenue"
  | "sessions"
  | "new_patients"
  | "new_leads"
  | "conversion_rate"
  | "products_sold"
  | "active_memberships"
  | "pending_follow_ups";

export type ResultsMetric = {
  key: ResultsMetricKey;
  label: string;
  value: string;
  helper: string;
};

export type BusinessInsight = {
  title: string;
  message: string;
  actionLabel: string;
  tone: "calm" | "attention" | "positive";
};

export type ResultsAnalyticsSummary = {
  primaryMetrics: ResultsMetric[];
  secondaryMetrics: ResultsMetric[];
  businessInsights: BusinessInsight[];
};
