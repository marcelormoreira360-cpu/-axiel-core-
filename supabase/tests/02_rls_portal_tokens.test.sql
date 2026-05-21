-- =============================================================================
-- AXIEL Core — Testes de RLS: Portal do Paciente (tokens)
-- Executa com: supabase test db
-- =============================================================================

begin;

select plan(10);

-- ---------------------------------------------------------------------------
-- Setup: clínica de teste para portal
-- ---------------------------------------------------------------------------

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, created_at, updated_at)
values (
  '00000000-0000-0000-0001-000000000001',
  'authenticated', 'authenticated',
  'owner_portal@test.axiel',
  crypt('password123', gen_salt('bf')),
  now(), '{}'::jsonb, '{}'::jsonb, false, false, now(), now()
) on conflict do nothing;

insert into public.users (id, email, full_name, role, clinic_id)
values ('00000000-0000-0000-0001-000000000001', 'owner_portal@test.axiel', 'Owner Portal', 'clinic_owner', null)
on conflict (id) do nothing;

insert into public.clinics (id, name, slug, status)
values ('10000000-0000-0000-0001-000000000001', 'Clínica Portal', 'clinica-portal', 'active')
on conflict do nothing;

insert into public.clinic_users (clinic_id, user_id, role, status)
values ('10000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000001', 'clinic_owner', 'active')
on conflict do nothing;

update public.users set clinic_id = '10000000-0000-0000-0001-000000000001'
where id = '00000000-0000-0000-0001-000000000001';

insert into public.patients (id, clinic_id, full_name, email, status)
values (
  '20000000-0000-0000-0001-000000000001',
  '10000000-0000-0000-0001-000000000001',
  'Paciente Portal',
  'portal_patient@test.axiel',
  'active'
) on conflict do nothing;

-- Outro usuário sem clínica nenhuma
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, created_at, updated_at)
values (
  '00000000-0000-0000-0001-000000000002',
  'authenticated', 'authenticated',
  'outsider_portal@test.axiel',
  crypt('password123', gen_salt('bf')),
  now(), '{}'::jsonb, '{}'::jsonb, false, false, now(), now()
) on conflict do nothing;

insert into public.users (id, email, full_name, role, clinic_id)
values ('00000000-0000-0000-0001-000000000002', 'outsider_portal@test.axiel', 'Outsider', 'staff', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Portal link seed (como owner da clínica)
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}';

insert into public.patient_portal_links (id, clinic_id, patient_id, token_hash, expires_at)
values (
  '70000000-0000-0000-0001-000000000001',
  '10000000-0000-0000-0001-000000000001',
  '20000000-0000-0000-0001-000000000001',
  encode(sha256('test-token-a'::bytea), 'hex'),
  now() + interval '7 days'
) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Testes
-- ---------------------------------------------------------------------------

-- 1. Owner da clínica vê o link
select ok(
  exists(select 1 from public.patient_portal_links where id = '70000000-0000-0000-0001-000000000001'),
  'Owner da clínica deve ver portal link'
);

-- 2. Count de links retorna apenas 1 para o owner
select is(
  (select count(*)::int from public.patient_portal_links
   where clinic_id in (
     '10000000-0000-0000-0001-000000000001'
   )),
  1,
  'Owner vê exatamente 1 portal link da sua clínica'
);

-- Trocar para outsider
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0001-000000000002","role":"authenticated"}';

-- 3. Outsider NÃO vê portal link de outra clínica
select ok(
  not exists(select 1 from public.patient_portal_links where id = '70000000-0000-0000-0001-000000000001'),
  'Outsider não deve ver portal link da Clínica Portal'
);

-- 4. Outsider NÃO pode criar portal link para clínica alheia
select throws_ok(
  $$insert into public.patient_portal_links (clinic_id, patient_id, token_hash, expires_at)
    values (
      '10000000-0000-0000-0001-000000000001',
      '20000000-0000-0000-0001-000000000001',
      encode(sha256('malicious-token'::bytea), 'hex'),
      now() + interval '7 days'
    )$$,
  null,
  'Outsider não deve criar portal link para clínica alheia'
);

-- Anon
reset role;
set local role anon;

-- 5. Anon NÃO vê portal links
select ok(
  not exists(select 1 from public.patient_portal_links limit 1),
  'Anon não deve ver portal links'
);

-- 6. Anon NÃO vê patient portal access logs
select ok(
  not exists(select 1 from public.patient_portal_access_logs limit 1),
  'Anon não deve ver portal access logs'
);

-- Voltar para owner
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}';

-- 7. Owner pode revogar seu próprio link (update revoked_at)
update public.patient_portal_links
set revoked_at = now()
where id = '70000000-0000-0000-0001-000000000001';

select ok(
  exists(select 1 from public.patient_portal_links
         where id = '70000000-0000-0000-0001-000000000001'
         and revoked_at is not null),
  'Owner deve conseguir revogar portal link'
);

-- Outsider tenta revogar
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0001-000000000002","role":"authenticated"}';

-- Novo link para testar revogação por outsider
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}';

insert into public.patient_portal_links (id, clinic_id, patient_id, token_hash, expires_at)
values (
  '70000000-0000-0000-0001-000000000002',
  '10000000-0000-0000-0001-000000000001',
  '20000000-0000-0000-0001-000000000001',
  encode(sha256('test-token-b'::bytea), 'hex'),
  now() + interval '7 days'
) on conflict do nothing;

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0001-000000000002","role":"authenticated"}';

-- 8. Outsider NÃO consegue revogar link de outra clínica (0 rows affected)
with upd8 as (
  update public.patient_portal_links
  set revoked_at = now()
  where id = '70000000-0000-0000-0001-000000000002'
  returning id
)
select is((select count(*)::int from upd8), 0, 'Outsider não deve conseguir revogar portal link alheio');

-- 9. Outsider NÃO vê o paciente da Clínica Portal
select ok(
  not exists(select 1 from public.patients where id = '20000000-0000-0000-0001-000000000001'),
  'Outsider não deve ver paciente da Clínica Portal'
);

-- 10. Token hash não pode ser lido por outsider
select ok(
  (select token_hash from public.patient_portal_links
   where id = '70000000-0000-0000-0001-000000000002') is null,
  'Outsider não deve ler token_hash do link alheio'
);

select * from finish();

rollback;
