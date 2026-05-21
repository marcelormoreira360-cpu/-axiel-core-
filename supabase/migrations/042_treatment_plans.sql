-- Treatment plans + steps
-- Each patient can have multiple plans (only one active at a time by convention)

create table if not exists public.treatment_plans (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  patient_id    uuid not null references public.patients(id) on delete cascade,
  created_by    uuid references public.users(id),
  title         text not null,
  goal          text,
  status        text not null default 'active'
                  check (status in ('active', 'paused', 'completed', 'cancelled')),
  started_at    date,
  target_end_at date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.treatment_plan_steps (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.treatment_plans(id) on delete cascade,
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  title         text not null,
  description   text,
  order_index   integer not null default 0,
  is_completed  boolean not null default false,
  completed_at  timestamptz,
  due_date      date,
  created_at    timestamptz not null default now()
);

-- Indexes
create index if not exists idx_treatment_plans_patient_id  on public.treatment_plans(patient_id);
create index if not exists idx_treatment_plan_steps_plan_id on public.treatment_plan_steps(plan_id);

-- RLS
alter table public.treatment_plans       enable row level security;
alter table public.treatment_plan_steps  enable row level security;

create policy "treatment_plans_select"  on public.treatment_plans       for select using (public.can_access_clinic(clinic_id));
create policy "treatment_plans_insert"  on public.treatment_plans       for insert with check (public.can_write_clinic_data(clinic_id));
create policy "treatment_plans_update"  on public.treatment_plans       for update using (public.can_write_clinic_data(clinic_id));
create policy "treatment_plans_delete"  on public.treatment_plans       for delete using (public.can_write_clinic_data(clinic_id));

create policy "treatment_steps_select"  on public.treatment_plan_steps  for select using (public.can_access_clinic(clinic_id));
create policy "treatment_steps_insert"  on public.treatment_plan_steps  for insert with check (public.can_write_clinic_data(clinic_id));
create policy "treatment_steps_update"  on public.treatment_plan_steps  for update using (public.can_write_clinic_data(clinic_id));
create policy "treatment_steps_delete"  on public.treatment_plan_steps  for delete using (public.can_write_clinic_data(clinic_id));
