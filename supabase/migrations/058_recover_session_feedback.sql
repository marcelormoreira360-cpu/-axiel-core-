-- migration 058_recover_session_feedback.sql
-- Reconciliação: recria a tabela session_feedback (NPS pós-sessão) que constava
-- na migration 014 mas não existia em produção. DDL idêntica à 014. Idempotente.

create table if not exists public.session_feedback (
  id             uuid        primary key default gen_random_uuid(),
  clinic_id      uuid        not null references public.clinics(id)      on delete cascade,
  patient_id     uuid        not null references public.patients(id)     on delete cascade,
  appointment_id uuid        not null references public.appointments(id) on delete cascade,
  nps_score      integer     not null check (nps_score >= 0 and nps_score <= 10),
  feedback_text  text,
  created_at     timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists session_feedback_clinic_patient_idx
  on public.session_feedback (clinic_id, patient_id);
create index if not exists session_feedback_clinic_created_idx
  on public.session_feedback (clinic_id, created_at desc);

alter table public.session_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'session_feedback'
      and policyname = 'Clinic members can manage session_feedback'
  ) then
    execute $policy$
      create policy "Clinic members can manage session_feedback"
        on public.session_feedback
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

notify pgrst, 'reload schema';
