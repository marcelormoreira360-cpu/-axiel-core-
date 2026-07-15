-- =============================================================================
-- 133_outbound_media_jobs.sql
-- Worker de midia (item 6 do roadmap Fase 1): fila de envio de IMAGEM em DM
-- do Instagram (e Messenger, preparado). O webhook nao pode bloquear subindo/
-- gerando imagem, entao o envio e enfileirado aqui e processado por um cron
-- worker (app/api/cron/media-worker) que resolve a URL publica e envia.
--
-- Fonte da midia (prioridade): media_url pronta > storage_path no bucket
-- privado (URL assinada na hora) > generate_prompt (a IA gera quando nada foi
-- fornecido, conforme a politica do Marcelo). Ver services/outbound-media-service.
--
-- Nao insere dados. Entra no lote de deploy da Fase 1.
-- =============================================================================

create table if not exists public.outbound_media_jobs (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  channel          text not null check (channel in ('instagram', 'messenger')),
  recipient_id     text not null,                 -- IGSID/PSID do destinatario no canal
  conversation_key text,                          -- opcional, p/ correlacionar com o historico
  media_type       text not null default 'image' check (media_type = 'image'),

  -- Fonte da midia: pelo menos uma resolve para uma URL publica no envio.
  storage_path     text,                          -- caminho no bucket privado patient-docs
  media_url        text,                          -- URL publica ja pronta (ex.: asset fixo)
  generate_prompt  text,                          -- prompt p/ a IA gerar quando nada foi dado
  caption          text,

  ig_account_id    text,                          -- conta IG de origem (multi-clinica) p/ resolver token
  status           text not null default 'pending'
                     check (status in ('pending', 'sending', 'sent', 'failed', 'canceled')),
  attempts         int not null default 0,
  max_attempts     int not null default 3,
  last_error       text,

  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  sent_at          timestamptz
);

-- Hot path do worker: proximos pendentes por ordem de chegada.
create index if not exists outbound_media_jobs_pending_idx
  on public.outbound_media_jobs (created_at)
  where status = 'pending';

create index if not exists outbound_media_jobs_clinic_idx
  on public.outbound_media_jobs (clinic_id, created_at desc);

alter table public.outbound_media_jobs enable row level security;

-- Cada clinica gerencia seus proprios jobs (mesma helper das demais tabelas).
-- O worker roda com service role (admin client), que ignora RLS.
drop policy if exists outbound_media_manage on public.outbound_media_jobs;
create policy outbound_media_manage on public.outbound_media_jobs
  for all using (public.can_manage_clinic(clinic_id))
  with check (public.can_manage_clinic(clinic_id));

notify pgrst, 'reload schema';
