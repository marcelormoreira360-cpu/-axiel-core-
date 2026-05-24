-- ============================================================
-- Migration 016 — Push subscriptions (Web Push / VAPID)
--
-- Stores browser push subscriptions so the server can send
-- Web Push notifications to authenticated clinic users.
-- One user can have multiple subscriptions (different browsers/devices).
-- ============================================================

create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  endpoint    text        not null,
  p256dh      text        not null,   -- DH public key
  auth        text        not null,   -- auth secret
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  -- one subscription per endpoint per user
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

create index if not exists push_subscriptions_clinic_idx
  on public.push_subscriptions (clinic_id);

-- RLS: users can only manage their own subscriptions
alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'push_subscriptions'
      and policyname = 'Users manage own push subscriptions'
  ) then
    execute $policy$
      create policy "Users manage own push subscriptions"
        on public.push_subscriptions
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $policy$;
  end if;
end $$;
