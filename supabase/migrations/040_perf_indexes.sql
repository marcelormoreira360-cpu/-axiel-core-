-- Migration 040: PERF-01 — index to support follow_ups.notes LIKE 'custom:%' query
-- processAutomations filters: notes.in.(d-1,nps,d+3,d+30),notes.like.custom:%
-- A B-tree index with text_pattern_ops covers prefix-LIKE on notes efficiently.
-- CONCURRENTLY avoids locking the table during creation.

create index concurrently if not exists idx_follow_ups_notes_pattern
  on public.follow_ups (notes text_pattern_ops);

-- PERF-03: index on whatsapp_conversations.phone to speed up conversation lookup by phone number.
-- getHistory() always queries by phone; without this, each webhook message scans the full table.
create index concurrently if not exists idx_whatsapp_conversations_phone
  on public.whatsapp_conversations (phone);
