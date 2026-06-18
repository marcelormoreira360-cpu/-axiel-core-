-- 092_neuro_id_catalog_reseed.sql
-- Os codes do catálogo Neuro ID mudaram (mapeamento §2 do _BRIEF_BIO3_AJUSTE_PILARES).
-- O catálogo já semeado em produção usa os codes ANTIGOS, que não batem mais com
-- o motor/form. Esta migration remove o catálogo antigo para que
-- `ensureClinicCatalog` re-semeie os defaults NOVOS no próximo uso (por clínica).
--
-- Seguro: assessment_items_catalog é CONFIGURAÇÃO; nenhum dado clínico de paciente
-- é apagado. `patient_assessment_values.catalog_id` é ON DELETE SET NULL (não há
-- avaliações reais ainda — só a de teste, já removida).
--
-- ⚠️ NÃO aplicada automaticamente — aguardando OK do Marcelo.

delete from public.assessment_items_catalog;

notify pgrst, 'reload schema';
