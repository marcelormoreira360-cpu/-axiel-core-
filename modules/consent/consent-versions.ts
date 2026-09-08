/**
 * Versão dos TERMOS de consentimento aceitos, gravada em patient_consents.policy_version.
 *
 * Objetivo (compliance): poder PROVAR depois QUAL versão do termo o paciente aceitou, não só
 * a data. Incremente a versão aqui sempre que o TEXTO/escopo do termo mudar — assim aceites
 * antigos continuam apontando para a versão que a pessoa realmente leu. Segue a convenção do
 * no-show (<tipo>_v<semver>).
 */
export const CONSENT_POLICY_VERSIONS = {
  data_processing: "data_processing_v1.0",
  marketing: "marketing_v1.0",
  analytics_anonymized: "analytics_anonymized_v1.0",
  portal_access: "portal_access_v1.0",
  channel: "channel_v1.0",
} as const;

export type ConsentPolicyKey = keyof typeof CONSENT_POLICY_VERSIONS;

/** Versão vigente do termo para um tipo de consentimento. */
export function consentPolicyVersion(key: ConsentPolicyKey): string {
  return CONSENT_POLICY_VERSIONS[key];
}
