-- 148: coluna `code` opcional em assessment_questions.
--
-- Liga cada pergunta ao CÓDIGO de resposta que a fiação do Mapa Bio³ usa
-- (modules/neuro-id/unified-form-import). Necessária para o formulário unificado
-- Neuro ID: sem ela não dá para mapear a resposta de volta ao pilar/catálogo.
--
-- Aditiva e nullable: não afeta os questionários existentes (Q-SNA/QRM/MSQ, que
-- continuam mapeados por nome/seção em question-map.ts). NÃO APLICADA ainda.

alter table public.assessment_questions
  add column if not exists code text;

comment on column public.assessment_questions.code is
  'Código Neuro ID da resposta (ex.: bf_palpitacoes_freq). Usado só pelo formulário unificado; null nos questionários legados.';
