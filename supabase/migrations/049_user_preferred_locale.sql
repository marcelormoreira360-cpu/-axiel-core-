-- 049_user_preferred_locale.sql
-- Adiciona preferência de idioma por usuário para o app bilíngue PT-BR / EN.
-- Default 'pt-BR' garante zero regressão para usuários existentes.

alter table public.users
  add column if not exists preferred_locale text not null default 'pt-BR';

-- Restringe aos locales suportados (idempotente: só cria se ainda não existir).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_preferred_locale_check'
  ) then
    alter table public.users
      add constraint users_preferred_locale_check
      check (preferred_locale in ('pt-BR', 'en'));
  end if;
end $$;

comment on column public.users.preferred_locale is
  'Idioma preferido da interface (pt-BR | en). Fonte da verdade para usuário logado; áreas públicas usam cookie AXIEL_LOCALE.';
