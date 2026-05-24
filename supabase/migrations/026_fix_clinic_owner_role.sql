-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 026 — Corrigir role do criador da clínica
--
-- Problema: usuários criadores de clínica ficaram com role = 'staff' em vez de
-- 'clinic_owner', o que impede o acesso às funções de gestão da equipe.
--
-- Fix: para cada clínica que não tem nenhum clinic_owner, promove o usuário
-- mais antigo (o criador) para clinic_owner.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  c RECORD;
  owner_id uuid;
BEGIN
  FOR c IN SELECT id FROM public.clinics LOOP
    -- Verifica se já existe um clinic_owner nesta clínica
    SELECT id INTO owner_id
    FROM public.users
    WHERE clinic_id = c.id AND role = 'clinic_owner'
    LIMIT 1;

    IF owner_id IS NULL THEN
      -- Promove o primeiro usuário cadastrado (criador) para clinic_owner
      UPDATE public.users
      SET role        = 'clinic_owner',
          updated_at  = NOW()
      WHERE id = (
        SELECT id FROM public.users
        WHERE clinic_id = c.id
        ORDER BY created_at ASC
        LIMIT 1
      );

      RAISE NOTICE 'Promovido clinic_owner na clínica %', c.id;
    END IF;
  END LOOP;
END $$;
