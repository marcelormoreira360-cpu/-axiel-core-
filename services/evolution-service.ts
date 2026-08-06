export type BiomarkerPoint = {
  date: string;       // ISO date string
  value: number;
  ref_min: number | null;
  ref_max: number | null;
  status: string;
  lab_name: string | null;
};

export type BiomarkerSeries = {
  name: string;
  unit: string | null;
  points: BiomarkerPoint[];
};

export type AssessmentPoint = {
  date: string;
  score_percentage: number;
  total_score: number;
  max_possible_score: number;
};

export type AssessmentSeries = {
  template_id: string;
  name: string;
  points: AssessmentPoint[];
};

export type VitalPoint = {
  date: string;  // ISO date string of the session starts_at
  // Valores por chave de vital (dinâmicos, config por clínica): dor/energia/humor/
  // sono ou customizados.
  values: Record<string, number | null>;
};

// Definição de um vital para o gráfico (chave, rótulo custom, cor). O rótulo dos
// vitais PADRÃO vem vazio e é resolvido por i18n no componente.
export type VitalDef = {
  key: string;
  label: string;
  color: string;
};

export type EvolutionData = {
  biomarkers: BiomarkerSeries[];
  assessments: AssessmentSeries[];
  vitals: VitalPoint[];
  vitalDefs: VitalDef[];
  vitalsScaleMax: number;
};

// ── Resumo evolutivo rolante (Melhoria 2) ─────────────────────────────────────
// "Onde estamos" condensado das últimas sessões, para o rumo não se diluir depois
// de muitas sessões. Determinístico (sem IA nesta fase). Uso interno; linguagem
// prudente (tendência/associação, não diagnóstico). Computado on-read (sem cache).

export type EvolutionScoreTrend = { label: string; from: number; to: number };

export type EvolutionDigest = {
  /** 2 a 3 linhas condensadas (~280 chars) para o painel. */
  text: string;
  /** observações-chave deduplicadas (mais recentes primeiro). */
  bullets: string[];
  /** nº de sessões consideradas. */
  sessionsCount: number;
  /** intervalo das datas das sessões consideradas, já localizado. */
  period: string | null;
  /** variação relevante de score entre as 2 respostas mais recentes do mesmo formulário. */
  scoreTrend?: EvolutionScoreTrend | null;
};

// Formas mínimas (não acopla ao tipo completo; testável com objetos simples).
type SessionRecordLike = {
  key_observations?: string[] | null;
  created_at?: string | null;
  appointments?: { starts_at?: string | null } | { starts_at?: string | null }[] | null;
};

type ResponseLike = {
  template_id?: string | null;
  score_percentage?: number | string | null;
  filled_at?: string | null;
  created_at?: string | null;
  assessment_templates?: { name?: string } | { name?: string }[] | null;
};

type ComposeOptions = {
  limit?: number;         // sessões consideradas (default 5)
  maxBullets?: number;    // teto de bullets (default 5)
  maxChars?: number;      // teto do text (default 280)
  trendMinDelta?: number; // variação mínima em pontos percentuais (default 5)
  /** formatação de data curta e localizada (ex.: "12 jun"). */
  formatDate: (iso: string) => string;
  /** separador de período localizado (ex.: " a " / " to "). */
  periodSep: string;
  /** rótulo de tendência localizado (ex.: "tendência GAD-7: 72% para 58%"). */
  trend: (name: string, from: number, to: number) => string;
};

// Timestamp cronológico da sessão: usa a data do agendamento; cai no created_at.
function sessionTimestamp(r: SessionRecordLike): string | null {
  const appt = Array.isArray(r.appointments) ? r.appointments[0] ?? null : r.appointments;
  return appt?.starts_at ?? r.created_at ?? null;
}

function respTemplateName(r: ResponseLike): string {
  const tpl = Array.isArray(r.assessment_templates) ? r.assessment_templates[0] ?? null : r.assessment_templates;
  return tpl?.name ?? "";
}

/** Agrupa respostas por formulário em séries {name, points[{date, score_percentage}]}. */
export function buildAssessmentSeries(responses: ResponseLike[]): AssessmentSeries[] {
  const map = new Map<string, AssessmentSeries>();
  for (const r of responses) {
    const name = respTemplateName(r);
    const date = r.filled_at ?? r.created_at ?? null;
    const pctRaw = r.score_percentage;
    if (!date || pctRaw === null || pctRaw === undefined) continue;
    const pct = Number(pctRaw);
    if (!Number.isFinite(pct)) continue;
    const key = String(r.template_id ?? name);
    if (!key) continue;
    const series = map.get(key) ?? { template_id: key, name, points: [] };
    series.points.push({ date, score_percentage: pct, total_score: 0, max_possible_score: 0 });
    map.set(key, series);
  }
  return Array.from(map.values());
}

// Tendência: entre as 2 respostas mais recentes do MESMO formulário; escolhe a de
// maior variação absoluta que atinja o limiar. Retorna null se nenhuma qualificar.
function detectScoreTrend(
  series: AssessmentSeries[],
  minDelta: number,
  label: ComposeOptions["trend"],
): EvolutionScoreTrend | null {
  let best: { name: string; from: number; to: number; delta: number } | null = null;
  for (const s of series) {
    if (s.points.length < 2) continue;
    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    const from = Math.round(sorted[sorted.length - 2].score_percentage);
    const to = Math.round(sorted[sorted.length - 1].score_percentage);
    const delta = Math.abs(to - from);
    if (delta < minDelta) continue;
    if (!best || delta > best.delta) best = { name: s.name, from, to, delta };
  }
  if (!best) return null;
  return { label: label(best.name, best.from, best.to), from: best.from, to: best.to };
}

/**
 * Composição PURA do resumo evolutivo, a partir de registros já carregados.
 * Testável (formatação localizada injetada via opts). Retorna null quando não há
 * nenhuma observação de sessão, deixando o painel cair no resumo manual.
 */
export function composeEvolutionDigest(
  records: SessionRecordLike[],
  assessmentSeries: AssessmentSeries[],
  opts: ComposeOptions,
): EvolutionDigest | null {
  const limit = opts.limit ?? 5;
  const maxBullets = opts.maxBullets ?? 5;
  const maxChars = opts.maxChars ?? 280;
  const trendMinDelta = opts.trendMinDelta ?? 5;

  // 1) sessões com data, ordenadas da mais recente para a mais antiga.
  const dated = records
    .map((r) => ({ r, ts: sessionTimestamp(r) }))
    .filter((x): x is { r: SessionRecordLike; ts: string } => x.ts !== null)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const recent = dated.slice(0, limit);

  // 2) observações deduplicadas (case-insensitive + trim), recentes primeiro.
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const { r } of recent) {
    for (const obs of r.key_observations ?? []) {
      const clean = (obs ?? "").trim();
      if (!clean) continue;
      const dedupKey = clean.toLowerCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      bullets.push(clean);
      if (bullets.length >= maxBullets) break;
    }
    if (bullets.length >= maxBullets) break;
  }

  if (bullets.length === 0) return null; // sem observação, painel usa o resumo manual

  // 3) tendência de score (opcional).
  const scoreTrend = detectScoreTrend(assessmentSeries, trendMinDelta, opts.trend);

  // 4) período das sessões consideradas.
  const stamps = recent.map((x) => x.ts).sort((a, b) => a.localeCompare(b));
  let period: string | null = null;
  if (stamps.length > 0) {
    const from = opts.formatDate(stamps[0]);
    const to = opts.formatDate(stamps[stamps.length - 1]);
    period = from === to ? from : `${from}${opts.periodSep}${to}`;
  }

  // 5) texto condensado (2 a 3 linhas), sem travessão. Frase a partir dos bullets
  // + a tendência quando houver; teto de caracteres.
  const sentence = bullets.slice(0, 3).join(". ").trim();
  let text = sentence.endsWith(".") ? sentence : `${sentence}.`;
  if (scoreTrend) text += ` ${scoreTrend.label}.`;
  if (text.length > maxChars) text = `${text.slice(0, maxChars - 1).trimEnd()}…`;

  return { text, bullets, sessionsCount: recent.length, period, scoreTrend };
}

/** Envelope localizado: resolve locale/traduções e chama a composição pura. */
export async function composeEvolutionDigestLocalized(
  records: SessionRecordLike[],
  responses: ResponseLike[],
  opts?: { limit?: number },
): Promise<EvolutionDigest | null> {
  const { getLocale, getTranslations } = await import("next-intl/server");
  const locale = await getLocale();
  const t = await getTranslations("directionPanel");
  const df = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const series = buildAssessmentSeries(responses);
  return composeEvolutionDigest(records, series, {
    limit: opts?.limit,
    formatDate: (iso) => df.format(new Date(iso)),
    periodSep: t("periodSep"),
    trend: (name, from, to) => t("trend", { name, from, to }),
  });
}

/**
 * Resumo evolutivo do paciente (últimas ~5 sessões). Query enxuta própria (não
 * reusa getPatientEvolution, que puxa exames/vitais desnecessários aqui).
 * Escopo de tenant: filtra por clinic_id quando informado; senão herda a RLS.
 */
export async function getEvolutionDigest(
  patientId: string,
  opts?: { limit?: number; clinicId?: string },
): Promise<EvolutionDigest | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const clinicId = opts?.clinicId;

  let recordsQ = supabase
    .from("session_records")
    .select("key_observations, created_at, appointments(starts_at)")
    .eq("patient_id", patientId);
  if (clinicId) recordsQ = recordsQ.eq("clinic_id", clinicId);
  recordsQ = recordsQ.order("created_at", { ascending: false }).limit(20);

  let respQ = supabase
    .from("assessment_responses")
    .select("template_id, score_percentage, filled_at, created_at, assessment_templates(name)")
    .eq("patient_id", patientId);
  if (clinicId) respQ = respQ.eq("clinic_id", clinicId);
  respQ = respQ.order("filled_at", { ascending: true });

  const [{ data: records }, { data: responses }] = await Promise.all([recordsQ, respQ]);

  return composeEvolutionDigestLocalized(
    (records ?? []) as SessionRecordLike[],
    (responses ?? []) as ResponseLike[],
    { limit: opts?.limit },
  );
}

export async function getPatientEvolution(patientId: string): Promise<EvolutionData> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const { getCurrentClinic, getClinicSessionConfig } = await import("@/services/clinic-service");
  const { defaultSessionConfig } = await import("@/modules/session/session-config");

  const supabase = await createSupabaseServerClient();

  // Config de vitais/escala da clínica: o gráfico mostra os vitais configurados
  // (inclusive customizados) na escala certa, em vez dos 4 fixos + escala 1–5.
  const clinic = await getCurrentClinic();
  const sessionConfig = clinic ? await getClinicSessionConfig(clinic.id) : defaultSessionConfig();

  const [{ data: exams }, { data: assessments }, { data: sessionRecords }] = await Promise.all([
    supabase
      .from("patient_exams")
      .select("exam_date, lab_name, exam_results(biomarker, value, unit, ref_min, ref_max, status)")
      .eq("patient_id", patientId)
      .order("exam_date", { ascending: true }),
    supabase
      .from("assessment_responses")
      .select("filled_at, score_percentage, total_score, max_possible_score, assessment_templates(id, name)")
      .eq("patient_id", patientId)
      .order("filled_at", { ascending: true }),
    supabase
      .from("session_records")
      .select("vitals, appointments(starts_at)")
      .eq("patient_id", patientId)
      .not("vitals", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  // Group exam results by biomarker name
  const biomarkerMap = new Map<string, BiomarkerSeries>();

  type ExamResult = { biomarker: string; value: string | number; unit: string | null; ref_min: string | number | null; ref_max: string | number | null; status: string };

  for (const exam of exams ?? []) {
    for (const result of (exam.exam_results as ExamResult[]) ?? []) {
      const key = result.biomarker.toLowerCase().trim();
      if (!biomarkerMap.has(key)) {
        biomarkerMap.set(key, {
          name: result.biomarker,
          unit: result.unit ?? null,
          points: [],
        });
      }
      biomarkerMap.get(key)!.points.push({
        date: exam.exam_date,
        value: Number(result.value),
        ref_min: result.ref_min != null ? Number(result.ref_min) : null,
        ref_max: result.ref_max != null ? Number(result.ref_max) : null,
        status: result.status,
        lab_name: exam.lab_name ?? null,
      });
    }
  }

  // Only include biomarkers with at least 1 point (show all, even single)
  const biomarkers = Array.from(biomarkerMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Group assessment scores by template
  const assessmentMap = new Map<string, AssessmentSeries>();

  for (const resp of assessments ?? []) {
    const raw = resp as unknown as { assessment_templates?: { id: string; name: string } | { id: string; name: string }[] | null };
    const tmpl = raw.assessment_templates;
    const template = Array.isArray(tmpl) ? tmpl[0] ?? null : (tmpl ?? null);
    if (!template) continue;
    const key = template.id;
    if (!assessmentMap.has(key)) {
      assessmentMap.set(key, {
        template_id: template.id,
        name: template.name,
        points: [],
      });
    }
    assessmentMap.get(key)!.points.push({
      date: resp.filled_at,
      score_percentage: Number(resp.score_percentage ?? 0),
      total_score: Number(resp.total_score ?? 0),
      max_possible_score: Number(resp.max_possible_score ?? 0),
    });
  }

  const assessmentSeries = Array.from(assessmentMap.values()).filter(
    (s) => s.points.length >= 1
  );

  // Build vitals time series from session records
  type SessionVitalsRow = {
    vitals: Record<string, number | null> | null;
    appointments: { starts_at: string } | { starts_at: string }[] | null;
  };

  const vitals: VitalPoint[] = (sessionRecords ?? [])
    .map((r) => {
      const row = r as unknown as SessionVitalsRow;
      const appt = Array.isArray(row.appointments) ? row.appointments[0] ?? null : row.appointments;
      return { vitals: row.vitals, starts_at: appt?.starts_at ?? null };
    })
    .filter((r): r is { vitals: Record<string, number | null>; starts_at: string } =>
      Boolean(r.vitals && r.starts_at)
    )
    .map((r) => ({
      date: r.starts_at,
      // Um valor por vital configurado (chaves reais dos dados).
      values: Object.fromEntries(
        sessionConfig.vitals.map((cv) => [
          cv.key,
          r.vitals?.[cv.key] != null ? Number(r.vitals[cv.key]) : null,
        ]),
      ) as Record<string, number | null>,
    }));

  const vitalDefs: VitalDef[] = sessionConfig.vitals.map((cv) => ({
    key: cv.key,
    label: cv.label,
    color: cv.color,
  }));

  return {
    biomarkers,
    assessments: assessmentSeries,
    vitals,
    vitalDefs,
    vitalsScaleMax: sessionConfig.scaleMax,
  };
}
