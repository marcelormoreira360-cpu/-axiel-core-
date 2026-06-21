-- 096_neuro_id_question_map_reseed.sql
-- O de-para questionário→Bio³ mudou (bioemocional vai para qrm_*; + intestino e qrm_total).
-- A tabela já semeada por clínica usa o mapa ANTIGO. Removendo as linhas, o
-- ensureClinicQuestionMap re-semeia os defaults NOVOS no próximo uso (por clínica).
-- Seguro: neuro_id_question_map é CONFIGURAÇÃO (sem dado clínico de paciente).
delete from public.neuro_id_question_map;
notify pgrst, 'reload schema';
