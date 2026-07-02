-- 109: Higiene de segurança e performance (varredura 01/07/2026)
--
-- 1) Funções SECURITY DEFINER deixavam de expor superfície via /rest/v1/rpc
--    (advisor: anon/authenticated_security_definer_function_executable).
--    Regras aplicadas:
--    - Funções de TRIGGER: ninguém precisa de EXECUTE (o disparo de trigger
--      não checa ACL); revogado de public/anon/authenticated.
--    - Helpers de RLS (can_access_clinic etc.): usados DENTRO de policies,
--      avaliados como o usuário logado -> authenticated MANTÉM EXECUTE;
--      revogado de public/anon.
--    - write_audit_log / upsert_whatsapp_bot_config: chamados via .rpc() com
--      o server client (authenticated) -> mantém authenticated, revoga anon.
--    - check_rate_limit: chamado só com admin client -> revoga de todos.
--    - service_role recebe GRANT explícito (o default vinha de PUBLIC).
--
-- 2) 18 índices duplicados removidos (advisor: duplicate_index).
-- 3) 5 FKs sem índice ganham índice (advisor: unindexed_foreign_keys).

-- ── 1a. Funções de trigger: revogar de todos os roles de API ────────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'assert_same_clinic',
    'create_ai_generated_pending_review_event',
    'handle_new_auth_user',
    'log_patient_portal_link_revoked',
    'prevent_ai_validation_event_mutation',
    'prevent_patient_portal_link_sensitive_update',
    'sync_package_sessions_used',
    'validate_ai_final_approval',
    'validate_ai_validation_event_same_clinic',
    'validate_communication_log_clinic',
    'validate_patient_portal_access_log_same_clinic',
    'validate_patient_portal_link_same_clinic'
  ] loop
    execute format('revoke execute on function public.%I() from public, anon, authenticated', fn);
    execute format('grant execute on function public.%I() to service_role', fn);
  end loop;
end $$;

-- ── 1b. Helpers de RLS: revogar public/anon, manter authenticated ───────────
revoke execute on function public.can_access_clinic(uuid) from public, anon;
revoke execute on function public.can_manage_clinic(uuid) from public, anon;
revoke execute on function public.can_write_clinic_data(uuid) from public, anon;
revoke execute on function public.current_membership_role(uuid) from public, anon;
revoke execute on function public.current_user_clinic_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.is_platform_staff() from public, anon;

grant execute on function public.can_access_clinic(uuid) to authenticated, service_role;
grant execute on function public.can_manage_clinic(uuid) to authenticated, service_role;
grant execute on function public.can_write_clinic_data(uuid) to authenticated, service_role;
grant execute on function public.current_membership_role(uuid) to authenticated, service_role;
grant execute on function public.current_user_clinic_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.is_platform_staff() to authenticated, service_role;

-- ── 1c. RPCs de aplicação ────────────────────────────────────────────────────
revoke execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) to authenticated, service_role;

revoke execute on function public.upsert_whatsapp_bot_config(uuid, text, text, text, text, jsonb, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.upsert_whatsapp_bot_config(uuid, text, text, text, text, jsonb, text, text, boolean, text, text, text) to authenticated, service_role;

revoke execute on function public.check_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, timestamptz, integer) to service_role;

-- ── 2. Índices duplicados (mantém a variante <tabela>_<coluna>_idx) ─────────
drop index if exists public.idx_assessment_answers_response_id;
drop index if exists public.idx_assessment_invitations_patient_id;
drop index if exists public.idx_assessment_invitations_token_hash;
drop index if exists public.idx_assessment_questions_section_id;
drop index if exists public.idx_assessment_questions_template_id;
drop index if exists public.idx_assessment_responses_clinic_id;
drop index if exists public.idx_assessment_responses_patient_id;
drop index if exists public.idx_assessment_responses_template_id;
drop index if exists public.idx_assessment_sections_template_id;
drop index if exists public.idx_assessment_templates_clinic_id;
drop index if exists public.idx_exam_results_exam_id;
drop index if exists public.finance_insights_clinic_generated;
drop index if exists public.idx_hotmart_purchases_clinic;
drop index if exists public.idx_hotmart_purchases_patient;
drop index if exists public.idx_patients_clinic_id;
drop index if exists public.repasse_ledger_clinic_month;
drop index if exists public.idx_users_clinic_id;
drop index if exists public.idx_whatsapp_bot_configs_meta_phone_number_id;

-- ── 3. FKs sem índice ────────────────────────────────────────────────────────
create index if not exists ai_insights_ai_request_id_idx
  on public.ai_insights (ai_request_id);
create index if not exists patient_assessments_created_by_idx
  on public.patient_assessments (created_by);
create index if not exists patient_functional_exams_created_by_idx
  on public.patient_functional_exams (created_by);
create index if not exists patient_functional_exams_metrics_reviewed_by_idx
  on public.patient_functional_exams (metrics_reviewed_by);
create index if not exists public_form_submissions_invitation_id_idx
  on public.public_form_submissions (invitation_id);
