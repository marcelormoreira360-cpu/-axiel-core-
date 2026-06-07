-- migration 068_session_clinical_tests.sql
-- Feature 3: testes clínicos presenciais registrados na sessão.
-- clinical_tests = array de { "name": "...", "result": "...", "notes": "..." }.
-- Cada clínica monta a própria bateria de testes (genérico/comercial); a UI
-- repete os nomes da sessão anterior (carry-forward), sem catálogo fixo.
alter table public.session_records
  add column if not exists clinical_tests jsonb;

notify pgrst, 'reload schema';
