-- =============================================================================
-- 165_supplement_regeneration_jobs.sql
-- Fila de REGENERAÇÃO DE SUPLEMENTAÇÃO em massa (Fase 2 da feature "atualizar a
-- suplementação de todos os pacientes pela nova config, Marcelo valida e envia").
--
-- Cada job = regenerar o Documento 2 de UM paciente com a versão atual do
-- Protocolo dos 10 Filtros (config_version = SUPPLEMENT_REASONING_VERSION).
-- O processamento roda em LOTES disparados por um gestor autenticado
-- (services/supplement-regeneration-queue-service), reusando regenerateSupplement
-- ForPatient. Cada job vira um RASCUNHO pendente de revisão; nada é enviado.
--
-- Não insere dados. Aplicar em produção após revisão do Marcelo.
-- =============================================================================

create table if not exists public.supplement_regeneration_jobs (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references public.clinics(id) on delete cascade,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  status            text not null default 'pending'
                      check (status in ('pending', 'processing', 'done', 'failed', 'canceled')),
  -- Versão-alvo do raciocínio de suplementação (carimbo do output regenerado).
  config_version    text not null,
  attempts          int not null default 0,
  max_attempts      int not null default 3,
  -- Insight rascunho gerado por este job (quando done).
  result_insight_id uuid references public.ai_insights(id) on delete set null,
  last_error        text,
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  processed_at      timestamptz
);

-- Um paciente não pode ter 2 jobs ABERTOS (pending/processing) ao mesmo tempo:
-- evita enfileirar duplicado e regenerar 2x. Jobs done/failed/canceled não contam.
create unique index if not exists supplement_regen_jobs_open_uniq
  on public.supplement_regeneration_jobs (patient_id)
  where status in ('pending', 'processing');

-- Hot path do processamento: próximos pendentes por ordem de chegada, por clínica.
create index if not exists supplement_regen_jobs_pending_idx
  on public.supplement_regeneration_jobs (clinic_id, created_at)
  where status = 'pending';

create index if not exists supplement_regen_jobs_clinic_idx
  on public.supplement_regeneration_jobs (clinic_id, created_at desc);

alter table public.supplement_regeneration_jobs enable row level security;

-- Cada clínica gerencia seus próprios jobs (mesma helper das demais tabelas).
-- O processamento roda no contexto do gestor autenticado (não service role).
drop policy if exists supplement_regen_manage on public.supplement_regeneration_jobs;
create policy supplement_regen_manage on public.supplement_regeneration_jobs
  for all using (public.can_manage_clinic(clinic_id))
  with check (public.can_manage_clinic(clinic_id));

-- =============================================================================
-- Elegibilidade em SQL (evita cap de 1000 linhas do PostgREST, listas .in()
-- gigantes na URL e carregar o JSON inteiro só para ler a versão): pacientes da
-- clínica COM dados clínicos (exame funcional OU Mapa Neuro ID) cujo insight mais
-- recente NÃO está na versão-alvo do raciocínio. SECURITY INVOKER: respeita a RLS
-- do gestor que chama (multi-tenant seguro), nunca roda como anon.
-- =============================================================================
create or replace function public.eligible_supplement_regeneration_patients(
  p_clinic uuid,
  p_version text
) returns table (patient_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  with clinical as (
    select p.id
    from patients p
    where p.clinic_id = p_clinic
      and p.deleted_at is null
      and (
        exists (select 1 from patient_functional_exams e where e.patient_id = p.id)
        or exists (select 1 from patient_neuro_id_scores s where s.patient_id = p.id)
      )
  ),
  latest as (
    select distinct on (ai.patient_id)
      ai.patient_id,
      coalesce(ai.final_output, ai.output) as out
    from ai_insights ai
    where ai.patient_id in (select id from clinical)
      and ai.review_status <> 'archived'
    order by ai.patient_id, ai.created_at desc
  )
  select c.id
  from clinical c
  left join latest l on l.patient_id = c.id
  where coalesce(l.out ->> 'supplement_reasoning_version', '') is distinct from p_version;
$$;

notify pgrst, 'reload schema';
