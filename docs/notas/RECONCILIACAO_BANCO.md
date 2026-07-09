# Reconciliação Banco × Migrations — AXIEL Core (04/06/2026)

Comparação **automática** de todas as 55 migrations do repo contra o schema real de produção (`bfuulpvzedcrpmmjxles`), via `information_schema`/`pg_catalog`. Método: parser dos `.sql` → schema esperado; diff contra o banco.

## Causa-raiz

O **registro oficial de migrations do Supabase só vai até a 045**, e várias migrations marcadas como aplicadas **não tiveram efeito** no banco (foram "carimbadas" sem rodar, ou rodaram contra um baseline diferente). As 046–054 foram aplicadas **à mão** (fora do registro). Conclusão central:

> A fonte de verdade é o **schema real**, nunca o registro de migrations. Toda mudança nova deve ser verificada contra `information_schema`.

---

## CRÍTICO — quebra funcionalidade em uso hoje

| Item | Origem | Impacto |
|------|--------|---------|
| `appointments.status` (coluna faltando) | migration 012 | `/financeiro`, dashboard, booking, relatórios de profissional, automações — **~15 pontos** filtram `appointments.status` → erro 42703. **Fix pronto: migration 055.** |
| `session_feedback` (tabela inteira faltando) | migration 014 | NPS pós-sessão (5 arquivos: bot WhatsApp salva nota, analytics lê). Coleta de NPS quebrada. |

## ALTO — quebra ao usar a feature

| Item | Origem | Impacto |
|------|--------|---------|
| `patients`: `first_name, last_name, city, state, country, zip_code, address_line` (7 colunas) | migration 004 (patient_address_fields) | Cadastro/edição de paciente (`patient-service`, `/patients/new`) grava esses campos → insert/update pode falhar ou perder dados. |
| `plans`: `limits, price_usd_cents, price_eur_cents, recommended, slug` | migration 007 (pricing_v2) | Página de planos/billing (`billing-plan-card`, `plan-config`). |
| `clinic_users.zoom_personal_url` | migration 003 | Links de teleconsulta (`/links`). |
| `assessment_responses.appointment_id` | assessment | Vínculo de formulário respondido à sessão. |

## MÉDIO — features secundárias / pouco uso

| Item | Origem | Uso no código |
|------|--------|---------------|
| `media` (tabela) | — | 3 arquivos |
| `zoom_recordings` (tabela) | 043 | 1 arquivo (gravações Zoom) |
| `product_orders` (tabela) | 011 (products) | 1 arquivo |
| `meta_conversations` (tabela) | — | 1 arquivo (provável legado — Instagram usa `whatsapp_conversations`) |

## BAIXO — não quebra o app

- **2 funções faltando**: `sync_package_sessions_used` (no fix 055), `set_updated_at_assessment`.
- **~12 triggers faltando**: `trg_sync_package_sessions` (no 055) + vários `set_<tabela>_updated_at` (só deixam de auto-atualizar `updated_at`; cosmético).
- **~24 índices faltando** (amostra): a maioria nas tabelas ausentes acima + alguns de performance (`patient_payments_status_idx`, `idx_patients_*_trgm`). Não quebram — afetam velocidade.

---

## O que já foi corrigido nesta sessão

- **053** (aplicada): colunas Stripe em `patient_payments` + `boleto` no CHECK + índice único.
- **054** (aplicada): `status='pending'` + `proof_path` + `confirmed_at`.
- **055** (criada, pronta p/ aplicar): recupera `appointments.status` + constraint + função/trigger `sync_package_sessions_used` + backfill.

## Remediação recomendada (ordem)

1. **Aplicar 055 agora** — destrava `/financeiro` e o resto (CRÍTICO confirmado).
2. **Recuperar `patients` (004)** e **`plans` (007)** — colunas additivas, baixo risco; gerar `056`.
3. **Recuperar `session_feedback` (014)** — recriar tabela + RLS + índices a partir da DDL original.
4. **`clinic_users.zoom_personal_url` (003)** e **`assessment_responses.appointment_id`** — additivas.
5. **Avaliar uso real** de `media`, `zoom_recordings`, `product_orders`, `meta_conversations` antes de recriar — se a feature não está em uso, podem ficar para depois.
6. **Índices** — aplicar por último (perf), idealmente fora de horário de pico.

> Importante: recriar **tabela inteira** (itens MÉDIO) exige replicar a DDL original exata (colunas, FKs, RLS, índices) da migration de origem — fazer uma por uma e revisar, não em lote.
