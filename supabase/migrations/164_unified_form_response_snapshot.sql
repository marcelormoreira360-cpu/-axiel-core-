-- 164_unified_form_response_snapshot.sql
--
-- O FORMULÁRIO UNIFICADO Neuro ID ("Perfil Clínico Integrado de 30 Dias") é
-- renderizado a partir do CÓDIGO (não tem assessment_questions no banco). Até
-- aqui, ao ser respondido, ele gravava só o Mapa Bio³ (patient_assessments /
-- patient_neuro_id_scores) e DESCARTAVA as respostas de texto/escolha, além de
-- não aparecer na seção "Questionários".
--
-- Esta coluna guarda o snapshot completo das respostas (por código) no próprio
-- registro de resposta, para: (a) não perder nenhuma resposta; (b) alimentar a
-- lista de Questionários; (c) permitir a tela de detalhe da resposta.
--
-- Aditiva e nullable: questionários normais continuam usando assessment_answers
-- e deixam raw_answers em NULL. Sem impacto em RLS (herda as políticas da tabela).

alter table public.assessment_responses
  add column if not exists raw_answers jsonb;

comment on column public.assessment_responses.raw_answers is
  'Snapshot das respostas cruas por código do formulário unificado Neuro ID (renderizado por código, sem assessment_questions). NULL para questionários normais.';
