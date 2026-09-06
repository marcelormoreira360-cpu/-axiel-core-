-- Migration 154 — Índices de cobertura para as foreign keys do ERP financeiro.
--
-- Os advisors de performance do Supabase apontaram 9 FKs sem índice de cobertura
-- nas tabelas novas fin_* (Fase 6, migrations 150-152). Sem esses índices, JOINs
-- e DELETEs em cascata (ex.: apagar um fornecedor, um lançamento, uma recorrência)
-- fazem sequential scan e degradam conforme os lançamentos crescem.
--
-- Todos são CREATE INDEX IF NOT EXISTS: idempotente e seguro de reaplicar.

create index if not exists fin_audit_changed_by_idx      on public.fin_audit(changed_by);

create index if not exists fin_entries_created_by_idx     on public.fin_entries(created_by);

create index if not exists fin_payables_created_by_idx     on public.fin_payables(created_by);
create index if not exists fin_payables_fin_entry_id_idx   on public.fin_payables(fin_entry_id);
create index if not exists fin_payables_recurring_id_idx   on public.fin_payables(recurring_id);
create index if not exists fin_payables_supplier_id_idx    on public.fin_payables(supplier_id);

create index if not exists fin_recurring_created_by_idx    on public.fin_recurring(created_by);
create index if not exists fin_recurring_supplier_id_idx   on public.fin_recurring(supplier_id);

create index if not exists fin_suppliers_created_by_idx    on public.fin_suppliers(created_by);
