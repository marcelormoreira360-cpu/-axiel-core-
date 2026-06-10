# Auditoria Completa — AXIEL Core (10/06/2026)

Escopo: segurança, qualidade de código, banco de produção (Supabase advisors) e produto/growth.

---

## 1. CORRIGIR AGORA (crítico / alto)

### 1.1 Áudios TTS com dados clínicos em bucket público — `app/api/whatsapp/send-voice/route.ts:50`
Áudios gerados de prontuários são salvos no bucket `media` **público**, com URL previsível (`whatsapp-reports/{patientId}-{timestamp}.mp3`) e sem expiração. Qualquer pessoa com a URL acessa dados de saúde. O advisor do Supabase confirma `public_bucket_allows_listing`.
**Fix**: bucket privado + URL assinada com expiração curta (como já é feito em `app/api/documents/[id]/route.ts`). Apagar os arquivos antigos do bucket.

### 1.2 Upload público sem validação de tipo — `app/envio/[slug]/actions.ts:95-115`
Rota pública aceita qualquer MIME declarado pelo cliente (inclusive `.exe`/`.html`). O portal (`app/p/[token]/actions.ts`) já tem allowlist — copiar o mesmo padrão (PDF/JPEG/PNG/WEBP, ≤10MB) + checar magic bytes.

### 1.3 Migrations 048, 052 e 054 — confirmar aplicação em produção
Código em produção depende delas (`waitlist_entries`, `clinic_integration_keys`, `patient_payments.proof_path/pending`). Lição da reconciliação de 04/06: **a fonte de verdade é o `information_schema`, não o registro de migrations**. Verificar via conector Supabase e aplicar o que faltar.

### 1.4 Falha silenciosa no registro de pagamento — `app/api/asaas/charge/route.ts:119`
Se o insert em `patient_payments` falha, o erro só vai pro console e o paciente **recebe o link Pix mesmo assim** → pagamento sem registro financeiro. Retornar erro 500 (ou compensar cancelando a cobrança no Asaas).

### 1.5 CSP com `unsafe-eval` + `unsafe-inline` — `next.config.ts:22`
Em app de dados de saúde, isso neutraliza a proteção contra XSS. Migrar para CSP com nonce (já anotado como "next step" no próprio config). Se `unsafe-eval` é só pelo Sentry Replay, avaliar desabilitar o replay ou isolá-lo.

### 1.6 Query sem filtro de clínica — `app/api/whatsapp/send-voice/route.ts:22-27`
Busca paciente por `id` sem `.eq("clinic_id", ...)`. O RLS provavelmente segura, mas todo o resto do código usa defesa em profundidade (ex.: `/api/whatsapp/send`). Adicionar o filtro explícito.

---

## 2. MELHORAR (médio)

### Segurança
- **Rate limit ausente**: `GET /api/book/[slug]/slots` (scraping de agenda), rotas do portal `POST /api/p/book|feedback|messages` (spam/exaustão), `GET /api/ical/[token]` (força bruta).
- **Injeção no DSL do PostgREST**: input interpolado em `.or(...)` sem escapar vírgula/parênteses — `app/api/search/route.ts:28,37`, `services/patient-service.ts:25,50`, `services/hotmart-service.ts:306`, `app/envio/[slug]/actions.ts:71`. Criar helper único que sanitize o termo antes do `.or()`.
- **iCal token em texto claro** (`clinics.ical_secret`), sem hash/expiração/rotação — `services/ical-service.ts:80`.
- **Meta webhook GET** compara `hub.verify_token` com `===` (timing attack) — usar `timingSafeEqual` como no POST.
- **Rate limiter em memória** no `/api/meta/webhook` (limite real = 30 × nº de instâncias Vercel) — trocar por `checkRateLimitDb`.
- **`refreshDashboardData(clinicId)`** aceita clinicId externo sem validar pertencimento — validar contra `profile.clinic_id`.
- **`billing_events.payload`** guarda o objeto Stripe completo (PII) — armazenar só os campos usados.
- **HSTS sem `preload`**.

### Advisors do banco (produção)
- **Segurança (60 lints: 56 WARN, 4 INFO)**: 4 tabelas com RLS ligado e **zero policies** (`cron_runs`, `hotmart_purchases`, `whatsapp_conversations`, `whatsapp_interactions` — ok se só o service-role acessa, mas documentar); **`rls_policy_always_true` em `data_deletion_requests` e `patient_consents`** (revisar — são tabelas LGPD); ~20 funções SECURITY DEFINER executáveis por `anon`/`authenticated` (revogar EXECUTE de quem não precisa); 4 funções sem `search_path` fixo; `pg_trgm` no schema public.
- **Performance (~480 lints)**: ~230 foreign keys sem índice, ~50 policies RLS com `auth.*()` reavaliado por linha (`auth_rls_initplan` — envolver em `(select auth.uid())`), ~200 índices nunca usados (candidatos a drop). Vale uma migration de limpeza num fim de semana.

### Qualidade / performance de código
- **Sem CI/CD** — nenhum check roda em push. Mínimo: GitHub Action com `typecheck` + `verify:i18n` + `vitest`. É barato e elimina a classe de bug "validado com tsc quebrado" que já aconteceu.
- **Testes**: 13 arquivos, só em `lib/`/`modules/`. Zero cobertura de rotas de API e webhooks — justamente onde está o dinheiro (Stripe/Asaas). Priorizar testes dos handlers de webhook.
- **N+1 / risco de timeout nos crons (60s)**: `assessment-progress-service.ts:132` (loop com await), `google-calendar-service.ts:331` (update por evento), `broadcast-service.ts:128` e `processReassessments` (envio sequencial). Broadcast com centenas de pacientes **vai** estourar 60s — mover para fila/chunks (ex.: processar 50 por invocação com cursor).
- **Cron `monthly-report` duplicado** no `vercel.json`.
- **Limites arbitrários `.limit(5000)`** em finance/report-service — quebram silenciosamente em clínica grande.
- **`select("*")`** em `lead-service` carrega `warming_context` (JSONB grande) em toda listagem.
- **Componentes gigantes**: `schedule-container.tsx` (1.354 linhas), `patient-portal-dashboard.tsx` (1.211) — dividir quando for mexer neles.
- **Tela `/intake` antiga ainda duplica formulários** a cada save — remover o builder antigo e apontar tudo pro editor `/intake/[id]/edit`.
- **Mismatch `next@16` × `eslint-config-next@15.3.4`**; `recharts@3.x` ainda instável.
- **i18n residual**: `modules/follow-ups` (mensagens PT fixas chegam a paciente EN), `report-service` (`MONTH_PT`), `business-analytics-service` (6× `toLocaleDateString("pt-BR")`), `formatBRL` em 6 arquivos de serviço.
- **`whatsapp_bot_configs.clinic_id` text** → uuid (dívida já anotada; 5 queries extras por operação do bot).

---

## 3. CONSELHOS — SUCESSO E VIRALIZAÇÃO

O produto está tecnicamente acima da média (multi-tenant sério, IA com governança, i18n completo, PWA, onboarding com dados demo). O que falta não é feature clínica — é **motor de distribuição e medição**. Em ordem de impacto:

### 3.1 Você está voando às cegas — instale product analytics (semana 1)
Zero PostHog/Mixpanel/GA. Sem isso não dá pra saber onde o funil vaza nem o que repetir. PostHog tem tier grátis generoso e self-serve. Rastrear 8 eventos: signup, onboarding concluído, 1º paciente real, 1º agendamento, 1º pagamento, ativação de WhatsApp, conversão de trial, churn. **Tudo abaixo depende disso.**

### 3.2 Loop viral nº 1: "Powered by AXIEL" (1 dia de trabalho)
O booking público e o portal do paciente são vistos por **pacientes — que incluem donos de outras clínicas**. Hoje não há nenhuma marca AXIEL neles. Um rodapé discreto "Agendamento por AXIEL ✦ crie o da sua clínica" com UTM é o loop de PLG mais barato que existe (foi assim que Calendly e Typeform cresceram). Manter white-label como feature do Enterprise — vira até argumento de upgrade.

### 3.3 Loop viral nº 2: programa de indicação (1 semana)
Clínicas integrativas se conhecem (congressos, formações, grupos de WhatsApp). Hoje `referral` é só um enum manual. Estruturar: link único por clínica → indicado ganha 1 mês grátis, indicador ganha 1 mês grátis na conversão. Mostrar o link no dashboard e no e-mail de relatório mensal (que já existe e é o momento de maior orgulho do cliente).

### 3.4 E-mails de ciclo de vida B2B (1 semana)
A infra (Resend + React Email) já existe, mas **todos** os e-mails são para pacientes. Faltam os que vendem: boas-vindas no signup, sequência D+1/D+3/D+7 de ativação, **aviso de trial expirando (D-3 e D-1)** — este último é literalmente receita perdida hoje —, aviso de limite do plano (upsell automático) e win-back.

### 3.5 SEO básico (2 dias) + conteúdo programático
Faltam `sitemap.ts`, `robots.ts`, `opengraph-image` e canonical. Sem OG image, todo link compartilhado no WhatsApp (o canal do seu público!) aparece sem preview. Depois: páginas por especialidade ("software para clínica de acupuntura", "sistema para nutricionista integrativa") — os 8 perfis do onboarding já dão o template. Concorrência de SEO nesse nicho em PT-BR é fraca.

### 3.6 Conteúdo que viraliza no nicho
O canal do seu público é Instagram/WhatsApp, não LinkedIn. O que compartilha: o **mapa anatômico interativo** e os **gráficos de evolução do paciente** são visualmente únicos — vídeos de 30s mostrando isso rodam bem em Reels. Um "relatório de evolução" bonito que o paciente recebe e mostra pra outras pessoas é marketing feito pelo próprio paciente. Considerar um gerador de imagem compartilhável da evolução (com consentimento, sem dados sensíveis).

### 3.7 Prova social real
Os 6 depoimentos e "500+ clínicas" da landing são hardcoded. Se não são reais, é risco reputacional (e legal). Trocar por 2-3 casos reais com foto e resultado concreto ("reduzi faltas em 40% — Dra. X, São Paulo") vale mais que 6 genéricos. O NPS que você já coleta dos pacientes pode alimentar isso.

### 3.8 Reduzir atrito de booking
Cancelamento/reagendamento self-service pelo paciente (hoje não existe) reduz no-show e ligações — e é a feature que clínicas comparam com Doctoralia. Foto do profissional no booking aumenta conversão.

### 3.9 Health score interno
Você já calcula churn risk **dos pacientes das clínicas** — falta o mesmo para **as clínicas no AXIEL** (login frequency, nº de agendamentos/semana, features usadas). Com poucos clientes, um e-mail semanal pra você mesmo listando clínicas esfriando já permite intervenção manual.

### Sequência sugerida (30/60/90)
- **30 dias**: itens da seção 1 + analytics (3.1) + "Powered by AXIEL" (3.2) + e-mail de trial expirando + SEO básico (3.5) + CI.
- **60 dias**: programa de indicação (3.3) + sequência completa de e-mails (3.4) + self-service de reagendamento (3.8) + limpeza dos advisors do banco.
- **90 dias**: páginas programáticas de SEO + conteúdo Reels/casos reais (3.6/3.7) + health score (3.9) + refactors (componentes gigantes, filas para broadcast).

---

*Gerado por auditoria automatizada (código + Supabase advisors). Itens com arquivo:linha verificados no código em 10/06/2026.*
