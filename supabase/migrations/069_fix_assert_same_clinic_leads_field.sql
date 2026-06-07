-- migration 069_fix_assert_same_clinic_leads_field.sql
-- BUGFIX: assert_same_clinic() acessava new.converted_patient_id na MESMA condição
-- do ELSIF (`tg_table_name = 'leads' AND new.converted_patient_id IS NOT NULL`).
-- Em PL/pgSQL essa referência a campo é resolvida mesmo quando tg_table_name <> 'leads',
-- então QUALQUER insert nas tabelas avaliadas depois desse ELSIF (intake_questions,
-- intake_responses, session_records, follow_ups, patient_offers, ai_insights, ai_requests)
-- falhava com: record "new" has no field "converted_patient_id".
-- Correção: aninhar a checagem do campo dentro do branch já garantido por 'leads'.
CREATE OR REPLACE FUNCTION public.assert_same_clinic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  related_clinic_id uuid;
BEGIN
  IF tg_table_name = 'appointments' THEN
    SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.patient_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Patient must belong to the same clinic as the appointment';
    END IF;

  ELSIF tg_table_name = 'leads' THEN
    IF new.converted_patient_id IS NOT NULL THEN
      SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.converted_patient_id;
      IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
        RAISE EXCEPTION 'Converted patient must belong to the same clinic as the lead';
      END IF;
    END IF;

  ELSIF tg_table_name = 'intake_questions' THEN
    SELECT clinic_id INTO related_clinic_id FROM public.intake_forms WHERE id = new.form_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Intake form must belong to the same clinic as the question';
    END IF;

  ELSIF tg_table_name = 'intake_responses' THEN
    SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.patient_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Patient must belong to the same clinic as the intake response';
    END IF;

  ELSIF tg_table_name = 'session_records' THEN
    SELECT clinic_id INTO related_clinic_id FROM public.appointments WHERE id = new.appointment_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Appointment must belong to the same clinic as the session record';
    END IF;
    SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.patient_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Patient must belong to the same clinic as the session record';
    END IF;

  ELSIF tg_table_name = 'follow_ups' THEN
    SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.patient_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Patient must belong to the same clinic as the follow-up';
    END IF;

  ELSIF tg_table_name = 'patient_offers' THEN
    SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.patient_id;
    IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
      RAISE EXCEPTION 'Patient must belong to the same clinic as the patient offer';
    END IF;

  ELSIF tg_table_name IN ('ai_insights', 'ai_requests') THEN
    IF new.patient_id IS NOT NULL THEN
      SELECT clinic_id INTO related_clinic_id FROM public.patients WHERE id = new.patient_id;
      IF related_clinic_id IS NULL OR related_clinic_id <> new.clinic_id THEN
        RAISE EXCEPTION 'Patient must belong to the same clinic as the AI record';
      END IF;
    END IF;

  END IF;

  RETURN new;
END;
$function$;
