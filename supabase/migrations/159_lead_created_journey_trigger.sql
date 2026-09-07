-- Migration 159: trigger de lead_created na jornada (Frente C, captura de topo de funil)
--
-- Leads nascem por MUITOS caminhos (equipe, formulário público, bot WhatsApp/SMS,
-- Messenger/Instagram, Hotmart, integração Growth). Plugar um emissor em cada
-- call-site é frágil e esquece caminhos futuros. Um trigger AFTER INSERT em
-- public.leads captura TODOS de forma uniforme, gravando o evento lead_created em
-- patient_journey_events (migration 158).
--
-- Segurança/robustez:
--   * SECURITY DEFINER + search_path fixo (grava no log mesmo em ação sem usuário
--     autenticado, ex.: webhook público);
--   * EXCEPTION WHEN OTHERS: best-effort — NUNCA bloquear a criação do lead se o
--     log falhar (a criação do lead é a operação de negócio; o evento é derivado);
--   * ON CONFLICT DO NOTHING pelo dedup_key: idempotente, e não duplica com o
--     backfill da 158 nem com qualquer emissor de app que use a mesma dedup_key.
-- Idempotente (create or replace + drop/create do trigger).

create or replace function public.emit_lead_created_journey_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.patient_journey_events
      (clinic_id, patient_id, lead_id, event_type, occurred_at, source,
       ref_table, ref_id, dedup_key, payload)
    values
      (NEW.clinic_id, NEW.converted_patient_id, NEW.id, 'lead_created',
       coalesce(NEW.created_at, now()), 'core', 'leads', NEW.id,
       'core:lead:' || NEW.id || ':lead_created',
       jsonb_build_object('source', NEW.source::text))
    on conflict (clinic_id, dedup_key) where dedup_key is not null do nothing;
  exception when others then
    -- best-effort: falha ao registrar o evento não pode derrubar a criação do lead.
    null;
  end;
  return NEW;
end;
$$;

-- A função de trigger NÃO deve ser chamável via API (PostgREST expõe funções do
-- schema public como RPC). O trigger a executa como owner independentemente de
-- grants, então revogamos EXECUTE de todos os papéis: fecha a superfície de RPC
-- (evita o lint anon/authenticated SECURITY DEFINER) sem afetar o trigger.
revoke all on function public.emit_lead_created_journey_event() from public, anon, authenticated;

drop trigger if exists trg_lead_created_journey on public.leads;
create trigger trg_lead_created_journey
  after insert on public.leads
  for each row execute function public.emit_lead_created_journey_event();

notify pgrst, 'reload schema';
