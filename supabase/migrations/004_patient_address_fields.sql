-- Migration 004: adiciona campos de endereço e nome separado em patients

alter table public.patients
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists address_line text,
  add column if not exists city         text,
  add column if not exists state        text,
  add column if not exists zip_code     text,
  add column if not exists country      text default 'Brasil';
