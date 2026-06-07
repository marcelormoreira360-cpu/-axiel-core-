export type AppRole =
  | "admin"
  | "platform_admin"
  | "platform_support"
  | "clinic_owner"
  | "clinic_manager"
  | "practitioner"
  | "front_desk"
  | "read_only_staff"
  | "staff";

export type ClinicProfile =
  | "integrativa"
  | "fisioterapia"
  | "saude_mental"
  | "nutricao"
  | "wellness";

export type Clinic = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  clinic_profile: ClinicProfile;
  logo_url: string | null;
  primary_color: string | null;
  // Contact & location (migration 024)
  phone: string | null;
  contact_email: string | null;
  website: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  cnpj: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type AppUser = {
  id: string;
  clinic_id: string | null;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type Patient = {
  id: string;
  clinic_id: string;
  created_by: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  date_of_birth: string | null;
  status: "active" | "inactive" | "archived";
  notes: string | null;
  chief_complaint: string | null;
  case_summary: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
  /** Populated only when fetched with appointments(practitioner_id) */
  appointments?: { practitioner_id: string | null }[] | null;
};

export type LeadSource = "website" | "instagram" | "facebook" | "google" | "referral" | "other";

export type LeadStage = "new_lead" | "contacted" | "scheduled" | "converted_to_patient";

export type Lead = {
  id: string;
  clinic_id: string;
  created_by: string | null;
  converted_patient_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  main_complaint: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};


export type AppointmentSource = "website" | "instagram" | "facebook" | "google" | "referral" | "direct" | "package" | "other";

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  created_by: string | null;
  practitioner_id: string | null;
  session_type_id: string | null;
  patient_offer_id: string | null;
  source: AppointmentSource | null;
  starts_at: string;
  duration_minutes: number;
  notes: string | null;
  video_url: string | null;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show" | null;
  zoom_meeting_id: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
  patients?: Pick<Patient, "id" | "full_name" | "email" | "phone" | "status"> | null;
  session_types?: Pick<SessionType, "id" | "name" | "duration_minutes" | "price_cents"> | null;
};

export type IntakeQuestionType = "short_text" | "long_text" | "number" | "date" | "yes_no" | "body_map";

export type IntakeForm = {
  id: string;
  clinic_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IntakeQuestion = {
  id: string;
  clinic_id: string;
  form_id: string;
  label: string;
  question_type: IntakeQuestionType;
  is_required: boolean;
  display_order: number;
  placeholder: string | null;
  created_at: string;
  updated_at: string;
};

export type IntakeResponse = {
  id: string;
  clinic_id: string;
  patient_id: string;
  form_id: string;
  question_id: string;
  answer: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  intake_questions?: Pick<IntakeQuestion, "id" | "label" | "question_type" | "display_order"> | null;
};

export type IntakeFormWithQuestions = IntakeForm & {
  intake_questions: IntakeQuestion[];
};

export type SessionVitals = {
  dor?: number | null;      // 1–5 (1=sem dor, 5=dor máxima)
  energia?: number | null;  // 1–5 (1=exausto, 5=cheio de energia)
  humor?: number | null;    // 1–5 (1=muito ruim, 5=excelente)
  sono?: number | null;     // 1–5 (1=péssimo, 5=ótimo)
};

// Teste clínico presencial registrado na sessão (Feature 3).
export type ClinicalTestResult = {
  name: string;
  result: string;
  notes?: string;
};

// Anotação em mapa anatômico na sessão (corpo/coluna/visceras).
export type BodyMapNote = {
  map: string;
  notes: string;
};

export type SessionRecord = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  created_by: string | null;
  notes: string | null;
  key_observations: string[];
  // SOAP fields
  soap_mode: boolean;
  subjective: string | null;
  objective: string | null;
  assessment_note: string | null;
  plan: string | null;
  // Patient-reported vitals
  vitals: SessionVitals | null;
  // Testes clínicos presenciais (Feature 3)
  clinical_tests: ClinicalTestResult[] | null;
  // Anotações em mapa anatômico
  body_map_notes: BodyMapNote[] | null;
  created_at: string;
  updated_at: string;
  appointments?: Pick<Appointment, "id" | "starts_at" | "duration_minutes" | "notes"> | null;
  patients?: Pick<Patient, "id" | "full_name" | "email" | "phone" | "status"> | null;
};



export type FollowUpStatus = "pending" | "completed" | "canceled";
export type FollowUpChannel = "none" | "email" | "sms" | "whatsapp";

export type FollowUp = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  created_by: string | null;
  title: string;
  due_at: string;
  status: FollowUpStatus;
  channel: FollowUpChannel;
  message_subject: string | null;
  message_body: string | null;
  notes: string | null;
  ai_suggested_timing: string | null;
  created_at: string;
  updated_at: string;
  patients?: Pick<Patient, "id" | "full_name" | "email" | "phone" | "status"> | null;
  appointments?: Pick<Appointment, "id" | "starts_at" | "duration_minutes" | "notes"> | null;
};

export type AiInsightOutput = {
  label: "AI-generated insights (not medical advice)";
  structured_summary: {
    overview: string;
    key_context: string[];
    current_status: string;
  };
  patterns_and_correlations: Array<{
    title: string;
    insight: string;
    related_inputs: string[];
  }>;
  practitioner_review_points: string[];
  data_limitations: string[];
  safety_note: string;
};

export type AiInsightReviewStatus = "pending_review" | "needs_changes" | "final" | "archived";

export type AiInsight = {
  id: string;
  clinic_id: string;
  patient_id: string;
  created_by: string | null;
  input_snapshot: Record<string, unknown>;
  output: AiInsightOutput;
  final_output: AiInsightOutput | null;
  status: "completed" | "error";
  review_status: AiInsightReviewStatus;
  approved_by: string | null;
  approved_at: string | null;
  reviewer_notes: string | null;
  changes_made: string | null;
  last_reviewed_by: string | null;
  last_reviewed_at: string | null;
  created_at: string;
};

export type MonetizationOfferType = "session_package" | "membership";
export type PatientOfferStatus = "active" | "completed" | "canceled";

export type MonetizationOffer = {
  id: string;
  clinic_id: string;
  created_by: string | null;
  name: string;
  offer_type: MonetizationOfferType;
  price_cents: number;
  currency: string;
  number_of_sessions: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PatientOffer = {
  id: string;
  clinic_id: string;
  patient_id: string;
  offer_id: string;
  created_by: string | null;
  status: PatientOfferStatus;
  sessions_total: number;
  sessions_used: number;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patients?: Pick<Patient, "id" | "full_name" | "email" | "phone" | "status"> | null;
  monetization_offers?: Pick<MonetizationOffer, "id" | "name" | "offer_type" | "price_cents" | "currency" | "number_of_sessions"> | null;
};

export type SessionType = {
  id: string;
  clinic_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  is_online: boolean;
  is_recorded: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = "pix" | "boleto" | "credit_card" | "debit_card" | "cash" | "transfer" | "insurance" | "other";

export type PatientPaymentStatus = "pending" | "paid" | "refunded" | "partially_refunded" | "failed";

export type PatientPayment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  patient_offer_id: string | null;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod | null;
  paid_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Stripe refund tracking (added in migration 046)
  stripe_payment_intent_id: string | null;
  status: PatientPaymentStatus;
  refunded_at: string | null;
  refund_amount_cents: number | null;
  // Conciliação manual (migration 054)
  proof_path: string | null;
  confirmed_at: string | null;
  // Pix via Asaas (migration 061)
  asaas_payment_id: string | null;
};

export type WorkingHour = {
  id: string;
  clinic_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
  created_at: string;
  updated_at: string;
};

export type ActionSuggestionStatus = "pending" | "accepted" | "ignored" | "completed";
export type ActionSuggestionPriority = "high" | "medium" | "low";
export type ActionSuggestionCategory = "patient" | "lead" | "schedule" | "follow_up" | "system";
export type ActionSuggestionEntityType = "patient" | "lead" | "appointment" | "follow_up" | "clinic" | null;

export type ActionSuggestion = {
  id: string;
  clinic_id: string;
  action_key: string;
  title: string;
  description: string | null;
  content_key: string | null;
  content_params: Record<string, string | number> | null;
  priority: ActionSuggestionPriority;
  category: ActionSuggestionCategory;
  status: ActionSuggestionStatus;
  source: "system_rule" | "ai_placeholder" | "manual";
  entity_type: ActionSuggestionEntityType;
  entity_id: string | null;
  suggested_url: string | null;
  reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  accepted_at: string | null;
  ignored_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};


export type CommunicationChannel = "email" | "sms";
export type CommunicationUseCase = "appointment_reminder" | "follow_up" | "lead_nurturing";
export type CommunicationLogStatus = "queued" | "sent" | "failed";

export type CommunicationTemplate = {
  id: string;
  clinic_id: string;
  key: string;
  name: string;
  channel: CommunicationChannel;
  use_case: CommunicationUseCase;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CommunicationLog = {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  lead_id: string | null;
  appointment_id: string | null;
  follow_up_id: string | null;
  template_id: string | null;
  created_by: string | null;
  channel: CommunicationChannel;
  use_case: CommunicationUseCase;
  recipient: string;
  subject: string | null;
  body: string;
  status: CommunicationLogStatus;
  provider: "resend" | "twilio" | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

// ── Assessment / Questionnaire module ─────────────────────────

export type QuestionType = 'scale' | 'yes_no' | 'text' | 'number' | 'single_choice';

// Faixa de interpretação de pontuação (grau de disfunção). max=null → sem limite superior.
export type ScoreBand = {
  min: number;
  max: number | null;
  label: string;
  color: string;
};

// Configuração de pontuação por template (Feature 1 — grau de disfunção configurável).
export type ScoringConfig = {
  total_bands: ScoreBand[];   // faixas sobre o total
  section_bands: ScoreBand[]; // faixas aplicadas à pontuação de cada seção
  flag_item_max: boolean;     // sinaliza itens que atingem a pontuação máxima
};

export type AssessmentTemplate = {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  scale_labels: string[] | null;
  scoring_config: ScoringConfig | null;
  is_active: boolean;
  send_on_first_appointment: boolean;
  reassessment_interval_days: number;
  created_at: string;
  updated_at: string;
};

export type AssessmentSection = {
  id: string;
  template_id: string;
  title: string;
  order_index: number;
};

export type AssessmentQuestion = {
  id: string;
  template_id: string;
  section_id: string | null;
  text: string;
  question_type: QuestionType;
  min_score: number;
  max_score: number;
  options: { label: string; value: number }[] | null;
  order_index: number;
  is_required: boolean;
};

export type AssessmentResponse = {
  id: string;
  template_id: string;
  patient_id: string;
  clinic_id: string;
  filled_at: string;
  total_score: number | null;
  max_possible_score: number | null;
  score_percentage: number | null;
  section_scores: Record<string, { title: string; score: number; max: number }> | null;
  notes: string | null;
  created_at: string;
  assessment_templates?: { name: string; scoring_config?: ScoringConfig | null } | null;
};

export type AssessmentAnswer = {
  id: string;
  response_id: string;
  question_id: string;
  section_id: string | null;
  value_number: number | null;
  value_text: string | null;
};

export type TemplateWithStructure = AssessmentTemplate & {
  assessment_sections: (AssessmentSection & {
    assessment_questions: AssessmentQuestion[];
  })[];
};
