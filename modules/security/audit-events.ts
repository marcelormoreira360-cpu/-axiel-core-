export const auditEvents = {
  patientCreated: "patient.created",
  patientViewed: "patient.viewed",
  patientUpdated: "patient.updated",
  patientArchived: "patient.archived",
  leadCreated: "lead.created",
  leadUpdated: "lead.updated",
  leadConverted: "lead.converted",
  appointmentCreated: "appointment.created",
  appointmentUpdated: "appointment.updated",
  sessionRecordSaved: "session_record.saved",
  intakeSubmitted: "intake.submitted",
  insightGenerated: "insight.generated",
  aiInsightGenerated: "ai_insight.generated",
  aiInsightReviewed: "ai_insight.reviewed",
  userInvited: "user.invited",
  userRoleChanged: "user.role_changed",
  subscriptionUpdated: "subscription.updated",
} as const;

export type AuditEvent = (typeof auditEvents)[keyof typeof auditEvents];
