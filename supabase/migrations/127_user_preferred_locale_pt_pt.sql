-- 127_user_preferred_locale_pt_pt.sql
-- Comercialização trilíngue: adiciona pt-PT (Portugal) aos locales aceitos em
-- users.preferred_locale. Antes o CHECK (049) só permitia 'pt-BR' e 'en', então
-- a preferência pt-PT do usuário não persistia no banco (só no cookie).

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'users_preferred_locale_check'
  ) then
    alter table public.users drop constraint users_preferred_locale_check;
  end if;

  alter table public.users
    add constraint users_preferred_locale_check
    check (preferred_locale in ('pt-BR', 'en', 'pt-PT'));
end $$;

comment on column public.users.preferred_locale is
  'Idioma preferido da interface (pt-BR | en | pt-PT). Fonte da verdade para usuário logado; áreas públicas usam cookie AXIEL_LOCALE.';
