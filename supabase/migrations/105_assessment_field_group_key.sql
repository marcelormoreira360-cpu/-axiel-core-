-- 105_assessment_field_group_key.sql
-- Avaliação: ordem 100% configurável pela clínica.
--
-- Antes: a ficha renderizava por uma espinha ATM FIXA no código (ASSESSMENT_GROUP_ORDER
-- em lib/assessment-groups.ts) e o agrupamento vinha de um mapa fixo (groupForFieldKey).
-- Resultado: a ordem definida na config (order_index) NÃO valia na ficha (ex.: Anamnese
-- em 1º na config, mas no 4º bloco na ficha).
--
-- Agora: a ficha renderiza pela ORDEM GLOBAL (order_index, que a config já controla) e
-- agrupa em blocos contíguos pelo novo group_key. A config passa a mandar 100%.
-- group_key default 'mediadores' (igual ao fallback do código); backfill dos campos
-- conhecidos pela MESMA classificação do mapa ATM. Aditivo e idempotente.

alter table public.clinic_assessment_fields
  add column if not exists group_key text not null default 'mediadores';

-- Valida os 5 grupos da espinha ATM (rótulos i18n group.*).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinic_assessment_fields_group_key_chk'
  ) then
    alter table public.clinic_assessment_fields
      add constraint clinic_assessment_fields_group_key_chk
      check (group_key in ('objetivo','antecedentes','gatilhos','mediadores','integracao'));
  end if;
end $$;

-- Backfill: mesma classificação do mapa ATM do código (assessment-groups.ts).
update public.clinic_assessment_fields set group_key = 'objetivo'     where field_key = 'objetivo';
update public.clinic_assessment_fields set group_key = 'antecedentes' where field_key = 'antecedents';
update public.clinic_assessment_fields set group_key = 'gatilhos'     where field_key = 'linha_do_tempo';
update public.clinic_assessment_fields set group_key = 'mediadores'   where field_key in ('anamnese','pain_level','pain_location');
update public.clinic_assessment_fields set group_key = 'integracao'   where field_key in ('integracao_atm','treatment_note');

notify pgrst, 'reload schema';
