-- 156_add_clinics_clinical_pack_id.sql
-- Frente B (Passo 3): binding "qual clinica usa qual metodo clinico (Clinical Pack)".
--
-- Principio: a ENCANACAO do motor de IA (gerar -> validar por humano -> revisar ->
-- aprovar -> enviar) e HORIZONTAL e serve qualquer clinica. O CONTEUDO do metodo
-- (prompt do relatorio, schema de saida, prompts de apoio) vira um Clinical Pack,
-- definido em CODIGO e versionado (modules/clinical-packs). Este binding
-- "clinica -> pack" fica em DADOS, por tenant, nesta coluna.
--
-- Regra de ouro:
--   * default 'generic' para QUALQUER clinica (nova ou existente): horizontal, sem Neuro ID.
--   * backfill explicito da IFWC para 'bio3-neuroid': a IFWC e a unica clinica com o
--     metodo Bio3/Neuro ID em producao hoje, entao ela mantem exatamente o comportamento
--     atual (zero regressao).
--
-- Seguranca: coluna simples, NOT NULL com default; nao altera RLS. A leitura em app roda
-- via admin client (service_role) filtrando por id explicito (padrao ja usado no Core),
-- e o resolvedor cai em 'bio3-neuroid' se a leitura falhar, para a IFWC nunca quebrar.
--
-- Idempotente: 'add column if not exists' + update por id fixo podem ser reaplicados.

alter table public.clinics
  add column if not exists clinical_pack_id text not null default 'generic';

comment on column public.clinics.clinical_pack_id is
  'Clinical Pack ativo da clinica (metodo clinico do motor de IA). Ex.: generic, bio3-neuroid. '
  'Binding por tenant; a definicao do pack mora no codigo em modules/clinical-packs.';

-- Backfill da IFWC (unica clinica com metodo Bio3/Neuro ID em producao).
update public.clinics
  set clinical_pack_id = 'bio3-neuroid'
  where id = '98e98ef3-a056-40bd-989b-0ab69d0c4bff';
