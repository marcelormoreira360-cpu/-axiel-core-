
-- 076_referral_program.sql
-- Programa de indicação: "indique outra clínica e ambos ganham 1 mês grátis".
-- Cria: clinics.referral_code + clinics.referred_by_clinic_id + tabela
-- referral_conversions (rastreio signed_up → converted → rewarded).
-- Não destrutivo, sem dados sensíveis. Seguro para aplicar antes do deploy.
-- ✅ APLICADA em produção em 10/06/2026 via conector Supabase.


-- 1) Código de indicação da clínica (8 chars alfanuméricos, gerado pelo app
--    via services/referral-service.ts; backfill abaixo cobre as existentes).
alter table public.clinics
  add column if not exists referral_code text,
  add column if not exists referred_by_clinic_id uuid references public.clinics(id) on delete set null;

-- Unicidade do código (parcial: ignora NULL enquanto o código não foi gerado).
create unique index if not exists clinics_referral_code_uq
  on public.clinics (referral_code)
  where referral_code is not null;

-- Lookup das clínicas indicadas por uma clínica.
create index if not exists clinics_referred_by_idx
  on public.clinics (referred_by_clinic_id)
  where referred_by_clinic_id is not null;

-- 2) Conversões de indicação — 1 linha por clínica indicada (unique).
--    status: 'signed_up' (criou conta) → 'converted' (assinatura paga ativa)
--    → 'rewarded' (indicador recebeu o cupom de 1 mês grátis).
create table if not exists public.referral_conversions (
  id                 uuid primary key default gen_random_uuid(),
  referrer_clinic_id uuid not null references public.clinics(id) on delete cascade,
  referred_clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  status             text not null default 'signed_up'
                       check (status in ('signed_up', 'converted', 'rewarded')),
  created_at         timestamptz not null default now(),
  converted_at       timestamptz,
  rewarded_at        timestamptz,
  -- Auto-indicação nunca é válida.
  constraint referral_conversions_no_self check (referrer_clinic_id <> referred_clinic_id)
);

create index if not exists referral_conversions_referrer_idx
  on public.referral_conversions (referrer_clinic_id);

-- 3) RLS: a clínica só enxerga as conversões em que ela é a INDICADORA.
--    Escritas acontecem apenas via service role (admin client) — sem policy
--    de insert/update para usuários comuns.
alter table public.referral_conversions enable row level security;

drop policy if exists referral_conversions_select on public.referral_conversions;
create policy referral_conversions_select on public.referral_conversions
  for select using (
    referrer_clinic_id in (
      select u.clinic_id from public.users u where u.id = (select auth.uid())
    )
  );

-- 4) Backfill: gera referral_code para as clínicas existentes.
--    md5 → 8 chars hex (alfanuméricos, minúsculos→upper). Colisão é
--    estatisticamente desprezível e, se ocorrer, o índice único barra o update
--    (rodar de novo resolve). Novos códigos do app usam crypto com retry.
update public.clinics
   set referral_code = upper(substr(md5(id::text || gen_random_uuid()::text), 1, 8))
 where referral_code is null;
