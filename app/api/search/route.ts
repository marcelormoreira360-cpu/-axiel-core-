import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";
import { tokenizeQuery, rankByRelevance, normalizeForSearch } from "@/lib/search-ranking";

export const runtime = "nodejs";

// Quantos candidatos buscar no banco antes de ordenar por relevância em memória,
// e quantos exibir por seção. Buscar mais que o exibido é o que evita o antigo
// "tive que digitar o nome quase todo" (o certo pode ficar fora dos 5 alfabéticos).
// LIMITAÇÃO conhecida: os candidatos vêm ordenados por nome; se um token único
// casar com >CANDIDATE_LIMIT registros (ex.: "maria"), o ranqueamento só vê os
// primeiros alfabéticos. Mitigação do usuário: digitar uma 2ª palavra (o filtro é
// AND, então "maria s" já reduz drasticamente). Solução plena futura: ordenar por
// similaridade trigram no banco (RPC). 50 cobre bem o volume por clínica (~800).
const CANDIDATE_LIMIT = 50;
const PATIENTS_SHOWN = 8;
const LEADS_SHOWN = 5;

// SEC-07: escapa curingas do LIKE para uma query como "%%%" não forçar full scan.
function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return Response.json({ patients: [], appointments: [], leads: [] });
  }

  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const supabase = await createSupabaseServerClient();

  // Busca por MÚLTIPLAS palavras em qualquer ordem, insensível a ACENTO e caixa.
  // `search_text` é uma coluna gerada = immutable_unaccent(lower(nome+email+telefone))
  // (migration 167). Cada token é normalizado do mesmo jeito e casado com ILIKE;
  // chamar .ilike() várias vezes combina com AND no PostgREST. Assim "vitor pedro",
  // "pedro saldanha" (pulando o meio) e "jose" (achando "José") funcionam.
  const tokens = tokenizeQuery(q);
  const toks = (tokens.length ? tokens : [q]).map((t) => normalizeForSearch(t)).filter(Boolean);
  // Sem token útil (ex.: query só de acentos/combinações) → nada a buscar.
  if (toks.length === 0) {
    return Response.json({ patients: [], appointments: [], leads: [] });
  }

  function withTokenFilters<T extends { ilike: (col: string, f: string) => T }>(qb: T): T {
    let out = qb;
    for (const tok of toks) {
      out = out.ilike("search_text", `%${escapeLike(tok)}%`);
    }
    return out;
  }

  const [patientsRes, leadsRes] = await Promise.all([
    withTokenFilters(
      supabase
        .from("patients")
        .select("id, full_name, email, phone, status")
        .eq("clinic_id", clinic.id),
    )
      .order("full_name")
      .limit(CANDIDATE_LIMIT),

    withTokenFilters(
      supabase
        .from("leads")
        .select("id, full_name, email, phone, stage, source")
        .eq("clinic_id", clinic.id),
    )
      .order("full_name")
      .limit(CANDIDATE_LIMIT),
  ]);

  // Ordena os candidatos por relevância (acento/caixa ignorados, prefixo primeiro)
  // e corta no número exibido por seção.
  const patients = rankByRelevance(patientsRes.data ?? [], q, (p) => p.full_name, PATIENTS_SHOWN);
  const leads = rankByRelevance(leadsRes.data ?? [], q, (l) => l.full_name, LEADS_SHOWN);

  // Search appointments server-side using matched patient IDs (avoids large client-side filter).
  // Usa os pacientes já ranqueados (os mais relevantes), não a lista bruta.
  const matchedPatientIds = patients.map((p) => p.id);
  let appointments: {
    id: string;
    starts_at: string;
    duration_minutes: number;
    patient_id: string | null;
    patient_name: string;
    session_type_name: string | null;
  }[] = [];

  if (matchedPatientIds.length > 0) {
    const appointmentsRes = await supabase
      .from("appointments")
      .select("id, starts_at, duration_minutes, patients(id, full_name), session_types(name)")
      .eq("clinic_id", clinic.id)
      .in("patient_id", matchedPatientIds)
      .order("starts_at", { ascending: false })
      .limit(30);

    appointments = (appointmentsRes.data ?? []).slice(0, 5).map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      duration_minutes: a.duration_minutes,
      patient_id: (a.patients as { id?: string } | null)?.id ?? null,
      patient_name: (a.patients as { full_name?: string } | null)?.full_name ?? "—",
      session_type_name: (a.session_types as { name?: string } | null)?.name ?? null,
    }));
  }

  return Response.json({
    patients,
    appointments,
    leads,
  });
}
