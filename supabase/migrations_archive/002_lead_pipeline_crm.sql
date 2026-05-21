-- AXIEL Core CRM migration for projects that already ran the earlier starter schema.
-- Run this migration only if your existing database still uses the old lead stages:
-- cold, warm, hot, won, lost.

alter type public.lead_stage add value if not exists 'new_lead';
alter type public.lead_stage add value if not exists 'contacted';
alter type public.lead_stage add value if not exists 'scheduled';
alter type public.lead_stage add value if not exists 'converted_to_patient';

-- Important: in PostgreSQL, newly added enum values may need a committed transaction
-- before they can be used. If Supabase shows an enum error, run the statements above first,
-- then run the statements below in a second SQL Editor execution.

alter table public.leads alter column stage set default 'new_lead';

update public.leads set stage = 'new_lead' where stage::text in ('cold', 'warm');
update public.leads set stage = 'scheduled' where stage::text = 'hot';
update public.leads set stage = 'converted_to_patient' where stage::text = 'won';
update public.leads set stage = 'contacted' where stage::text = 'lost';

create index if not exists leads_stage_idx on public.leads(stage);
