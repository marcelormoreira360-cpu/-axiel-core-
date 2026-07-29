-- 139_mental_health_section_bands.sql
-- ⚠️ ATUALIZAÇÃO DE DADOS (não é mudança de schema). NÃO aplicar sem revisão.
--
-- Objetivo: separar o resultado do questionário público de saúde mental em DOIS
-- scores independentes (PHQ-9 = humor/depressão e GAD-7 = ansiedade), cada um com
-- sua PRÓPRIA faixa, em vez do score único somado. Somar mascara depressão grave
-- sob ansiedade baixa (recomendação do Aval).
--
-- Implementação: preenche `section_bands` do scoring_config dos 2 templates. Como
-- PHQ-9 e GAD-7 compartilham os MESMOS cortes clínicos (0-4 / 5-9 / 10-14 / 15+),
-- um único conjunto de 4 faixas serve às duas seções; a faixa de topo é aberta
-- (max = null), cobrindo 15-27 no PHQ-9 e 15-21 no GAD-7. O `max` de cada eixo é
-- resolvido em runtime pela soma dos max_score das perguntas de cada seção.
--
-- Também zera `total_bands` para NÃO exibir mais a faixa do somatório único.
-- O gate de crise (item 9 do PHQ-9, ideação) é detectado por TEXTO no backend e
-- independe de qualquer faixa — continua disparando normalmente.
--
-- Labels/descrições ficam no idioma de cada template (EN e PT). Rever com Salvo/Aval
-- antes de aplicar em produção.

-- ── Template EN: "Mental Health Check-in (Depression & Anxiety)" ──────────────
UPDATE assessment_templates
SET scoring_config = jsonb_set(
  jsonb_set(
    coalesce(scoring_config, '{}'::jsonb) || jsonb_build_object('mode', 'absolute', 'flag_item_max', true),
    '{total_bands}', '[]'::jsonb, true
  ),
  '{section_bands}',
  '[
    {"min": 0,  "max": 4,    "label": "Not much weighing on you right now", "color": "#0F6E56", "description": "Over the past couple of weeks, these feelings don''t seem to be weighing on you much. That''s a good place to be, and it''s still worth checking in with yourself now and then."},
    {"min": 5,  "max": 9,    "label": "A few things to notice",          "color": "#B7791F", "description": "A few things are showing up here. Nothing alarming, but worth keeping an eye on how you''ve been feeling over the next couple of weeks."},
    {"min": 10, "max": 14,   "label": "Some signals worth talking about", "color": "#C2410C", "description": "Some of what you shared points to feelings that have been present fairly often lately. Talking it through with someone can help you make sense of it."},
    {"min": 15, "max": null, "label": "Worth a closer look with someone",  "color": "#B42318", "description": "Several of these have been weighing on you often over the past couple of weeks. That deserves a closer look with someone you trust, a provider or counselor. You don''t have to sort it out on your own."}
  ]'::jsonb,
  true
)
WHERE id = '0f74c83b-f67c-4b5e-843c-9a8033a0802c';

-- ── Template PT: "Check-in de Saúde Mental" ──────────────────────────────────
UPDATE assessment_templates
SET scoring_config = jsonb_set(
  jsonb_set(
    coalesce(scoring_config, '{}'::jsonb) || jsonb_build_object('mode', 'absolute', 'flag_item_max', true),
    '{total_bands}', '[]'::jsonb, true
  ),
  '{section_bands}',
  '[
    {"min": 0,  "max": 4,    "label": "Poucos sinais por agora",           "color": "#0F6E56", "description": "Nas últimas semanas, esses sentimentos parecem não estar pesando muito em você. É um bom lugar para se estar, e ainda vale se observar de vez em quando."},
    {"min": 5,  "max": 9,    "label": "Alguns pontos a notar",             "color": "#B7791F", "description": "Aparecem aqui alguns pontos. Nada alarmante, mas vale ficar de olho em como você tem se sentido nas próximas semanas."},
    {"min": 10, "max": 14,   "label": "Alguns sinais que vale conversar",  "color": "#C2410C", "description": "Parte do que você compartilhou aponta para sentimentos que têm aparecido com certa frequência ultimamente. Conversar sobre isso com alguém pode ajudar a entender melhor."},
    {"min": 15, "max": null, "label": "Vale um olhar mais de perto",       "color": "#B42318", "description": "Vários desses pontos têm pesado em você com frequência nas últimas semanas. Isso merece um olhar mais de perto com alguém de confiança, um profissional ou conselheiro. Você não precisa lidar com isso sozinho."}
  ]'::jsonb,
  true
)
WHERE id = '1abd91e3-e8ef-4f63-8cf2-9eed65f403f3';
