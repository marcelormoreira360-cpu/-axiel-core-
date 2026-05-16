export const featureFlags = {
  aiInsights: "ai_insights",
  patientInsights: "patient_insights",
  followUpAutomation: "follow_up_automation",
  smsMessaging: "sms_messaging",
  emailMessaging: "email_messaging",
  customBranding: "custom_branding",
  billing: "billing",
  auditLogs: "audit_logs",
} as const;

export type FeatureFlagKey = (typeof featureFlags)[keyof typeof featureFlags];
