-- 098_neuro_id_map_articulacoes.sql
-- "Articulações/músculos" passa a preencher o item visível qrm_musculo_articular (biomecânico).
update public.neuro_id_question_map set catalog_code='qrm_musculo_articular'
  where template_match in ('Rastreamento Metab','MSQ') and upper(section_match) in ('ARTICULA','JOINTS');
notify pgrst, 'reload schema';
