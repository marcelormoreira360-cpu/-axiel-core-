import { randomUUID } from "node:crypto";
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
        "A dor é constante ou aparece em determinados movimentos ou posições?",
        "Já realizou algum tratamento anteriormente? Se sim, qual foi o resultado?",
        "Tem algum exame de imagem recente (raio-x, ressonância, ultrassom)?",
        "Pratica alguma atividade física? Qual e com que frequência?",
        "Tem histórico de cirurgias, fraturas ou lesões relevantes?",
        "Alguma informação importante que o terapeuta deve saber?",
      ];
    case "saude_mental":
      return [
        "O que te trouxe até aqui hoje?",
        "Como está se sentindo nas últimas semanas?",
        "Está passando por alguma situação específica de estresse ou dificuldade?",
        "Como está sua qualidade de sono?",
        "Tem sentido impacto nas atividades do dia a dia, trabalho ou relacionamentos?",
        "Já fez acompanhamento psicológico ou psiquiátrico anteriormente?",
        "Faz uso de algum medicamento prescrito por psiquiatra ou clínico?",
        "Há algo que gostaria que eu soubesse antes da nossa conversa?",
      ];
    case "nutricao":
      return [
        "Qual é o seu principal objetivo com o acompanhamento nutricional?",
        "Tem alguma restrição alimentar, intolerância ou alergia diagnosticada?",
        "Como você descreveria seus hábitos alimentares atuais?",
        "Quantas refeições faz por dia e em quais horários?",
        "Pratica alguma atividade física? Se sim, qual e com que frequência?",
        "Tem histórico de alguma condição relacionada à alimentação (diabetes, dislipidemia, etc.)?",
        "Faz uso de algum suplemento ou medicamento?",
        "Como está sua digestão, trânsito intestinal e hidratação?",
      ];
    case "wellness":
      return [
        "O que te motivou a buscar um cuidado de bem-estar agora?",
        "Como está sua qualidade de sono, energia e disposição no dia a dia?",
        "Qual é o seu nível de estresse atualmente (baixo, moderado, alto)?",
        "Tem algum objetivo específico de saúde ou qualidade de vida?",
        "Pratica alguma atividade física ou prática de movimento?",
        "Como está sua alimentação e hidratação em geral?",
        "Alguma condição de saúde relevante que deva ser considerada?",
      ];
    default: // integrativa
      return [
        "Qual é o seu principal motivo de consulta?",
        "Quais sintomas ou questões são mais importantes no momento?",
        "Há quanto tempo está experienciando esses sintomas?",
        "Já realizou outros tratamentos ou acompanhamentos? Se sim, quais?",
        "O que você gostaria de melhorar na sua saúde e qualidade de vida?",
        "Como está seu sono, energia e nível de estresse?",
        "Tem feito uso de algum medicamento, fitoterápico ou suplemento?",
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

function getSamplePatientData(profile: string): { full_name: string; notes: string } {
  switch (profile) {
    case "fisioterapia":
      return {
        full_name: "Ana Figueiredo (Demo)",
        notes: "Paciente de demonstração. Dor lombar crônica há 6 meses, piora com posição sentada prolongada. Trabalha em home office.",
      };
    case "saude_mental":
      return {
        full_name: "Lucas Mendes (Demo)",
        notes: "Paciente de demonstração. Relata ansiedade generalizada e dificuldade de concentração. Busca ferramentas de autorregulação emocional.",
      };
    case "nutricao":
      return {
        full_name: "Carla Torres (Demo)",
        notes: "Paciente de demonstração. Objetivo de reeducação alimentar e perda de peso moderada. Intolerante à lactose.",
      };
    case "wellness":
      return {
        full_name: "Rafael Costa (Demo)",
        notes: "Paciente de demonstração. Busca melhorar qualidade de sono e energia. Pratica caminhada 3x por semana.",
      };
    default: // integrativa
      return {
        full_name: "Marina Alves (Demo)",
        notes: "Paciente de demonstração. Queixas de fadiga crônica, insônia e estresse. Interesse em abordagem integrativa para melhorar qualidade de vida.",
      };
  }
}

function getSampleLeadComplaint(profile: string): string {
  switch (profile) {
    case "fisioterapia": return "Dor nas costas e interesse em tratamento fisioterapêutico";
    case "saude_mental": return "Interesse em psicoterapia para ansiedade e bem-estar emocional";
    case "nutricao": return "Quer orientação nutricional para emagrecimento saudável";
    case "wellness": return "Busca programa de bem-estar e qualidade de vida";
    default: return "Interesse em consulta integrativa e cuidados de saúde";
  }
}

function getDemoSessionNotes(profile: string): string {
  switch (profile) {
    case "fisioterapia":
      return "Paciente relata dor lombar (EVA 6/10) com irradiação para glúteo direito. Testes de SLR e FABER positivos à direita. Realizada avaliação postural — hiperlordose lombar e anteriorização do quadril. Conduta: mobilização articular L4-L5, ativação do core e alongamento de psoas. Paciente tolerou bem os exercícios. Evoluindo com exercícios para próxima sessão.";
    case "saude_mental":
      return "Paciente relata semana com nível de ansiedade moderado (6/10). Identificados gatilhos: reuniões de trabalho e incerteza sobre carreira. Trabalhamos técnica de respiração diafragmática e reestruturação cognitiva de pensamentos automáticos catastróficos. Paciente demonstrou boa adesão. Para a próxima sessão: registrar pensamentos automáticos no diário proposto.";
    case "nutricao":
      return "Paciente apresentou registro alimentar da semana. Identificado padrão de beliscadas noturnas relacionado a estresse. Calculado TDEE: 1.950 kcal. Proposto plano com déficit de 300 kcal, priorizando proteínas (1,8g/kg). Orientada sobre importância da hidratação. Paciente motivada. Retorno em 15 dias para ajuste do plano.";
    case "wellness":
      return "Paciente relata melhora parcial do sono após as orientações de higiene do sono (dorme ~6h, meta 7-8h). Ainda com dificuldade de desligar à noite. Trabalhamos rotina pré-sono e técnica de relaxamento progressivo. Medimos biometria: FC repouso 68 bpm. Próximo passo: adicionar prática de 10 min de meditação guiada antes de dormir.";
    default: // integrativa
      return "Paciente relata fadiga persistente (7/10) e insônia de manutenção. Revimos hábitos de sono e identificamos uso excessivo de tela antes de dormir. Realizada análise de biomarcadores: ferritina baixa (18 ng/mL), vitamina D insuficiente. Solicitados exames complementares. Orientações sobre higiene do sono e suplementação a avaliar com resultado dos exames. Próxima sessão: revisar resultados e iniciar protocolo de suporte adrenal.";
  }
}

function getDemoObservations(profile: string): string[] {
  switch (profile) {
    case "fisioterapia":
      return ["Dor lombar EVA 6/10 com irradiação glútea direita", "SLR e FABER positivos à direita", "Hiperlordose lombar identificada na avaliação postural"];
    case "saude_mental":
      return ["Nível de ansiedade 6/10 esta semana", "Gatilhos: reuniões de trabalho e incerteza profissional", "Boa adesão à técnica de respiração diafragmática"];
    case "nutricao":
      return ["Padrão de beliscadas noturnas — gatilho: estresse", "TDEE calculado: 1.950 kcal", "Intolerância à lactose confirmada — substituições orientadas"];
    case "wellness":
      return ["Sono: 6h/noite, meta 7-8h", "FC repouso: 68 bpm", "Dificuldade de desligar à noite — padrão identificado"];
    default:
      return ["Fadiga persistente 7/10", "Ferritina baixa: 18 ng/mL — exames solicitados", "Insônia de manutenção — higiene do sono iniciada"];
  }
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
  // Use admin client for all setup writes — the user has no clinic yet so RLS
  // policies on clinic_settings, clinic_users, session_types etc. would block
  // a server-session client (chicken-and-egg problem on first insert).
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = createSupabaseAdminClient();
  const profile = await getCurrentUserProfile();

  if (!profile) throw new Error("Você precisa estar autenticado para concluir o onboarding.");

  const clinicName = input.clinicName.trim() || "Minha Clínica";
  const clinicSlug = normalizeClinicSlug(input.clinicSlug, clinicName);
  const clinicProfile = input.clinicProfile || "integrativa";
  const sessionTypes = getSessionTypes(clinicProfile);
  const intakeQuestions = getIntakeQuestions(clinicProfile);
  const workingHours = getWorkingHours(input.hoursPreset);

  let clinicId = profile.clinic_id;
  let createdNewClinic = false;

  if (!clinicId) {
    // Try to find a clinic already owned by this user (handles partial-failure re-runs).
    // We look in clinic_users first — safer than slug matching which could hit another clinic.
    const { data: existingMembership } = await supabase
      .from("clinic_users")
      .select("clinic_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existingMembership?.clinic_id) {
      clinicId = existingMembership.clinic_id;
    } else {
      const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .insert({ name: clinicName, slug: clinicSlug, status: "active", clinic_profile: clinicProfile })
        .select("*")
        .single();

      if (clinicError) throw new Error(clinicError.message ?? JSON.stringify(clinicError));
      clinicId = clinic.id;
      createdNewClinic = true;
    }

    // Always ensure the user profile is linked (idempotent)
    const { error: profileError } = await supabase
      .from("users")
      .update({ clinic_id: clinicId, role: "clinic_owner", full_name: profile.full_name || "Proprietário" })
      .eq("id", profile.id);

    if (profileError) throw new Error(profileError.message ?? JSON.stringify(profileError));
  } else {
    // Update profile on existing clinic
    await supabase
      .from("clinics")
      .update({ clinic_profile: clinicProfile })
      .eq("id", clinicId);
  }

  // Programa de indicação: se a clínica acabou de nascer e há cookie AXIEL_REF
  // (capturado pelo middleware em /auth/signup?ref=CODIGO), vincula a clínica
  // indicadora + registra a conversão. Falha de referral NUNCA quebra o signup.
  if (createdNewClinic && clinicId) {
    try {
      const { cookies } = await import("next/headers");
      const { REFERRAL_COOKIE, resolveReferralCode, recordReferralSignup } = await import("@/services/referral-service");
      const refCode = (await cookies()).get(REFERRAL_COOKIE)?.value;
      if (refCode) {
        const referrerClinicId = await resolveReferralCode(refCode);
        if (referrerClinicId && referrerClinicId !== clinicId) {
          await supabase
            .from("clinics")
            .update({ referred_by_clinic_id: referrerClinicId })
            .eq("id", clinicId);
          await recordReferralSignup(referrerClinicId, clinicId);
        }
      }
    } catch { /* referral é best-effort — nunca bloqueia o onboarding */ }
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

  if (settingsError) throw new Error(settingsError.message ?? JSON.stringify(settingsError));

  const { error: clinicUserError } = await supabase.from("clinic_users").upsert({
    clinic_id: clinicId!,
    user_id: profile.id,
    role: "clinic_owner",
    status: "active",
  }, { onConflict: "clinic_id,user_id" });

  if (clinicUserError) throw new Error(clinicUserError.message ?? JSON.stringify(clinicUserError));

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

  // Non-critical: create intake form — swallow errors (e.g. duplicate name on re-run)
  try {
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
  } catch { /* already exists or non-critical */ }

  // Non-critical: invite staff member
  if (input.staffEmail.trim()) {
    try {
      await supabase.from("invites").insert({
        clinic_id: clinicId!,
        email: input.staffEmail.trim().toLowerCase(),
        role: "front_desk",
        token_hash: randomUUID(),
        invited_by: profile.id,
        status: "pending",
      });
    } catch { /* already invited */ }
  }

  // Non-critical: demo patient, lead and appointment — swallow errors so a
  // re-run (unique constraint on email) never blocks the onboarding from completing.
  const demoPatient = getSamplePatientData(clinicProfile);
  let demoPatientId: string | null = null;
  let demoAppointmentId: string | null = null;

  try {
    const patient = await createPatient({
      clinic_id: clinicId!,
      full_name: demoPatient.full_name,
      email: "paciente-demo@exemplo.com",
      phone: "(11) 99999-0000",
      notes: demoPatient.notes,
    });
    demoPatientId = patient.id;
  } catch { /* duplicate on re-run — ignore */ }

  try {
    await createLead({
      clinic_id: clinicId!,
      full_name: "Maria Oliveira (Demo)",
      email: "lead-demo@exemplo.com",
      phone: "(11) 99999-0001",
      source: "instagram" as LeadSource,
      stage: "new_lead",
      main_complaint: getSampleLeadComplaint(clinicProfile),
      notes: "Lead de demonstração criado automaticamente durante o onboarding.",
    });
  } catch { /* duplicate on re-run — ignore */ }

  if (demoPatientId) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 3);
    yesterday.setHours(10, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    tomorrow.setHours(10, 0, 0, 0);

    // Past session (for demo session record + insight)
    try {
      const pastAppt = await createAppointment({
        clinic_id:        clinicId!,
        patient_id:       demoPatientId,
        starts_at:        yesterday.toISOString(),
        duration_minutes: sessionTypes[0]?.duration_minutes || 60,
        notes:            "Sessão de demonstração — veja como funciona o registro de evolução.",
      });
      demoAppointmentId = pastAppt.id;
    } catch { /* ignore */ }

    // Upcoming session
    try {
      await createAppointment({
        clinic_id:        clinicId!,
        patient_id:       demoPatientId,
        starts_at:        tomorrow.toISOString(),
        duration_minutes: sessionTypes[0]?.duration_minutes || 60,
        notes:            "Próxima sessão de acompanhamento — demo.",
      });
    } catch { /* ignore */ }
  }

  // Non-critical: demo session record with pre-filled notes
  if (demoPatientId && demoAppointmentId) {
    try {
      await supabase.from("session_records").insert({
        clinic_id: clinicId!,
        appointment_id: demoAppointmentId,
        patient_id: demoPatientId,
        created_by: profile.id,
        notes: getDemoSessionNotes(clinicProfile),
        key_observations: getDemoObservations(clinicProfile),
        soap_mode: false,
      });
    } catch { /* ignore */ }

    // Non-critical: demo AI insight
    try {
      const insightTitle = {
        fisioterapia: "Avaliação inicial — lombalgia com componente postural",
        saude_mental: "Mapeamento inicial — ansiedade e padrões cognitivos",
        nutricao: "Perfil nutricional — reeducação alimentar",
        wellness: "Perfil de bem-estar — sono e energia",
        integrativa: "Avaliação integrativa — fadiga e biomarcadores",
      }[clinicProfile as string] ?? "Primeiro insight clínico";

      await supabase.from("ai_insights").insert({
        clinic_id: clinicId!,
        patient_id: demoPatientId,
        appointment_id: demoAppointmentId,
        created_by: profile.id,
        title: insightTitle,
        review_status: "final",
        approved_at: new Date().toISOString(),
        output: {
          structured_summary: {
            overview: getDemoSessionNotes(clinicProfile).slice(0, 220) + "…",
            current_status: "Paciente em início de acompanhamento. Boa adesão e motivação observadas na primeira sessão.",
          },
          patterns_and_correlations: [
            {
              title: insightTitle,
              insight: getDemoObservations(clinicProfile).join(". ") + ".",
            },
          ],
          practitioner_review_points: [
            "Avaliar evolução dos sintomas na próxima sessão.",
            "Reforçar orientações de autocuidado entre as sessões.",
          ],
        },
      });
    } catch { /* ignore */ }
  }

  return { clinicId };
}
