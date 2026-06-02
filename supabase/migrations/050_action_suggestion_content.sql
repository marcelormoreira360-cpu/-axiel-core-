-- i18n das sugestões do Action Center.
-- Em vez de persistir texto em inglês, passamos a guardar uma chave de conteúdo
-- (content_key) + parâmetros (content_params) que são traduzidos no momento da
-- renderização (namespace `actions.suggestions.*`). As colunas title/description/
-- reason continuam existindo como fallback para linhas antigas.

alter table public.action_suggestions
  add column if not exists content_key text,
  add column if not exists content_params jsonb;
