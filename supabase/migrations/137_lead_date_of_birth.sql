-- Data de nascimento coletada no formulário público de captação (evento/QR),
-- agora que os dados vêm DEPOIS do questionário e nome+nascimento+e-mail são
-- obrigatórios. Guarda no lead (carrega para o paciente na conversão) e na
-- submissão (registro do que foi respondido).
alter table public.leads
  add column if not exists date_of_birth date;
alter table public.public_form_submissions
  add column if not exists date_of_birth date;
