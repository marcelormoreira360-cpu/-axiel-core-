# AXIEL Core — Contexto do Projeto

> Leia este arquivo no início de cada sessão antes de explorar o código.
> Atualizado em: 04/06/2026 (6)

---

## O que é

SaaS para clínicas integrativas. Um workspace completo: agenda, prontuário, IA, faturamento, formulários, teleconsulta, automações.

**Stack**: Next.js 15 App Router · Supabase (Postgres + Auth + Storage) · TypeScript · Tailwind · OpenAI GPT-4o · Vercel

---

## Estado atual (Mai 2026)

- ✅ Sistema em produção (Vercel + Supabase)
- ✅ Auditoria de segurança/UX completa — 15 itens resolvidos
- ✅ Performance otimizada — React.cache nos serviços core + 17 índices no banco
- ✅ Migration 029 aplicada no banco de produção
- ✅ Migration 030 aplicada — UNIQUE constraint em `whatsapp_conversations.phone`
- ✅ Migration 031 aplicada — coluna `current_step` em `whatsapp_conversations`
- ✅ Bot WhatsApp corrigido (loop + duplo INSERT) — commit ffabf22
- ✅ Booking confirmation trocado Twilio → Meta API (template `agendamento_confirmado`)
- ✅ Bot WhatsApp bilíngue PT/EN com auto-detecção — commit c0254eb (28/05/2026)
- ✅ Auditoria completa — 21 correções de segurança, bugs e performance — commit 922961e (28/05/2026)
- ✅ Migration 032 aplicada — coluna `sessions_remaining` gerada + índice parcial em `patient_packages`
- ✅ Migrations 033–045 aplicadas no banco de produção (29/05/2026)
- ✅ Google Calendar OAuth conectado — `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` em produção
- ✅ Drag-and-drop + resize de duração na agenda semanal e diária (dnd-kit)
- ✅ Gráfico mensal de receita no relatório financeiro (recharts AreaChart)
- ✅ Badge de notificações na sidebar (insights pendentes + solicitações LGPD)
- ✅ Exportar lista de pacientes em CSV
- ✅ Filtro de pacientes por profissional (owners/admins)
- ✅ Página de upgrade + banner de trial expirado
- ✅ Bot Meta WhatsApp: `getHistory()` agora lê `clinic_id` real do banco (fix SEC-02)
- ✅ `SessionPackageBadge` no perfil do paciente — exibe "Sessão X · Pacote Y" + barra de progresso
- ✅ Results Dashboard (Execução 13) — `/results` com 4 KPIs, serviços, origem, resumo financeiro e AI insights
- ✅ `/results` adicionado à sidebar (seção Clínica)
- ✅ Feature gates WhatsApp bot implementados (Meta: Scale+; Twilio: Professional+)
- ✅ Todos os marcadores TODO-02, DEBT-04, DEBT-08 removidos (código já estava implementado)
- ✅ Fase 1 (jornada conectada): painel "Contexto do paciente" na tela de sessão (anamnese + assessment + última sessão)
- ✅ Fase 1: strip "Next Step" na página do paciente — amber se revisão pendente, verde com current_status se insight final
- ✅ Fase 1: após aprovar insight → banner sugere criar follow-up (`?approved=1&suggest_followup=1`)
- ✅ Fase 2 (Voice Notes): `VoiceDictation` genérico — textarea + mic + Whisper, uncontrolled, funciona em qualquer form
- ✅ Fase 2: VoiceDictation integrado no formulário de aprovação de insights (reviewer_notes)
- ✅ Fase 2: VoiceDictation integrado no formulário de follow-up (notes)
- ✅ Fase 3 (Stripe): onboarding plan page com "Continuar com trial grátis" (skip sem cartão)
- ✅ Fase 3: histórico de faturas Stripe na página /billing (lista até 8 faturas com status + PDF)
- ✅ Fase 4 (Results avançado): breakdown mensal em `business-analytics-service.ts` (MonthlyBreakdown)
- ✅ Fase 4: period selector 1/3/6/12 meses via URL em `/results`
- ✅ Fase 4: `ResultsChart` (recharts ComposedChart — barras sessões/novos pacientes + linha receita)
- ✅ Fase 4: `ResultsExportButton` — CSV client-side com BOM UTF-8 (resumo + tabela mensal)
- ✅ Portal melhorado: timeline de todos insights aprovados, exames com biomarkers, protocolo (medicamentos + suplementos), "ver mais sessões"
- ✅ Onboarding guiado: `/api/onboarding/checklist` detecta 6 passos; widget com barra de progresso, steps com ✓ real, refresh ao navegar — commit da65942 (29/05/2026)
- ✅ Notificações in-app: 5 tipos (insights, LGPD, follow-ups vencidos, novos leads, formulários); Supabase Realtime em vez de polling 30s — commit 0efa4a2 (29/05/2026)
- ✅ PWA mobile: MobileBottomNav (4 tabs + Mais), safe-area-inset-bottom iPhone, manifest com 4 shortcuts, install prompt re-mostra após 7 dias — commit 5ef1f26 (29/05/2026)
- ✅ `/results` assíncrono: AI insights carregam em background via `/api/results/insights` (GPT isolado, maxDuration=60s), página renderiza em <1s com skeleton — commit 6b327af (29/05/2026)
- ✅ Bug crítico resolvido: Shell com `try-catch` explícito no `Promise.all` — edge case Next.js 16 RSC onde rejeição silenciosa de promise nested derrubava todas as páginas — commit 13ccb6a (29/05/2026)
- ✅ Relatório mensal: template React Email + botão enviar agora + cron no Vercel (dia 1º às 9h e 10h) — commit 08b64aa
- ✅ Phase 2 Intelligence: engagement score 0-100, churn risk badge, patient timeline — zero queries extras — commit 6b2eccd
- ✅ Push notifications para pacientes: tabela `patient_push_subscriptions`, portal usa token auth (sem Supabase Auth), bot envia push em booking + insight aprovado — commit 27adb80
- ✅ Prontuário PDF completo: 7 seções (intelligence strip, SOAP, assessments, exames, insights, prescrições) — commit a4092f1
- ✅ Landing page comercial: DashboardMockup, stats, integrações, SEO metadata — commit 9dbc725
- ✅ NPS pós-sessão via WhatsApp: paciente responde 1-5 direto no chat, score salvo em `session_feedback`, score ≥ 4 dispara link Google Reviews — commit 7dccd51
- ✅ Google Reviews URL: campo nas Settings → Integrações, salvo em `clinic_settings.settings.google_review_url` — commit 7dccd51
- ✅ Broadcast WhatsApp: envio em massa por segmento (todos ativos / inativos 30d / 60d), tabela `broadcast_campaigns`, modal com preview e variáveis {{nome}} — migration 047 aplicada — commit 708a327
- ✅ Fila de espera: tabela `waitlist_entries`, hook no cancelamento de agendamento notifica os 3 primeiros via WhatsApp com link de booking, WaitlistButton no perfil do paciente — migration 048 pendente — commit 5942863
- ✅ Correções críticas de produção (29/05/2026):
  - `renderToStaticMarkup` → `@react-email/render` (react-dom/server proibido em route handlers no Next.js 16)
  - `app/error.tsx` html/body removidos (nested html crashava hidratação)
  - ThemeProvider: try-catch em localStorage/matchMedia (Safari Private Browsing)
  - notification-bell: canal Supabase Realtime único por mount (evita crash React 18 ao remontar)
  - CSP: `worker-src 'self' blob:` adicionado para service workers
  - DashboardGreeting: `useState("")` em vez de `useState(getGreeting())` (mismatch UTC vs timezone local = React #418)
  - `suppressHydrationWarning` no `<body>` (extensões de browser modificam atributos)
- ✅ i18n PT-BR/EN — Fase 1 (Fundação) (01/06/2026):
  - `next-intl` 4.13 instalado; modo **sem locale na URL** (cookie + `users.preferred_locale`)
  - `i18n/locales.ts`, `i18n/get-locale.ts` (resolve cookie > Accept-Language > pt-BR), `i18n/request.ts` (loader de namespaces)
  - `next.config.ts`: `withSentryConfig(withNextIntl(nextConfig), …)` — plugin envolvido por dentro do Sentry
  - `app/layout.tsx` async: `lang={await getLocale()}` + `<NextIntlClientProvider>`
  - `middleware.ts`: `ensureLocaleCookie()` seta `AXIEL_LOCALE` por Accept-Language sem tocar auth/MFA
  - `LanguageSwitcher` + Server Action `setLocale` (`app/actions/locale-actions.ts`) grava cookie + banco
  - Migration **049_user_preferred_locale.sql** APLICADA (01/06/2026) — `users.preferred_locale` default pt-BR
  - Mensagens em `messages/{pt-BR,en}/{common,nav,dashboard}.json` (ICU para plurais)
  - **Piloto migrado**: Dashboard (`app/dashboard/page.tsx` + `greeting.tsx`) e navegação (`sidebar-nav.tsx`)
  - Validado: tsc limpo, paridade de chaves PT/EN, ICU compila. `next build` deve rodar localmente (SWC linux indisponível no sandbox)
  - **Pendente**: aplicar migration 049; Fases 2–6 (demais ~200 telas, áreas públicas, e-mails/PDF)
- ✅ i18n Fase 2 (01/06/2026): Dashboard 100% + telas de auth
  - Namespaces novos: `auth`, `onboarding`; expandidos `common` (appointmentStatus, push) e `dashboard` (kpis, chart, agenda)
  - Componentes migrados: dashboard-realtime-kpis, revenue-chart, today-agenda, setup-progress-banner, push-prompt (+ PushSettingsToggle), soft-onboarding-guide
  - Auth migrado: login (page+form, com mapeamento de erro), signup (page+form), mfa, reset-password, update-password
  - `LanguageSwitcher` adicionado nas páginas de login e signup (troca de idioma antes do login, via cookie)
  - Datas/horas usam `useLocale()` (pt-BR/en) via toLocale*; moeda permanece BRL
  - Migration 049 APLICADA em produção (bfuulpvzedcrpmmjxles)
  - Validado: tsc limpo, paridade PT/EN (5 namespaces), ICU compila, sem literais PT acentuados nos arquivos migrados
- ✅ i18n Fase 3a+3b (01/06/2026): módulo Pacientes
  - Namespaces novos: `patients` (lista + novo), `patientProfile` (página do perfil), `patientPanels` (todos os painéis)
  - 3a: app/patients/page.tsx, patients-client.tsx, patients/new/page.tsx (listas de país mantidas como dado)
  - 3b-1: app/patients/[id]/page.tsx (perfil completo)
  - 3b-2: 7 painéis + widgets — intelligence-strip, timeline, exams, prescriptions, package, treatment-plan, documents, health-agent, session-package-badge, waitlist-button, quick-voice-note
  - getTerm() (terminologia sessão/insight) deixado como está; conteúdo gerado por IA no health-agent não é traduzido (é dado)
  - Validado: tsc limpo, paridade PT/EN (8 namespaces), ICU compila
- ✅ i18n Fase 3d (01/06/2026): Tela de sessão — namespace `session`
  - app/schedule/[id]/session/page.tsx (contexto do paciente) + session-recording-panel.tsx (SOAP, vitais, observações, áudio, detalhes)
  - SOAP_FIELDS e VITALS_CONFIG agora puxam labels/placeholders das mensagens
  - Não migrados (fora de escopo, secundários): zoom-recordings-panel, zoom-session-banner, session-insight-generator
  - Validado: tsc limpo, paridade PT/EN (10 namespaces), ICU compila
- ✅ **Fase 3 COMPLETA** (Pacientes + Agenda + Sessões) — fluxo clínico principal 100% bilíngue
  - Namespaces i18n totais: common, nav, dashboard, auth, onboarding, patients, patientProfile, patientPanels, schedule, session
  - **Follow-ups conhecidos**: date-utils.ts (pt-BR fixo); mensagens de throw/WhatsApp em PT; escopar mensagens por rota no client; memoizar tooltip do revenue-chart
- ✅ i18n Fase 4a (01/06/2026): módulo Formulários — namespace `forms`
  - 4a-1: app/forms/page.tsx, new, [id], [id]/edit + botões delete/share/import
  - 4a-2: assessment-form-builder, assessment-form-editor (compartilham forms.builder), assessment-fill-form (forms.fill)
  - Conteúdo dos templates (nomes/perguntas/tags do catálogo) deixado como dado
  - Validado: tsc do código limpo, paridade PT/EN (11 namespaces), ICU compila
- ✅ i18n Fase 5e (01/06/2026): Jurídico — **namespace `legal`** (Privacidade + Termos)
  - `app/privacidade/page.tsx` e `app/termos/page.tsx` reescritos com `getTranslations`; listas longas via `t.raw` (arrays de strings e de objetos); links via `t.rich`
  - Textos legais reescritos com acentuação correta no JSON (a fonte original era sem acentos)
  - Script de verificação atualizado para também validar ICU dentro de arrays
  - Validado: tsc do código limpo, paridade PT/EN (26 namespaces), ICU compila
  - **FASE 5 COMPLETA.** App inteiro (autenticado + público) bilíngue PT/EN
- ✅ i18n Fase 6b (01/06/2026): Componentes React Email + pontos de render
  - 6 componentes em `components/email/*.tsx` recebem `t: EmailT` + `locale`; `EmailT` (em base-email.tsx) retipado: call `(key, values)`, `rich` e `markup` com callbacks tipados (`chunks: ReactNode`/`string`) — elimina implicit-any
  - `lib/email-i18n.ts`: `getServerT()` agora retorna `Promise<ServerT>` (= `EmailT`) via cast — antes devolvia o `Translator` cru do next-intl (chaves viravam `never`, quebrando todos os `t("...")`)
  - Pontos de render migrados (passam `t`+`locale`, datas/moeda via locale, subjects via `t`): patient-welcome-service, monthly-report-service, automation-service (lembrete + confirmação; WhatsApp segue PT), communication-service, app/api/results/send-report
  - Chaves novas em emails.json (PT+EN): `apptConfirm.subject`, `apptReminder.subject/fallbackDate/fallbackTime`, `monthly.subject`, `simple.defaultSubject`
  - ⚠️ **DESCOBERTA IMPORTANTE**: `npx tsc --noEmit` estava **mascarando erros** — o arquivo gerado `.next/dev/types/validator.ts` tem erros de parse (TS1109) que faziam o tsc reportar só esses e NÃO checar o código-fonte (confirmado: erro proposital não era pego). As fases anteriores foram "validadas" com esse tsc quebrado.
  - **Verificação confiável criada**: `tsconfig.check.json` (exclui `.next`, incremental off). Comando: `npx tsc -p tsconfig.check.json --noEmit`
  - Ao rodar o tsc confiável, apareceram **7 erros latentes** de fases anteriores, todos corrigidos:
    - `app/forms/page.tsx` e `app/forms/import-templates-button.tsx`: `.map((t) =>)` sombreava o tradutor `t` → `t("edit")`/`t("fill")`/`t("import")` chamavam o objeto template (bug de **runtime**). Param renomeado p/ `tpl`.
    - `app/financeiro/page.tsx`: `methodLabel(p.payment_method)` com `string|null` → `?? ""`
    - `app/settings/integrations/page.tsx`: `appUrl: process.env.NEXT_PUBLIC_APP_URL` (`string|undefined`) em `t.rich` → `?? ""`
  - Validado com tsc confiável: **0 erros de código**; paridade PT/EN + ICU OK em **28 namespaces**
  - **Pendente Fase 6**: 6c — PDFs e exportações (`lib/pdf-report.ts` + 5 rotas em `app/api/{finance/report,reports/*}`)
- ✅ i18n Fase 6c (01/06/2026): PDFs e exportações — **namespace `pdf` expandido**
  - `lib/pdf-report.ts`: `buildTablePdf` ganhou `locale?`; rótulo "PERÍODO" e rodapé "gerado pelo AXIEL Core" via `getServerT(locale,"pdf")`
  - 5 rotas migradas (trilha PDF): `app/api/finance/report/pdf` + `app/api/reports/{pagamentos,pacientes,leads,sessoes}` — título, colunas, período, datas e enums (status de paciente/sessão, etapa/origem de lead) via `t`; `locale` passado ao `buildTablePdf`
  - pdf.json: `allPeriods`, `range`, `col.*`, `finance.*` (título + summary com plural + labels de período), `payments/patients/leads/sessions.title`, `patientStatus`, `sessionStatus`, `leadStage`, `leadSource`
  - **Fora de escopo (PT, follow-up)**: trilhas **CSV e XLSX** das mesmas rotas (decisão era "e-mails + PDFs"); `paymentMethodLabel` (de finance-service) ainda PT no PDF de pagamentos
  - Validado com tsc confiável (`tsconfig.check.json`): **0 erros de código**; paridade PT/EN + ICU OK em **28 namespaces**
  - **FASE 6 COMPLETA. Internacionalização PT-BR/EN do AXIEL Core concluída** (app autenticado + público + e-mails + PDFs)
- 🧹 i18n — limpeza de resíduos (01/06/2026, em andamento):
  - ✅ **ROLE_LABELS** centralizado em `common.roles` (PT+EN, 9 papéis). Migrados: equipe-client (RoleTag + selects + convites), dashboard (via `tc("roles.*")`), join/[token]. `ROLE_LABELS` em `lib/team-utils` permanece **só** para o e-mail de convite (team-service) — escopo de e-mail, follow-up.
  - ✅ **plan-config descrições** → `pricing.planDesc.{starter,professional,scale,enterprise}` (nomes dos planos mantidos, são próprios). Migrado em `pricing-client.tsx`. Landing já usava `t()` próprio.
  - ✅ **teleconsulta-video.tsx + teleconsulta-notes.tsx** migrados (namespaces `teleconsulta.video` / `teleconsulta.notes`)
  - ✅ **Datas Hotmart**: settings/integrations/hotmart/page.tsx (getLocale) e app/hotmart/hotmart-client.tsx (useLocale)
  - ✅ **date-utils.ts** locale-aware: 4 helpers (formatTime/formatShortDate/formatDayLabel/formatMonthYear) ganharam `locale?` (default pt-BR, sem regressão); callers passam locale — schedule/page, session-recording-panel, session-drawer, session-card, telehealth-room, clinic-chat (formatTime local também), schedule-container (5 sub-componentes com useLocale)
  - ✅ **Exportações CSV/XLSX** das 4 rotas de relatório migradas (locale/t no topo; cabeçalhos via `col.*`, enums via maps `patientStatus`/`sessionStatus`/`leadStage`/`leadSource`, datas via locale)
  - ✅ **Telas de profissionais** migradas — **novo namespace `professionals`** (`list` + `report`): profissionais-client.tsx e profissional-report-client.tsx (KPIs, períodos, status, tendência, tipos, NPS com plural ICU); param `.map((t)=>)` renomeado p/ `st`
  - Validado: tsc confiável **0 erros**; paridade PT/EN + ICU OK em **29 namespaces**
- 🧹 i18n — follow-ups maiores fechados (01/06/2026):
  - ✅ **telehealth-room.tsx** migrado — novo `teleconsulta.room` (estados de gravação/transcrição/resumo IA, botões, erros)
  - ✅ **app/hotmart/hotmart-client.tsx** migrado — **novo namespace `hotmart`** (abas de status, filtros, colunas, paginação com interpolação, estado vazio com `t.rich`)
  - ✅ **clinic-chat.tsx** migrado — **novo namespace `clinicChat`** (formatDateGroup Hoje/Ontem via labels, placeholder, erros, footer; `onInput` param renomeado p/ `el`)
  - ✅ **E-mail de convite de equipe** (team-service) — `emails.invite.*` via `getServerT`; papel via `getServerT(locale, "common")` → `SERVER_NS` agora inclui `common`
  - ✅ **paymentMethodLabel** nos relatórios → `pdf.paymentMethod.*` (rota pagamentos usa map locale-aware; removido import do helper PT)
  - Validado: tsc confiável **0 erros**; paridade PT/EN + ICU OK em **31 namespaces**
  - **Ainda fora de escopo (refactors à parte, não "resíduo i18n")**: `modules/follow-ups` (MESSAGE_AUTOMATION_STATUS / FOLLOW_UP_AI_LABEL)
- 🧹 i18n — Action Center migrado (01/06/2026): **novo namespace `actions`**
  - `app/actions/page.tsx` (eyebrow, título, seções, view-more com plural, empty states) via `getTranslations`
  - `components/action-suggestion-card.tsx` agora **async server component** com `getTranslations`: prioridade, status, "Por quê:", botões Aceitar/Concluir/Ignorar/Concluída (o `title`/`description`/`reason` continuam vindo do gerador persistido — ver abaixo)
  - `components/action-suggestions-panel.tsx` (usado em leads/[id]) agora async: eyebrow, título, subtítulo, empty state, "Ver todos" — **removido `getTerm` daqui** (substituído por `actions.panel.*`)
  - Validado: tsc confiável **0 erros**; paridade PT/EN + ICU OK em **32 namespaces**
  - ✅ **Conteúdo gerado das sugestões reestruturado (content_key + params)** (01/06/2026):
    - **Migration `050_action_suggestion_content.sql`** — adiciona `content_key text` + `content_params jsonb` em `action_suggestions`. ⚠️ **DEPENDÊNCIA DE DEPLOY**: o código agora envia essas colunas no `upsert` do `syncActionSuggestions`; **a migration 050 precisa estar aplicada em produção antes/junto deste deploy**, senão `/actions` e `/leads/[id]` quebram (coluna inexistente).
    - `action-rules.ts`: cada draft emite `content_key` (aiReviewNeedsChanges/Ready, followUpDue/Soon, newLead, leadReadyScheduled/Contacted, patientNoReturn30, patientNoSession) + `content_params`; title/description/reason em EN mantidos como **fallback** para linhas antigas (pré-050).
    - `action-suggestion-card.tsx` renderiza `t(\`suggestions.${content_key}.{title,description,reason}\`, params)` com fallback ao texto persistido quando `content_key` é null.
    - Templates em `actions.suggestions.*` (PT/EN); `followUp*` usa `{text}` (título do follow-up = dado do usuário, passthrough).
    - **Permanece como decisão de produto (não tradução simples)**:
- 🧹 i18n — correções da auditoria (02/06/2026): **gaps achados na auditoria, todos corrigidos**
  - **3 rotas de PDF/CSV/XLSX** que estavam 100% PT e EM USO: `app/api/reports/financeiro` (KPIs, por método, tabela), `app/api/reports/repasse`, `app/api/reports/paciente/[id]` (prontuário completo) — todas via `getServerT(locale,"pdf")`; **namespace `pdf` muito expandido** (`financeReport`, `repasse`, `record`, `paymentMethod`, mais `col.*`). Helpers `ptDate/ptDateTime` agora recebem locale.
  - **Telas admin**: `app/admin/audit` + `components/audit-log-table.tsx` + `app/admin/plans` → **novo namespace `admin`** (datas via locale; `.map((t)` renomeado p/ `tab2`).
  - `app/patients/[id]/forms/new` → `forms.fillPicker.*`.
  - **CSV export de pacientes** (`app/api/patients/export`) → headers/datas via locale (`pdf.col.*`).
  - **billing-plan-card.tsx** (usado em /billing e /onboarding/plan) → **`pricing.billingCard.*`** (features, limites, CTAs); virou async server component.
  - **getTerm na UI de tráfego** (`app/patients/[id]/page.tsx`) → `common.terms` (session/insights). Helper `getTerm` permanece para a camada de IA.
  - **Processo**: `scripts/verify-i18n.mjs` commitado; `package.json` → `typecheck` agora usa `tsconfig.check.json` (confiável), novo `verify:i18n`.
  - Validado: tsc confiável **0 erros**; paridade PT/EN + ICU OK em **33 namespaces**; rescan sem `pt-BR` hardcoded em UI.
- ✅ **Integração AXIEL Growth → Core (lado Core)** (02/06/2026): recebe lead quente do Growth
  - **Migration `052_growth_integration.sql` PENDENTE** — tabela `clinic_integration_keys` (chave hasheada SHA-256 por clínica, RLS via `can_manage_clinic`) + colunas `score`/`growth_lead_id`/`warming_context` em `leads` + valor de enum `lead_source = 'axiel_growth'`. ⚠️ aplicar antes do deploy do código.
  - `services/growth-integration-service.ts`: gerar/listar/revogar Integration Key; `resolveClinicByKey` (admin, sem fallback); `upsertGrowthLead` idempotente (por `growth_lead_id`, depois dedup por phone/email com `.eq()` — sem injeção em `.or()`)
  - **Endpoint** `app/api/integrations/growth/lead/route.ts`: Bearer key → rate limit (`checkRateLimitDb`, 120/min) → resolve clínica → upsert; Idempotency-Key header; retorna `{clinic_id, lead_id, created}`
  - UI: `components/growth-integration-card.tsx` em `Settings → Integrações` (gera/exibe-uma-vez/revoga chave + URL do endpoint); server actions `generateGrowthKeyAction`/`revokeGrowthKeyAction`; i18n `settings.integrations.growth*` PT/EN
  - Mapeamento de stage Growth→Core: `scheduled`→scheduled, `patient`→converted_to_patient, demais→new_lead
  - Spec completa em `AXIEL_GROWTH_INTEGRATION_SPEC.md` (v0.2). Pendente lado Growth: chamada de saída + retorno `patient_id`. Confirmado: AXIEL Health (schema Growth) = AXIEL Core
  - Validado: tsc confiável **0 erros**; verify:i18n paridade PT/EN OK (34 namespaces)
- ✅ **Fix: migration 050 nunca aplicada em produção** (03/06/2026): `action_suggestions.content_key`/`content_params` não existiam no banco → `syncActionSuggestions` (chamado em `/leads/[id]` e `/actions`) lançava erro de coluna inexistente, quebrando **todas** as páginas de lead e o Action Center (não só os leads do Growth). Aplicada a `050_action_suggestion_content.sql` + `notify pgrst, 'reload schema'`. Lição: confirmar que TODA migration listada no repo está de fato aplicada em produção.
- ✅ **Fix: salvar config do WhatsApp Bot quebrava (PGRST200)** (02/06/2026): `whatsapp_bot_configs.clinic_id` é **text** e `clinics.id` é **uuid** → não há FK entre eles, então o join embutido `clinics(slug)` do PostgREST falhava (`Could not find a relationship ... in schema cache`) e derrubava o `Save configuration`. Tentar converter a coluna esbarra na política RLS `clinic_own_whatsapp_config` (`clinic_id = (select users.clinic_id::text ...)`). **Solução pelo código** (sem mexer em coluna/política em produção): `services/whatsapp-bot-service.ts` agora busca o slug via `fetchClinicSlug()` em consulta separada nas 5 funções (get/getByNumber/getByMetaPhoneId/getByInstagramId/upsert) em vez do join `clinics(slug)`. Com isso o save passou a funcionar e o **Instagram Account ID `17841460053907081` (jifwcenter)** foi gravado. ⚠️ dívida técnica futura: padronizar `whatsapp_bot_configs.clinic_id` para uuid (exige dropar+recriar a policy).
- ✅ **Recebimento de pacientes — Fase 3: conciliação manual (Zelle/transferência/dinheiro)** (04/06/2026):
  - **Migration `054_patient_payments_pending_proof.sql` PENDENTE** — adiciona `'pending'` ao CHECK de `status` + colunas `proof_path` e `confirmed_at`. ⚠️ aplicar antes do deploy.
  - `PatientPaymentStatus` ganhou `'pending'`; `PatientPayment` ganhou `proof_path`/`confirmed_at`.
  - `register-payment-modal`: escolha **Recebido × Pendente** + upload de **comprovante** (imagem/PDF, ≤10MB → bucket `patient-docs` em `payment-proofs/`). `registerPaymentAction` agora trata status + upload.
  - Novas actions: `confirmPaymentAction` (pendente→paid + `confirmed_at`) e `getPaymentProofUrlAction` (URL assinada do comprovante, escopada à clínica).
  - `services/finance-service`: `getPendingPayments()`; **`getFinanceKPIs` agora conta só `status='paid'`** (pendentes não inflam a receita — antes contava tudo).
  - UI: seção **"Pagamentos pendentes"** no `/financeiro` (`pending-payments.tsx`, client) com Confirmar + Ver comprovante; pendentes saem da lista de "recentes".
  - **Recebimento de pacientes (Fases 1–3) COMPLETO**: Stripe (Pix/Boleto/Cartão) para sessão/pacote/mensalidade + cobrança pela clínica + conciliação manual.
  - Validado: tsc confiável **0 erros**; verify:i18n paridade PT/EN OK (34 namespaces)
- ✅ **Recebimento de pacientes — Fase 2: cobrança de pacote/mensalidade pela clínica** (04/06/2026):
  - Nova rota staff `app/api/finance/charge-offer/route.ts`: `getCurrentClinic` + oferta/paciente escopados à clínica. `offer_type='session_package'` → checkout único (cartão/Pix/Boleto, metadata `patient_purchase`); `offer_type='membership'` → assinatura (mode subscription, **só cartão**, metadata `patient_subscription`, guarda assinatura ativa existente). **Reaproveita os handlers do webhook** — nenhuma mudança no webhook.
  - `components/patient-charge-panel.tsx`: painel no perfil do paciente (após o de pacotes) — seleciona oferta ativa, gera link, copia/abre; mostra hint de método (único vs recorrente). Ofertas ativas buscadas via `getMonetizationOffers(clinic.id)` no `app/patients/[id]/page.tsx` (adicionado ao Promise.all).
  - i18n `finance.chargeOffer` (PT/EN). `success_url`/`cancel_url` → `/pagamento/sucesso`.
  - Obs: `monetization_offers.currency` default é **USD** — Pix/Boleto só aparecem se a oferta estiver em BRL (comportamento correto do helper por moeda).
  - Validado: tsc confiável **0 erros**; verify:i18n paridade PT/EN OK (34 namespaces)
  - Pendente: Fase 3 (conciliação manual de Zelle/transferência — status pendente/confirmado + comprovante no `register-payment-modal`).
- ✅ **Recebimento de pacientes — Fase 1: Pix + Boleto + Cartão (Stripe)** (04/06/2026):
  - **Descoberta**: já existia checkout de paciente pelo portal (`session-checkout`, `patient-checkout`, `patient-subscription`) + webhook gravando `patient_payments`. Faltava Pix/Boleto, tratamento assíncrono e cobrança pelo lado da clínica.
  - `lib/stripe.ts`: helper `paymentMethodTypesForCurrency()` → BRL = `['card','pix','boleto']`, demais = `['card']`. Aplicado em `session-checkout` e `patient-checkout`.
  - **Webhook corrigido (crítico)**: Pix/Boleto são **assíncronos**. `checkout.session.completed` agora só registra pagamento se `payment_status === 'paid'` (cartão); para pix/boleto espera **`checkout.session.async_payment_succeeded`** (novo handler) + `async_payment_failed` (log). Lógica de registro extraída para `handleCheckoutSessionPaid()` — **idempotente** por `stripe_payment_intent_id`. Método real (`pix`/`boleto`/`credit_card`) resolvido via `resolveStripePaymentMethod()` (lê o PaymentIntent/charge) em vez de hardcode `credit_card`.
  - `PaymentMethod` enum (`lib/types`) ganhou **`boleto`**; rótulos em `lib/finance-utils`, `finance.methods` e `pdf.paymentMethod` (PT+EN).
  - **Botão "Cobrar"** nas sessões não pagas (`/financeiro`): nova rota staff-autenticada `app/api/finance/charge-session/route.ts` (valida clínica, guarda "já pago", moeda da clínica) gera link de checkout; `charge-session-button.tsx` (client) gera/copia/abre o link. Página pública `app/pagamento/sucesso` (rota liberada no `middleware.ts`).
  - **Recorrência**: Stripe não faz Pix recorrente → mensalidade segue **só cartão** (inalterada).
  - **Migration `053_patient_payments_stripe_boleto.sql` APLICADA em produção (04/06/2026)**: descoberto que `patient_payments` em prod **não tinha** `stripe_payment_intent_id`/`refunded_at`/`refund_amount_cents` (a 005 usava `alter table if exists` antes do `create`, e a tabela já existia sem essas colunas — nunca houve pagamento Stripe real, então o erro só apareceu agora) **e** o CHECK de `payment_method` **não incluía `boleto`**. A 053 adiciona as colunas (idempotente), recria o CHECK com `boleto`, garante o CHECK de `status` e cria **índice ÚNICO parcial** em `stripe_payment_intent_id` (idempotência do webhook contra reentrega de evento). Verificação cruzada código×banco (information_schema) rodada nas 3 tabelas de pagamento (patient_payments/packages/subscriptions): **0 colunas faltando**.
  - `.gitignore`: `.env.backup` + `*.backup` adicionados (estavam untracked, risco de commit de credenciais).
  - ⚠️ **Dependências de produção restantes (fora do código)**: (1) **ativar Pix e Boleto no painel do Stripe** (conta BR — Pix p/ empresa BR pode ser invite-only), senão o checkout falha; (2) **registrar os eventos `checkout.session.async_payment_succeeded` e `async_payment_failed`** no endpoint do webhook no dashboard do Stripe.
  - Pendente (próximas fases): cobrança de pacote/mensalidade pela clínica; conciliação manual de Zelle/transferência (status pendente/confirmado + comprovante no `register-payment-modal`).
  - Validado: tsc confiável **0 erros**; verify:i18n paridade PT/EN OK (34 namespaces)
- ✅ **Instagram: opt-out / escalonamento humano** (03/06/2026): requisito do Meta App Review. `app/api/meta/instagram/route.ts` detecta intenção de "falar com atendente/humano" (PT/EN, phrase-based, evitando "parar/stop" para não dar falso-positivo em contexto clínico) → responde uma vez avisando que a equipe assume, seta `bot_disabled=true` na conversa e para de auto-responder. Plano de produção em `INSTAGRAM_PRODUCAO_PLANO.md`.
- ✅ **Instagram bot multi-clínica (SEC-01)** (02/06/2026): rota do Instagram deixou de usar `IFWC_DEFAULT_CONFIG` hardcoded
  - **Migration `051_whatsapp_meta_instagram_id.sql` APLICADA em produção (02/06/2026)** — coluna `meta_instagram_id text unique` + índice em `whatsapp_bot_configs`; RPC `upsert_whatsapp_bot_config` recriada com `p_meta_instagram_id` (12 args; assinatura antiga de 11 args dropada). ⚠️ **PENDENTE: deploy dos `.ts` na Vercel** (banco já tem a coluna; código que a usa ainda precisa subir).
  - `services/whatsapp-bot-service.ts`: campo `meta_instagram_id` no tipo + `getWhatsAppBotConfigByInstagramId()` (admin client, sem fallback) + param no upsert/select
  - `app/api/meta/instagram/route.ts`: resolve clínica por `entry.id` (IG account id); se nenhuma clínica casar → pula o entry silenciosamente (paridade SEC-01 com o WhatsApp); prompt por clínica; persiste `clinic_id` na conversa (`whatsapp_conversations.clinic_id` é NOT NULL — antes o INSERT do IG ia sem clinic_id e era um bug latente)
  - UI: campo "Instagram Account ID" no `whatsapp-bot-form.tsx` + `actions.ts` salvando `meta_instagram_id`; i18n `settings.whatsapp.metaInstagramId(+Hint)` PT/EN
  - Validado: tsc confiável **0 erros**; verify:i18n paridade PT/EN OK (34 namespaces)
- 🧹 i18n — componentes de insight de IA migrados (02/06/2026): **novo namespace `insights`**
  - `components/clinical-insight.tsx` (ClinicalInsightView) e `components/guided-ai-insights-panel.tsx` → **async server components** com `getTranslations("insights")` (label, Notas-chave, O que pode estar conectado, Próximos passos, painel: Padrões/placeholder/etc.)
  - `app/patients/[id]/reports/clinical-insight/page.tsx` (chrome: voltar, eyebrow, título, disclaimer, baixar PDF)
  - `app/patients/[id]/reports/clinical-insight/pdf/route.ts` (route handler usa `getTranslations` + `getLocale` — o PDF monta com pdfkit, **não** renderiza React, então sem risco): seções, disclaimer, "Criado em", rodapé
  - Descoberta: o PDF do insight **não** usa o componente React (pdfkit direto), então a migração async foi segura
  - **Resultado**: `getTerm` agora existe SOMENTE na camada de IA (`modules/ai-insights/governance.ts`, `guardrails.ts`) + `modules/ui/terminology.ts` — **zero uso de `getTerm` na UI**. Toda a interface, e-mails, PDFs e exportações estão localizados.
  - Validado: tsc confiável 0 erros; paridade PT/EN + ICU OK em **34 namespaces**
  - **Único restante EN por design**: glossário `getTerm` nos prompts de IA (intencional) + datas internas em contexto de IA / nota de webhook / título de broadcast (`session/actions.ts`, `health-agent`, `stripe/webhook`, `automacoes/broadcast`) — dados/prompt, não UI.
    - **Glossário `getTerm`** (`modules/ui/terminology.ts`): termos fixos EN (Session/Insight/Next Step) com regra de compliance `PROHIBITED_UI_TERMS`; ainda usado em `app/patients/[id]/page.tsx`, `clinical-insight.tsx`, `guided-ai-insights-panel.tsx` **e nos prompts de IA** (`modules/ai-insights/governance.ts`, `guardrails.ts`). Traduzir afeta a camada de IA — manter EN é intencional.
- ✅ i18n Fase 5d (01/06/2026): Formulários públicos, Join, Teleconsulta, Links — **namespaces `publicForm`, `join`, `links`, `teleconsulta` + `portal.tokenExpired`**
  - `app/f/[token]` + `components/public-assessment-form.tsx` (progress plural, yes/no, total, done); `DEFAULT_SCALE_LABELS` mantidos (default de conteúdo)
  - `app/p/[token]` (página de link expirado → portal.tokenExpired)
  - `app/join/[token]` (rich `<b>` em invitedAs; ROLE_LABELS ainda PT — follow-up)
  - `app/links` (page + `links-hub.tsx`)
  - `app/teleconsulta/[appointmentId]` (datas via locale; `components/teleconsulta-video/notes` **não migrados — follow-up**)
  - Validado: tsc do código limpo, paridade PT/EN (25 namespaces), ICU compila
  - **Pendente Fase 5**: 5e jurídico (privacidade + termos)
- ✅ i18n Fase 5c (01/06/2026): Landing + Pricing — **namespaces `landing` e `pricing`**
  - `app/page.tsx` reescrito com `getTranslations` (hero, stats, features, integrações, steps, automações, depoimentos, planos, FAQ, CTA, footer + DashboardMockup) — nomes próprios/valores mantidos como amostra
  - `app/pricing/pricing-client.tsx` (cards, comparativo, add-ons, FAQ, CTA, footer) — `plan.name`/`description` vêm de `modules/billing/plan-config` (**ainda PT — follow-up**, como ROLE_LABELS); CURRENCY_LABELS mantidos
  - Validado: tsc do código limpo, paridade PT/EN (21 namespaces), ICU compila
- ✅ i18n Fase 5b (01/06/2026): Agendamento online — **namespace `booking`**
  - `app/book/[slug]/page.tsx` (fluxo público: profissional → serviço → data → horário → dados → confirmação)
  - STEP_LABELS → STEP_LABEL_KEYS resolvido via t; datas via useLocale; plurais/interpolação (minutes, continueWith, doneWith)
  - Validado: tsc do código limpo, paridade PT/EN (19 namespaces), ICU compila
- ✅ i18n Fase 5a (01/06/2026): Portal do paciente — **namespace `portal`**
  - Entrada: `app/portal/page.tsx`, `portal-access-form.tsx`, `verificar/page.tsx`
  - Subcomponentes `components/patient-portal/*`: `patient-portal-dashboard.tsx` (1145 linhas — banners, próxima sessão, pacote/plano, insights, exames, protocolo, histórico sessões/pagamentos, agendamentos, intake, documentos, meus dados, LGPD), `portal-booking-modal.tsx`, `portal-chat.tsx`, `nps-widget.tsx`, `packages-section.tsx`, `patient-push-prompt.tsx`
  - Datas via `useLocale`; plurais ICU (sessions, sessionsRemaining, sessionsLeftCycle, newMessages); rich text `<a>`/`<b>` (lgpdNote, lgpdFooter, verificar.desc)
  - Detalhes: `formatDate/formatDateTime` recebem locale + conector "at"; estados de erro de upload/contato via boolean (não string-match); colisões de `t` evitadas (onInput → `el`)
  - Validado: tsc do código limpo, paridade PT/EN (18 namespaces), ICU compila
  - **Pendente Fase 5**: 5b book/[slug], 5c landing+pricing, 5d formulários públicos/join/teleconsulta/links, 5e jurídico
- ✅ i18n Fase 4e (01/06/2026): módulo Automações — **namespace `automations`**
  - `automacoes/page.tsx` (hub + histórico de envios, datas via locale) + `components/automacoes-client.tsx` (KPIs, abas Regras/Histórico, RuleCard, CreateRuleForm — atenção: param do `.map((t)=>)` renomeado p/ `tabKey`) + `components/broadcast-whatsapp-modal.tsx` (segmentos, compose, preview, done)
  - `follow-ups/page.tsx` + `components/follow-up-form.tsx` e `components/follow-up-list.tsx` — **convertidos para async server components** com `getTranslations`
  - Placeholders com `{{nome}}` escapados com aspas simples no JSON (ICU trata `{` como argumento) — ex: `'{{nome}}'`
  - **Fora de escopo (follow-up):** `app/actions/` (Action Center) e `components/action-suggestions-panel.tsx` já são EN e usam o sistema `getTerm` (modules/ui/terminology) — refactor à parte; `MESSAGE_AUTOMATION_STATUS`/`FOLLOW_UP_AI_LABEL` (modules/follow-ups) ainda PT
  - Validado: tsc do código limpo, paridade PT/EN (17 namespaces), ICU compila
  - **Fase 4 COMPLETA.** Pendente: Fases 5–6 (áreas públicas: landing/agendamento/portal; e-mails/PDF) + componentes secundários soltos
- ✅ i18n Fase 4d (01/06/2026): módulo Configurações — **namespace `settings`**
  - 4d-1: hub (`settings/page.tsx`, 19 cards via chaves + audit log), profile (page+form), regional (chrome; listas TZ/moeda são dados), usage, lgpd, security (RLS), `components/mfa-settings.tsx` (2FA)
  - 4d-2: equipe (page+client, modal de convite; ROLE_LABELS de lib/team-utils **ainda em PT — follow-up**), practitioners (page+list), session-types (page + `components/session-type-list.tsx`), offers (page + `components/offer-list.tsx`)
  - 4d-3: integrations hub (`integrations/page.tsx` — Google/Zoom/iCal/NFSe/Hotmart/Reviews + setup com `t.rich` `<b>`/`<a>`/`<code>` e `{appUrl}`), hotmart (page+form), nfse (page+form), branding (page+form); componentes-filhos `components/{zoom-credentials-form,google-review-url-form,ical-copy-button}.tsx`
  - 4d-4: lembretes (`lembretes/page.tsx` — pipeline, log de comunicações com datas via locale, push), whatsapp (page + `whatsapp-bot-form.tsx` — checklist, identidade, preços por localidade), voice (`voice/page.tsx` — passos, idiomas, ativação com `t.rich` + links)
  - Rich text via `t.rich` com tags `<b>`/`<a>`/`<code>` (explainer session-types, infoTip offers, setup integrations, passos hotmart, hiw nfse, steps whatsapp, ativação voice)
  - Plurais ICU: membersCount, sessionTypes.count, offers.count, offers.sessionsLabel
  - Validado: tsc do código limpo, paridade PT/EN (16 namespaces), ICU compila
  - **Fase 4d COMPLETA** (Configurações). **Pendente**: 4e Automações (se houver telas específicas), Fases 5–6
  - Follow-ups menores: ROLE_LABELS (lib/team-utils) ainda PT; datas pt-BR fixas em hotmart purchases; `components/push-prompt.tsx` (toggle de push) não migrado
  - **Pendente geral**: Fases 5–6 (áreas públicas; e-mails/PDF) + componentes secundários soltos
- ✅ i18n Fase 4c (01/06/2026): Results, Relatórios e Analytics
  - Results (`/results`) e Relatórios (`/relatorios`) migrados — namespaces `results` e `reports`
  - Analytics (`app/analytics/page.tsx`) migrado — **novo namespace `analytics`** (registrado em i18n/request.ts); NPS, ocupação, alertas; plurais ICU (avaliações, sessões sem NPS, pacotes ≤2, restantes, pacientes inativos); `npsLabelKey` mapeia score→chave; `daysSinceLabel(days,t)` e datas via locale
  - `components/finance-report-client.tsx` migrado — strings adicionadas em `finance.report.*` (períodos, KPIs, tabela, CSV header, plurais); `useTranslations`/`useLocale`; datas via locale; param do `.map((t)=>)` renomeado para `st` (evita colisão com `t`)
  - Validado: tsc do código limpo, paridade PT/EN (15 namespaces), ICU compila
  - **Pendente Fase 4**: 4d Configurações (~25 telas), 4e Automações
  - **Pendente geral**: Fases 5–6 (áreas públicas; e-mails/PDF) + componentes secundários soltos
- ✅ i18n Fase 4b (01/06/2026): módulo Financeiro — namespace `finance`
  - 4b-1: financeiro/page.tsx, financeiro-dashboard-client, register-payment-modal, finance-ai-panel (formas de pagamento via finance.methods)
  - 4b-2: repasse (page+client), nfse (page+client), relatorio/page (chrome)
  - Datas via locale; finance-report-client migrado na Fase 4c
  - Validado: tsc do código limpo, paridade PT/EN (12 namespaces), ICU compila
- ✅ i18n Fase 3c (01/06/2026): módulo Agenda — namespace `schedule`
  - 3c-1: app/schedule/page.tsx, schedule/new/page.tsx, appointment-form.tsx
  - 3c-2: schedule-container.tsx (toolbar, navegação, views Dia/Semana/Mês, dias da semana via chaves), session-card, session-drawer (badge reusa common.appointmentStatus), create-session-modal
  - Datas no calendário usam locale via toLocaleDateString; **follow-up conhecido**: modules/schedule/date-utils.ts (formatTime/formatShortDate/formatMonthYear/formatDayLabel) ainda hardcodam "pt-BR" — são helpers compartilhados, migrar com cuidado
  - Mensagens de throw new Error (server actions) e confirmação WhatsApp deixadas em PT (não são UI; WhatsApp é voltado ao paciente)
  - Validado: tsc limpo, paridade PT/EN (9 namespaces), ICU compila

---

## Arquivos mais importantes

| Arquivo | O que faz |
|---------|-----------|
| `services/clinic-service.ts` | `getCurrentClinic()` — cached com React.cache, join users+clinics |
| `services/user-service.ts` | `getCurrentUserProfile()` — cached com React.cache |
| `services/billing-service.ts` | `getBillingContext()` — cached por clinicId |
| `modules/billing/feature-access.ts` | `canUseFeature(ctx, "feature_key")` |
| `modules/billing/plan-config.ts` | Definição dos planos e features |
| `lib/webhook-guard.ts` | `checkRateLimitDb(key, max, windowMs)` |
| `services/automation-service.ts` | Cron de follow-ups — usa admin client |
| `app/api/health-agent/route.ts` | Análise clínica com GPT-4o |
| `components/session-recording-panel.tsx` | Gravação de sessão + useActionState |
| `app/schedule/[id]/session/actions.ts` | `saveSessionRecord` — Server Action |
| `supabase/migrations/` | última aplicada = **051_whatsapp_meta_instagram_id.sql** (02/06/2026); deploy dos `.ts` do bot Instagram multi-clínica pendente na Vercel |
| `i18n/` | locales.ts, get-locale.ts, request.ts — config do next-intl (sem locale na URL) |
| `messages/{pt-BR,en}/` | JSONs de tradução por namespace (common, nav, dashboard…) |
| `components/language-switcher.tsx` | Toggle PT/EN — chama Server Action setLocale |
| `services/waitlist-service.ts` | Fila de espera — addToWaitlist, notifyWaitlistOnCancellation |
| `services/broadcast-service.ts` | Broadcast WhatsApp — segmentos, envio em lote, histórico |
| `components/notification-bell.tsx` | Canal Realtime único por mount (notification-bell-{timestamp}) |
| `app/dashboard/greeting.tsx` | useState("") evita mismatch de timezone servidor/cliente |
| `app/api/meta/whatsapp/route.ts` | Bot WhatsApp bilíngue PT/EN — 8 passos + auto-detecção |
| `app/api/book/[slug]/route.ts` | Booking público — confirmação via Meta API (template) |
| `lib/whatsapp-bot-defaults.ts` | Config IFWC + buildSystemPrompt() |

---

## Padrões obrigatórios

### Feature gates
```typescript
const billingCtx = await getBillingContext(clinicId); // já cached
if (!canUseFeature(billingCtx, "feature_key")) return 403;
```

### Rate limiting
```typescript
if (!(await checkRateLimitDb(`chave:${id}`, maxReqs, windowMs))) {
  return NextResponse.json({ error: "..." }, { status: 429 });
}
```

### Admin client (cron/webhooks sem sessão)
```typescript
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
const supabase = createSupabaseAdminClient(); // sem await, sem cookies
```

### Server Actions com erro visível
```typescript
export type MyState = { error?: string } | null;
export async function myAction(_prev: MyState, fd: FormData): Promise<MyState> {
  try { ... } catch { return { error: "Mensagem" }; }
  redirect("/destino");
}
// No componente:
const [state, action] = useActionState<MyState, FormData>(myAction, null);
```

### i18n (next-intl, sem locale na URL)
```typescript
// Server Component
import { getTranslations } from "next-intl/server";
const t = await getTranslations("dashboard");
return <h1>{t("greeting.withName", { greeting, name })}</h1>;

// Client Component
"use client";
import { useTranslations } from "next-intl";
const t = useTranslations("nav");
return <span>{t(`main.${item.key}`)}</span>;
```
- Strings novas vão em `messages/pt-BR/<ns>.json` **e** `messages/en/<ns>.json` (chaves em paridade)
- Novo namespace: criar os 2 JSONs + adicionar o nome em `NAMESPACES` (`i18n/request.ts`)
- Plurais: usar ICU (`{count, plural, one {# item} other {# itens}}`)
- Nunca hardcodar texto de UI em PT — sempre via `t()`

### Dynamic import de componentes pesados
```typescript
// Em Server Components — SEM ssr: false (causa build error)
const Chart = dynamic(() => import("@/components/chart").then(m => m.Chart), {
  loading: () => <div className="h-40 animate-pulse bg-black/[.03] rounded-xl" />,
});
```

---

## Banco de dados — tabelas principais

| Tabela | Uso |
|--------|-----|
| `patients` | Pacientes (clinic_id, full_name, email, phone, status) |
| `appointments` | Agenda (clinic_id, patient_id, starts_at, status) |
| `session_records` | Notas de sessão (patient_id, clinic_id, notes, soap_mode) |
| `assessment_responses` | Formulários respondidos |
| `assessment_invitations` | Links de convite com token_hash |
| `follow_ups` | Automações de follow-up (status, due_at) |
| `rate_limit_buckets` | Rate limiting (key, window_start, count) |
| `subscriptions` | Plano ativo da clínica (JOIN plans) |
| `patient_exams` | Exames laboratoriais |
| `patient_prescriptions` | Medicamentos e suplementos |

---

## Decisões já tomadas (não reverter sem motivo)

- `React.cache` nos serviços core — deduplica queries por request
- `ilike` para busca de pacientes (GIN trigram index no banco compensam o custo)
- `ssr: false` PROIBIDO em Server Components com `next/dynamic`
- Admin client obrigatório em contexto sem sessão (cron, webhooks)
- `img` em vez de `Image` para QR code MFA (data: URL incompatível com next/image)
- Paginação de pacientes: `PAGE_SIZE = 100`, URL `?page=N&q=termo`
- Bot WhatsApp: step derivado do nº de msgs assistant (nunca coluna DB) — imune a cache stale
- Bot WhatsApp: UPSERT com `onConflict: "phone"` no INSERT inicial (evita race condition)
- Bot WhatsApp: SELECT inclui `clinic_id` — usado em `effectiveClinicId = convClinicId ?? botConfig.clinic_id`
- Confirmação de agendamento: Meta API template `agendamento_confirmado` (não Twilio)
- Bot bilíngue: idioma detectado da primeira mensagem do paciente, fixo para toda conversa
- Drag-drop agenda: dnd-kit com `activationConstraint: { distance: 8 }` + resize via pointer capture
- Google Calendar: já implementado em `services/google-calendar-service.ts`, precisa de env vars por clínica
- **Shell com try-catch obrigatório**: `Promise.all` em Server Components deve ser envolvido em try-catch explícito no Next.js 16 — rejeição de promise nested sem catch pode disparar error boundary em todas as páginas
- AI insights no `/results`: sempre usar `generateAiInsights` via rota dedicada `/api/results/insights` (maxDuration=60s), nunca inline no page render
- `ResultsInsights` client component com skeleton: carrega insights após render da página, nunca bloqueia SSR

---

## Módulos funcionais

- **Agenda**: `/schedule` — criação, edição, teleconsulta (Zoom)
- **Pacientes**: `/patients` — prontuário, exames, prescrições, documentos
- **Sessões**: `/schedule/[id]/session` — notas SOAP, vitais, gravação de áudio
- **Formulários**: `/forms` — templates + convites para pacientes
- **Health Agent**: `/patients/[id]` → botão IA — análise GPT-4o + email para paciente
- **Financeiro**: `/financeiro` — pagamentos, repasses, NFSe
- **Analytics**: `/analytics` — NPS, ocupação, alertas
- **Automações**: cron no Supabase → `automation-service.ts`
- **Integrações**: Google Calendar (OAuth, conectado em produção), Zoom (token por clínica)
- **Portal do Paciente**: `/p/[token]` — sessões, documentos, LGPD, link Zoom
- **LGPD**: `/settings/lgpd` — solicitações de exclusão + `patient_consents`

---

## Vault Obsidian

Localização: `../AXIEL_Obsidian/`
Atualizado automaticamente às 8h via launchd (`~/Library/LaunchAgents/com.axiel.vault-update.plist`)
Notas de decisões técnicas: `08-Referencia-Tecnica/Decisoes-Tecnicas.md`
