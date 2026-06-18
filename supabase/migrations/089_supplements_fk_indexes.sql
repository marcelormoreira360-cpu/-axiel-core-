-- 089_supplements_fk_indexes.sql
-- Índices das FKs restantes das tabelas de suplementos (advisor unindexed_foreign_keys).
create index if not exists psr_report_idx
  on public.patient_supplement_recommendations (report_id);
create index if not exists psr_created_by_idx
  on public.patient_supplement_recommendations (created_by);
create index if not exists psr_reviewed_by_idx
  on public.patient_supplement_recommendations (reviewed_by);
create index if not exists psri_catalog_idx
  on public.patient_supplement_recommendation_items (catalog_id);
