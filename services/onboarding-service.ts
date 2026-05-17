import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { LeadSource } from "@/lib/types";
import { createAppointment } from "@/services/appointment-service";
import { createIntakeFormWithQuestions } from "@/services/intake-service";
import { createLead } from "@/services/lead-service";
import { createPatient } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";

export type ClinicProfile =
  | "integrativa"
  | "fisioterapia"
  | "saude_mental"
  | "nutricao"
  | "wellness";

export type GuidedOnboardingInput = {
  clinicName: string;
  clinicSlug: string;
  timezone: string;
  hoursPreset: string;
  clinicProfile: ClinicProfile | string;
  staffEmail: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `clinica-${Date.now()}`;
}

export function normalizeClinicSlug(value: string, fallback: string) {
  return slugify(value || fallback);
}

function getSessionTypes(profile: string) {
  switch (profile) {
    case "fisioterapia":
      return [
        { name: "Avaliação fisioterapêutica", duration_minutes: 60 },
        { name: "Sessão de fisioterapia", duration_minutes: 45 },
        { name: "Retorno", duration_minutes: 30 },
      ];
    case "saude_mental":
      return [
        { name: "Consulta inicial", duration_minutes: 60 },
        { name: "Sessão terapêutica", duration_minutes: 50 },
        { name: "Sessão de acompanhamento", duration_minutes: 45 },
      ];
    case "nutricao":
      return [
        { name: "Consulta nutricional inicial", duration_minutes: 60 },
        { name: "Retorno nutricional", duration_minutes: 45 },
        { name: "Consulta rápida", duration_minutes: 30 },
      ];
    case "wellness":
      return [
        { name: "Sessão de bem-estar", duration_minutes: 90 },
        { name: "Acompanhamento", duration_minutes: 60 },
        { name: "Check-in", duration_minutes: 30 },
      ];
    default: // integrativa
      return [
        { name: "Consulta integrativa inicial", duration_minutes: 90 },
        { name: "Sessão de acompanhamento", duration_minutes: 60 },
        { name: "Retorno", duration_minutes: 45 },
      ];
  }
}

function getIntakeQuestions(profile: string) {
  switch (profile) {
    case "fisioterapia":
      return [
        "Qual é a sua principal queixa ou motivo da consulta?",
        "Há quanto tempo sente essa dor ou limitação?",
        "Já realizou algum tratamento anteriormente? Se sim, qual?",
        "Tem algum exame de imagem recente (raio-x, ressonância)?",
        "Alguma informação importante que o terapeuta deve saber?",
      ];
    case "saude_mental":
      return [
        "O que te trouxe até aqui hoje?",
        "Como está se sentindo nas últimas semanas?",
        "Está passando por alguma situação específica de estresse ou dificuldade?",
        "Já fez acompanhamento psicológico ou psiquiátrico anteriormente?",
        "Há algo que gostaria que eu soubesse antes da nossa conversa?",
      ];
    case "nutricao":
      return [
        "Qual é o seu principal objetivo com o acompanhamento nutricional?",
        "Tem alguma restrição alimentar, intolerância ou alergia?",
        "Como você descreveria seus hábitos alimentares atuais?",
        "Pratica alguma atividade física? Se sim, qual e com que frequência?",
        "Faz uso de algum suplemento ou medicamento?",
      ];
    case "wellness":
      return [
        "O que te motivou a buscar um cuidado de bem-estar?",
        "Como está sua qualidade de sono, energia e disposição?",
        "Tem algum objetivo específico de saúde ou qualidade de vida?",
        "Alguma informação relevante sobre sua saúde geral?",
      ];
    default: // integrativa
      return [
        "Qual é o seu principal motivo de consulta?",
        "Quais sintomas ou questões são mais importantes no momento?",
        "O que você gostaria de melhorar na sua saúde e qualidade de vida?",
        "Tem feito uso de algum medicamento ou suplemento?",
        "Alguma informação importante que o terapeuta deve saber antes da sessão?",
      ];
  }
}

function getWorkingHours(preset: string) {
  const rows = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    opens_at: "09:00",
    closes_at: "17:00",
    is_open: [1, 2, 3, 4, 5].includes(day),
  }));

  if (preset === "extended") {
    return rows.map((row) => ({
      ...row,
      opens_at: "08:00",
      closes_at: row.day_of_week === 5 ? "16:00" : "18:00",
    }));
  }

  if (preset === "flexible") {
    return rows.map((row) => ({
      ...row,
      is_open: [1, 2, 3, 4, 5, 6].includes(row.day_of_week),
      closes_at: row.day_of_week === 6 ? "13:00" : "17:00",
    }));
  }

  return rows;
}

function getSamplePatientName(profile: string) {
  return "Paciente Demonstração";
}

function getIntakeFormName(profile: string) {
  switch (profile) {
    case "fisioterapia": return "Anamnese Fisioterapêutica";
    case "saude_mental": return "Formulário de Acolhimento";
    case "nutricao": return "Anamnese Nutricional";
    case "wellness": return "Formulário de Bem-estar";
    default: return "Anamnese Integrativa";
  }
}

export async function completeGuidedOnboarding(input: GuidedOnboardingInput) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentUserProfile();

  if (!profile) throw new Error("Você precisa estar autenticado para concluir o onboarding.");

  const clinicName = input.clinicName.trim() || "Minha Clínica";
  const clinicSlug = normalizeClinicSlug(input.clinicSlug, clinicName);
  const clinicProfile = input.clinicProfile || "integrativa";
  const sessionTypes = getSessionTypes(clinicProfile);
  const intakeQuestions = getIntakeQuestions(clinicProfile);
  const workingHours = getWorkingHours(input.hoursPreset);

  let clinicId = profile.clinic_id;

  if (!clinicId) {
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({ name: clinicName, slug: clinicSlug, status: "active", clinic_profile: clinicProfile })
      .select("*")
      .single();

    if (clinicError) throw clinicError;
    clinicId = clinic.id;

    const { error: profileError } = await supabase
      .from("users")
      .update({ clinic_id: clinicId, role: "clinic_owner", full_name: profile.full_name || "Proprietário" })
      .eq("id", profile.id);

    if (profileError) throw profileError;
  } else {
    // Update profile on existing clinic
    await supabase
      .from("clinics")
      .update({ clinic_profile: clinicProfile })
      .eq("id", clinicId);
  }

  const { error: settingsError } = await supabase.from("clinic_settings").upsert({
    clinic_id: clinicId!,
    display_name: clinicName,
    timezone: input.timezone || "America/Sao_Paulo",
    settings: {
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      clinic_profile: clinicProfile,
      hours_preset: input.hoursPreset,
    },
  }, { onConflict: "clinic_id" });

  if (settingsError) throw settingsError;

  const { error: clinicUserError } = await supabase.from("clinic_users").upsert({
    clinic_id: clinicId!,
    user_id: profile.id,
    role: "clinic_owner",
    status: "active",
  }, { onConflict: "clinic_id,user_id" });

  if (clinicUserError) throw clinicUserError;

  const sessionRows = sessionTypes.map((item) => ({
    clinic_id: clinicId!,
    name: item.name,
    duration_minutes: item.duration_minutes,
    is_active: true,
  }));

  if (sessionRows.length) {
    await supabase.from("session_types").upsert(sessionRows, { onConflict: "clinic_id,name" });
  }

  const hourRows = workingHours.map((item) => ({
    clinic_id: clinicId!,
    day_of_week: item.day_of_week,
    opens_at: item.opens_at,
    closes_at: item.closes_at,
    is_open: item.is_open,
  }));

  await supabase.from("working_hours").upsert(hourRows, { onConflict: "clinic_id,day_of_week" });

  await createIntakeFormWithQuestions({
    clinic_id: clinicId!,
    name: getIntakeFormName(clinicProfile),
    description: "Formulário de anamnese criado automaticamente no onboarding.",
    questions: intakeQuestions.map((question) => ({
      label: question,
      question_type: "long_text",
      is_required: false,
    })),
  });

  if (input.staffEmail.trim()) {
    await supabase.from("invites").insert({
      clinic_id: clinicId!,
      email: input.staffEmail.trim().toLowerCase(),
      role: "front_desk",
      token_hash: randomUUID(),
      invited_by: profile.id,
      status: "pending",
    });
  }

  const patient = await createPatient({
    clinic_id: clinicId!,
    full_name: getSamplePatientName(clinicProfile),
    email: "paciente-demo@exemplo.com",
    phone: "(11) 99999-0000",
    notes: "Paciente de demonstração criado automaticamente para você explorar o sistema.",
  });

  await createLead({
    clinic_id: clinicId!,
    full_name: "Lead Demonstração",
    email: "lead-demo@exemplo.com",
    phone: "(11) 99999-0001",
    source: "instagram" as LeadSource,
    stage: "new_lead",
    main_complaint: "Interesse em iniciar tratamento",
    notes: "Lead de demonstração criado automaticamente durante o onboarding.",
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  await createAppointment({
    clinic_id: clinicId!,
    patient_id: patient.id,
    starts_at: tomorrow.toISOString(),
    duration_minutes: sessionTypes[0]?.duration_minutes || 60,
    notes: "Sessão de demonstração criada durante o onboarding.",
  });

  return { clinicId };
}
