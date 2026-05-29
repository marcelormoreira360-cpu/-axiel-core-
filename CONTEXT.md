# AXIEL Core — Contexto do Projeto

> Leia este arquivo no início de cada sessão antes de explorar o código.
> Atualizado em: 29/05/2026

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
| `supabase/migrations/` | 045 migrations, última = 045_lgpd_consent_and_deletion.sql |
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
