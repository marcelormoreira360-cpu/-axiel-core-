-- migration 060_recover_triggers_indexes.sql
-- Reconciliação (camada cosmética/perf): recria os triggers de auto-updated_at e
-- os índices de performance que faltavam. Não quebram nada — só mantêm updated_at
-- e aceleram queries. Idempotente. (pula media/meta_conversations — não usadas)

-- ── Triggers de updated_at (usam a função genérica public.set_updated_at) ──────
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'assessment_responses','assessment_templates','hotmart_purchases',
    'patient_packages','product_orders','repasse_ledger','repasse_rules',
    'treatment_plans','whatsapp_bot_configs','whatsapp_conversations'
  ] loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$s', tbl);
    execute format('create trigger set_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', tbl);
  end loop;
end $$;

-- ── Índices de performance faltantes ─────────────────────────────────────────
create index if not exists assessment_answers_response_id_idx     on public.assessment_answers(response_id);
create index if not exists assessment_invitations_clinic_id_idx   on public.assessment_invitations(clinic_id);
create index if not exists assessment_invitations_patient_id_idx  on public.assessment_invitations(patient_id);
create index if not exists assessment_invitations_token_hash_idx  on public.assessment_invitations(token_hash);
create index if not exists assessment_questions_section_id_idx    on public.assessment_questions(section_id);
create index if not exists assessment_questions_template_id_idx   on public.assessment_questions(template_id);
create index if not exists assessment_responses_clinic_id_idx     on public.assessment_responses(clinic_id);
create index if not exists assessment_responses_patient_id_idx    on public.assessment_responses(patient_id);
create index if not exists assessment_responses_template_id_idx   on public.assessment_responses(template_id);
create index if not exists assessment_sections_template_id_idx    on public.assessment_sections(template_id);
create index if not exists assessment_templates_clinic_id_idx     on public.assessment_templates(clinic_id);
create index if not exists exam_results_exam_id_idx               on public.exam_results(exam_id);
create index if not exists finance_insights_clinic_generated_idx  on public.finance_insights(clinic_id, generated_at desc);
create index if not exists hotmart_purchases_clinic_id_idx        on public.hotmart_purchases(clinic_id);
create index if not exists hotmart_purchases_created_at_idx       on public.hotmart_purchases(created_at desc);
create index if not exists hotmart_purchases_patient_id_idx       on public.hotmart_purchases(patient_id);
create index if not exists hotmart_purchases_status_idx           on public.hotmart_purchases(status);
create index if not exists patient_payments_status_idx           on public.patient_payments(status);

notify pgrst, 'reload schema';
