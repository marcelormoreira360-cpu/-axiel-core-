import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import { anonymizePatientAsSystem } from "@/services/patient-service";
import { isAnonymizeEligible, MIN_RETENTION_YEARS } from "@/modules/compliance/retention-policy";

const log = createLogger("retention");

// Teto de segurança por execução: mesmo com um bug de lógica, o job nunca anonimiza
// a base inteira de uma vez. Anonimização é IRREVERSÍVEL.
const MAX_PER_RUN = 100;

export type RetentionRunResult = {
  scanned: number;
  eligible: number;
  anonymized: number;
  dryRun: boolean;
  capped: boolean;
  errors: number;
};

/**
 * Job de retenção (#9): anonimiza pacientes cujo prazo de retenção (por país) já passou.
 * Ver modules/compliance/retention-policy. Seguro por design:
 *  - pré-filtro por idade do cadastro (só quem já passaria do MENOR prazo entra);
 *  - exclui já anonimizados e soft-deleted;
 *  - "último contato" = MAIOR sinal (última consulta ou criação), nunca uma data velha demais;
 *  - teto por execução; modo dryRun para inspecionar sem anonimizar.
 */
export async function runRetentionAnonymization(opts?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<RetentionRunResult> {
  const dryRun = opts?.dryRun ?? false;
  const cap = Math.min(opts?.limit ?? MAX_PER_RUN, MAX_PER_RUN);
  const supabase = createSupabaseAdminClient();
  const now = new Date();

  // Só pacientes cujo cadastro é anterior ao MENOR prazo possível podem estar elegíveis.
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - MIN_RETENTION_YEARS);

  // Mais antigos primeiro (mais prováveis de estarem vencidos) e teto de scan por
  // execução: limita o custo (uma consulta de última consulta por candidato) bem abaixo
  // do maxDuration do cron. Como o job roda mensalmente, execuções seguintes pegam o resto.
  const { data: candidates, error } = await supabase
    .from("patients")
    .select("id, clinic_id, country, date_of_birth, created_at")
    .lte("created_at", cutoff.toISOString())
    .is("deleted_at", null)
    .neq("full_name", "Paciente Anonimizado")
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    log.error("Falha ao buscar candidatos de retenção", error);
    throw error;
  }

  const rows = candidates ?? [];
  let eligible = 0;
  let anonymized = 0;
  let errors = 0;
  let capped = false;

  for (const p of rows) {
    // Último contato = maior sinal conhecido (última consulta OU criação do cadastro).
    const { data: lastAppt } = await supabase
      .from("appointments")
      .select("starts_at")
      .eq("patient_id", p.id as string)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const createdAt = new Date(p.created_at as string);
    const lastApptAt = lastAppt?.starts_at ? new Date(lastAppt.starts_at as string) : null;
    const lastContact =
      lastApptAt && lastApptAt.getTime() > createdAt.getTime() ? lastApptAt : createdAt;
    const dob = p.date_of_birth ? new Date(p.date_of_birth as string) : null;

    const eligibleNow = isAnonymizeEligible(
      { country: p.country as string | null, lastContact, dateOfBirth: dob },
      now,
    );
    if (!eligibleNow) continue;
    eligible += 1;

    if (anonymized >= cap) {
      capped = true;
      break;
    }
    if (dryRun) continue;

    try {
      const ok = await anonymizePatientAsSystem(
        p.id as string,
        p.clinic_id as string,
        "retention_policy",
      );
      if (ok) anonymized += 1;
    } catch (e) {
      errors += 1;
      log.error("Falha ao anonimizar por retenção", e as Error, { patient_id: p.id });
    }
  }

  log.info("Retenção executada", {
    scanned: rows.length,
    eligible,
    anonymized,
    dryRun,
    capped,
    errors,
  });
  return { scanned: rows.length, eligible, anonymized, dryRun, capped, errors };
}
