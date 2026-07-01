-- 108 — Consolidação: migrar o "Formulário de intake" (intake_forms) para o
-- sistema de Formulários (assessment_templates), com placement 'intake'.
--
-- Contexto: o Intake antigo era preenchido só internamente (não chegava ao
-- paciente por link/portal) e duplicava o papel dos Formulários. Aqui cada
-- intake_form ATIVO vira um assessment_template equivalente (perguntas de texto,
-- sem pontuação), marcado para aparecer no slot "intake" e ser enviado no 1º
-- agendamento. Os dados antigos de intake_responses ficam intactos.
--
-- Idempotente: guarda por source_intake_form_id, então reaplicar não duplica.

alter table public.assessment_templates
  add column if not exists source_intake_form_id uuid
    references public.intake_forms(id) on delete set null;

create unique index if not exists assessment_templates_source_intake_form_id_key
  on public.assessment_templates(source_intake_form_id)
  where source_intake_form_id is not null;

with new_templates as (
  insert into public.assessment_templates
    (clinic_id, name, description, is_active, placement, send_on_first_appointment, source_intake_form_id)
  select f.clinic_id,
         f.name,
         'Migrado do formulário de intake (perguntas abertas, sem pontuação).',
         true,
         '{intake}'::text[],
         true,
         f.id
  from public.intake_forms f
  where f.is_active
    and not exists (
      select 1 from public.assessment_templates t where t.source_intake_form_id = f.id
    )
  returning id, source_intake_form_id
),
new_sections as (
  insert into public.assessment_sections (template_id, title, order_index)
  select nt.id, 'Anamnese', 0 from new_templates nt
  returning id, template_id
)
insert into public.assessment_questions
  (template_id, section_id, text, question_type, min_score, max_score, order_index, is_required)
select ns.template_id,
       ns.id,
       q.label,
       -- Tipos do intake que o Formulário não tem (short/long_text, date,
       -- body_map) viram 'text'. number e yes_no têm equivalente direto.
       -- (assessment_questions.question_type é text no banco.)
       case q.question_type
         when 'number' then 'number'
         when 'yes_no' then 'yes_no'
         else 'text'
       end,
       0, 0,
       q.display_order,
       coalesce(q.is_required, false)
from new_sections ns
join new_templates nt on nt.id = ns.template_id
join public.intake_questions q on q.form_id = nt.source_intake_form_id;
