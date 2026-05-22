-- ─── Assessment Forms (Formulários) ──────────────────────────────────────────
-- Migration 002: cria as tabelas de templates de formulários clínicos
-- assessment_templates → assessment_sections → assessment_questions
-- assessment_responses → assessment_answers

-- ── question_type enum ───────────────────────────────────────────────────────
do $$ begin
  create type public.assessment_question_type as enum ('scale', 'yes_no', 'text', 'number');
exception when duplicate_object then null; end $$;

-- ── assessment_templates ─────────────────────────────────────────────────────
create table if not exists public.assessment_templates (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  name            text not null,
  description     text,
  instructions    text,
  scale_labels    text[],          -- array com rótulos do 0 ao 4
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists assessment_templates_clinic_id_idx on public.assessment_templates(clinic_id);

-- ── assessment_sections ──────────────────────────────────────────────────────
create table if not exists public.assessment_sections (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.assessment_templates(id) on delete cascade,
  title           text not null,
  order_index     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists assessment_sections_template_id_idx on public.assessment_sections(template_id);

-- ── assessment_questions ─────────────────────────────────────────────────────
create table if not exists public.assessment_questions (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.assessment_templates(id) on delete cascade,
  section_id      uuid references public.assessment_sections(id) on delete cascade,
  text            text not null,
  question_type   public.assessment_question_type not null default 'scale',
  min_score       integer not null default 0,
  max_score       integer not null default 4,
  order_index     integer not null default 0,
  is_required     boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists assessment_questions_template_id_idx on public.assessment_questions(template_id);
create index if not exists assessment_questions_section_id_idx  on public.assessment_questions(section_id);

-- ── assessment_responses ─────────────────────────────────────────────────────
create table if not exists public.assessment_responses (
  id                      uuid primary key default gen_random_uuid(),
  clinic_id               uuid not null references public.clinics(id) on delete cascade,
  patient_id              uuid not null references public.patients(id) on delete cascade,
  template_id             uuid not null references public.assessment_templates(id) on delete cascade,
  appointment_id          uuid references public.appointments(id) on delete set null,
  total_score             integer,
  max_possible_score      integer,
  score_percentage        numeric(5,2),
  section_scores          jsonb,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists assessment_responses_patient_id_idx  on public.assessment_responses(patient_id);
create index if not exists assessment_responses_clinic_id_idx   on public.assessment_responses(clinic_id);
create index if not exists assessment_responses_template_id_idx on public.assessment_responses(template_id);

-- ── assessment_answers ───────────────────────────────────────────────────────
create table if not exists public.assessment_answers (
  id              uuid primary key default gen_random_uuid(),
  response_id     uuid not null references public.assessment_responses(id) on delete cascade,
  question_id     uuid not null references public.assessment_questions(id) on delete cascade,
  score           integer,
  text_answer     text,
  created_at      timestamptz not null default now()
);

create index if not exists assessment_answers_response_id_idx on public.assessment_answers(response_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists set_assessment_templates_updated_at on public.assessment_templates;
create trigger set_assessment_templates_updated_at
  before update on public.assessment_templates
  for each row execute function public.handle_updated_at();

drop trigger if exists set_assessment_responses_updated_at on public.assessment_responses;
create trigger set_assessment_responses_updated_at
  before update on public.assessment_responses
  for each row execute function public.handle_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.assessment_templates  enable row level security;
alter table public.assessment_sections   enable row level security;
alter table public.assessment_questions  enable row level security;
alter table public.assessment_responses  enable row level security;
alter table public.assessment_answers    enable row level security;

-- Templates: visíveis para usuários da clínica
create policy "Clinic users can view assessment templates"
  on public.assessment_templates for select
  using (clinic_id = (select clinic_id from public.users where id = auth.uid()));

create policy "Clinic users can manage assessment templates"
  on public.assessment_templates for all
  using (clinic_id = (select clinic_id from public.users where id = auth.uid()));

-- Sections: seguem a política do template
create policy "Clinic users can view assessment sections"
  on public.assessment_sections for select
  using (
    template_id in (
      select id from public.assessment_templates
      where clinic_id = (select clinic_id from public.users where id = auth.uid())
    )
  );

create policy "Clinic users can manage assessment sections"
  on public.assessment_sections for all
  using (
    template_id in (
      select id from public.assessment_templates
      where clinic_id = (select clinic_id from public.users where id = auth.uid())
    )
  );

-- Questions: seguem a política do template
create policy "Clinic users can view assessment questions"
  on public.assessment_questions for select
  using (
    template_id in (
      select id from public.assessment_templates
      where clinic_id = (select clinic_id from public.users where id = auth.uid())
    )
  );

create policy "Clinic users can manage assessment questions"
  on public.assessment_questions for all
  using (
    template_id in (
      select id from public.assessment_templates
      where clinic_id = (select clinic_id from public.users where id = auth.uid())
    )
  );

-- Responses: visíveis para usuários da clínica
create policy "Clinic users can view assessment responses"
  on public.assessment_responses for select
  using (clinic_id = (select clinic_id from public.users where id = auth.uid()));

create policy "Clinic users can manage assessment responses"
  on public.assessment_responses for all
  using (clinic_id = (select clinic_id from public.users where id = auth.uid()));

-- Answers: seguem a política da response
create policy "Clinic users can view assessment answers"
  on public.assessment_answers for select
  using (
    response_id in (
      select id from public.assessment_responses
      where clinic_id = (select clinic_id from public.users where id = auth.uid())
    )
  );

create policy "Clinic users can manage assessment answers"
  on public.assessment_answers for all
  using (
    response_id in (
      select id from public.assessment_responses
      where clinic_id = (select clinic_id from public.users where id = auth.uid())
    )
  );
