-- AXIEL Core - Action Suggestions
-- Track suggested operational actions that can be accepted, ignored, or completed.

create type public.action_suggestion_status as enum ('pending', 'accepted', 'ignored', 'completed');
create type public.action_suggestion_priority as enum ('high', 'medium', 'low');
create type public.action_suggestion_category as enum ('patient', 'lead', 'schedule', 'follow_up', 'system');
create type public.action_suggestion_source as enum ('system_rule', 'ai_placeholder', 'manual');
create type public.action_suggestion_entity_type as enum ('patient', 'lead', 'appointment', 'follow_up', 'clinic');

create table if not exists public.action_suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  action_key text not null,
  title text not null,
  description text,
  priority public.action_suggestion_priority not null default 'medium',
  category public.action_suggestion_category not null default 'system',
  status public.action_suggestion_status not null default 'pending',
  source public.action_suggestion_source not null default 'system_rule',
  entity_type public.action_suggestion_entity_type,
  entity_id uuid,
  suggested_url text,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  ignored_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, action_key)
);

create index if not exists action_suggestions_clinic_status_idx on public.action_suggestions(clinic_id, status);
create index if not exists action_suggestions_entity_idx on public.action_suggestions(entity_type, entity_id);
create index if not exists action_suggestions_priority_idx on public.action_suggestions(priority);

drop trigger if exists set_action_suggestions_updated_at on public.action_suggestions;
create trigger set_action_suggestions_updated_at
before update on public.action_suggestions
for each row execute function public.set_updated_at();

alter table public.action_suggestions enable row level security;

drop policy if exists "Clinic users can view action suggestions" on public.action_suggestions;
create policy "Clinic users can view action suggestions"
on public.action_suggestions for select to authenticated
using (public.can_access_clinic(clinic_id));

drop policy if exists "Clinic users can create action suggestions" on public.action_suggestions;
create policy "Clinic users can create action suggestions"
on public.action_suggestions for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "Clinic users can update action suggestions" on public.action_suggestions;
create policy "Clinic users can update action suggestions"
on public.action_suggestions for update to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "Clinic managers can delete action suggestions" on public.action_suggestions;
create policy "Clinic managers can delete action suggestions"
on public.action_suggestions for delete to authenticated
using (public.can_manage_clinic(clinic_id));
