import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Linha agregada e anonimizada da view `patient_trends_agg`.
 * Sem identificadores nem clinic_id; só células com >= 5 pacientes consentidos.
 */
export type PatientTrendRow = {
  state: string | null;
  city: string | null;
  age_band: string;
  patient_count: number;
};

export type PatientTrendsSummary = {
  rows: PatientTrendRow[];
  totalConsented: number;
  distinctCities: number;
  byAgeBand: { age_band: string; patient_count: number }[];
};

const AGE_ORDER = ["0-17", "18-29", "30-44", "45-59", "60+", "desconhecido"];

/**
 * Lê a camada de tendências via admin client (a view é bloqueada para anon/authenticated).
 * O acesso deve ser gateado por papel de gestor na página que a consome.
 */
export async function getPatientTrends(): Promise<PatientTrendsSummary> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patient_trends_agg")
    .select("state, city, age_band, patient_count")
    .order("patient_count", { ascending: false });

  if (error) {
    console.error("[getPatientTrends] %s", error.message);
    return { rows: [], totalConsented: 0, distinctCities: 0, byAgeBand: [] };
  }

  const rows = (data ?? []) as PatientTrendRow[];
  const totalConsented = rows.reduce((s, r) => s + (r.patient_count ?? 0), 0);
  const distinctCities = new Set(
    rows.map((r) => `${r.state ?? ""}|${r.city ?? ""}`),
  ).size;

  const ageMap = new Map<string, number>();
  for (const r of rows) {
    ageMap.set(r.age_band, (ageMap.get(r.age_band) ?? 0) + r.patient_count);
  }
  const byAgeBand = [...ageMap.entries()]
    .map(([age_band, patient_count]) => ({ age_band, patient_count }))
    .sort((a, b) => AGE_ORDER.indexOf(a.age_band) - AGE_ORDER.indexOf(b.age_band));

  return { rows, totalConsented, distinctCities, byAgeBand };
}
