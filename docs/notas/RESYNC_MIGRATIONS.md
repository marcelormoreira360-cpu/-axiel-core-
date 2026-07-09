# Resync do baseline de migrations — AXIEL Core

## Problema

O registro do Supabase (`supabase_migrations.schema_migrations`) está dessincronizado do repo:

- **001–045**: registradas com versão curta (`001`…`045`).
- **046–054**: **ausentes** do registro — foram aplicadas à mão no SQL Editor, nunca registradas.
- **055–060**: registradas, mas com **versão timestamp** (`20260604234559`…) em vez do prefixo do arquivo (`055`…`060`), porque foram aplicadas via conector.

Consequência: `supabase db push` ficaria confuso (tentaria reaplicar 046–060). O schema real **já está correto** (reconciliação 055–060) — só o *registro* precisa refletir isso.

> Importante: este resync mexe **apenas na tabela de controle de migrations**. Não altera dados nem o schema da aplicação. Não há impacto no app em produção.

---

## Opção A — Supabase CLI (recomendada)

Roda localmente, com o projeto linkado (`supabase link --project-ref bfuulpvzedcrpmmjxles`). O `migration repair` é o caminho oficial e valida contra os arquivos locais.

```bash
# 1. Ver a divergência (antes)
supabase migration list

# 2. Remover as 6 entradas com versão timestamp (aplicadas via conector)
supabase migration repair --status reverted \
  20260604234559 20260604234612 20260604234732 \
  20260604234753 20260605003238 20260605003451

# 3. Marcar 046–060 como aplicadas SEM reexecutar (o schema já está correto)
supabase migration repair --status applied \
  046 047 048 049 050 051 052 053 054 055 056 057 058 059 060

# 4. Confirmar — local e remoto devem aparecer alinhados (sem pendências)
supabase migration list
```

Depois disso, `supabase db push` deve reportar **"no changes"** e voltar a ser confiável para novas migrations.

---

## Opção B — SQL direto (se preferir não usar a CLI)

Equivale ao que o `repair` faz, aplicável pelo SQL Editor (ou eu rodo via conector). Idempotente.

```sql
begin;

-- remove as 6 entradas com versão timestamp
delete from supabase_migrations.schema_migrations
 where version in (
   '20260604234559','20260604234612','20260604234732',
   '20260604234753','20260605003238','20260605003451'
 );

-- registra 046–060 com a versão = prefixo do arquivo
insert into supabase_migrations.schema_migrations (version, name) values
 ('046','patient_push_subscriptions'),
 ('047','broadcast_campaigns'),
 ('048','waitlist'),
 ('049','user_preferred_locale'),
 ('050','action_suggestion_content'),
 ('051','whatsapp_meta_instagram_id'),
 ('052','growth_integration'),
 ('053','patient_payments_stripe_boleto'),
 ('054','patient_payments_pending_proof'),
 ('055','appointments_status_recover'),
 ('056','recover_additive_columns'),
 ('057','recover_additive_columns_2'),
 ('058','recover_session_feedback'),
 ('059','recover_orders_recordings'),
 ('060','recover_triggers_indexes')
on conflict (version) do nothing;

commit;
```

Verificação:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
-- deve listar 001..060 (versões curtas), sem nenhuma versão timestamp
```

---

## Regras pra não dessincronizar de novo

1. **Toda** mudança de schema vira um arquivo `NNN_descricao.sql` em `supabase/migrations/` **e** é aplicada via `supabase db push` (não cole SQL solto no Editor).
2. Se precisar aplicar à mão por urgência, **registre** depois com `supabase migration repair --status applied NNN`.
3. Antes de assumir que o banco bate com o repo, valide contra o schema real (`information_schema`), nunca contra o registro — foi o que essa reconciliação ensinou.
4. Confirme que cada migration nova realmente teve efeito (não confie só no "success").
