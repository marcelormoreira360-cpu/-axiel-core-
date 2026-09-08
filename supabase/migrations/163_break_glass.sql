-- 163_break_glass.sql
-- Acesso de suporte "quebra-vidro" (#6.2). Depois do #6.1, o suporte do Oxiel (platform
-- staff) tem ZERO acesso clinico por padrao. O break-glass e a porta de emergencia:
-- excepcional, TEMPORARIA, com MOTIVO e REGISTRADA. Enquanto houver um grant ATIVO (nao
-- expirado) para (usuario, clinica), esse usuario le o dado clinico daquela clinica; ao
-- expirar, o acesso some sozinho. A criacao do grant e restrita a platform staff e fica
-- logada (break_glass.granted em audit_logs, gravado pelo servico).

create table if not exists public.break_glass_grants (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  user_id     uuid not null,               -- o membro de plataforma que quebrou o vidro
  reason      text not null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists break_glass_grants_lookup_idx
  on public.break_glass_grants (user_id, clinic_id, expires_at);

alter table public.break_glass_grants enable row level security;

-- Só platform staff cria grant, e só para si mesmo (nao da para "quebrar o vidro" por outro).
drop policy if exists "Platform staff can create break-glass grants" on public.break_glass_grants;
create policy "Platform staff can create break-glass grants"
  on public.break_glass_grants for insert to authenticated
  with check (
    public.is_platform_staff()
    and user_id = auth.uid()
    -- O teto temporal (TEMPORARIO) e uma invariante de seguranca: precisa valer na
    -- fronteira (RLS), nao so no codigo do servico, senao um insert direto via PostgREST
    -- criaria acesso clinico ~permanente. Espelha MAX_DURATION_MINUTES (4h) do servico.
    and expires_at > now()
    and expires_at <= now() + interval '4 hours'
  );

-- Transparencia: a clinica ve quem entrou no quebra-vidro (e o proprio platform staff ve os seus).
drop policy if exists "View break-glass grants" on public.break_glass_grants;
create policy "View break-glass grants"
  on public.break_glass_grants for select to authenticated
  using (public.can_access_clinic(clinic_id));

-- Sem update/delete: append-only, expira por tempo.

-- Leitura clinica passa a aceitar um grant ativo, alem dos papeis clinicos da clinica.
create or replace function public.can_read_clinical_data(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.clinic_users cu
      where cu.user_id = auth.uid()
        and cu.clinic_id = target_clinic_id
        and cu.status = 'active'
        and cu.role::text in ('clinic_owner', 'clinic_manager', 'practitioner', 'read_only_staff')
    )
    or (
      public.current_user_clinic_id() = target_clinic_id
      and public.current_membership_role(target_clinic_id)::text in
        ('clinic_owner', 'clinic_manager', 'practitioner', 'read_only_staff')
    )
    or exists (
      -- Break-glass: grant ativo (nao expirado) concede leitura clinica temporaria.
      select 1
      from public.break_glass_grants g
      where g.user_id = auth.uid()
        and g.clinic_id = target_clinic_id
        and now() < g.expires_at
    ),
    false
  );
$$;
