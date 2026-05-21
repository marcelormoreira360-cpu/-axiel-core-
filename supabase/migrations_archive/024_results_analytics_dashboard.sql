-- AXIEL Core — Execution 13: Results / Analytics Dashboard
-- This migration adds an optional table for saved business insight events.
-- The dashboard itself is mostly derived from existing clinical and SaaS tables.

create table if not exists public.business_insight_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  insight_type text not null,
  title text not null,
  message text not null,
  action_label text,
  source text not null default 'ai_placeholder',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint business_insight_events_status_check check (
    status in ('active', 'resolved', 'dismissed')
  ),

  constraint business_insight_events_source_check check (
    source in ('ai_placeholder', 'ai_generated', 'manual')
  )
);

alter table public.business_insight_events enable row level security;

drop policy if exists "business_insight_events_select_same_clinic" on public.business_insight_events;
create policy "business_insight_events_select_same_clinic"
on public.business_insight_events
for select
using (public.can_access_clinic(clinic_id));

drop policy if exists "business_insight_events_insert_same_clinic" on public.business_insight_events;
create policy "business_insight_events_insert_same_clinic"
on public.business_insight_events
for insert
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "business_insight_events_update_same_clinic" on public.business_insight_events;
create policy "business_insight_events_update_same_clinic"
on public.business_insight_events
for update
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create index if not exists business_insight_events_clinic_status_idx
on public.business_insight_events(clinic_id, status, created_at desc);
