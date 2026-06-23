-- 102_assessment_template_placement.sql
-- "Onde este formulário aparece" (placement): cada clínica escolhe os lugares onde o
-- formulário é oferecido. Aditivo, reusa a engine de Formulários (assessment_templates).
-- Slots: intake (1º agendamento) | session (por sessão) | portal (portal do paciente).
--
-- send_on_first_appointment continua existindo e passa a ser DERIVADO do slot 'intake'
-- (a automação de envio no 1º agendamento permanece intacta, sem mudança a jusante).

alter table public.assessment_templates
  add column if not exists placement text[] not null default '{}';

-- Backfill: formulários já marcados para envio no 1º agendamento viram slot 'intake'.
update public.assessment_templates
set placement = array['intake']
where send_on_first_appointment = true
  and (placement is null or placement = '{}');

notify pgrst, 'reload schema';
