-- Permite, por clínica, agendar 2+ sessões no mesmo horário (atendimento em
-- paralelo / dois procedimentos ao mesmo tempo). Default false = mantém a trava
-- de conflito para as demais clínicas. Quando true, hasAppointmentConflict
-- retorna sempre "sem conflito" para a clínica.
alter table public.clinics
  add column if not exists allow_double_booking boolean not null default false;
