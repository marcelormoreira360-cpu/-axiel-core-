"use server";

import { getCurrentUserProfile } from "@/services/user-service";
import { SUPPLEMENT_REASONING_VERSION } from "@/modules/ai-insights/supplement-reasoning";
import {
  getEligiblePatientIdsForRegeneration,
  getEligiblePatientCountForRegeneration,
  enqueueSupplementRegeneration,
  getRegenerationQueueSummary,
  processNextRegenerationBatch,
  type RegenerationQueueSummary,
} from "@/services/supplement-regeneration-queue-service";

function isManagerRole(role: string | null | undefined): boolean {
  return ["clinic_owner", "clinic_manager", "admin"].includes(role ?? "");
}

// Teto por invocação: cada job é uma geração de relatório completa (dezenas de
// segundos). Poucos por clique para caber no maxDuration da rota (60s). A tela
// chama em laço (novo request, novo orçamento de tempo) até zerar o pending.
const MAX_BATCH = 3;
const DEFAULT_BATCH = 2;

export type RegenerationOverview = {
  configVersion: string;
  eligibleCount: number;
  summary: RegenerationQueueSummary;
};

export async function getRegenerationOverviewAction(): Promise<
  { ok: true; data: RegenerationOverview } | { ok: false; error: string }
> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };
  if (!isManagerRole(profile.role)) return { ok: false, error: "Sem permissão." };

  const [eligibleCount, summary] = await Promise.all([
    getEligiblePatientCountForRegeneration(profile.clinic_id, SUPPLEMENT_REASONING_VERSION),
    getRegenerationQueueSummary(profile.clinic_id),
  ]);
  return {
    ok: true,
    data: { configVersion: SUPPLEMENT_REASONING_VERSION, eligibleCount, summary },
  };
}

export async function enqueueEligibleRegenerationAction(): Promise<
  { ok: true; enqueued: number; skipped: number } | { ok: false; error: string }
> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };
  if (!isManagerRole(profile.role)) return { ok: false, error: "Sem permissão." };

  const patientIds = await getEligiblePatientIdsForRegeneration(
    profile.clinic_id,
    SUPPLEMENT_REASONING_VERSION,
  );
  const { enqueued, skipped } = await enqueueSupplementRegeneration({
    clinicId: profile.clinic_id,
    configVersion: SUPPLEMENT_REASONING_VERSION,
    patientIds,
  });
  return { ok: true, enqueued, skipped };
}

export async function processRegenerationBatchAction(
  limit?: number,
): Promise<{ ok: true; claimed: number; done: number; failed: number } | { ok: false; error: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };
  if (!isManagerRole(profile.role)) return { ok: false, error: "Sem permissão." };

  const safeLimit = Math.min(Math.max(1, limit ?? DEFAULT_BATCH), MAX_BATCH);
  const result = await processNextRegenerationBatch({ clinicId: profile.clinic_id, limit: safeLimit });
  return { ok: true, ...result };
}
