-- SEC-01 (Instagram): Add meta_instagram_id to whatsapp_bot_configs so the
-- Instagram Messaging webhook can resolve clinic_id from the incoming IG account
-- id (entry.id). Without this, the Instagram route would fall back to a single
-- hardcoded config (IFWC) and leak one clinic's data/prices to every clinic.
-- Each clinic configures their Instagram Account ID in Settings → WhatsApp Bot.

alter table public.whatsapp_bot_configs
  add column if not exists meta_instagram_id text unique;

-- Index for fast lookup in the webhook hot path
create index if not exists whatsapp_bot_configs_meta_instagram_idx
  on public.whatsapp_bot_configs (meta_instagram_id)
  where meta_instagram_id is not null;

-- Recreate the upsert RPC to also persist meta_instagram_id.
-- (PostgREST resolves RPC functions correctly even when the table schema cache
-- hasn't reloaded yet, because the function body runs as raw SQL in the DB.)
create or replace function public.upsert_whatsapp_bot_config(
  p_clinic_id          uuid,
  p_professional_name  text,
  p_clinic_name        text,
  p_specialty          text,
  p_methodology        text,
  p_locations          jsonb,
  p_language           text,
  p_custom_instructions text,
  p_is_active          boolean,
  p_twilio_number      text,
  p_meta_phone_number_id text,
  p_meta_instagram_id  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Verify the calling user has management rights over this clinic
  if not public.can_manage_clinic(p_clinic_id) then
    raise exception 'Access denied: cannot manage clinic %', p_clinic_id
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.whatsapp_bot_configs (
    clinic_id,
    professional_name,
    clinic_name,
    specialty,
    methodology,
    locations,
    language,
    custom_instructions,
    is_active,
    twilio_number,
    meta_phone_number_id,
    meta_instagram_id,
    updated_at
  ) values (
    p_clinic_id,
    coalesce(p_professional_name, ''),
    coalesce(p_clinic_name, ''),
    coalesce(p_specialty, ''),
    coalesce(p_methodology, ''),
    coalesce(p_locations, '[]'::jsonb),
    coalesce(p_language, 'pt-BR'),
    coalesce(p_custom_instructions, ''),
    coalesce(p_is_active, true),
    nullif(p_twilio_number, ''),
    nullif(p_meta_phone_number_id, ''),
    nullif(p_meta_instagram_id, ''),
    now()
  )
  on conflict (clinic_id) do update set
    professional_name    = excluded.professional_name,
    clinic_name          = excluded.clinic_name,
    specialty            = excluded.specialty,
    methodology          = excluded.methodology,
    locations            = excluded.locations,
    language             = excluded.language,
    custom_instructions  = excluded.custom_instructions,
    is_active            = excluded.is_active,
    twilio_number        = excluded.twilio_number,
    meta_phone_number_id = excluded.meta_phone_number_id,
    meta_instagram_id    = excluded.meta_instagram_id,
    updated_at           = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Drop the old 11-arg signature so PostgREST doesn't keep an ambiguous overload
drop function if exists public.upsert_whatsapp_bot_config(
  uuid, text, text, text, text, jsonb, text, text, boolean, text, text
);

grant execute on function public.upsert_whatsapp_bot_config(
  uuid, text, text, text, text, jsonb, text, text, boolean, text, text, text
) to authenticated;
