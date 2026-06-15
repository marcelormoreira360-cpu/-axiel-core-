-- Migration 077: auto-cadastro do paciente + bairro + camada de tendências anonimizada
--
-- Contexto: o paciente preenche os próprios dados (incl. endereço) por um link público.
-- Esses dados, COM consentimento explícito e separado (`analytics_anonymized`),
-- alimentam um "produto de tendências" exposto APENAS de forma agregada e anonimizada.
--
-- Privacidade (LGPD): a view só conta pacientes que consentiram, agrega por
-- cidade+estado+faixa etária, NÃO expõe identificadores nem clinic_id, e suprime
-- células com menos de 5 pessoas (k-anonimato). Acesso só via service_role.

-- ── 1. Endereço: bairro ───────────────────────────────────────────────────────
-- (address_line/city/state/zip_code/country já existem desde a mig 056)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS neighborhood text;

-- ── 2. Consentimento analítico ────────────────────────────────────────────────
-- `patient_consents.consent_type` é texto livre (sem CHECK), então o novo valor
-- 'analytics_anonymized' não exige mudança de schema. Documentado aqui por clareza.
COMMENT ON COLUMN public.patient_consents.consent_type IS
  'data_processing | marketing | sharing | portal_access | analytics_anonymized';

-- ── 3. View agregada e anonimizada de tendências ──────────────────────────────
-- security_invoker = on (recomendação Supabase; evita o lint security_definer_view).
-- Lida só via service_role (admin client), que ignora RLS → agregados globais.
-- Caso um usuário autenticado consulte, o RLS de `patients` ainda escopa os dados.
-- De toda forma o acesso é bloqueado para anon/authenticated logo abaixo.
DROP VIEW IF EXISTS public.patient_trends_agg;
CREATE VIEW public.patient_trends_agg
WITH (security_invoker = on)
AS
WITH consented AS (
  -- Último consentimento analítico por paciente (granted = true)
  SELECT DISTINCT ON (pc.patient_id) pc.patient_id, pc.granted
  FROM public.patient_consents pc
  WHERE pc.consent_type = 'analytics_anonymized'
  ORDER BY pc.patient_id, pc.created_at DESC
)
SELECT
  p.state                                            AS state,
  p.city                                             AS city,
  CASE
    WHEN p.date_of_birth IS NULL                              THEN 'desconhecido'
    WHEN date_part('year', age(p.date_of_birth)) < 18         THEN '0-17'
    WHEN date_part('year', age(p.date_of_birth)) < 30         THEN '18-29'
    WHEN date_part('year', age(p.date_of_birth)) < 45         THEN '30-44'
    WHEN date_part('year', age(p.date_of_birth)) < 60         THEN '45-59'
    ELSE                                                           '60+'
  END                                                AS age_band,
  count(*)::int                                      AS patient_count
FROM public.patients p
JOIN consented c ON c.patient_id = p.id AND c.granted = true
WHERE p.status <> 'archived'
GROUP BY p.state, p.city, age_band
HAVING count(*) >= 5;  -- k-anonimato: nunca expõe grupos menores que 5

COMMENT ON VIEW public.patient_trends_agg IS
  'Tendências anonimizadas (cidade+estado+faixa etária) de pacientes que consentiram '
  'uso analítico. Sem identificadores nem clinic_id. Células < 5 suprimidas. '
  'Acesso só via service_role.';

-- Bloqueia exposição pública via PostgREST; só service_role (admin client) lê.
REVOKE ALL ON public.patient_trends_agg FROM anon, authenticated;

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
