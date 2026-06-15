-- Migration 079: corrige drift de schema — session_types.is_recorded
--
-- O código (createIntegrationsSideEffects, SessionType, create-session-modal) usa
-- `session_types.is_recorded`, mas a coluna nunca foi criada em produção, gerando
-- "column session_types.is_recorded does not exist" ao confirmar agendamento/criar Zoom.
ALTER TABLE public.session_types
  ADD COLUMN IF NOT EXISTS is_recorded boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
