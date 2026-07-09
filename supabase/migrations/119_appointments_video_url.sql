-- Link de teleconsulta manual (Google Meet/Zoom/Teams colado pelo terapeuta).
-- O código já lê/grava appointments.video_url (lib/types, agenda, session panel),
-- mas a coluna nunca existiu no banco: a tela "Agendar sessão" (que tem o campo
-- Telehealth link) quebrava no insert com PGRST204. Cria a coluna e recarrega o
-- schema cache do PostgREST.
alter table public.appointments
  add column if not exists video_url text;

notify pgrst, 'reload schema';
