-- 019_patient_portal_token_enforcement
-- Enforces one active patient dashboard token per patient and keeps patient data private per token.

-- Revoke older active links before enforcing uniqueness.
with ranked_links as (
  select
    id,
    row_number() over (
      partition by clinic_id, patient_id
      order by created_at desc
    ) as link_rank
  from public.patient_portal_links
  where revoked_at is null
)
update public.patient_portal_links links
set revoked_at = now()
from ranked_links ranked
where links.id = ranked.id
  and ranked.link_rank > 1;

-- A patient can have only one non-revoked portal link at a time.
-- Regenerating a link revokes the old one and creates a new 7-day token.
create unique index if not exists patient_portal_links_one_active_per_patient_idx
on public.patient_portal_links(clinic_id, patient_id)
where revoked_at is null;

-- Make sure portal links always expire in 7 days by default.
alter table public.patient_portal_links
  alter column expires_at set default (now() + interval '7 days');

-- Helpful index for token validation on each request.
create index if not exists patient_portal_links_token_validation_idx
on public.patient_portal_links(token_hash, revoked_at, expires_at);
