-- 144: nome legal (razao social) da clinica para o texto da politica de no-show.
--
-- Motivo: o texto v3.0 da politica de agendamento/cancelamento passou a usar o
-- placeholder {clinic_name} no lugar do nome fixo "Moreira & Angeli LLC", para
-- vender o produto a OUTRAS clinicas. Este campo guarda a razao social por clinica.
--
-- Aditiva e idempotente (add column if not exists). Nullable de proposito: quando
-- null, o app usa clinics.name como fallback (ver getClinicPolicyPresentation e o
-- render em app/book e app/confirmar). Nenhuma mudanca de RLS: a coluna herda as
-- policies ja existentes de public.clinics. Nenhum dado tocado.
--
-- Pos-migration (manual, via MCP com OK do Marcelo): setar a IFWC ->
--   update public.clinics set legal_entity_name = 'Moreira & Angeli LLC' where slug = 'ifwc';

alter table public.clinics
  add column if not exists legal_entity_name text;

comment on column public.clinics.legal_entity_name is
  'Razao social / nome legal da entidade (ex.: "Moreira & Angeli LLC") que preenche {clinic_name} na politica de no-show. Nullable; quando null, o app usa clinics.name como fallback.';
