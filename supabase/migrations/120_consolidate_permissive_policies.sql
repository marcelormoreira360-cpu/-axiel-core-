-- 120: consolida policies permissivas múltiplas (advisor multiple_permissive_policies: 49 WARNs -> 0)
-- Semântica preservada: uniões de policies viram OR; policies ALL viram per-comando
-- onde só o SELECT sobrepunha. Verificado em prod antes de aplicar:
--   select count(*) from users u where u.clinic_id is not null
--     and not exists (select 1 from clinic_users cu where cu.user_id=u.id and cu.clinic_id=u.clinic_id)
--   = 0  (todo usuário com clinic_id está em clinic_users)

-- ─────────────────────────────────────────────────────────────────────────────
-- patient_payments (24 dos 49 WARNs): remove o modelo legado users.clinic_id.
-- Fica só "clinic members can manage payments" (ALL, modelo clinic_users).
drop policy if exists "clinic_own_payments_select" on public.patient_payments;
drop policy if exists "clinic_own_payments_insert" on public.patient_payments;
drop policy if exists "clinic_own_payments_update" on public.patient_payments;
drop policy if exists "clinic_own_payments_delete" on public.patient_payments;

-- session_types: 4 policies -> 1. O ALL de membros (can_access_clinic) já cobre
-- as duas de SELECT e o ALL de managers (subconjunto).
drop policy if exists "Clinic managers can manage session_types" on public.session_types;
drop policy if exists "Clinic users can view session types" on public.session_types;
drop policy if exists "Clinic users can view session_types" on public.session_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- Padrão "ALL manage + SELECT view": o ALL vira INSERT/UPDATE/DELETE com a mesma
-- expressão; o SELECT fica com a policy de view existente.

-- ai_review_status
drop policy if exists "Clinic users can manage AI review status" on public.ai_review_status;
create policy "Clinic users can insert ai_review_status" on public.ai_review_status
  for insert to authenticated with check (can_write_clinic_data(clinic_id));
create policy "Clinic users can update ai_review_status" on public.ai_review_status
  for update to authenticated using (can_write_clinic_data(clinic_id)) with check (can_write_clinic_data(clinic_id));
create policy "Clinic users can delete ai_review_status" on public.ai_review_status
  for delete to authenticated using (can_write_clinic_data(clinic_id));

-- clinic_settings
drop policy if exists "Clinic managers can manage clinic settings" on public.clinic_settings;
create policy "Clinic managers can insert clinic_settings" on public.clinic_settings
  for insert to authenticated with check (can_manage_clinic(clinic_id));
create policy "Clinic managers can update clinic_settings" on public.clinic_settings
  for update to authenticated using (can_manage_clinic(clinic_id)) with check (can_manage_clinic(clinic_id));
create policy "Clinic managers can delete clinic_settings" on public.clinic_settings
  for delete to authenticated using (can_manage_clinic(clinic_id));

-- feature_flags
drop policy if exists "Platform admins can manage feature flags" on public.feature_flags;
create policy "Platform admins can insert feature_flags" on public.feature_flags
  for insert to authenticated with check (is_platform_admin() or can_manage_clinic(clinic_id));
create policy "Platform admins can update feature_flags" on public.feature_flags
  for update to authenticated using (is_platform_admin() or can_manage_clinic(clinic_id))
  with check (is_platform_admin() or can_manage_clinic(clinic_id));
create policy "Platform admins can delete feature_flags" on public.feature_flags
  for delete to authenticated using (is_platform_admin() or can_manage_clinic(clinic_id));

-- invites
drop policy if exists "Clinic managers can manage invites" on public.invites;
create policy "Clinic managers can insert invites" on public.invites
  for insert to authenticated with check (can_manage_clinic(clinic_id));
create policy "Clinic managers can update invites" on public.invites
  for update to authenticated using (can_manage_clinic(clinic_id)) with check (can_manage_clinic(clinic_id));
create policy "Clinic managers can delete invites" on public.invites
  for delete to authenticated using (can_manage_clinic(clinic_id));

-- patient_push_subscriptions (roles originais: public — mantido)
drop policy if exists "Clinic users can manage patient push subscriptions" on public.patient_push_subscriptions;
create policy "Clinic users can insert patient push subscriptions" on public.patient_push_subscriptions
  for insert with check (can_write_clinic_data(clinic_id));
create policy "Clinic users can update patient push subscriptions" on public.patient_push_subscriptions
  for update using (can_write_clinic_data(clinic_id)) with check (can_write_clinic_data(clinic_id));
create policy "Clinic users can delete patient push subscriptions" on public.patient_push_subscriptions
  for delete using (can_write_clinic_data(clinic_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- clinic_users: ALL de managers vira UPDATE/DELETE; INSERT de manager + INSERT de
-- onboarding fundem numa policy só (OR).
drop policy if exists "Clinic managers can manage clinic users" on public.clinic_users;
drop policy if exists "Users can create own clinic owner membership during onboarding" on public.clinic_users;
create policy "Managers or onboarding owners can insert clinic_users" on public.clinic_users
  for insert to authenticated with check (
    can_manage_clinic(clinic_id)
    or ((user_id = (select auth.uid())) and (role = 'clinic_owner'::app_role) and can_access_clinic(clinic_id))
  );
create policy "Clinic managers can update clinic_users" on public.clinic_users
  for update to authenticated using (can_manage_clinic(clinic_id)) with check (can_manage_clinic(clinic_id));
create policy "Clinic managers can delete clinic_users" on public.clinic_users
  for delete to authenticated using (can_manage_clinic(clinic_id));

-- clinics: ALL de admin funde nas per-comando.
drop policy if exists "Admins can manage all clinics" on public.clinics;
drop policy if exists "Clinic users can view their clinic" on public.clinics;
create policy "Clinic users or admins can view clinics" on public.clinics
  for select to authenticated using (is_admin() or can_access_clinic(id));
drop policy if exists "Clinic owners can update their clinic" on public.clinics;
create policy "Clinic owners or admins can update clinics" on public.clinics
  for update to authenticated using (is_admin() or can_manage_clinic(id))
  with check (is_admin() or can_manage_clinic(id));
drop policy if exists "Unassigned users can create first clinic during onboarding" on public.clinics;
create policy "Onboarding users or admins can insert clinics" on public.clinics
  for insert to authenticated with check (
    is_admin()
    or (not (exists (select 1 from users u where ((u.id = (select auth.uid())) and (u.clinic_id is not null)))))
  );
create policy "Admins can delete clinics" on public.clinics
  for delete to authenticated using (is_admin());

-- users: ALL de admin funde nas per-comando; os 2 SELECTs e os 2 UPDATEs fundem em 1 cada.
drop policy if exists "Admins can manage all users" on public.users;
drop policy if exists "Clinic owners can view users in their clinic" on public.users;
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users, owners or admins can view users" on public.users
  for select to authenticated using (
    is_admin()
    or (id = (select auth.uid()))
    or (((current_user_role())::text = 'clinic_owner'::text) and (clinic_id = current_user_clinic_id()))
  );
drop policy if exists "Clinic owners can update staff in their clinic" on public.users;
drop policy if exists "Users can complete own onboarding profile" on public.users;
create policy "Owners, self-onboarding or admins can update users" on public.users
  for update to authenticated
  using (
    is_admin()
    or (((current_user_role())::text = 'clinic_owner'::text) and (clinic_id = current_user_clinic_id()) and (role = 'staff'::app_role))
    or ((id = (select auth.uid())) and (clinic_id is null))
  )
  with check (
    is_admin()
    or (((current_user_role())::text = 'clinic_owner'::text) and (clinic_id = current_user_clinic_id()) and (role = 'staff'::app_role))
    or ((id = (select auth.uid())) and (clinic_id is not null) and (role = any (array['clinic_owner'::app_role, 'staff'::app_role])))
  );
create policy "Admins can insert users" on public.users
  for insert to authenticated with check (is_admin());
create policy "Admins can delete users" on public.users
  for delete to authenticated using (is_admin());
