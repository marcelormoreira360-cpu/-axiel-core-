-- AXIEL Core SaaS Foundation hardening
-- Adds stronger tenant isolation, scalable clinic memberships, billing foundation,
-- audit logs, feature flags, soft-delete columns, AI governance, and support tables.

-- 1) Expand app roles safely.
alter type public.app_role add value if not exists 'platform_admin';
alter type public.app_role add value if not exists 'platform_support';
alter type public.app_role add value if not exists 'clinic_manager';
alter type public.app_role add value if not exists 'practitioner';
alter type public.app_role add value if not exists 'front_desk';
alter type public.app_role add value if not exists 'read_only_staff';

-- 2) SaaS billing + platform foundation tables.
do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.clinic_user_status as enum ('invited', 'active', 'disabled');
exception when duplicate_object then null;
end $$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  max_users integer,
  max_patients integer,
  ai_insights_included integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  external_customer_id text,
  external_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id)
);

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade unique,
  display_name text,
  timezone text not null default 'America/New_York',
  ai_enabled boolean not null default false,
  patient_reports_enabled boolean not null default true,
  default_currency text not null default 'USD',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null default 'staff',
  status public.clinic_user_status not null default 'active',
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'staff',
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  flag_key text not null,
  is_enabled boolean not null default false,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, flag_key)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3) AI governance tables.
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  model text,
  purpose text not null default 'structured_insight',
  input_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'error')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_review_status (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  ai_insight_id uuid not null references public.ai_insights(id) on delete cascade unique,
  reviewed_by uuid references public.users(id) on delete set null,
  status text not null default 'needs_review' check (status in ('needs_review', 'reviewed', 'archived')),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Soft delete and audit metadata columns on clinic-owned tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
    'session_records', 'ai_insights', 'follow_ups', 'monetization_offers', 'patient_offers'
  ]
  loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists updated_by uuid references public.users(id) on delete set null', t);
  end loop;
end $$;

-- 5) Indexes.
create index if not exists subscriptions_clinic_id_idx on public.subscriptions(clinic_id);
create index if not exists clinic_users_clinic_id_idx on public.clinic_users(clinic_id);
create index if not exists clinic_users_user_id_idx on public.clinic_users(user_id);
create index if not exists invites_clinic_id_idx on public.invites(clinic_id);
create index if not exists feature_flags_clinic_id_idx on public.feature_flags(clinic_id);
create index if not exists usage_events_clinic_id_idx on public.usage_events(clinic_id);
create index if not exists audit_logs_clinic_id_idx on public.audit_logs(clinic_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists ai_requests_clinic_id_idx on public.ai_requests(clinic_id);
create index if not exists ai_review_status_clinic_id_idx on public.ai_review_status(clinic_id);

-- 6) Updated_at triggers for new tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'plans', 'subscriptions', 'clinic_settings', 'clinic_users', 'invites', 'feature_flags', 'ai_review_status'
  ]
  loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I', t, t);
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- 7) Stronger helper functions.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role()::text in ('admin', 'platform_admin'), false);
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role()::text in ('admin', 'platform_admin', 'platform_support'), false);
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
      public.current_user_role()::text = 'clinic_owner'
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
      public.current_user_role()::text in ('clinic_owner', 'staff')
      and public.current_user_clinic_id() = target_clinic_id
    ),
    false
  );
$$;

-- Keep old is_admin function compatible with legacy app code.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_platform_admin();
$$;

-- 8) Cross-clinic relationship protection.
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
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['appointments', 'leads', 'intake_questions', 'intake_responses', 'session_records', 'follow_ups', 'patient_offers', 'ai_insights', 'ai_requests']
  loop
    execute format('drop trigger if exists assert_same_clinic_%s on public.%I', t, t);
    execute format('create trigger assert_same_clinic_%s before insert or update on public.%I for each row execute function public.assert_same_clinic()', t, t);
  end loop;
end $$;

-- 9) Enable RLS for new tables.
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_users enable row level security;
alter table public.invites enable row level security;
alter table public.feature_flags enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_review_status enable row level security;

-- Plans are visible to authenticated users; only platform admins manage them.
drop policy if exists "Authenticated users can view active plans" on public.plans;
create policy "Authenticated users can view active plans"
on public.plans for select to authenticated
using (is_active = true or public.is_platform_staff());

drop policy if exists "Platform admins can manage plans" on public.plans;
create policy "Platform admins can manage plans"
on public.plans for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Clinic scoped new tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['subscriptions', 'clinic_settings', 'clinic_users', 'invites', 'feature_flags', 'usage_events', 'audit_logs', 'ai_requests', 'ai_review_status']
  loop
    execute format('drop policy if exists "Clinic users can view %s" on public.%I', table_name, table_name);
    execute format('create policy "Clinic users can view %s" on public.%I for select to authenticated using (clinic_id is null or public.can_access_clinic(clinic_id))', table_name, table_name);
  end loop;
end $$;

create policy "Platform admins can manage subscriptions"
on public.subscriptions for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "Clinic managers can manage clinic settings"
on public.clinic_settings for all to authenticated
using (public.can_manage_clinic(clinic_id)) with check (public.can_manage_clinic(clinic_id));

create policy "Clinic managers can manage clinic users"
on public.clinic_users for all to authenticated
using (public.can_manage_clinic(clinic_id)) with check (public.can_manage_clinic(clinic_id));

create policy "Clinic managers can manage invites"
on public.invites for all to authenticated
using (public.can_manage_clinic(clinic_id)) with check (public.can_manage_clinic(clinic_id));

create policy "Platform admins can manage feature flags"
on public.feature_flags for all to authenticated
using (public.is_platform_admin() or public.can_manage_clinic(clinic_id))
with check (public.is_platform_admin() or public.can_manage_clinic(clinic_id));

create policy "Clinic users can create usage events"
on public.usage_events for insert to authenticated
with check (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can create audit logs"
on public.audit_logs for insert to authenticated
with check (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can create AI requests"
on public.ai_requests for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can manage AI review status"
on public.ai_review_status for all to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

-- 10) Replace core clinic-owned RLS policies with write permissions and soft-delete visibility.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
        'session_records', 'ai_insights', 'follow_ups', 'monetization_offers', 'patient_offers'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
    'session_records', 'follow_ups', 'monetization_offers', 'patient_offers'
  ]
  loop
    execute format('create policy "Clinic users can view active %s" on public.%I for select to authenticated using (public.can_access_clinic(clinic_id) and deleted_at is null)', t, t);
    execute format('create policy "Clinic users can create %s" on public.%I for insert to authenticated with check (public.can_write_clinic_data(clinic_id))', t, t);
    execute format('create policy "Clinic users can update %s" on public.%I for update to authenticated using (public.can_write_clinic_data(clinic_id) and deleted_at is null) with check (public.can_write_clinic_data(clinic_id))', t, t);
    execute format('create policy "Clinic managers can hard delete %s" on public.%I for delete to authenticated using (public.can_manage_clinic(clinic_id))', t, t);
  end loop;
end $$;

create policy "Clinic users can view active ai_insights"
on public.ai_insights for select to authenticated
using (public.can_access_clinic(clinic_id) and deleted_at is null);

create policy "Clinic users can create ai_insights"
on public.ai_insights for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can hard delete ai_insights"
on public.ai_insights for delete to authenticated
using (public.can_manage_clinic(clinic_id));

-- 11) Audit helper.
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
  values (target_clinic_id, auth.uid(), action_name, entity_name, target_entity_id, details)
  returning id into new_id;

  return new_id;
end;
$$;

-- 12) Seed starter SaaS plans.
insert into public.plans (code, name, description, price_cents, billing_interval, max_users, max_patients, ai_insights_included, features)
values
  ('starter', 'Starter', 'Simple clinic operations for a small team.', 4900, 'monthly', 2, 250, 0, '{"crm": true, "schedule": true, "intake": true}'::jsonb),
  ('professional', 'Professional', 'Full clinic workflow with reports and AI insights.', 14900, 'monthly', null, 2500, 100, '{"crm": true, "schedule": true, "intake": true, "reports": true, "ai_insights": true}'::jsonb),
  ('enterprise', 'Enterprise', 'Advanced controls, custom limits, and compliance support.', 0, 'monthly', null, null, null, '{"custom_branding": true, "audit_logs": true, "feature_flags": true, "priority_support": true}'::jsonb)
on conflict (code) do nothing;

-- Recommended bootstrap after first auth user:
-- update public.users set role = 'platform_admin' where email = 'your-email@example.com';
