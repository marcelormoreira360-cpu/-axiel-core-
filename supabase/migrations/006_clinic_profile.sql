-- Migration 006: adiciona clinic_profile, logo_url e primary_color à tabela clinics

alter table public.clinics
  add column if not exists clinic_profile text not null default 'integrativa'
    check (clinic_profile in ('integrativa','fisioterapia','saude_mental','nutricao','wellness')),
  add column if not exists logo_url      text,
  add column if not exists primary_color text;
