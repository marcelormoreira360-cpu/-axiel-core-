-- 129_stt_usage.sql
-- Medição de uso de transcrição de voz (Whisper) por clínica, para habilitar
-- cobrança por uso real. Antes, o custo de STT era invisível (só um gate de
-- plano boolean; nenhuma duração era registrada). Agora cada transcrição grava
-- os segundos/minutos de áudio (duração vinda do Whisper via response_format
-- verbose_json). clinic_id pode ser NULL quando o canal ainda não resolveu a
-- clínica no momento da transcrição (ex.: webhook Meta).

-- Guarda os SEGUNDOS exatos por transcrição (fonte da verdade para cobrança). Os
-- minutos NÃO são gravados por linha de propósito: cobrar deve somar `seconds` e
-- arredondar o TOTAL (ceil), senão N áudios curtos viram N minutos inteiros.
create table if not exists public.stt_usage (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        references public.clinics(id) on delete cascade,
  channel     text        not null,     -- 'session' | 'whatsapp' | 'meta_whatsapp' | 'zoom'
  seconds     numeric     not null,
  created_at  timestamptz not null default now()
);

create index if not exists stt_usage_clinic_created_idx
  on public.stt_usage(clinic_id, created_at desc);

alter table public.stt_usage enable row level security;

-- Leitura por clínica (relatórios de uso). Inserção é feita pelo service role
-- (admin client) nos webhooks/rotas, que ignora RLS — sem policy de insert.
drop policy if exists "stt_usage_select" on public.stt_usage;
create policy "stt_usage_select" on public.stt_usage
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));
