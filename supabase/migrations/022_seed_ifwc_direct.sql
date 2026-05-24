-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Seed direto com clinic_id IFWC
--
-- Usa UUID direto para evitar problema de RLS no runner de migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- Session Types
insert into public.session_types
  (clinic_id, name, duration_minutes, price_cents, is_online, is_active)
values
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff', 'Avaliação',                              60, 20000, false, true),
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff', 'Sessão de Microfioterapia',              60, 30000, false, true),
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff', 'Sessão de Terapia Manual',               60, 15000, false, true),
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff', 'Exame de Neurometria (SNA)',             60, 20000, false, true),
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff', 'Exame de Biorressonância',               60, 20000, false, true),
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff', 'Exame de Hipersensibilidade Alimentar',  45, 15000, false, true)
on conflict (clinic_id, name) do nothing;

-- Monetization Offers (pacotes + plano mensal)
insert into public.monetization_offers
  (clinic_id, name, offer_type, price_cents, currency, number_of_sessions, description, is_active)
values
  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff',
   'Pacote Microfioterapia — 5 sessões',
   'session_package', 135000, 'BRL', 5,
   '5 sessões de Microfioterapia. Economize 10% em relação ao valor avulso (R$ 300/sessão).',
   true),

  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff',
   'Pacote Terapia Manual — 10 sessões',
   'session_package', 120000, 'BRL', 10,
   '10 sessões de Terapia Manual. Economize 20% em relação ao valor avulso (R$ 150/sessão).',
   true),

  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff',
   'Pacote Microfioterapia — 10 sessões',
   'session_package', 255000, 'BRL', 10,
   '10 sessões de Microfioterapia. Economize 15% em relação ao valor avulso (R$ 300/sessão).',
   true),

  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff',
   'Programa Completo (Avaliação + 8 Microfioterapia)',
   'session_package', 220000, 'BRL', 9,
   'Inclui avaliação inicial + 8 sessões de Microfioterapia. Economize ~15% no pacote.',
   true),

  ('98e98ef3-a056-40bd-989b-0ab69d0c4bff',
   'Plano Mensal — Terapia Manual (4 sessões/mês)',
   'membership', 50000, 'BRL', 4,
   '4 sessões de Terapia Manual por mês, renovação automática. Economize ~17% vs. avulso.',
   true)
on conflict do nothing;
