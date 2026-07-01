-- 107 — Link de captação: enviar um questionário para quem AINDA NÃO é paciente.
-- A pessoa abre o link, preenche os próprios dados (vira Lead) e responde o
-- questionário. Tudo é salvo sem exigir um patient_id — o convite passa a poder
-- ser "público" (sem paciente) e reutilizável (o mesmo link serve p/ várias
-- pessoas). A materialização no Mapa Bio³ acontece só quando o lead é convertido
-- em paciente (fase 2).

-- ── 1) Convite público e reutilizável ─────────────────────────────────────────
alter table public.assessment_invitations
  alter column patient_id drop not null;

alter table public.assessment_invitations
  add column if not exists kind        text    not null default 'patient'
    check (kind in ('patient', 'public')),
  add column if not exists is_reusable boolean not null default false,
  add column if not exists label       text;

-- ── 2) Nova origem de lead ────────────────────────────────────────────────────
-- (não é usada nesta migration; só passa a existir para o código de runtime)
alter type public.lead_source add value if not exists 'public_form';

-- ── 3) Submissões públicas: respostas de quem ainda não é paciente ─────────────
create table if not exists public.public_form_submissions (
  id                  uuid        primary key default gen_random_uuid(),
  clinic_id           uuid        not null references public.clinics(id) on delete cascade,
  template_id         uuid        not null references public.assessment_templates(id) on delete cascade,
  invitation_id       uuid        references public.assessment_invitations(id) on delete set null,
  lead_id             uuid        references public.leads(id) on delete set null,
  full_name           text        not null,
  email               text,
  phone               text,
  consent_at          timestamptz not null default now(),
  consent_ip          text,
  consent_user_agent  text,
  answers             jsonb       not null default '[]'::jsonb,
  section_scores      jsonb,
  total_score         integer,
  max_possible_score  integer,
  score_percentage    numeric(5,2),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists public_form_submissions_clinic_id_idx   on public.public_form_submissions(clinic_id);
create index if not exists public_form_submissions_lead_id_idx      on public.public_form_submissions(lead_id);
create index if not exists public_form_submissions_template_id_idx  on public.public_form_submissions(template_id);

alter table public.public_form_submissions enable row level security;

-- Leitura pela clínica dona. A escrita acontece só pelo servidor via admin client
-- (service role ignora RLS), pois quem responde é um visitante não autenticado.
drop policy if exists "public_form_submissions_select" on public.public_form_submissions;
create policy "public_form_submissions_select" on public.public_form_submissions
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "public_form_submissions_delete" on public.public_form_submissions;
create policy "public_form_submissions_delete" on public.public_form_submissions
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));
