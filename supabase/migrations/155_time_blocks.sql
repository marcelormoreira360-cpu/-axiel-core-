-- Migration 155 — Bloqueio de horário pessoal (indisponibilidade da agenda).
--
-- Tabela SEPARADA de appointments de propósito: um bloqueio não é um paciente e
-- não pode vazar para nenhuma query orientada a paciente (lembretes, exports,
-- relatórios, trigger de pacotes, financeiro). Ele só precisa: (1) ocupar o horário
-- para checagem de conflito e disponibilidade, e (2) aparecer na grade da agenda.
-- A app integra esses dois pontos lendo time_blocks além de appointments.

create table if not exists public.time_blocks (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  practitioner_id  uuid references public.users(id) on delete set null,  -- null = bloqueio da clínica inteira
  starts_at        timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0 and duration_minutes <= 1440),
  title            text,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists time_blocks_clinic_starts_idx  on public.time_blocks(clinic_id, starts_at) where deleted_at is null;
create index if not exists time_blocks_practitioner_idx    on public.time_blocks(practitioner_id);
create index if not exists time_blocks_created_by_idx       on public.time_blocks(created_by);

alter table public.time_blocks enable row level security;

-- Leitura por membros da clínica (mesmo padrão das tabelas fin_*); escrita via servidor.
drop policy if exists "Clinic users can view time blocks" on public.time_blocks;
create policy "Clinic users can view time blocks"
  on public.time_blocks for select to authenticated
  using (public.can_access_clinic(clinic_id));

comment on table public.time_blocks is
  'Bloqueios de horário (indisponibilidade pessoal/clínica). Ocupam slot p/ conflito e disponibilidade e aparecem na agenda. Nunca entram em queries de paciente. Escrita via servidor.';
