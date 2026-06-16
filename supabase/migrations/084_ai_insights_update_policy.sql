-- Migration 084: ai_insights não tinha policy de UPDATE.
-- Sem ela, o RLS bloqueava silenciosamente o aprovar / solicitar mudanças:
-- o UPDATE via client do usuário retornava 0 linhas -> .single() lança PGRST116
-- -> a action mostrava o genérico "Unknown error".
-- INSERT funcionava (gerar) porque tinha policy; UPDATE (aprovar) não.
DROP POLICY IF EXISTS "Clinic users can update ai_insights" ON public.ai_insights;
CREATE POLICY "Clinic users can update ai_insights"
  ON public.ai_insights
  FOR UPDATE
  USING (can_write_clinic_data(clinic_id) AND (deleted_at IS NULL))
  WITH CHECK (can_write_clinic_data(clinic_id));

NOTIFY pgrst, 'reload schema';
