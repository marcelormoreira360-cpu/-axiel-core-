-- migration 070_body_map_field.sql
-- Mapa anatômico (corpo/coluna/vísceras) como campo de questionário e anotação na sessão.
-- 1) novo tipo de pergunta de intake "body_map" (a imagem escolhida fica em intake_questions.placeholder)
alter type public.intake_question_type add value if not exists 'body_map';

-- 2) anotações de mapa na sessão: array de { "map": "corpo|coluna|visceras", "notes": "..." }
alter table public.session_records
  add column if not exists body_map_notes jsonb;

notify pgrst, 'reload schema';
