-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019 — Seed: Serviços e Pacotes JIFWC
--
-- Insere os 6 tipos de sessão e os pacotes sugeridos para a clínica JIFWC.
-- Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente.
--
-- INSTRUÇÃO: substitua 'YOUR_CLINIC_ID' pelo UUID real da sua clínica
-- antes de rodar no Supabase SQL Editor, ou execute via:
--   supabase db push
-- (o clinic_id será resolvido pelo slug se você usar a sub-query abaixo).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Variável de conveniência: ajuste o slug da sua clínica ──────────────────
do $$
declare
  v_clinic_id uuid;
begin

  -- Resolve o clinic_id pelo slug
  select id into v_clinic_id
  from public.clinics
  where slug = 'ifwc'
  limit 1;

  if v_clinic_id is null then
    raise notice 'Clínica com slug "ifwc" não encontrada. Ajuste o slug e rode novamente.';
    return;
  end if;

  -- ── 1. Session Types ────────────────────────────────────────────────────────

  insert into public.session_types (clinic_id, name, duration_minutes, price_cents, is_online, is_active)
  values
    (v_clinic_id, 'Avaliação',                             60,  20000, false, true),
    (v_clinic_id, 'Sessão de Microfioterapia',             60,  30000, false, true),
    (v_clinic_id, 'Sessão de Terapia Manual',              60,  15000, false, true),
    (v_clinic_id, 'Exame de Neurometria (SNA)',            60,  20000, false, true),
    (v_clinic_id, 'Exame de Biorressonância',              60,  20000, false, true),
    (v_clinic_id, 'Exame de Hipersensibilidade Alimentar', 45,  15000, false, true)
  on conflict (clinic_id, name) do nothing;

  -- ── 2. Pacotes de Sessões (monetization_offers) ─────────────────────────────

  insert into public.monetization_offers
    (clinic_id, name, offer_type, price_cents, currency, number_of_sessions, description, is_active)
  values
    -- Pacote Microfioterapia 5x  (R$300 × 5 = R$1.500 → oferta R$1.350, -10%)
    (v_clinic_id,
     'Pacote Microfioterapia 5 sessões',
     'session_package',
     135000,
     'BRL',
     5,
     '5 sessões de Microfioterapia. Economize 10% em relação ao valor avulso (R$ 300/sessão).',
     true),

    -- Pacote Terapia Manual 10x  (R$150 × 10 = R$1.500 → oferta R$1.200, -20%)
    (v_clinic_id,
     'Pacote Terapia Manual 10 sessões',
     'session_package',
     120000,
     'BRL',
     10,
     '10 sessões de Terapia Manual. Economize 20% em relação ao valor avulso (R$ 150/sessão).',
     true),

    -- Pacote Microfioterapia 10x  (R$300 × 10 = R$3.000 → oferta R$2.550, -15%)
    (v_clinic_id,
     'Pacote Microfioterapia 10 sessões',
     'session_package',
     255000,
     'BRL',
     10,
     '10 sessões de Microfioterapia. Economize 15% em relação ao valor avulso (R$ 300/sessão).',
     true),

    -- Programa Completo: Avaliação + 8 Microfio  (R$200 + 8×R$300 = R$2.600 → oferta R$2.200, -15%)
    (v_clinic_id,
     'Programa Completo (Avaliação + 8 Microfioterapia)',
     'session_package',
     220000,
     'BRL',
     9,   -- 1 avaliação + 8 sessões
     'Inclui avaliação inicial + 8 sessões de Microfioterapia. Economize ~15% no pacote completo.',
     true),

    -- Plano Mensal Recorrente — assinatura de Terapia Manual
    (v_clinic_id,
     'Plano Mensal — Terapia Manual (4 sessões/mês)',
     'membership',
     50000,   -- R$ 500/mês  (4 × R$150 = R$600 → -17%)
     'BRL',
     4,
     '4 sessões de Terapia Manual por mês, com renovação automática. Economize ~17% vs. valor avulso.',
     true)
  on conflict do nothing;

  raise notice 'Seed JIFWC concluído para clinic_id = %', v_clinic_id;
end $$;
