-- AXIEL Core - Simple CRM Pipeline UI support
-- Adds a dedicated short complaint field for fast lead scanning.

alter table public.leads
  add column if not exists main_complaint text;

update public.leads
set main_complaint = left(notes, 180)
where main_complaint is null
  and notes is not null
  and trim(notes) <> '';

create index if not exists leads_main_complaint_idx on public.leads using gin (to_tsvector('english', coalesce(main_complaint, '')));
