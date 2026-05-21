-- AXIEL Core - RLS audit and enforcement
-- Enforces tenant isolation, immutable logs, AI tracking, and safer fallbacks.

-- 1) Normalize helper functions used by all RLS policies.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select u.role::text in ('admin', 'platform_admin') from public.users u where u.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select u.role::text in ('admin', 'platform_admin', 'platform_support') from public.users u where u.id = auth.uid()),
    false
  );
$$;

create or replace function public.current_user_clinic_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select clinic_id from public.users where id = auth.uid();
$$;

create or replace function public.current_membership_role(target_clinic_id uuid)
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select cu.role
      from public.clinic_users cu
      where cu.user_id = auth.uid()
        and cu.clinic_id = target_clinic_id
        and cu.status = 'active'
      order by cu.created_at asc
      limit 1
    ),
    (
      select u.role
      from public.users u
      where u.id = auth.uid()
        and u.clinic_id = target_clinic_id
      limit 1
    )
  );
$$;

create or replace function public.can_access_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_platform_staff()
    or public.current_user_clinic_id() = target_clinic_id
    or exists (
      select 1
      from public.clinic_users cu
      where cu.user_id = auth.uid()
        and cu.clinic_id = target_clinic_id
        and cu.status = 'active'
    ),
    false
  );
$$;

create or replace function public.can_manage_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_platform_admin()
    or public.current_membership_role(target_clinic_id)::text in ('clinic_owner', 'clinic_manager')
    or (
      (select u.role::text from public.users u where u.id = auth.uid()) in ('clinic_owner')
      and public.current_user_clinic_id() = target_clinic_id
    ),
    false
  );
$$;

create or replace function public.can_write_clinic_data(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_platform_admin()
    or public.current_membership_role(target_clinic_id)::text in ('clinic_owner', 'clinic_manager', 'practitioner', 'front_desk', 'staff')
    or (
      (select u.role::text from public.users u where u.id = auth.uid()) in ('clinic_owner', 'staff')
      and public.current_user_clinic_id() = target_clinic_id
    ),
    false
  );
$$;

-- 2) Make sure all known application tables have RLS enabled.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clinics', 'users', 'patients', 'leads', 'appointments',
    'intake_forms', 'intake_questions', 'intake_responses',
    'session_records', 'ai_insights', 'ai_requests', 'ai_review_status',
    'follow_ups', 'monetization_offers', 'patient_offers',
    'plans', 'subscriptions', 'clinic_settings', 'clinic_users', 'invites',
    'feature_flags', 'usage_events', 'audit_logs', 'session_types', 'working_hours',
    'action_suggestions', 'billing_events', 'communication_templates', 'communication_logs'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;

-- 3) Add soft-delete and updated_by coverage for all clinic-owned mutable tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
    'session_records', 'ai_insights', 'follow_ups', 'monetization_offers', 'patient_offers',
    'session_types', 'working_hours', 'action_suggestions', 'communication_templates'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I add column if not exists deleted_at timestamptz', table_name);
      execute format('alter table public.%I add column if not exists updated_by uuid references public.users(id) on delete set null', table_name);
    end if;
  end loop;
end $$;

-- 4) Prevent cross-clinic relationships, including newer communication/action tables.
create or replace function public.assert_same_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_clinic_id uuid;
begin
  if tg_table_name = 'appointments' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the appointment';
    end if;

  elsif tg_table_name = 'leads' and new.converted_patient_id is not null then
    select clinic_id into related_clinic_id from public.patients where id = new.converted_patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Converted patient must belong to the same clinic as the lead';
    end if;

  elsif tg_table_name = 'intake_questions' then
    select clinic_id into related_clinic_id from public.intake_forms where id = new.form_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Intake form must belong to the same clinic as the question';
    end if;

  elsif tg_table_name = 'intake_responses' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the intake response';
    end if;
    select clinic_id into related_clinic_id from public.intake_forms where id = new.form_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Intake form must belong to the same clinic as the intake response';
    end if;
    select clinic_id into related_clinic_id from public.intake_questions where id = new.question_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Intake question must belong to the same clinic as the intake response';
    end if;

  elsif tg_table_name = 'session_records' then
    select clinic_id into related_clinic_id from public.appointments where id = new.appointment_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Appointment must belong to the same clinic as the session record';
    end if;
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the session record';
    end if;

  elsif tg_table_name = 'follow_ups' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the follow-up';
    end if;
    if new.appointment_id is not null then
      select clinic_id into related_clinic_id from public.appointments where id = new.appointment_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then
        raise exception 'Appointment must belong to the same clinic as the follow-up';
      end if;
    end if;

  elsif tg_table_name = 'patient_offers' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the patient offer';
    end if;
    select clinic_id into related_clinic_id from public.monetization_offers where id = new.offer_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Offer must belong to the same clinic as the patient offer';
    end if;

  elsif tg_table_name in ('ai_insights', 'ai_requests') and new.patient_id is not null then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the AI record';
    end if;

  elsif tg_table_name = 'ai_review_status' then
    select clinic_id into related_clinic_id from public.ai_insights where id = new.ai_insight_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'AI insight must belong to the same clinic as the review status';
    end if;

  elsif tg_table_name = 'communication_logs' then
    if new.patient_id is not null then
      select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then raise exception 'Patient does not belong to this clinic'; end if;
    end if;
    if new.lead_id is not null then
      select clinic_id into related_clinic_id from public.leads where id = new.lead_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then raise exception 'Lead does not belong to this clinic'; end if;
    end if;
    if new.appointment_id is not null then
      select clinic_id into related_clinic_id from public.appointments where id = new.appointment_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then raise exception 'Appointment does not belong to this clinic'; end if;
    end if;
    if new.follow_up_id is not null then
      select clinic_id into related_clinic_id from public.follow_ups where id = new.follow_up_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then raise exception 'Follow-up does not belong to this clinic'; end if;
    end if;
    if new.template_id is not null then
      select clinic_id into related_clinic_id from public.communication_templates where id = new.template_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then raise exception 'Template does not belong to this clinic'; end if;
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'appointments', 'leads', 'intake_questions', 'intake_responses', 'session_records',
    'follow_ups', 'patient_offers', 'ai_insights', 'ai_requests', 'ai_review_status', 'communication_logs'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop trigger if exists assert_same_clinic_%s on public.%I', table_name, table_name);
      execute format('create trigger assert_same_clinic_%s before insert or update on public.%I for each row execute function public.assert_same_clinic()', table_name, table_name);
    end if;
  end loop;
end $$;

-- 5) Immutable operational logs. Logs can be inserted and viewed, but never updated/deleted.
create or replace function public.prevent_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Immutable log records cannot be updated or deleted';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['audit_logs', 'usage_events', 'billing_events', 'communication_logs']
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop trigger if exists prevent_%s_mutation on public.%I', table_name, table_name);
      execute format('create trigger prevent_%s_mutation before update or delete on public.%I for each row execute function public.prevent_log_mutation()', table_name, table_name);
      execute format('revoke update, delete on public.%I from authenticated', table_name);
    end if;
  end loop;
end $$;

-- 6) Replace policies for immutable logs with select + insert only.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('audit_logs', 'usage_events', 'billing_events', 'communication_logs')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "Clinic users can view audit logs"
on public.audit_logs for select to authenticated
using (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can insert audit logs"
on public.audit_logs for insert to authenticated
with check (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can view usage events"
on public.usage_events for select to authenticated
using (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can insert usage events"
on public.usage_events for insert to authenticated
with check (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic managers can view billing events"
on public.billing_events for select to authenticated
using (public.is_platform_staff() or (clinic_id is not null and public.can_manage_clinic(clinic_id)));

create policy "Clinic users can view communication logs"
on public.communication_logs for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can insert communication logs"
on public.communication_logs for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

-- 7) Harden AI governance and tracking.
alter table public.ai_insights add column if not exists ai_request_id uuid references public.ai_requests(id) on delete set null;
alter table public.ai_insights add column if not exists reviewed_at timestamptz;
alter table public.ai_insights add column if not exists safety_label text not null default 'AI-generated insights (not medical advice)';
alter table public.ai_requests add column if not exists error_message text;
alter table public.ai_requests add column if not exists output_summary jsonb not null default '{}'::jsonb;
alter table public.ai_requests add column if not exists tokens_used integer;
alter table public.ai_requests add column if not exists fallback_used boolean not null default false;

create index if not exists ai_insights_ai_request_id_idx on public.ai_insights(ai_request_id);
create index if not exists ai_requests_patient_id_idx on public.ai_requests(patient_id);
create index if not exists ai_requests_created_at_idx on public.ai_requests(created_at desc);

-- AI request rows may be created and updated by clinic users so status/error can be tracked.
-- AI outputs remain clinic-scoped and require review for patient-facing use.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('ai_requests', 'ai_insights', 'ai_review_status')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "Clinic users can view ai requests"
on public.ai_requests for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create ai requests"
on public.ai_requests for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can update ai requests"
on public.ai_requests for update to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can view ai insights"
on public.ai_insights for select to authenticated
using (public.can_access_clinic(clinic_id) and deleted_at is null);

create policy "Clinic users can create ai insights"
on public.ai_insights for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can update ai insights review fields"
on public.ai_insights for update to authenticated
using (public.can_write_clinic_data(clinic_id) and deleted_at is null)
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can view ai review status"
on public.ai_review_status for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can manage ai review status"
on public.ai_review_status for all to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

-- 8) Fix feature flag compatibility from earlier billing migration naming.
do $$
begin
  if exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'feature_flags' and column_name = 'flag_key'
  ) then
    update public.feature_flags
    set flag_key = coalesce(flag_key, metadata ->> 'legacy_key')
    where flag_key is null;
  end if;
end $$;

-- 9) Safer write_audit_log RPC. It never updates existing logs.
create or replace function public.write_audit_log(
  target_clinic_id uuid,
  action_name text,
  entity_name text,
  target_entity_id uuid default null,
  details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if target_clinic_id is not null and not public.can_access_clinic(target_clinic_id) then
    raise exception 'Not allowed to write audit log for this clinic';
  end if;

  insert into public.audit_logs (clinic_id, user_id, action, entity_type, entity_id, metadata)
  values (target_clinic_id, auth.uid(), action_name, entity_name, target_entity_id, coalesce(details, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

-- 10) Optional sanity view for platform admins/support to audit RLS state.
create or replace view public.security_rls_status as
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  forcerowsecurity as rls_forced
from pg_tables
where schemaname = 'public'
order by tablename;

alter view public.security_rls_status set (security_barrier = true);

-- View access is still controlled by table/function permissions at the app layer.
-- Use only from platform admin/support screens or SQL editor.

grant select on public.security_rls_status to authenticated;
