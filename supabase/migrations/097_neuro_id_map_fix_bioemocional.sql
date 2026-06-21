-- 097_neuro_id_map_fix_bioemocional.sql
-- Corrige o de-para já semeado (todas as clínicas), sem depender de re-seed de código:
-- seções bioemocionais → itens qrm_* (visíveis) + intestino e qrm_total no bioquímico.
-- Necessário porque ensureClinicQuestionMap só semeia quando a tabela está vazia.
update public.neuro_id_question_map set catalog_code='qrm_coracao'
  where template_match in ('Rastreamento Metab','MSQ') and upper(section_match) in ('CORAÇÃO','HEART');
update public.neuro_id_question_map set catalog_code='qrm_pulmao'
  where template_match in ('Rastreamento Metab','MSQ') and upper(section_match) in ('PULMÃO','LUNGS');
update public.neuro_id_question_map set catalog_code='qrm_trato_digestivo'
  where template_match in ('Rastreamento Metab','MSQ') and upper(section_match) in ('DIGESTIVO','DIGESTIVE');
update public.neuro_id_question_map set catalog_code='qrm_mente'
  where template_match in ('Rastreamento Metab','MSQ') and upper(section_match) in ('MENTE','MIND');
update public.neuro_id_question_map set catalog_code='qrm_emocoes'
  where template_match in ('Rastreamento Metab','MSQ') and upper(section_match) in ('EMOÇÕES','EMOTIONS');

insert into public.neuro_id_question_map (clinic_id, source, template_match, section_match, catalog_code, weight, active)
select distinct clinic_id, 'assessment', 'Rastreamento Metab', 'DIGESTIVO', 'intestino', 1, true
  from public.neuro_id_question_map
on conflict do nothing;

insert into public.neuro_id_question_map (clinic_id, source, template_match, section_match, catalog_code, weight, active)
select distinct clinic_id, 'assessment', 'Rastreamento Metab', null, 'qrm_total', 1, true
  from public.neuro_id_question_map
on conflict do nothing;

notify pgrst, 'reload schema';
