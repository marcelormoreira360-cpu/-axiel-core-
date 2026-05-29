-- Migration 039: SEC-03 — enforce NOT NULL on whatsapp_conversations.clinic_id
-- Conversations without a clinic_id are orphaned (no bot config can be looked up).
-- We delete them before adding the constraint.

-- Step 1: remove orphaned rows (no matching clinic_id in clinics table)
delete from public.whatsapp_conversations
where clinic_id is null;

-- Step 2: add NOT NULL constraint
alter table public.whatsapp_conversations
  alter column clinic_id set not null;
