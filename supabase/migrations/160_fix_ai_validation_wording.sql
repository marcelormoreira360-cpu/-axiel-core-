-- 160_fix_ai_validation_wording.sql
-- Alinha a nota de auditoria com o contrato de governanca: a validacao humana e OBRIGATORIA,
-- nao "optional". Troca apenas o texto literal gravado em ai_validation_events.reviewer_notes
-- pela funcao de trigger; corpo identico ao atual (idempotente, reaplicavel).
create or replace function public.create_ai_generated_pending_review_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_validation_events (
    clinic_id,
    ai_insight_id,
    patient_id,
    action,
    previous_status,
    new_status,
    reviewed_by,
    reviewer_notes,
    changes_made,
    output_after
  ) values (
    new.clinic_id,
    new.id,
    new.patient_id,
    'generated_pending_review',
    null,
    coalesce(new.review_status, 'pending_review'),
    new.created_by,
    'AI output created and waiting for human validation before final use.',
    null,
    new.output
  );
  return new;
end;
$$;
