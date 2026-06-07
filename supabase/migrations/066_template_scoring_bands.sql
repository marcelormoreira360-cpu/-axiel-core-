-- migration 066_template_scoring_bands.sql
-- Grau de disfunção configurável por template (Feature 1).
-- scoring_config guarda as faixas de interpretação do score:
--   {
--     "total_bands":   [{ "min": 0, "max": 20,  "label": "Sem disfunção", "color": "#0F6E56" }, ...],
--     "section_bands": [{ "min": 0, "max": 9,   "label": "Normal",        "color": "#0F6E56" }, ...],
--     "flag_item_max": true   -- sinaliza itens que atingem a pontuação máxima
--   }
-- "max": null numa faixa = sem limite superior (ex.: "106+").
-- Por template => cada clínica define as próprias faixas (genérico/comercial).
alter table public.assessment_templates
  add column if not exists scoring_config jsonb;

notify pgrst, 'reload schema';
