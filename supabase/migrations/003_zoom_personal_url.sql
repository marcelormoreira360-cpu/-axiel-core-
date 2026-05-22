-- Migration 003: adiciona zoom_personal_url em clinic_users
-- Armazena o link da sala pessoal do profissional para teleconsultas

alter table public.clinic_users
  add column if not exists zoom_personal_url text;
