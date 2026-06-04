# Auditoria AXIEL Core — 03/06/2026

> O que está faltando, o que melhorar, e o que já está bem feito.
> Ordenado por prioridade. Itens marcados **[ação sua]** são coisas práticas para você fazer.

---

## Resumo executivo

O **código** está em boa forma: TypeScript sem erros, i18n PT/EN 100% em paridade (34 namespaces), sem TODOs/`@ts-ignore`, sem segredos jogados em log, RLS por clínica em todas as tabelas, assinaturas de webhook validadas (Meta e Stripe), rotas sensíveis (ex.: reembolso) protegidas por papel, rate limiting e idempotência na integração com o Growth.

O **maior risco não é o código — é o banco de dados**: as migrations vêm sendo aplicadas **manualmente** (colando SQL), sem rastreamento. Foi exatamente isso que quebrou todas as telas de lead (a migration 050 nunca tinha sido aplicada). Provavelmente há outras nessa situação. Esse é o item nº 1.

---

## 🔴 CRÍTICO

### 1. Drift de migrations (banco fora de sincronia com o código)
**O problema:** o processo documentado é aplicar via `supabase db push --linked` (que registra o que já foi aplicado). Mas na prática as migrations foram coladas à mão no SQL Editor, sem registro. Resultado: ninguém sabe ao certo o que está aplicado. Já mordeu duas vezes (050 faltando → telas de lead quebradas; FK/tipo do `clinic_id`).

**[ação sua] Rode esta verificação** no Supabase (projeto **AXIEL Core**) para descobrir o que falta:
```sql
select 'waitlist_entries (048)'                    as artefato, to_regclass('public.waitlist_entries') is not null as existe
union all select 'users.preferred_locale (049)',           exists(select 1 from information_schema.columns where table_name='users' and column_name='preferred_locale')
union all select 'action_suggestions.content_key (050)',   exists(select 1 from information_schema.columns where table_name='action_suggestions' and column_name='content_key')
union all select 'whatsapp_bot_configs.meta_instagram_id (051)', exists(select 1 from information_schema.columns where table_name='whatsapp_bot_configs' and column_name='meta_instagram_id')
union all select 'clinic_integration_keys (052)',          to_regclass('public.clinic_integration_keys') is not null
union all select 'leads.growth_lead_id (052)',             exists(select 1 from information_schema.columns where table_name='leads' and column_name='growth_lead_id')
union all select 'broadcast_campaigns (047)',              to_regclass('public.broadcast_campaigns') is not null
union all select 'patient_push_subscriptions (046)',       to_regclass('public.patient_push_subscriptions') is not null
order by 1;
```
Qualquer linha com `existe = false` é uma migration que **não foi aplicada** — me manda o resultado que eu te passo o SQL para corrigir cada uma.

**Recomendação de processo:** parar de colar SQL à mão. Passar a usar `supabase db push --linked` (ou um checklist fixo "aplicou a migration? sim/não" antes de cada deploy). Isso elimina o drift de vez.

### 2. Confirmar a migration 048 (fila de espera)
O código (`services/waitlist-service.ts`) usa a tabela `waitlist_entries`, mas o CONTEXT registrava a **048 como pendente**. Se ela não estiver aplicada, a **fila de espera quebra** quando alguém cancela um agendamento. A verificação acima já cobre isso (`waitlist_entries`).

---

## 🟡 IMPORTANTE

### 3. Tipo do `clinic_id` em `whatsapp_bot_configs` (texto em vez de uuid) — 🟠 DÍVIDA ACEITA, NÃO MEXER POR ORA
Toda a base usa `clinic_id` como `uuid`, mas essa tabela ficou como `text`. Já contornado no código (não quebra nada).
**Decisão (03/06/2026): NÃO converter agora.** Ao investigar, descobriu-se que as políticas RLS **em produção não batem com os arquivos de migration**: o banco roda uma policy `clinic_own_whatsapp_config` (com `users.clinic_id::text`) que **não existe no repo**, enquanto o repo define 4 policies (`select/insert/update/delete` com `clinic_id::uuid`). Converter o tipo exigiria dropar/recriar políticas cujo estado real é incerto → **risco de travar o acesso à tabela em produção**, para um ganho meramente cosmético. Fica como dívida técnica aceita. Se um dia for mexer: fazer fora de horário de pico, com backup, e reconciliando as policies primeiro.

### 4. Instagram — dois bloqueios para o bot de DM funcionar de verdade
- **(a)** A conta `jifwcenter` precisa virar **conta Business** (a conversão estava dando erro temporário na Meta).
- **(b)** O app da Meta está em **modo desenvolvimento**. Assim ele só recebe DMs das **suas próprias contas**. Para responder DM de **qualquer paciente**, o app precisa ser **publicado** (passa pela **App Review** da Meta, pedindo a permissão `instagram_business_manage_messages`). Isso leva alguns dias e é um processo à parte.

### 5. Cron do relatório mensal duplicado — ✅ VERIFICADO, ESTÁ CORRETO (não mexer)
O `/api/cron/monthly-report` aparece 2x no `vercel.json` (9h e 10h do dia 1º), mas **é intencional e seguro**: o run das 10h é um **retry** caso o das 9h falhe, e o `CronGuard` (tabela `cron_runs`, janela de 2h) garante que **não envia em dobro** — se o primeiro já teve sucesso, o segundo pula. Bom design de resiliência. **Nenhuma ação necessária.**

### 6. Limpeza — ✅ CONCLUÍDA (03/06/2026)
- Chaves expostas no chat **revogadas**; mantida só a que o Growth usa (`axg_bf1…`).
- Leads de teste **apagados** no Core e no Growth.

---

## 🟢 MELHORIAS (não urgentes)

### 7. Cobertura de testes na integração nova
O Core tem 13 arquivos de teste (bom), mas a **integração com o Growth** (`services/growth-integration-service.ts` + o endpoint) **não tem teste automatizado** — e ela lida com criação de leads e autenticação por chave. Vale adicionar testes (200/401/422/429, dedup, idempotência), como o Growth já fez do lado dele.

### 8. Separar dados do IFWC do schema comercial
Há migrations de **seed** com dados do IFWC (`019`, `021`, `022`) e o `IFWC_DEFAULT_CONFIG` no código. Para o produto comercial, o ideal é que esses dados de exemplo fiquem **fora** das migrations canônicas (num seed separado, só para o seu ambiente de teste), para uma clínica nova não herdar dados do IFWC.

### 9. Observabilidade
Já existe **Sentry** configurado (ótimo). Sugestão: ativar **alertas** (e-mail/Slack) para erros 500 em produção — assim você descobre um problema como o da migration 050 **na hora**, não quando clica e vê a tela de erro.

### 10. Documentar o "go-live" do Instagram e do Growth
Criar um checklist curto de produção (App Review da Meta, conta Business, rotação final de chaves, verificação de migrations) para quando for vender para a primeira clínica externa.

---

## ✅ O QUE JÁ ESTÁ BEM (pontos fortes)

- **Build saudável:** `tsc` 0 erros; i18n PT/EN com paridade total em 34 namespaces.
- **Higiene de código:** zero `TODO`/`FIXME`/`@ts-ignore`; nenhum segredo (token/senha/chave) em `console.log`.
- **Segurança:** RLS por clínica em todas as tabelas; assinatura validada nos webhooks da Meta e no webhook do Stripe; rotas sensíveis (reembolso, envio de WhatsApp) exigem login + papel; rate limiting no banco; idempotência na recepção de leads.
- **Integração Growth↔Core:** validada ponta a ponta, com chave hasheada (SHA-256), dedup e idempotência.
- **Resiliência:** Sentry + páginas de erro tratadas; crons configurados (automações, relatório, sync Google).

---

## Ordem sugerida de ação

1. Rodar o **SQL de verificação** (item 1) e me mandar o resultado → corrigir migrations faltantes.
2. Fazer a **limpeza** (item 6): chaves + leads de teste.
3. Revisar o **cron duplicado** (item 5).
4. Quando for para produção externa: **Instagram App Review** (item 4) e **separar seed do IFWC** (item 8).
5. Aos poucos: **testes da integração** (item 7) e **padronizar clinic_id** (item 3).
