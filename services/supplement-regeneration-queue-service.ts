import type { AiInsight } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { resolveClinicalPack } from "@/modules/clinical-packs/resolve";
import { regenerateSupplementForPatient } from "@/services/ai-insight/supplement-regeneration";
import { sendSupplementToPatient } from "@/services/ai-insight/delivery";
import {
  resolveJobStatusAfterFailure,
  currentSupplementVersion,
  isSupplementSent,
} from "@/services/ai-insight/supplement-queue-logic";

const log = createLogger("supplement-regeneration-queue");

// 'processing' mais velho que isto = lote anterior morreu no meio; volta a pending.
// Bem acima da duração de UM job (uma geração ~dezenas de segundos), para nunca
// reivindicar um job que ainda está rodando de verdade e gerar rascunho duplicado.
const RECLAIM_MS = 15 * 60_000;

export type RegenerationQueueSummary = {
  pending: number;
  processing: number;
  done: number;
  failed: number;
  canceled: number;
};

const JOB_STATUSES: Array<keyof RegenerationQueueSummary> = [
  "pending",
  "processing",
  "done",
  "failed",
  "canceled",
];

/**
 * Segmentação (decisão do Marcelo): só pacientes COM dados clínicos (exame
 * funcional OU Mapa Neuro ID) cujo insight mais recente ainda NÃO está na versão
 * atual do raciocínio. Evita gerar suplementação genérica para leads sem dado.
 *
 * A seleção roda em SQL (função eligible_supplement_regeneration_patients) para
 * não bater no cap de 1000 linhas do PostgREST nem montar listas .in() gigantes
 * na URL em clínicas grandes.
 *
 * Guard: clínicas cujo pack NÃO gera suplementação (ex.: "generic") retornam
 * vazio — senão os jobs falhariam para sempre (regeneração exige um Documento 2).
 */
export async function getEligiblePatientIdsForRegeneration(
  clinicId: string,
  configVersion: string,
): Promise<string[]> {
  const pack = await resolveClinicalPack(clinicId);
  if (!pack.producesSupplementation) return [];

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("eligible_supplement_regeneration_patients", {
    p_clinic: clinicId,
    p_version: configVersion,
  });
  if (error) throw error;
  return (data ?? []).map((r: { patient_id: string }) => r.patient_id);
}

/**
 * Só a CONTAGEM de elegíveis (para o panorama/overview), sem transferir a lista
 * inteira de UUIDs. A lista completa só é buscada no caminho de enfileiramento.
 */
export async function getEligiblePatientCountForRegeneration(
  clinicId: string,
  configVersion: string,
): Promise<number> {
  const pack = await resolveClinicalPack(clinicId);
  if (!pack.producesSupplementation) return 0;

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase.rpc(
    "eligible_supplement_regeneration_patients",
    { p_clinic: clinicId, p_version: configVersion },
    { count: "exact", head: true },
  );
  if (error) throw error;
  return count ?? 0;
}

/**
 * Enfileira jobs de regeneração para os pacientes dados, pulando quem já tem job
 * aberto (pending/processing). Não regenera nada aqui; só cria a fila.
 */
export async function enqueueSupplementRegeneration(input: {
  clinicId: string;
  configVersion: string;
  patientIds: string[];
}): Promise<{ enqueued: number; skipped: number }> {
  if (input.patientIds.length === 0) return { enqueued: 0, skipped: 0 };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dedup é garantido pelo ÍNDICE ÚNICO PARCIAL (um job aberto por paciente), não
  // por um pré-check com .in() sobre a lista inteira (que viraria uma URL gigante
  // em clínica grande). Os rows vão no CORPO do insert (sem limite de URL).
  const rows = input.patientIds.map((patient_id) => ({
    clinic_id: input.clinicId,
    patient_id,
    config_version: input.configVersion,
    created_by: user?.id ?? null,
  }));

  // Caminho normal: um único insert em lote. Se colidir com um enqueue concorrente
  // (23505 no índice parcial), o statement inteiro reverte; aí refazemos por linha,
  // contando cada duplicado como "skipped" em vez de derrubar tudo.
  const { error } = await supabase.from("supplement_regeneration_jobs").insert(rows);
  if (!error) return { enqueued: rows.length, skipped: 0 };
  if (error.code !== "23505") throw error;

  let enqueued = 0;
  for (const row of rows) {
    const { error: rowError } = await supabase.from("supplement_regeneration_jobs").insert(row);
    if (!rowError) enqueued++;
    else if (rowError.code !== "23505") throw rowError;
  }
  return { enqueued, skipped: rows.length - enqueued };
}

export async function getRegenerationQueueSummary(clinicId: string): Promise<RegenerationQueueSummary> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // Contagem por status via head+count (não traz linhas): não bate no cap de 1000
  // do PostgREST quando jobs done/failed acumulam. Uma contagem por status.
  const counts = await Promise.all(
    JOB_STATUSES.map(async (status) => {
      const { count } = await supabase
        .from("supplement_regeneration_jobs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", status);
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as RegenerationQueueSummary;
}

type ClaimableJob = {
  id: string;
  patient_id: string;
  attempts: number;
  max_attempts: number;
  config_version: string;
};

/**
 * Processa um LOTE da fila, no contexto do gestor autenticado (não service role,
 * porque o pipeline de IA depende do cliente autenticado + RLS). O claim otimista
 * (pending -> processing condicional) evita que dois lotes peguem o mesmo job; as
 * finalizações (done/failed) só escrevem se o job ainda está 'processing' (guarda
 * contra um reclaim ter devolvido o job no meio). A tela (Fase 3) desabilita o
 * botão enquanto roda, então concorrência real é rara. Cada job vira um RASCUNHO;
 * nada é enviado.
 */
export async function processNextRegenerationBatch(input: {
  clinicId: string;
  limit?: number;
}): Promise<{ claimed: number; done: number; failed: number }> {
  // Cada job é uma geração de relatório completa (dezenas de segundos). Poucos por
  // invocação para caber no timeout da função serverless; a tela (Fase 3) chama em
  // laço até zerar o pending.
  const limit = input.limit ?? 3;
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // Reclaim: 'processing' preso (lote morreu) volta para 'pending' SÓ enquanto
  // ainda há tentativa; quem já esgotou max_attempts vira 'failed' (não gera mais
  // uma vez além do teto). Comparar attempts x max_attempts entre colunas não é
  // suportado no filtro do PostgREST, então buscamos os presos e ramificamos aqui.
  const staleCutoff = new Date(Date.now() - RECLAIM_MS).toISOString();
  const { data: stale } = await supabase
    .from("supplement_regeneration_jobs")
    .select("id, attempts, max_attempts")
    .eq("clinic_id", input.clinicId)
    .eq("status", "processing")
    .lt("updated_at", staleCutoff);
  for (const job of (stale ?? []) as Array<{ id: string; attempts: number; max_attempts: number }>) {
    const next = resolveJobStatusAfterFailure(job.attempts, job.max_attempts);
    await supabase
      .from("supplement_regeneration_jobs")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "processing"); // não sobrescreve uma finalização concorrente (done/failed)
  }

  const { data: jobs } = await supabase
    .from("supplement_regeneration_jobs")
    .select("id, patient_id, attempts, max_attempts, config_version")
    .eq("clinic_id", input.clinicId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  let claimed = 0;
  let done = 0;
  let failed = 0;

  for (const job of (jobs ?? []) as ClaimableJob[]) {
    // Reivindicação atômica: só um lote marca pending -> processing.
    const { data: got } = await supabase
      .from("supplement_regeneration_jobs")
      .update({ status: "processing", attempts: job.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!got) continue; // outro lote pegou este job
    claimed++;

    try {
      // Semântica "pelo menos uma vez": se a função morrer entre salvar o rascunho
      // e marcar o job como done, o reclaim (após 15 min) reprocessa e pode gerar
      // um 2º rascunho pendente para o mesmo paciente. Não é perigoso (nada é
      // enviado; o gestor revisa e o rascunho mais novo prevalece), mas é sabido.
      const insight: AiInsight = await regenerateSupplementForPatient(job.patient_id);
      // config_version = versão REALMENTE produzida (não a capturada no enqueue),
      // caso a constante tenha mudado entre enfileirar e processar.
      const producedVersion = currentSupplementVersion(insight) ?? job.config_version;
      await supabase
        .from("supplement_regeneration_jobs")
        .update({
          status: "done",
          result_insight_id: insight.id,
          config_version: producedVersion,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id)
        .eq("status", "processing"); // não sobrescreve um job que um reclaim devolveu
      done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const next = resolveJobStatusAfterFailure(job.attempts + 1, job.max_attempts);
      await supabase
        .from("supplement_regeneration_jobs")
        .update({ status: next, last_error: msg, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "processing");
      if (next === "failed") failed++;
      log.error("job de regeneração falhou", e, { job: job.id, next });
    }
  }

  return { claimed, done, failed };
}

// ── FASE 4: envio em lote dos aprovados ──────────────────────────────────────
// "Pronto para enviar" = job 'done' cujo rascunho o gestor já APROVOU
// (ai_insights.review_status = 'final') e que ainda não foi enviado (sent_at null).
// Respeita o gate humano: só envia o que já passou pela aprovação por paciente.

const SENDABLE_SELECT = "id, patient_id, ai_insights!inner(review_status)";

export async function getSendableSupplementCount(clinicId: string): Promise<number> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("supplement_regeneration_jobs")
    .select(SENDABLE_SELECT, { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "done")
    .is("sent_at", null)
    .eq("ai_insights.review_status", "final");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Jobs que TENTARAM enviar e não entregaram (sent_at marcado + send_error). Como o
 * envio reserva antes de tentar, uma falha (transitória do provedor OU sem contato)
 * sai de "prontos"; esta contagem a torna VISÍVEL para o gestor poder re-tentar.
 */
export async function getFailedSendCount(clinicId: string): Promise<number> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("supplement_regeneration_jobs")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "done")
    .not("sent_at", "is", null)
    .not("send_error", "is", null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Re-tentativa em lote dos envios que falharam: limpa sent_at/send_error para eles
 * voltarem a "prontos para enviar". Ação explícita do gestor (ex.: depois de
 * corrigir contato ou de uma indisponibilidade do provedor). Não envia aqui.
 */
export async function retryFailedSends(clinicId: string): Promise<{ reset: number }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("supplement_regeneration_jobs")
    .update({ sent_at: null, send_error: null, updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("status", "done")
    .not("sent_at", "is", null)
    .not("send_error", "is", null)
    .select("id");
  if (error) throw error;
  return { reset: data?.length ?? 0 };
}

// Teto por invocação (envio faz PDF + e-mail + WhatsApp por paciente). Igual ao
// MAX_SEND_BATCH da action; a tela chama em laço até esgotar.
const SEND_BATCH_LIMIT = 10;

/**
 * Envia em LOTE a suplementação dos jobs prontos (aprovados e não enviados), no
 * contexto do gestor autenticado.
 *
 * Semântica EXATAMENTE-UMA-VEZ por job: RESERVA (marca sent_at) ANTES de enviar.
 * Isso (a) impede reenvio em laço de casos não entregáveis (sem contato / sem Doc
 * 2), que antes ficavam "prontos" para sempre; e (b) impede envio duplo de dois
 * lotes concorrentes (só quem reserva de fato envia). Agrupa por paciente para
 * enviar UMA vez por paciente mesmo que ele tenha vários jobs done. Se o envio não
 * entregar por nenhum canal, registra send_error (o job já saiu de "prontos").
 */
export async function bulkSendApprovedSupplements(input: {
  clinicId: string;
  limit?: number;
}): Promise<{ sent: number; failed: number }> {
  const limit = input.limit ?? SEND_BATCH_LIMIT;
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: candidates, error: candidatesError } = await supabase
    .from("supplement_regeneration_jobs")
    .select(SENDABLE_SELECT)
    .eq("clinic_id", input.clinicId)
    .eq("status", "done")
    .is("sent_at", null)
    .eq("ai_insights.review_status", "final")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (candidatesError) throw candidatesError; // não trate falha de DB como "nada a enviar"

  // Um paciente pode ter mais de um job done aprovado; envia UMA vez e marca todos
  // os jobs candidatos dele nesta leva.
  const byPatient = new Map<string, string[]>();
  for (const j of (candidates ?? []) as Array<{ id: string; patient_id: string }>) {
    const ids = byPatient.get(j.patient_id) ?? [];
    ids.push(j.id);
    byPatient.set(j.patient_id, ids);
  }

  let sent = 0;
  let failed = 0;

  for (const [patientId, jobIds] of byPatient) {
    // Reserva atômica: marca sent_at ANTES de enviar. Quem reservar de fato (linhas
    // afetadas > 0) é dono do envio; um lote concorrente que não reservar pula.
    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from("supplement_regeneration_jobs")
      .update({ sent_at: nowIso, updated_at: nowIso })
      .in("id", jobIds)
      .is("sent_at", null)
      .select("id");
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) continue; // outro lote reservou

    try {
      const res = await sendSupplementToPatient(patientId);
      if (isSupplementSent(res.email, res.whatsapp)) {
        sent++;
      } else {
        const err = `email=${res.email} whatsapp=${res.whatsapp}`;
        await supabase
          .from("supplement_regeneration_jobs")
          .update({ send_error: err, updated_at: new Date().toISOString() })
          .in("id", jobIds);
        failed++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("supplement_regeneration_jobs")
        .update({ send_error: msg, updated_at: new Date().toISOString() })
        .in("id", jobIds);
      failed++;
      log.error("envio de suplemento em lote falhou", e, { patient: patientId });
    }
  }

  return { sent, failed };
}
