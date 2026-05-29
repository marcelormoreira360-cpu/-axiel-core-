-- ============================================================
-- Migration 047 — Broadcast campaigns
--
-- Logs WhatsApp broadcast campaigns sent by clinic staff.
-- Stores the segment, message body and send summary.
-- ============================================================

create table if not exists public.broadcast_campaigns (
  id              uuid        primary key default gen_random_uuid(),
  clinic_id       uuid        not null references public.clinics(id) on delete cascade,
  created_by      uuid        references public.users(id) on delete set null,
  title           text        not null,
  segment         text        not null check (segment in ('all_active','inactive_30','inactive_60','custom')),
  message_body    text        not null,
  total_recipients int        not null default 0,
  sent_count      int         not null default 0,
  failed_count    int         not null default 0,
  status          text        not null default 'completed'
                              check (status in ('completed','failed','partial')),
  created_at      timestamptz not null default now()
);

create index if not exists broadcast_campaigns_clinic_id_idx
  on public.broadcast_campaigns (clinic_id, created_at desc);

alter table public.broadcast_campaigns enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'broadcast_campaigns'
      and policyname = 'Clinic members can manage broadcast_campaigns'
  ) then
    execute $policy$
      create policy "Clinic members can manage broadcast_campaigns"
        on public.broadcast_campaigns
        for all
        using (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
    $policy$;
  end if;
end $$;
