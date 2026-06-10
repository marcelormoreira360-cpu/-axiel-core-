-- APLICADA em produção em 10/06/2026 via conector Supabase.
-- Envolve auth.uid()/auth.role()/auth.jwt() em (SELECT ...) nas policies
-- para avaliar 1x por query em vez de por linha (advisor auth_rls_initplan).
-- Reescrita mecânica via ALTER POLICY (preserva roles/cmd). 25 policies em 19 tabelas.
DO $$
DECLARE p record; new_qual text; new_check text; sql text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.(uid|role|jwt)\(\)' AND qual !~ 'SELECT auth\.(uid|role|jwt)\(\)')
        OR
        (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|role|jwt)\(\)' AND with_check !~ 'SELECT auth\.(uid|role|jwt)\(\)')
      )
  LOOP
    new_qual  := regexp_replace(p.qual,       'auth\.(uid|role|jwt)\(\)', '(SELECT auth.\1())', 'g');
    new_check := regexp_replace(p.with_check, 'auth\.(uid|role|jwt)\(\)', '(SELECT auth.\1())', 'g');
    sql := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF p.qual IS NOT NULL THEN
      sql := sql || format(' USING (%s)', new_qual);
    END IF;
    IF p.with_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;
