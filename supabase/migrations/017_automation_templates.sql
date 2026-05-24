-- ============================================================
-- Migration 017 — Automation templates
--
-- Stores per-clinic customizable message templates for each
-- automation rule. Falls back to hardcoded default if no row.
-- ============================================================

create table if not exists public.automation_templates (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  rule_key    text        not null check (rule_key in ('d_minus_1', 'nps', 'd_plus_3', 'd_plus_30')),
  channel     text        not null default 'whatsapp' check (channel in ('whatsapp', 'email')),
  template    text        not null check (char_length(template) between 10 and 1500),
  is_active   boolean     not null default true,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (clinic_id, rule_key, channel)
);

create index if not exists automation_templates_clinic_idx
  on public.automation_templates (clinic_id);

alter table public.automation_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'automation_templates'
      and policyname = 'Clinic members manage automation templates'
  ) then
    execute $policy$
      create policy "Clinic members manage automation templates"
        on public.automation_templates
        for all
        using (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
        with check (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
    $policy$;
  end if;
end $$;
