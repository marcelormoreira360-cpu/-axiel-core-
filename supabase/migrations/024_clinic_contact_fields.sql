-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024 — Campos de contato e localização na tabela clinics
--
-- Adiciona: phone, contact_email, website, address_line, city, state, cnpj, description
-- Todos opcionais (nullable), sem breaking changes.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.clinics
  add column if not exists phone         text,
  add column if not exists contact_email text,
  add column if not exists website       text,
  add column if not exists address_line  text,
  add column if not exists city          text,
  add column if not exists state         text,
  add column if not exists cnpj          text,
  add column if not exists description   text;
