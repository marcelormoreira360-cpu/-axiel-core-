import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("journey-events");

// Frente C — log append-only da jornada do paciente (migration 158,
// patient_journey_events). Este serviço é o ÚNICO ponto de escrita: grava via
// admin client (service role), porque muitos marcos acontecem em ações sem
// usuário autenticado (paciente, sistema, webhooks). Toda escrita é best-effort:
// falhar aqui NUNCA pode derrubar a ação de negócio que a disparou.

export const JOURNEY_EVENT_TYPES = [
  "lead_created",
  "form_submitted",
  "assessment_scheduled",
  "attended",
  "assessment_completed", // T0 da métrica
  "report_delivered",
  "plan_presented",
  "plan_started", // T1 da métrica
  "session_completed",
  "follow_up_logged",
  "interrupted",
  "renewed",
] as const;

export type JourneyEventType = (typeof JOURNEY_EVENT_TYPES)[number];

export type EmitJourneyEventInput = {
  clinicId: string;
  eventType: JourneyEventType;
  /** QUANDO o fato aconteceu. Default = agora. Aceita passado (import/backfill). */
  occurredAt?: string | Date | null;
  patientId?: string | null;
  leadId?: string | null;
  source?: "core" | "vagaro_csv" | "vagaro_api" | "manual";
  actorType?: "staff" | "patient" | "system" | null;
  recordedByUser?: string | null;
  refTable?: string | null;
  refId?: string | null;
  /** Chave de idempotência. Recomendado sempre — evita duplicar em reprocessos. */
  dedupKey?: string | null;
  payload?: Record<string, unknown>;
};

function toIso(v?: string | Date | null): string {
  if (!v) return new Date().toISOString();
  return typeof v === "string" ? v : v.toISOString();
}

/**
 * Grava um evento da jornada. Best-effort e idempotente:
 *  - com dedupKey, faz upsert ignorando duplicado (índice único clinic_id+dedup_key);
 *  - sem dedupKey, faz insert simples;
 *  - qualquer erro é logado e engolido (retorna false), nunca lança.
 */
export async function emitJourneyEvent(input: EmitJourneyEventInput): Promise<boolean> {
  if (!input.clinicId) return false;
  try {
    const supabase = createSupabaseAdminClient();
    const row = {
      clinic_id: input.clinicId,
      patient_id: input.patientId ?? null,
      lead_id: input.leadId ?? null,
      event_type: input.eventType,
      occurred_at: toIso(input.occurredAt),
      source: input.source ?? "core",
      actor_type: input.actorType ?? null,
      recorded_by_user: input.recordedByUser ?? null,
      ref_table: input.refTable ?? null,
      ref_id: input.refId ?? null,
      dedup_key: input.dedupKey ?? null,
      payload: input.payload ?? {},
    };

    const { error } = input.dedupKey
      ? await supabase
          .from("patient_journey_events")
          .upsert(row, { onConflict: "clinic_id,dedup_key", ignoreDuplicates: true })
      : await supabase.from("patient_journey_events").insert(row);

    if (error) {
      log.error("Falha ao gravar patient_journey_events", error, {
        clinic_id: input.clinicId,
        event_type: input.eventType,
        dedup_key: input.dedupKey ?? undefined,
      });
      return false;
    }
    return true;
  } catch (e) {
    log.error("Exceção ao gravar patient_journey_events", e as Error, {
      clinic_id: input.clinicId,
      event_type: input.eventType,
    });
    return false;
  }
}

// ── Métrica: conversão avaliação -> início do plano em até N dias ───────────────
//
// Coorte de janela (não é uma taxa "instantânea"). Distinguimos três estados por
// paciente para não subestimar a conversão enquanto ainda há janelas abertas:
//   - convertido: plan_started em [T0, T0 + janela];
//   - aberto (stillOpen): sem conversão E a janela ainda não fechou (agora < T0+janela);
//   - perda madura (maturedLost): sem conversão E a janela já fechou.
//
// Expomos DUAS taxas, nomeadas explicitamente (correção metodológica):
//   - matureRate = convertidos / (convertidos + perdas maduras): a taxa "de verdade",
//     que só considera casos cujo desfecho já é conhecido. É a que serve de prova.
//   - provisionalRate = convertidos / coorte total: subestima enquanto há janelas
//     abertas (pacientes que ainda podem converter contam no denominador). Só para
//     acompanhamento em tempo real, nunca como número final.
//
// LIMITAÇÃO CONHECIDA (paciente ≠ episódio): o T0 é a PRIMEIRA avaliação do paciente
// no período. Isso mede bem a aquisição inicial, mas não separa reavaliação, retorno,
// novo problema ou segundo episódio terapêutico. Quando existir um journey_episode_id,
// a âncora deve passar a ser por episódio, não por paciente. Enquanto não existir,
// tratamos como métrica de aquisição inicial e assumimos essa limitação.

export type ConversionResult = {
  windowDays: number;
  /** Coorte total: pacientes com assessment_completed no período (com T0). */
  cohort: number;
  /** Converteram: plan_started em [T0, T0 + janela]. */
  converted: number;
  /** Janela ainda ABERTA e sem conversão (agora < T0+janela): ainda pode converter. */
  stillOpen: number;
  /** Janela FECHADA sem conversão: perda madura (desfecho já conhecido). */
  maturedLost: number;
  /** Base madura = converted + maturedLost (= cohort - stillOpen). */
  maturedCohort: number;
  /** TAXA MADURA (usar como prova): converted / maturedCohort; null se base madura 0. */
  matureRate: number | null;
  /** Taxa PROVISÓRIA (converted / cohort): subestima com janelas abertas; null se coorte 0. */
  provisionalRate: number | null;
};

type PatientAnchor = { patientId: string; firstAssessmentAt: number; firstPlanAt: number | null };

/**
 * Cálculo PURO da conversão a partir dos eventos por paciente. Separado da query
 * para ser testável sem banco. `firstPlanAt` já vem filtrado pela query como o
 * PRIMEIRO plan_started em/após o T0 (ver getAssessmentToPlanConversion, correção B);
 * o guard `>= firstAssessmentAt` aqui é defensivo.
 */
export function computeConversion(
  anchors: PatientAnchor[],
  windowDays: number,
  now: number = Date.now(),
): ConversionResult {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  let cohort = 0;
  let converted = 0;
  let stillOpen = 0;
  let maturedLost = 0;

  for (const a of anchors) {
    cohort += 1;
    const deadline = a.firstAssessmentAt + windowMs;
    const hasPlanInWindow =
      a.firstPlanAt !== null && a.firstPlanAt >= a.firstAssessmentAt && a.firstPlanAt <= deadline;
    if (hasPlanInWindow) {
      converted += 1;
    } else if (now < deadline) {
      // Sem conversão dentro da janela, mas a janela ainda está aberta: pode converter.
      stillOpen += 1;
    } else {
      // Sem conversão e janela fechada: perda madura.
      maturedLost += 1;
    }
  }

  const maturedCohort = converted + maturedLost; // = cohort - stillOpen
  return {
    windowDays,
    cohort,
    converted,
    stillOpen,
    maturedLost,
    maturedCohort,
    matureRate: maturedCohort > 0 ? converted / maturedCohort : null,
    provisionalRate: cohort > 0 ? converted / cohort : null,
  };
}

/**
 * Métrica-alvo do piloto: dos pacientes cuja AVALIAÇÃO foi concluída no período,
 * quantos INICIARAM o plano em até `windowDays` dias. Lê de patient_journey_events
 * (T0 = assessment_completed, T1 = plan_started), via admin client escopado por
 * clinic_id (a leitura é agregada, não expõe PHI individual).
 */
export async function getAssessmentToPlanConversion(
  clinicId: string,
  range: { from: string; to: string; windowDays?: number },
): Promise<ConversionResult> {
  const windowDays = range.windowDays ?? 45;
  const supabase = createSupabaseAdminClient();

  // T0 de cada paciente no período (primeiro assessment_completed).
  const { data: assessments } = await supabase
    .from("patient_journey_events")
    .select("patient_id, occurred_at")
    .eq("clinic_id", clinicId)
    .eq("event_type", "assessment_completed")
    .gte("occurred_at", range.from)
    .lte("occurred_at", range.to)
    .not("patient_id", "is", null)
    .order("occurred_at", { ascending: true });

  const firstAssessment = new Map<string, number>();
  for (const r of assessments ?? []) {
    const pid = r.patient_id as string;
    if (!firstAssessment.has(pid)) firstAssessment.set(pid, new Date(r.occurred_at as string).getTime());
  }

  if (firstAssessment.size === 0) {
    return computeConversion([], windowDays);
  }

  // plan_started desses pacientes. Correção B: por paciente, pegamos o PRIMEIRO
  // plan_started EM/APÓS o T0 daquela avaliação, ignorando planos anteriores (um
  // episódio antigo) que esconderiam uma conversão posterior válida.
  const patientIds = [...firstAssessment.keys()];
  const { data: plans } = await supabase
    .from("patient_journey_events")
    .select("patient_id, occurred_at")
    .eq("clinic_id", clinicId)
    .eq("event_type", "plan_started")
    .in("patient_id", patientIds)
    .order("occurred_at", { ascending: true });

  const firstPlan = new Map<string, number>();
  for (const r of plans ?? []) {
    const pid = r.patient_id as string;
    const t0 = firstAssessment.get(pid);
    if (t0 === undefined) continue;
    const planAt = new Date(r.occurred_at as string).getTime();
    if (planAt < t0) continue; // ignora plano anterior ao T0 (episódio antigo)
    if (!firstPlan.has(pid)) firstPlan.set(pid, planAt);
  }

  const anchors: PatientAnchor[] = [...firstAssessment.entries()].map(([patientId, firstAssessmentAt]) => ({
    patientId,
    firstAssessmentAt,
    firstPlanAt: firstPlan.get(patientId) ?? null,
  }));

  return computeConversion(anchors, windowDays);
}
