-- APLICADA em produção em 10/06/2026 via conector Supabase.
-- 1) search_path fixo nas funções apontadas pelo advisor (function_search_path_mutable)
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_patient_portal_access_log_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_patient_portal_link_delete() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_patient_portal_security_event_mutation() SET search_path = public, pg_temp;

-- 2) Revogar EXECUTE do anon nas funções SECURITY DEFINER
--    (advisor anon_security_definer_function_executable)
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.sig);
  END LOOP;
END $$;
