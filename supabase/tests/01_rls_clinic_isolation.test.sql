-- =============================================================================
-- AXIEL Core — Testes de RLS: Isolamento entre clínicas
-- Executa com: supabase test db
-- Usa pgTAP (pré-instalado no Supabase local)
-- =============================================================================

begin;

select plan(32);

-- ---------------------------------------------------------------------------
-- Setup: criar dois usuários e duas clínicas completamente separadas
-- ---------------------------------------------------------------------------

-- Clinic A
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'owner_a@test.axiel',
  crypt('password123', gen_salt('bf')),
  now(), '{}'::jsonb, '{}'::jsonb, false, false, now(), now()
) on conflict do nothing;

insert into public.users (id, email, full_name, role, clinic_id)
values ('00000000-0000-0000-0000-000000000001', 'owner_a@test.axiel', 'Owner A', 'clinic_owner', null)
on conflict (id) do nothing;

insert into public.clinics (id, name, slug, status)
values ('10000000-0000-0000-0000-000000000001', 'Clínica Alpha', 'clinica-alpha', 'active')
on conflict do nothing;

insert into public.clinic_users (clinic_id, user_id, role, status)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'clinic_owner', 'active')
on conflict do nothing;

update public.users set clinic_id = '10000000-0000-0000-0000-000000000001'
where id = '00000000-0000-0000-0000-000000000001';

-- Clinic B
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated',
  'owner_b@test.axiel',
  crypt('password123', gen_salt('bf')),
  now(), '{}'::jsonb, '{}'::jsonb, false, false, now(), now()
) on conflict do nothing;

insert into public.users (id, email, full_name, role, clinic_id)
values ('00000000-0000-0000-0000-000000000002', 'owner_b@test.axiel', 'Owner B', 'clinic_owner', null)
on conflict (id) do nothing;

insert into public.clinics (id, name, slug, status)
values ('10000000-0000-0000-0000-000000000002', 'Clínica Beta', 'clinica-beta', 'active')
on conflict do nothing;

insert into public.clinic_users (clinic_id, user_id, role, status)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'clinic_owner', 'active')
on conflict do nothing;

update public.users set clinic_id = '10000000-0000-0000-0000-000000000002'
where id = '00000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- Seed: dados da Clínica A
-- ---------------------------------------------------------------------------

insert into public.patients (id, clinic_id, full_name, email, status)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Paciente da Clínica A',
  'paciente_a@test.axiel',
  'active'
) on conflict do nothing;

insert into public.appointments (id, clinic_id, patient_id, starts_at, duration_minutes)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  now() + interval '1 day',
  60
) on conflict do nothing;

insert into public.leads (id, clinic_id, full_name, stage)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Lead da Clínica A',
  'new_lead'
) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seed: dados da Clínica B
-- ---------------------------------------------------------------------------

insert into public.patients (id, clinic_id, full_name, email, status)
values (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'Paciente da Clínica B',
  'paciente_b@test.axiel',
  'active'
) on conflict do nothing;

insert into public.appointments (id, clinic_id, patient_id, starts_at, duration_minutes)
values (
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  now() + interval '1 day',
  60
) on conflict do nothing;

insert into public.leads (id, clinic_id, full_name, stage)
values (
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'Lead da Clínica B',
  'new_lead'
) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Testes como usuário da Clínica A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 1. Usuário A pode ver seu próprio paciente
select ok(
  exists(select 1 from public.patients where id = '20000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver Paciente A'
);

-- 2. Usuário A NÃO pode ver paciente da Clínica B
select ok(
  not exists(select 1 from public.patients where id = '20000000-0000-0000-0000-000000000002'),
  'Usuário A não deve ver Paciente B'
);

-- 3. Usuário A pode ver sua própria consulta
select ok(
  exists(select 1 from public.appointments where id = '30000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver Appointment A'
);

-- 4. Usuário A NÃO pode ver consulta da Clínica B
select ok(
  not exists(select 1 from public.appointments where id = '30000000-0000-0000-0000-000000000002'),
  'Usuário A não deve ver Appointment B'
);

-- 5. Usuário A pode ver seu próprio lead
select ok(
  exists(select 1 from public.leads where id = '40000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver Lead A'
);

-- 6. Usuário A NÃO pode ver lead da Clínica B
select ok(
  not exists(select 1 from public.leads where id = '40000000-0000-0000-0000-000000000002'),
  'Usuário A não deve ver Lead B'
);

-- 7. count de patients retorna apenas os da clínica A (1)
select is(
  (select count(*)::int from public.patients where clinic_id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  )),
  1,
  'Usuário A deve ver apenas 1 patient (o seu)'
);

-- 8. count de appointments retorna apenas os da clínica A (1)
select is(
  (select count(*)::int from public.appointments where clinic_id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  )),
  1,
  'Usuário A deve ver apenas 1 appointment (o seu)'
);

-- 9. count de leads retorna apenas os da clínica A (1)
select is(
  (select count(*)::int from public.leads where clinic_id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  )),
  1,
  'Usuário A deve ver apenas 1 lead (o seu)'
);

-- 10. Usuário A pode ver sua própria clínica
select ok(
  exists(select 1 from public.clinics where id = '10000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver Clínica A'
);

-- 11. Usuário A NÃO pode ver a clínica B
select ok(
  not exists(select 1 from public.clinics where id = '10000000-0000-0000-0000-000000000002'),
  'Usuário A não deve ver Clínica B'
);

-- 12. INSERT de patient em clínica alheia deve falhar
select throws_ok(
  $$insert into public.patients (clinic_id, full_name, status)
    values ('10000000-0000-0000-0000-000000000002', 'Intruso', 'active')$$,
  'new row violates row-level security policy for table "patients"',
  'Usuário A não deve inserir patient na Clínica B'
);

-- ---------------------------------------------------------------------------
-- Testes como usuário da Clínica B
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- 13. Usuário B pode ver seu próprio paciente
select ok(
  exists(select 1 from public.patients where id = '20000000-0000-0000-0000-000000000002'),
  'Usuário B deve ver Paciente B'
);

-- 14. Usuário B NÃO pode ver paciente da Clínica A
select ok(
  not exists(select 1 from public.patients where id = '20000000-0000-0000-0000-000000000001'),
  'Usuário B não deve ver Paciente A'
);

-- 15. Usuário B pode ver sua consulta
select ok(
  exists(select 1 from public.appointments where id = '30000000-0000-0000-0000-000000000002'),
  'Usuário B deve ver Appointment B'
);

-- 16. Usuário B NÃO pode ver consulta da Clínica A
select ok(
  not exists(select 1 from public.appointments where id = '30000000-0000-0000-0000-000000000001'),
  'Usuário B não deve ver Appointment A'
);

-- 17. Usuário B pode ver seu lead
select ok(
  exists(select 1 from public.leads where id = '40000000-0000-0000-0000-000000000002'),
  'Usuário B deve ver Lead B'
);

-- 18. Usuário B NÃO pode ver lead da Clínica A
select ok(
  not exists(select 1 from public.leads where id = '40000000-0000-0000-0000-000000000001'),
  'Usuário B não deve ver Lead A'
);

-- 19. UPDATE em paciente de outra clínica deve resultar em 0 rows
with upd19 as (
  update public.patients set full_name = 'Atacado'
  where id = '20000000-0000-0000-0000-000000000001'
  returning id
)
select is((select count(*)::int from upd19), 0, 'Usuário B não deve conseguir UPDATE no Paciente A');

-- 20. DELETE em paciente de outra clínica deve resultar em 0 rows
with del20 as (
  delete from public.patients
  where id = '20000000-0000-0000-0000-000000000001'
  returning id
)
select is((select count(*)::int from del20), 0, 'Usuário B não deve conseguir DELETE no Paciente A');

-- ---------------------------------------------------------------------------
-- Testes sem autenticação (anon)
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

-- 21. Anon não vê patients
select ok(
  not exists(select 1 from public.patients limit 1),
  'Anon não deve ver nenhum patient'
);

-- 22. Anon não vê appointments
select ok(
  not exists(select 1 from public.appointments limit 1),
  'Anon não deve ver nenhum appointment'
);

-- 23. Anon não vê leads
select ok(
  not exists(select 1 from public.leads limit 1),
  'Anon não deve ver nenhum lead'
);

-- 24. Anon não vê clinics
select ok(
  not exists(select 1 from public.clinics limit 1),
  'Anon não deve ver nenhuma clinic'
);

-- 25. Anon não vê users
select ok(
  not exists(select 1 from public.users limit 1),
  'Anon não deve ver nenhum user'
);

-- 26. Anon não pode inserir patient
select throws_ok(
  $$insert into public.patients (clinic_id, full_name, status)
    values ('10000000-0000-0000-0000-000000000001', 'Invasor', 'active')$$,
  null,
  'Anon não deve inserir patient'
);

-- ---------------------------------------------------------------------------
-- Testes de clinic_settings (dados sensíveis de configuração)
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.clinic_settings (clinic_id, settings)
values ('10000000-0000-0000-0000-000000000001', '{"test": true}')
on conflict (clinic_id) do update set settings = excluded.settings;

-- 27. Usuário A vê suas próprias settings
select ok(
  exists(select 1 from public.clinic_settings where clinic_id = '10000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver clinic_settings da Clínica A'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- 28. Usuário B NÃO vê settings da clínica A
select ok(
  not exists(select 1 from public.clinic_settings where clinic_id = '10000000-0000-0000-0000-000000000001'),
  'Usuário B não deve ver clinic_settings da Clínica A'
);

-- ---------------------------------------------------------------------------
-- Testes de session_records
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.session_records (id, clinic_id, appointment_id, patient_id, created_by, notes)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Nota de evolução clínica confidencial'
) on conflict do nothing;

-- 29. Usuário A vê seu session_record
select ok(
  exists(select 1 from public.session_records where id = '50000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver session_record da Clínica A'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- 30. Usuário B NÃO vê session_record da clínica A
select ok(
  not exists(select 1 from public.session_records where id = '50000000-0000-0000-0000-000000000001'),
  'Usuário B não deve ver session_record da Clínica A'
);

-- ---------------------------------------------------------------------------
-- Testes de ai_insights
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.ai_insights (id, clinic_id, patient_id, created_by, review_status)
values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'pending_review'
) on conflict do nothing;

-- 31. Usuário A vê seu insight
select ok(
  exists(select 1 from public.ai_insights where id = '60000000-0000-0000-0000-000000000001'),
  'Usuário A deve ver ai_insight da Clínica A'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

-- 32. Usuário B NÃO vê insight da clínica A
select ok(
  not exists(select 1 from public.ai_insights where id = '60000000-0000-0000-0000-000000000001'),
  'Usuário B não deve ver ai_insight da Clínica A'
);

-- ---------------------------------------------------------------------------
-- Cleanup e resultado
-- ---------------------------------------------------------------------------

select * from finish();

rollback;
