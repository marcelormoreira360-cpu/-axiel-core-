-- AXIEL Core AI Human Validation
-- Ensures AI-generated outputs remain drafts/pending review until a human marks them as final.
-- Tracks who approved, when they approved, and any changes/notes made during validation.

-- 1) Add human validation fields to AI insights.
alter table public.ai_insights
  add column if not exists review_status text not null default 'pending_review',
  add column if not exists final_output jsonb,
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists reviewer_notes text,
  add column if not exists changes_made text,
  add column if not exists last_reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists last_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_insights_review_status_check'
  ) then
    alter table public.ai_insights
      add constraint ai_insights_review_status_check
      check (review_status in ('pending_review', 'needs_changes', 'final', 'archived'));
  end if;
end $$;

-- Existing completed insights become pending review. They are NOT final until approved.
update public.ai_insights
set review_status = 'pending_review'
where review_status is null;

create index if not exists ai_insights_review_status_idx on public.ai_insights(review_status);
create index if not exists ai_insights_approved_at_idx on public.ai_insights(approved_at desc);

-- 2) Create immutable validation history.
create table if not exists public.ai_validation_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  ai_insight_id uuid not null references public.ai_insights(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  action text not null check (action in ('generated_pending_review', 'approved_final', 'requested_changes', 'archived', 'reopened')),
  previous_status text,
  new_status text not null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewer_notes text,
  changes_made text,
  output_before jsonb,
  output_after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_validation_events_clinic_id_idx on public.ai_validation_events(clinic_id);
create index if not exists ai_validation_events_ai_insight_id_idx on public.ai_validation_events(ai_insight_id);
create index if not exists ai_validation_events_created_at_idx on public.ai_validation_events(created_at desc);

alter table public.ai_validation_events enable row level security;

-- Drop existing validation policies safely if re-running in staging.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_validation_events'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "Clinic users can view ai validation events"
on public.ai_validation_events for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can insert ai validation events"
on public.ai_validation_events for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

-- 3) Make validation history immutable. Inserts only.
create or replace function public.prevent_ai_validation_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'AI validation events are immutable and cannot be changed or deleted';
end;
$$;

drop trigger if exists prevent_ai_validation_event_update on public.ai_validation_events;
create or replace trigger prevent_ai_validation_event_update
before update on public.ai_validation_events
for each row execute function public.prevent_ai_validation_event_mutation();

drop trigger if exists prevent_ai_validation_event_delete on public.ai_validation_events;
create or replace trigger prevent_ai_validation_event_delete
before delete on public.ai_validation_events
for each row execute function public.prevent_ai_validation_event_mutation();

-- 4) Track first validation event automatically when an insight is created.
create or replace function public.create_ai_generated_pending_review_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_validation_events (
    clinic_id,
    ai_insight_id,
    patient_id,
    action,
    previous_status,
    new_status,
    reviewed_by,
    reviewer_notes,
    changes_made,
    output_after
  ) values (
    new.clinic_id,
    new.id,
    new.patient_id,
    'generated_pending_review',
    null,
    coalesce(new.review_status, 'pending_review'),
    new.created_by,
    'AI output created and waiting for optional human validation before final use.',
    null,
    new.output
  );
  return new;
end;
$$;

drop trigger if exists create_ai_generated_pending_review_event on public.ai_insights;
create or replace trigger create_ai_generated_pending_review_event
after insert on public.ai_insights
for each row execute function public.create_ai_generated_pending_review_event();

-- 5) Extend relationship validation to the new immutable history table.
create or replace function public.validate_ai_validation_event_same_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_clinic_id uuid;
begin
  select clinic_id into related_clinic_id from public.ai_insights where id = new.ai_insight_id;
  if related_clinic_id is null or related_clinic_id <> new.clinic_id then
    raise exception 'AI insight must belong to the same clinic as the validation event';
  end if;

  if new.patient_id is not null then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the validation event';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_clinic_relationship_ai_validation_events on public.ai_validation_events;
create or replace trigger validate_clinic_relationship_ai_validation_events
before insert or update on public.ai_validation_events
for each row execute function public.validate_ai_validation_event_same_clinic();

-- 6) Require final outputs to have human approval metadata.
create or replace function public.validate_ai_final_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.review_status = 'final' then
    if new.approved_by is null or new.approved_at is null or new.final_output is null then
      raise exception 'AI insight cannot be marked final without approved_by, approved_at, and final_output';
    end if;
  end if;

  if old.review_status = 'final' and new.review_status <> 'final' then
    if not public.can_manage_clinic(new.clinic_id) then
      raise exception 'Only clinic managers or owners can reopen a final AI insight';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_ai_final_approval on public.ai_insights;
create or replace trigger validate_ai_final_approval
before update on public.ai_insights
for each row execute function public.validate_ai_final_approval();

-- 7) Keep ai_review_status compatible with older screens while using the stronger status model.
alter table public.ai_review_status
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists changes_made text;
