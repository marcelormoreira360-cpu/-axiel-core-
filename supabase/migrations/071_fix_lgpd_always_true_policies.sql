-- APLICADA em produção em 10/06/2026 via conector Supabase.
-- As policies "service role full access" foram criadas sem TO service_role,
-- valendo para public (anon+authenticated) com qual=true => acesso total indevido
-- às tabelas LGPD. service_role ignora RLS; policy recriada só por documentação.

DROP POLICY IF EXISTS "service role full access on patient_consents" ON public.patient_consents;
CREATE POLICY "service role full access on patient_consents"
  ON public.patient_consents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service role full access on data_deletion_requests" ON public.data_deletion_requests;
CREATE POLICY "service role full access on data_deletion_requests"
  ON public.data_deletion_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);
