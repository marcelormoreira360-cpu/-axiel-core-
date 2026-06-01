# AXIEL Core — Contexto do Projeto

> Leia este arquivo no início de cada sessão antes de explorar o código.
> Atualizado em: 29/05/2026 (5)

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
  - **Pendente**: Fases 4–6 (Formulários, Financeiro, Results, Settings, Automações; áreas públicas; e-mails/PDF) + componentes secundários soltos
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
| `supabase/migrations/` | última aplicada = 047_broadcast_campaigns.sql (048_waitlist.sql e 049_user_preferred_locale.sql pendentes) |
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
