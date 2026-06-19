/**
 * patient-demographics.ts — Fonte única da demografia do paciente.
 *
 * A idade é SEMPRE derivada de `date_of_birth` (nunca armazenada fixa).
 * Os geradores (AI Insight, PDF 360, Bio³) leem daqui — "Não informado" só
 * quando o campo realmente está vazio.
 */

export type PatientDemographicsInput = {
  full_name?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  city?: string | null;
  state?: string | null;
};

/** Idade em anos a partir de date_of_birth (YYYY-MM-DD). null se vazio/ inválido. */
export function ageFromDob(dob?: string | null, now: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob.length <= 10 ? `${dob}T00:00:00` : dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 130) return null;
  return age;
}

/** Bloco de identificação derivado do cadastro (strings prontas ou null). */
export type PatientIdentificacao = {
  paciente: string | null;
  idade: string | null;
  sexo: string | null;
  peso: string | null;
  altura: string | null;
  local: string | null;
};

export function patientIdentificacao(p: PatientDemographicsInput, now: Date = new Date()): PatientIdentificacao {
  const age = ageFromDob(p.date_of_birth, now);
  const local = [p.city, p.state].map((x) => (x ?? "").trim()).filter(Boolean).join(" / ") || null;
  return {
    paciente: (p.full_name ?? "").trim() || null,
    idade: age === null ? null : `${age} anos`,
    sexo: (p.sex ?? "").trim() || null,
    peso: p.weight_kg != null && Number.isFinite(p.weight_kg) ? `${p.weight_kg} kg` : null,
    altura: p.height_cm != null && Number.isFinite(p.height_cm) ? `${p.height_cm} cm` : null,
    local,
  };
}

const SEX_PT: Record<string, string> = { female: "Feminino", male: "Masculino", other: "Outro" };

/** Identificação ao vivo do cadastro com o sexo localizado em PT (para a revisão web). */
export function liveIdentificacaoPt(p: PatientDemographicsInput, now: Date = new Date()): PatientIdentificacao {
  const base = patientIdentificacao(p, now);
  return { ...base, sexo: base.sexo ? (SEX_PT[base.sexo.toLowerCase()] ?? base.sexo) : null };
}
