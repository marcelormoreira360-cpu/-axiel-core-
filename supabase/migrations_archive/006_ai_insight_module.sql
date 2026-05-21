-- AXIEL Core AI Insight module
-- Stores structured AI-generated insights for each patient.
-- The AI output is explicitly non-diagnostic and not medical advice.

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('completed', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists ai_insights_clinic_id_idx on public.ai_insights(clinic_id);
create index if not exists ai_insights_patient_id_idx on public.ai_insights(patient_id);
create index if not exists ai_insights_created_at_idx on public.ai_insights(created_at desc);

alter table public.ai_insights enable row level security;

create policy "Clinic users can view AI insights in their clinic"
on public.ai_insights for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create AI insights in their clinic"
on public.ai_insights for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete AI insights"
on public.ai_insights for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
