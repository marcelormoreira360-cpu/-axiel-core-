# AXIEL Core — Contexto do Projeto

> Leia este arquivo no início de cada sessão antes de explorar o código.
> Atualizado em: 15/07/2026 (40)

## 🟡 Fase 1 de rollout — 5 frentes (15/07/2026) — TUDO MERGEADO NO MAIN, DEPLOY GATED

> PRs **#95 #96 #98 #99 #100** mergeados no `main`. Migrations **131, 132, 133 NÃO aplicadas em prod ainda** (deploy gated). Gates locais: `tsc` 0, lint 0 nos arquivos tocados. (#97 foi fechado pelo GitHub ao deletar a branch base do #96 no merge; recriado como #100.)

1. **interest_area (#95, migration 131):** o AXIEL Growth (migration 0023) trocou o campo livre `pain` por `interest_area` fechado (`energy|sleep|stress|performance|general`) e passou a enviá-lo no hand-off (blindagem de PHI, parecer Lex 14/07). `growth-integration-service` agora aceita `interest_area`, sanitiza contra a whitelist (fora da lista vira null), e persiste na coluna `leads.interest_area` + `warming_context` + notes. Aplicar a 131 em prod casada com a 0023 do Growth.
2. **Opt-in por canal (#96, migration 132):** novo `services/channel-consent-service.ts` reaproveita a tabela append-only `patient_consents` (045) com `consent_type = channel_<canal>` (email/sms/whatsapp/instagram/messenger). `recordChannelConsent` grava opt-in/opt-out com ip/user_agent/source (prova TCPA/HIPAA); `getChannelConsent`/`getPatientChannelConsents`/`getChannelConsentsForPatients` leem o estado atual (linha mais recente por canal). Migration 132 é só `comment`, sem mudança de schema (consent_type é TEXT livre, sem CHECK novo p/ não rejeitar valores legados).
3. **Dunning por canal (#100):** `dunning-service` deixou de mandar só WhatsApp cego. Agora consulta o opt-in em lote e respeita opt-out (`canSendTransactional`: envia em canal sem opt-out explícito, não exige opt-in p/ não silenciar aviso de serviço); preferência WhatsApp → e-mail com fallback quando o WhatsApp falha; loga cada tentativa em `communication_logs` com channel/provider corretos; e-mail escapa dados do paciente antes do HTML. Roda dentro do cron `automations`.
4. **Convite de equipe (#98):** o fluxo já existia completo (team-service + /settings/equipe + /join/[token] + signup/login carregam invite + /api/auth/accept-invite + i18n + fixes IDOR/expiry). A verificação do disparo real de e-mail achou que a falha era ENGOLIDA em silêncio; agora `inviteTeamMember` loga a falha (Vercel). GOTCHA de env: `RESEND_API_KEY` do .env.local está INVÁLIDA (401), `RESEND_FROM_EMAIL` é o sandbox `onboarding@resend.dev` (só entrega no dono da conta) e `NEXT_PUBLIC_APP_URL` é localhost.
5. **Worker de mídia IG (#99, migration 133):** habilita a Clara a enviar IMAGEM no DM do Instagram, assíncrono. Fila `outbound_media_jobs` (RLS por clínica) + `services/outbound-media-service` (enqueue + processOutboundMediaJobs: claim atômico pending→sending, retry até max_attempts, reclaim de 'sending' órfão) + `lib/instagram-api` (envio extraído do webhook, `sendInstagramText` reusado + novo `sendInstagramImage`) + `lib/openai-image` (geração via gpt-image-1 quando não há imagem: política do Marcelo "usa a fornecida, senão a IA gera") + cron `/api/cron/media-worker` (vercel.json `*/2 * * * *`). DM, NÃO post no feed (post = trilha do Growth/Brio). Usa o bucket privado `patient-docs` + URL assinada (a Meta busca a URL).

🔴 **DEPLOY GATED (aguardando OK + envs do Marcelo):** aplicar migrations 131/132/133 na prod; ativar cron do worker; envs: `RESEND_API_KEY` válida + `RESEND_FROM_EMAIL` domínio verificado + `NEXT_PUBLIC_APP_URL` real + `CRON_SECRET` + `OPENAI_API_KEY` + `META_INSTAGRAM_TOKEN(_<conta>)`. **Follow-ups de código:** wiring da captura de opt-in (form/portal + handler STOP TCPA, distinto do handover "falar com atendente"); wiring do gatilho de imagem da Clara (chamar `enqueueOutboundMedia`); decisão de compliance de parar de aceitar `pain` no endpoint do Growth (Selo/Lex).

## 🟢 Auditoria 3 — lotes 6 e 7 (segurança + venda EN) (09/07/2026) — NO AR

> Commit `8ca64d4`, deploy Vercel verde nos 2 projetos. Migration **123 APLICADA na prod** (`bfuulpvzedcrpmmjxles`). Gates: tsc 0, **357 testes**, verify:i18n 46/0/0, lint 0 erros, next build ok. Advisors security agora só os 11 SECURITY DEFINER deliberados + leaked password protection (toggle do Marcelo).

**Segurança:** feed iCal sem PHI (notes fora do DESCRIPTION e do select) + rate limit 30/h por token+IP; `clinic-assets` com policies de escrita/leitura por pasta trazidas p/ migration ativa 123 (idempotente, leitura SEGUE restrita a membros, sem reintroduzir listagem pública da 110; comentário da 025 corrigido; `ical_secret` documentado como mantido em claro de propósito); link público de captação com teto de 200/dia por token; `checkRateLimitDb` loga warn no fail-open; PDF do Bio³ valida `clinic_id` explícito (404). **56 console.error/warn → lib/logger** em 31 arquivos (chegam ao Sentry); sobram só client component (app/error.tsx) e os console.warn (fora do escopo).

**Venda EN:** IA em **2 níveis** (novo `lib/ai-language.ts`, helper `languageInstruction`): material do PACIENTE segue `patients.locale` via `resolvePatientLocale` (AI Insight/relatório, síntese de exame); material INTERNO segue idioma da clínica (sugestão ATM, insight financeiro, resumo teleconsulta, datas do business-analytics). Guarda-corpos clínicos intactos. `/upgrade` lê preço da tabela `plans` por moeda da clínica (helper `formatPriceCents` compartilhado com /pricing). Automações DEFAULT_RULES e history no idioma da clínica (getServerT). Auto-replies fixos WhatsApp/Meta/SMS no idioma do paciente (`resolveChatLocaleByPhone`) ou da clínica quando o canal não tem telefone (Messenger/IG).

🔴 **PENDÊNCIA DE MARCELO (decisão comercial):** os planos no banco de prod têm `price_usd_cents`/`price_eur_cents` **NULL** (só starter R$49 e professional R$149 em BRL) → clínica US ainda vê BRL no /upgrade pelo fallback. O código está pronto; falta Marcelo definir os valores em USD/EUR (seed histórico da migration 007 sugeria US$ 49/129/299) p/ eu popular no banco. Também pendente: ligar leaked password protection no painel Supabase.

## 🟢 Auditoria 3 + 5 lotes de melhorias (09/07/2026) — TUDO NA MAIN E NO AR

> Commits `ac3faac`, `7682552`, `b537878`, `fc47c74`, `3553c9f`, `e4a9669`. Migrations **120, 121 e 122 APLICADAS na prod** (`bfuulpvzedcrpmmjxles`). Gates de tudo: `tsc` 0, **357 testes verdes**, lint 0 erros, `verify:i18n` 46/0/0, `next build` ok.

1. **UX (`ac3faac`):** kanban de leads migrado de drag HTML5 para **@dnd-kit com TouchSensor** (funciona no celular; grid responsivo; labels do pipeline i18n em `leads.pipeline`); novo **`components/confirm-dialog.tsx`** (alertdialog acessível, loading, variante destrutiva, dark) substitui os 12 `confirm()` nativos; **dark mode 100% aditivo no fluxo público /f** (formulário, captação, estados de link, caixa de crise PHQ-9 em alto contraste nos 2 temas).
2. **Banco (migrations 120-122):** advisor `multiple_permissive_policies` **49 → 0** (patient_payments abandonou o modelo legado `users.clinic_id`, verificado 0 usuários fora de `clinic_users`; padrão manage+view virou per-comando; merges com OR em clinics/users/clinic_users/plans/subscriptions); policies explícitas nas 5 tabelas RLS-sem-policy (`whatsapp_*` têm `clinic_id` TEXT: cast protegido por regex); `pg_trgm` movido p/ schema `extensions`; **17 índices sem uso dropados. GOTCHA: dos "147 unused" do advisor, 113 cobrem FKs e o resto é lookup crítico com stats jovens (token_hash, rate_limit, meta_phone) — NÃO dropar em massa.** Advisors security restantes: 11 SECURITY DEFINER deliberados (helpers RLS) + leaked password protection (toggle manual do Marcelo no painel).
3. **Higiene do repo (`7682552`):** 51 .md operacionais da raiz → `docs/notas/`; arquivo `=` e binários Revenue_Center fora do git (ficam no disco); 2 stubs órfãos removidos; `.gitignore` cobre notas/PDFs da raiz.
4. **i18n leva 3 (`b537878` + `fc47c74`):** ~340 strings pt-BR cravadas ZERADAS nas telas de app/ e components/ — onboarding-flow 100% (primeira tela do cliente novo), 15 componentes (insights, inbox, global-search, notification-bell, LGPD, monetização, evolução, zoom) e 17 páginas (patients/[id]/* 7 telas, whatsapp, hotmart, get-started, results, reminder etc.). `privacy/page.tsx` é bilíngue ESTÁTICA de propósito (EN+PT na mesma página). ~180 chaves novas em paridade.
5. **Refactor (`3553c9f`):** `schedule-container` 1478→259 linhas (`components/schedule/`: grid, cards, DayView/WeekView/MonthView); `patient-portal-dashboard` 1217→429 (11 seções em `components/patient-portal/`); `ai-insight-service` 1029→barrel de 31 linhas re-exportando `services/ai-insight/` (prompts byte a byte, MESMA superfície pública).
6. **Deps (`e4a9669`):** openai **4→6** (uso é só `chat.completions.create`, drop-in), @supabase/ssr **0.6→0.12** (cookies getAll/setAll já eram o padrão), **eslint-config-next 16** (flat config nativo, saiu o FlatCompat; regras novas do react-hooks v6 rebaixadas p/ warning: 33 padrões pré-existentes de `set-state-in-effect`/`purity`/`static-components`/`immutability` p/ limpeza dedicada), supabase-js 2.110, vitest atualizado. `npm audit --omit=dev`: 4 moderadas transitivas sem fix não-destrutivo (postcss via next, uuid via exceljs).

**Backlog vivo pós-auditoria 3 (bloqueadores de venda EN, aguardando ordem do Marcelo):** IA em PT cravado nos prompts (ai-insight/prompts+generation, exam-ai-service:22, ai-finance-insight-service:114, telehealth/summary:35, datas pt-BR no business-analytics) → plano combinado: material INTERNO segue idioma da CLÍNICA, material de PACIENTE segue `patients.locale` (resolvePatientLocale, como os e-mails já fazem); `/upgrade` com preços R$ cravados (upgrade/page.tsx:12-14; conferir prices USD no Stripe); automações DEFAULT_RULES em PT (api/automacoes/route.ts:43-74); auto-replies WhatsApp/Meta/SMS em PT (resolvePatientLocale só em 3 arquivos). Segurança pendente (lote 1 da auditoria, sem ordem): feed iCal expõe nome+notes por token plano sem expiração (ical-service.ts:53-80); policies de escrita do bucket clinic-assets só em migrations_archive/044; 87 console.error fora do lib/logger (não chegam ao Sentry); teto/revogação do link público de captação; checagem explícita de clinic_id no PDF do Bio³.

## 🟢 Clara AI + passagem de bastão humano↔IA (04/07/2026) — NO AR

> PRs **#79–#81** mergeados e deployados. Migrations **114 e 115 APLICADAS na prod** (Core em **migration 115**). 319 testes verdes (8 novos), verify:i18n 46 namespaces (novo: `whatsapp`).

1. **Passagem de bastão (PR #79, migration 114):** `whatsapp_conversations` ganhou `ai_paused` + `last_human_message_at`. Resposta manual pela UI grava o timestamp; o bot conversacional NÃO responde se `ai_paused` OU `bot_disabled` (legado do opt-out da Meta) OU humano respondeu há <24h (`lib/whatsapp-handoff.ts`, testado). Gate aplicado nos 4 webhooks (Twilio WhatsApp, Meta WhatsApp/Facebook/Instagram — todos usam `whatsapp_conversations`, prefixos `fb_`/`ig_`). Transacionais (lembretes/confirmações/NPS/`/api/whatsapp/send`) ficam FORA do gate. UI de conversas: estado ("IA ativa/pausada/Com a equipe") + botões "Pausar IA" e "Devolver para a Clara" (`pauseAi`/`resumeAi` limpam os três sinais). Fora: `/api/meta/webhook` (tabela legada `meta_conversations`, pipeline já desativado).
2. **Limite de instruções do bot 3k→12k (PRs #80/#81, migration 115):** o prompt operacional da Clara (~8,5k chars) estourava DOIS limites de 3.000 em `custom_instructions`: a validação da action (agora retorna `{ok,error}` legível em vez de throw — o Next mascara mensagens de exceção de server action em produção) e a check constraint do banco (`whatsapp_bot_configs_custom_instructions_length`, recriada em 12.000).
3. **Clara v1.0 EM PRODUÇÃO na IFWC:** persona salva nas "Instruções adicionais" do WhatsApp Bot. Fonte: `../CLARA_PROMPT_OPERACIONAL_PT.md` (+ `_EN.md`), destilados do `../MANUAL OPERACIONAL DA CLARA AI.pdf` (225 caps) com adições: protocolo de emergência (911/192, 988/CVV 188), handoff, verificação de identidade e Fatos Oficiais (endereço Orlando, seg-sex 8h-18h, avaliação US$200 Orlando / US$500 SP / US$400 Maringá). Ao editar o bot da IFWC, manter arquivos e campo em sincronia.
4. **Vídeo-tour na landing (PR #82, 04/07):** `public/landing/tour-pt.mp4` (v11 aprovada, 12MB) + poster no slot `#tour` de `app/page.tsx`; matcher do middleware passou a excluir `.mp4/.webm/.mp3` (arquivos de vídeo de /public eram reescritos como HTML). Strings `hero.videoSoon`→`hero.videoCaption`. Versão EN do vídeo entregue à parte (Desktop, "English and Spanish" na narração); backlog: player EN na landing quando locale=en.
5. **Dedup de webhooks Meta (PR #83, migration 116, 05/07):** a Meta reenviava webhooks quando o 200 demorava (LLM) e o bot respondia 2x com fraseados diferentes (IG "desconexo"). Tabela `meta_processed_messages` (mid pk) + gate `isDuplicateMetaMessage` (lib/meta-dedup, fail-open) como PRIMEIRA checagem nos 3 webhooks Meta. Migration APLICADA na prod. Canais da Clara mapeados: IG clínica + IG pessoal (META_IG_EXTRA_ACCOUNTS) + página FB JIFWC ativos; FB perfil pessoal é impossível via API (instant reply nativo do Messenger, ajuste manual); WhatsApp e Ligações IA aguardam número Twilio/Meta (checklist 2a/2b).
7. **Canal SMS da Clara (PR #84, 05/07):** `app/api/sms/webhook/route.ts` reutiliza o motor extraído para `services/twilio-bot-engine.ts` (histórico, lead automático, OpenAI, gate de plano; webhook do WhatsApp Twilio refatorado SEM mudança de comportamento). Conversas em `whatsapp_conversations` com phone `sms_+1...`; dedup por MessageSid na `meta_processed_messages`; opt-out compartilhado em `lib/whatsapp-optout.ts`; regra do canal (≤300 chars, sem emoji) + link de agendamento em `lib/twilio-webhook-utils.ts`; selo de canal (WhatsApp/Messenger/Instagram/SMS) na UI de conversas. OPERACIONAL pendente: apontar "A message comes in" do número Twilio para `/api/sms/webhook` quando o 689 280-3705 chegar (portabilidade OpenPhone→Twilio conta AC2d59fb em re-submissão: LOA de 25/06 foi preenchida com nome/endereço da Twilio em vez do titular e deve ter sido rejeitada).
8. **Funil com reset + handoff pelo app da Meta (PR #85, 05/07):** dois bugs reportados em teste real. (a) `funnelStepFromHistory` nunca resetava — um "Oi" numa conversa antiga caía no passo 7 ("vou confirmar seu agendamento"); agora conversa parada há 48h+ (`updated_at`) volta ao passo 1 e o prompt ganhou REGRA DE COERÊNCIA (não seguir o template do passo cegamente; nunca confirmar agendamento sem período+nome). (b) a pausa humana só era acionada pela UI do Core; agora os webhooks FB/IG processam ECHOES: no Messenger, echo com `app_id` ≠ `META_APP_ID` (env, fallback 1468755454577652) = humano pela caixa de entrada da Meta → `registerHumanReply` (grava no histórico + `last_human_message_at`, janela 24h); no Instagram (echo sem app_id confiável), texto que não é uma das 3 últimas respostas do bot = humano. Canal WhatsApp Twilio passou a usar o passo do funil (estava fixo em 1). OPERACIONAL: `message_echoes` assinado na página pessoal (549973015492301, conectada em 05/07 com token `META_FACEBOOK_TOKEN_549973015492301` no Vercel); PENDENTE marcar `message_echoes` nas páginas I.F. Wellness Center e Mrodriguesmoreira (dialog "Edit Page Subscriptions" no painel do app — tokens no Vercel são sensitive, não dá para assinar via API daqui). Porte do 689 SUBMETIDO (Reference PortRequestOnBoard-AC2d59fb...-1783302654, Processing).
9. **Persona Clara nos canais Meta (PR #86, 05/07):** Messenger usava SEMPRE `IFWC_DEFAULT_CONFIG` e o IG de contas extras (META_IG_EXTRA_ACCOUNTS, ex.: IG pessoal) idem — as `custom_instructions` (prompt Clara v1.0, 9.103 chars) ficavam FORA do prompt nesses canais (só o IG da clínica tinha a persona). Novo `getWhatsAppBotConfigByClinicId` (admin client; o `getWhatsAppBotConfig` existente usa server client com RLS e não serve para webhook); FB busca por `effectiveClinicId`, IG extra cai na config da clínica antes do default; `buildSystemPrompt` dá prioridade às instruções adicionais em persona/apresentação/tom mantendo a sequência do funil.
6. **Backlog i18n descoberto na versão EN do vídeo:** títulos/descrições das 4 automações (DEFAULT_RULES em `app/api/automacoes/route.ts`) e o sufixo "vs. mês passado" dos KPIs do dashboard estão cravados em PT (clínica EN vê PT).

## 🟢 Auditoria 2 + lotes 6–9 (01–02/07/2026) — TUDO MERGEADO E NO AR

> `tsc` 0, lint 0 erros, verify:i18n 43/0/0, **311 testes verdes**, `next build` ok. Migration **111 APLICADA na prod** (`bfuulpvzedcrpmmjxles`). Core agora em **migration 111**. PRs #63–#66.

Segunda auditoria (robustez de fluxos, performance, produto, RLS profundo) e execução dos 4 lotes resultantes:

1. **Lote 6 (PR #63) — timezone e conciliação:** toda mensagem ao paciente formata no fuso da clínica via `getClinicTimezone` (novo, em clinic-service; fonte canônica = COLUNA `clinic_settings.timezone` — o booking público lia o JSONB legado e a IFWC/America-New_York saía 1h errada nos slots); `/schedule/new` converte wall-clock→UTC com `wallClockToUTC` (exportado de booking-utils); webhook Stripe baixa `product_order` também no `async_payment_succeeded` (Pix/Boleto ficava pendente p/ sempre); double-confirm por token detecta 0 linhas (side-effects não duplicam); `vercel.json` sem o monthly-report duplicado.
2. **Lote 7 (PR #64) — agenda confiável:** `hasAppointmentConflict` (sobreposição por duração + escopo por profissional) nas 4 vias de criação (staff, token, /api/book com 409 SLOT_TAKEN, portal); cron cancela pendings com `confirm_expires_at` vencido (paravam de liberar o horário); follow-ups presos em `processing` >30min voltam à fila (claim grava `updated_at`); telefone normalizado em dígitos (`lib/phone.ts`) no booking/patient-service/Hotmart (dedup entre canais); Twilio prefixa `+`.
3. **Lote 8 (PR #65) — performance:** ficha do paciente com a cascata de ~10 awaits seriais em 2 levas de `Promise.all` (waitlist agora por paciente, `getWaitlistEntryForPatient`); middleware com fast-path para rotas públicas (sem `auth.getUser()` de rede) e matcher sem assets; `getPatientsLite` (7 colunas + join practitioner) em /patients, /schedule e /financeiro — tipos `PatientLite` em patients-client, schedule-container e create-session-modal; `React.cache` em `getClinicCurrency` e `getClinicsForUser`; recharts de /financeiro/relatorio via `next/dynamic`.
4. **Lote 9 (PR #66) — frente vendável:** (a) **clínica nova nasce com o MÉTODO**: `seedMethodTemplatesForClinic` (services/assessment-seed-service) semeia Q-SNA + QRM + Anamnese do perfil como Formulários (placement `intake`, `send_on_first_appointment`), idempotente por nome; templates canônicos extraídos p/ `modules/assessments/canonical-templates.ts` (o motor Bio³ reconhece pelo NOME, não renomear); seed do intake LEGADO removido do onboarding; (b) convite de equipe do onboarding agora ENVIA o e-mail (Resend, chaves `emails.invite`); (c) tela de sessão ganhou bloco "Pós-atendimento": `ChargeSessionButton` reusado (chip "Sessão já paga" quando quitada) + "Agendar retorno" p/ `/schedule/new?patient_id=` (pré-seleção já existia); (d) `/get-started` conta `assessment_templates` e linka `/forms` (era o intake aposentado); (e) `/upgrade` vai DIRETO ao checkout Stripe (form POST `planCode`, padrão do billing-plan-card); (f) **"Enviar ao paciente" no Mapa Bio³**: `sendNeuroIdReportToPatientAction` (e-mail com PDF anexo via `sendSimpleEmail`, push, log em communication_logs use_case `neuro_id_report` — migration 111), botão no painel com estados enviando/enviado/erro e desabilitado sem e-mail.

**Backlog vivo (auditoria 2, ainda não feito):** projetos — locale do PACIENTE ponta a ponta (coluna patients.locale; WhatsApp/IA/relatórios hoje pt cravado), trial real de 14 dias sem cartão, dark mode (~12 telas sem variantes `dark:`; esconder o toggle é quick win), sistema de toast + padronização de erros de action, materializar respostas do formulário público na conversão lead→paciente, rebooking no portal, zod nas ~52 actions com FormData, consolidar policy ALL redundante de patient_payments (49 multiple_permissive_policies), Stripe SDK 16→22 + pinar apiVersion, Hotmart refund→completed em retry fora de ordem, monthly-report sem dedup por clínica, DOB `new Date("YYYY-MM-DD")` inconsistente (padronizar T12:00:00), cron de automações de hora em hora, push no lembrete D-1, badge-72.png do sw.js, N+1 do progresso de questionários, empty states com CTA nas 6 telas principais.

## 🟢 Varredura completa + 5 lotes de correção (01/07/2026, sessão 2) — TUDO MERGEADO E NO AR

> `tsc` 0. **`npm run lint` FUNCIONA de novo (0 erros)**. `verify:i18n` **43** namespaces (novo: `leads`) 0/0. **311 testes verdes**. `next build` ok. Migrations **109 e 110 aplicadas na prod** (`bfuulpvzedcrpmmjxles`). Core agora em **migration 110**. PRs #58–#61 mergeados (squash) e deployados.

Varredura de auditoria (3 agentes: saúde do código, segurança, UX/i18n + advisors do Supabase) seguida de execução em 5 lotes:

1. **Segurança (PR #58):** (a) IDOR cross-tenant CRÍTICO fechado: `deletePatientDocument` agora exige `clinic_id` (usava admin client filtrando só por id — qualquer staff logado de outra clínica deletava documento/arquivo de PHI alheio); (b) `/api/patients/export` e `/api/reports/{pacientes,pagamentos,sessoes,leads}` agora exigem gestor/dono (`isFinanceApiAllowed`) — antes qualquer `read_only_staff` baixava CSV com PII da base inteira; (c) `accept-invite` valida que o e-mail da conta bate com o e-mail do convite (não confia mais só no `userId` do body); (d) webhook Asaas devolve 5xx em erro de banco (Asaas reentrega; antes pagamento podia ficar não-conciliado em silêncio).
2. **Build/lint (PR #59):** `npm run lint` estava quebrado em 2 camadas — `check:terminology` com ~200 falsos positivos (agora analisa SÓ copy visível: literais de string e texto JSX; ignora imports/comentários/identificadores/chaves i18n/interpolações/testes) e `next lint` removido no Next 16 (script migrado p/ `eslint .` + `eslint.config.mjs` flat config novo, next/core-web-vitals). 8 erros reais do ESLint corrigidos. `export encodeHistory` removido do webhook de voz (o erro pré-existente do build MORREU). `npm audit fix`: 2 high eliminadas (form-data, tmp); restam 4 moderate presas ao exceljs (fix seria downgrade breaking).
3. **Banco (migrations 109/110, APLICADAS na prod):** 109 = revoke EXECUTE das 24 funções SECURITY DEFINER expostas via /rest/v1/rpc (triggers: revogado de todos; helpers de RLS `can_access_clinic` etc.: authenticated MANTÉM — são avaliados dentro das policies; `check_rate_limit` só service_role) + 18 índices duplicados dropados + 5 FKs indexadas. 110 = bucket `clinic-assets` sem listagem pública (logo continua servindo por URL pública, verificado HTTP 200). Advisor de anon zerou; os 11 warnings restantes de authenticated são intencionais. **PENDENTE (só Marcelo, painel Supabase): ligar leaked password protection (Auth → senhas comprometidas/HaveIBeenPwned).**
4. **UX (PR #60):** `mobile-bottom-nav` saiu do pt-BR cravado (chaves de `nav.json`, novo grupo `mobile`); telas de lead (`/leads/[id]` EN cravado + `/leads/new` PT cravado) migradas p/ namespace novo **`leads`** (pt-BR+en, registrado em `i18n/request.ts`); aria-label em 19 botões só-ícone (setas da agenda = `calendar.prevPeriod/nextPeriod`, X de modais = `common.actions.close`); **`/trends` linkada na sidebar** (nav.clinic.trends).
5. **Limpeza (PR #61):** 10 componentes órfãos deletados (~1.100 linhas: conjunto `product-*`, `health-agent-panel`, `body-map-field`, `patient-demographics-panel`); **`_BRIEF_BIO3_MOBILE.md` FECHADO** (pirâmide fluida `w-full max-w-[260px]`, botões `w-full sm:w-auto` c/ tap target 44px, form 1 coluna — só CSS, `sm:` restaura o desktop); os 2 `confirm()` cravados migrados p/ i18n (`insights.deleteButton.confirm`, `common.actions.confirmRemoveNamed` com ICU `{name}`).

**Backlog que a varredura deixou anotado (não feito):** ~387 strings pt-BR cravadas em 83 .tsx (piores: patients/new c/ lista de países, onboarding-flow, clinics, upgrade, landing, schedule, pricing); questionários Q-SNA/QRM só em PT p/ paciente EN (linha antiga); Stripe 6 majors atrás (16→22, atualizar com calma); 79 `console.error` fora do `lib/logger` (não chegam ao Sentry); kanban de leads com drag HTML5 (sem touch — migrar p/ dnd-kit); 49 `multiple_permissive_policies` (24 em `patient_payments` — consolidar policies em migration futura); 160 índices sem uso (avaliar dropar após meses de métrica); pt-PT inexistente; triagem dos 13 `_BRIEF_*.md` da raiz (mobile Bio³ agora está feito).

## 🟢 Captação, UX e consolidação de formulários (01/07/2026) — TUDO MERGEADO E NO AR

> `tsc` 0 (sobra só o erro PRÉ-EXISTENTE de `.next/types` do `encodeHistory`). `verify:i18n` 42/0/0. **311 testes verdes**. Migrations **107 e 108 aplicadas na prod** (`bfuulpvzedcrpmmjxles`). Core agora em **migration 108**. PRs #48–#55 mergeados (squash) e deployados.

Sessão de feedback do Marcelo (UX + arquitetura de formulários). Decisões tomadas via perguntas antes de construir; cada item virou um PR isolado.

1. **Link de captação — questionário público que vira lead (PR #48, migration 107):** antes o convite de formulário exigia um paciente já cadastrado. Agora existe um **link público reutilizável** (`kind='public'` em `assessment_invitations`, `patient_id` virou nullable). Quem abre `/f/[token]` preenche os próprios dados (nome/e-mail/telefone + consentimento) e responde o questionário; entra como **Lead** (`lead_source` += `public_form`), com o score nas notas. Nova tabela `public_form_submissions` (respostas + score + consentimento c/ IP/UA, RLS). `createPublicCaptureInvitation` + `createPublicCaptureLinkAction`; ramo público em `/api/forms/submit` (rate-limit por IP + honeypot). Componentes `public-capture-form`, `public-capture-link-panel`. Materialização no Bio³ = fase 2 (na conversão lead→paciente).
2. **Spinner "IA trabalhando" (PR #49):** os botões de IA do painel de Avaliação (importar achados, sugerir ATM, extrair/confirmar medicação) e o de extrair de exame só trocavam texto. Novo `components/ai-button-spinner.tsx` nivela ao padrão dos demais geradores de IA.
3. **Equipe + Profissionais unificados (PR #50):** `/settings/equipe` virou tela com abas **Acesso** (EquipeClient) + **Perfil público** (PractitionersList). `/settings/practitioners` redireciona p/ `?tab=perfil`. Hub tem 1 card só ("Equipe & Profissionais"). Sidebar "Equipe" (`/profissionais`, BI de desempenho) **removido do menu** (PR #52) — colidia de nome e fica vazio em clínica solo; página segue por URL.
4. **Achados na Anamnese — formato QRM=42 / Q-SNA=46 (PR #51):** `groupHead` (`modules/neuro-id/findings.ts`) gera `QRM=42, <faixa>` e `Q-SNA=46, <faixa>` (com número, sem nome longo nem "total X/Y"). Dedup ao reimportar reconhece formatos antigos e apaga a intro legada "ACHADOS DOS QUESTIONÁRIOS...". Corrige texto já salvo ao reclicar "Importar achados".
5. **Botão "Voltar" padronizado (PRs #53, #54):** BackLink adicionado em Formulários, Configuração da clínica, LGPD, Integrações e Intake (faltavam). Billing/Monetização/Follow-ups/Get-started ficaram de fora (destinos primários com lugar no menu).
6. **Intake consolidado em Formulários (PR #55, migration 108):** o antigo "Formulário de intake" (`intake_forms`) não chegava ao paciente e duplicava os Formulários. Migration converte cada `intake_form` ativo em `assessment_template` (perguntas de texto, sem nota, placement `intake` + envio no 1º agendamento), idempotente via `source_intake_form_id`; dados antigos de `intake_responses` intactos e visíveis na ficha. **Formulário público agora exige só perguntas COM nota; texto livre é opcional** (a menos que `is_required`) — nenhum questionário existente muda. Card `/intake` removido do hub (página segue por URL p/ respostas antigas). **Envio automático no 1º agendamento (IFWC):** Anamnese Integrativa + Q-SNA + QRM; "Estilo de Vida" tirado do slot intake (ajuste de config no banco, reversível pela UI).

## 🟢 Polish da ficha do paciente — 4 frentes (27/06/2026) — 1a/1b/1c MERGEADAS E NO AR; Fase 2 no PR #43

> `tsc` 0 (sobra só erro PRÉ-EXISTENTE em `.next/types/app/api/voice/webhook/route.ts`: `route.ts` exporta `encodeHistory`, função não-handler). `verify:i18n` 42/0/0. 304 testes verdes. `next build` ok. Migrations **105 e 106 aplicadas na prod** (`bfuulpvzedcrpmmjxles`). Core agora em **migration 106**.

Sessão de feedback do Marcelo sobre a ficha. As 4 frentes nasceram da lista dele; decisões tomadas via perguntas antes de construir (evitar retrabalho).

1. **Fase 1a — Avaliação obedece 100% à config (PR #40, migration 105):** antes a ficha renderizava a Avaliação por uma espinha ATM **fixa no código** (`ASSESSMENT_GROUP_ORDER`), ignorando o `order_index` que as setas de `/settings/avaliacao` já salvavam (Anamnese ficava em 1º na config mas no 4º bloco na ficha). Agora `clinic_assessment_fields` ganhou **`group_key`** (migration 105, check dos 5 grupos ATM, backfill pela mesma classificação); a ficha renderiza pela **ordem global** (`order_index`) agrupando em **blocos contíguos** por `group_key` (`groupRuns` em `patient-assessment-panel`; `groupForField` em `lib/assessment-groups` = config manda, fallback no mapa). Config ganhou select "Grupo (seção)" + badge. Ordem padrão recontígua com **Anamnese no topo** (seed `DEFAULT_ASSESSMENT_FIELDS` + dados da clínica existente normalizados no banco).
2. **Fase 1b — "Voltar" inteligente (PR #41):** antes cada página tinha `<Link href="..." fixo>` de voltar, então ia sempre pro mesmo lugar, ignorando de onde o usuário veio. Novo **`components/back-link.tsx`** (`BackLink`): clique normal + histórico → `router.back()`; sem histórico → `fallbackHref`; cmd/ctrl/meio → comportamento padrão (nova aba). Substituídos **~44 botões** em toda a app (ficha + sub-páginas, `settings/*`, `schedule/*`, `products/*`, `forms/*`, leads, intake, financeiro, whatsapp, termos/privacidade). Imports `next/link` mortos removidos.
3. **Fase 1c — IA sugere rascunho de "Integração clínica (ATM)" (PR #42):** botão "Sugerir com IA" no campo `integracao_atm`. `suggestAtmIntegration` (`ai-insight-service`, **reusa `buildAiInsightInput`** = avaliação + questionários + exames + Mapa Bio³) + `suggestAtmIntegrationAction` (escopo de clínica). Guarda-corpos clínicos no prompt (Salvo/Aval: sem diagnóstico fechado, sem cura, encaminha em sinais de alerta, linguagem prudente). É **RASCUNHO**: campo controlado, dedup por marcador `[Sugestão IA (revise)]` **preserva o texto do terapeuta**; NÃO grava nem entra no relatório automaticamente (decisão do Marcelo: opção A).
4. **Fase 2 — Seções da ficha reordenáveis e ocultáveis por clínica (PR #43, migration 106):** a página `/patients/[id]` tinha ~17 seções em ordem fixa no JSX. Agora **`clinic_patient_sections`** (clinic_id/section_key/order_index/is_visible + RLS + seed das 17 seções) guarda ordem e visibilidade por clínica. `lib/patient-sections` (registro canônico, 17 keys) + `clinic-patient-sections-service` (seed/backfill preguiçoso, reorder, toggle, `getPatientSectionLayout` com **fallback resiliente** à ordem padrão). A página foi reescrita num **registro de seções** (`Record<key, ReactNode>`) renderizado na ordem configurada num container `flex` com gap uniforme; **cabeçalho + barra de inteligência ficam fixos no topo** (data-fetching intacto, confirmado por diff). Normalizadas 2 bordas encadeadas (acompanhamento + barra de inteligência). Config: nova tela **`/settings/secoes`** (↑↓ + mostrar/ocultar) + card no hub `/settings/personalizar`. Decisões do Marcelo: reorder completo (não presets) + permitir ocultar. Retrocompatível: sem a tabela, a ficha cai na ordem padrão.

**Estado de merge:** #40/#41/#42 mergeados (squash) e deployados; **#43 aberto** (migration 106 já aplicada, só falta mergear). Os PRs tocam arquivos majoritariamente disjuntos.

## 🟢 Avaliação editável por clínica + placement nos formulários + hub de personalização (23/06/2026) — MERGEADO E NO AR (PR #17)

> `tsc` 0; `verify:i18n` 42/0/0; 295 testes verdes (6 novos). Migrations 101 e 102 aplicadas na prod (`bfuulpvzedcrpmmjxles`) e verificadas. PR #17 squash-merge (commit `f0d9001`). Core agora em **migration 102**.

**Tema:** tirar do código o que é específico de cada clínica e torná-lo configurável (modelo Vagaro: "crio e escolho onde vai"). Decisão: customizar a camada de apresentação/coleta; manter o motor de scoring Neuro ID estável (depende de mapeamentos fixos de pergunta).

1. **Avaliação editável por clínica (migration 101):** o painel "Avaliação" da ficha deixou de ter 5 campos fixos. Nova tabela `clinic_assessment_fields` (por clínica, RLS `can_access_clinic`/`can_write_clinic_data`, 4 políticas) define os campos (label, `field_type` textarea/text/number/select, `options` jsonb, `order_index`, `is_active`, `include_in_report`). Respostas em `patients.assessment_data` (JSONB, chave = `field_key`). Backfill dos 5 campos legados + seed dos padrões por clínica (no banco: 0 pacientes tinham campos legados preenchidos, então backfill vazio = esperado). Colunas legadas (anamnese/antecedents/pain_level/pain_location/treatment_note) mantidas por compat; constante única `LEGACY_ASSESSMENT_COLUMNS`. Service `services/clinic-assessment-service.ts` (CRUD, `moveClinicAssessmentField`, seed preguiçoso idempotente via admin client + onConflict, `slugifyFieldKey`, helpers `assessmentReportPairs`/`fieldValue`). Painel `patient-assessment-panel.tsx` renderiza dinâmico por tipo (select preserva valor fora da lista). Save `app/patients/[id]/assessment/actions.ts` faz **merge** sobre o assessment_data existente (não apaga campos inativos) + dual-write das colunas legadas ativas. Tela de config `/settings/avaliacao` (gestor). Relatório IA (`ai-insight-service.ts`): injeta os campos só se ATIVOS + `include_in_report` (sem dado obsoleto de campo deletado; respeita o toggle nos 5 padrão); custom vão em `assessment_extra` no Doc 1 (linha nova no guardrails).
2. **Placement nos formulários (migration 102):** `assessment_templates.placement` (text[]). Editor de formulário ganhou grupo "Onde este formulário aparece" (slots `intake`/`session`/`portal`); `send_on_first_appointment` agora é DERIVADO do slot `intake` (automação de envio intacta; backfill põe `intake` onde send_on_first era true). Chips de placement na lista `/forms`. `getAssessmentTemplates` aceita filtro opcional por slot (`.contains`). Slot `intake` totalmente ligado; `session`/`portal` por ora são organização/descoberta (estrutura pronta).
3. **Hub "Personalizar minha clínica" (`/settings/personalizar`):** tela única que agrega Avaliação + Formulários + Tipos de sessão + Testes clínicos + Suplementos + Marca + Ofertas + Lembretes (só links p/ telas existentes; sem migration). Card em destaque no hub de Configurações. Apoia onboarding de clínica nova (frente C). Passo 1/2/3 do plano "editável por clínica".
4. **Code-review (high effort) aplicado:** merge do assessment_data (não apagar inativos); gate do relatório por ativo+include_in_report; select preserva valor órfão; reuso `isManager` (lib/team-utils) + constante `LEGACY_ASSESSMENT_COLUMNS`. Pulados com motivo: seed via admin client (dormente p/ clínicas existentes, clinicId é session-scoped), race no create (tabela de config), chaves i18n mortas (grep não confiável).

## 🟢 Bio³ fusão de exames + ajustes da ficha + dedup de paciente (22/06/2026) — TUDO MERGEADO E NO AR

> `tsc` 0; `verify:i18n` 42/0/0; 289 testes verdes. Migration 100 aplicada na prod. PRs #9–#15 mergeados e deployados (axiel-core-6ikl.vercel.app).

1. **Fusão Bio³ a partir de exames (incrementos 1–5, PR #9):** neurometria/biorressonância passam a alimentar a pirâmide (antes só questionários), com extração por IA e **gate humano**. `computeNeuroId` ganhou 3º arg `examValues` (funde métricas na média ponderada por pilar; expõe `examContributions`). `modules/neuro-id/exam-metrics.ts` = núcleo determinístico (8 métricas ancoradas no manual) + extração (`buildMetricExtractionPrompt`/`coerceExamMetricsDraft`, faixa de sanidade) + `mergeConfirmedMetrics` + `EXAM_METRIC_META`. `services/exam-ai-service.ts` → `extractExamMetrics` (lê PDF + legenda). **Migration 100** (`patient_functional_exams` += `metrics_draft`/`metrics_values`/`metrics_reviewed_at`/`metrics_reviewed_by`). Gate na UI: `MetricsGate` no `patient-functional-exams-panel` (revisar/editar/confirmar). `neuro-id-service`: `createNeuroIdAssessment` e `autoUpsertNeuroIdDraft` puxam métricas confirmadas (`confirmedExamMetrics`, clinic-scoped) e persistem em `patient_assessment_values` (origem `exam:`). Spec: `_SPEC_BIO3_FUSAO_EXAMES.md`.
2. **Ficha — questionários dentro da Jornada + Avaliação sempre editável + voltar→ficha (PR #10):** o bloco Q-SNA/QRM deixou de ser card separado e virou seção compacta DENTRO do card "Jornada do paciente" (slot `questionnaires` no `PatientTimeline`; removida a barra de cor/mini-barras). `PatientAssessmentPanel` agora é sempre formulário pré-preenchido (sem alternar leitura/edição). `app/schedule/[id]/session/page.tsx`: seta de voltar vai para `/patients/[id]`, não `/schedule`.
3. **Escala 0–10 clicável e colorida (PR #11/#12):** no formulário de avaliação, os itens **manuais do Biomecânico** (palpação/dor, `band_type` mobility/pain) viram botões 0–10 coloridos por banda (0–3 verde · 4–6 âmbar · 7–10 vermelho, via `bandForItem`). QRM/Q-SNA e Bioquímico/Bioemocional seguem campo numérico (extraídos, podem ter decimais). Componente `ScaleButtons` em `patient-neuro-id-panel`.
4. **Confirmar agendamento — sem falha silenciosa (PR #13):** `confirmAppointmentByToken` agora CHECA o erro do update do paciente (antes ignorava); `confirmAppointmentAction` revalida `/patients/[id]` e `/schedule`.
5. **Agendamento — dedup de paciente (PR #14):** novo `findOrCreatePatientForBooking` (patient-service) procura paciente existente por **e-mail → telefone → nome exato** (só reusa com 1 match de nome) antes de criar; usado em `schedule/page.tsx` e `schedule/new/page.tsx`. Resolve duplicata no reagendamento.
6. **Pacientes — ocultar arquivados (PR #15):** `getPatients`/`getPatientCount` filtram `deleted_at is null`; o dedup também ignora arquivados. Faz o "arquivar" sumir da lista (a listagem não filtrava por status/deleted_at).
7. **Limpeza de duplicatas (no banco de prod, com OK do Marcelo):** 9 `teste` + `MArcelo` excluídos; 1 `teste` arquivado (não dava hard-delete: `ai_validation_events` é log imutável por trigger); 4 clones vazios excluídos; 2 clones com pagamentos (Angelica, Serginando) **mesclados** (pagamentos reatribuídos ao registro real, clone apagado). GOTCHA: deletar paciente com `ai_validation_events` falha (trigger de imutabilidade); só `hotmart_purchases` é FK NO ACTION, o resto cascateia.
8. **INFRA (importante):** links para o PACIENTE (confirmação de agendamento em `app/schedule/page.tsx`, intake, portal) são montados a partir do HOST da requisição. Em deploy de PREVIEW da Vercel, o link herda a URL de preview, que tem Vercel Authentication (login wall) → paciente cai em "Log in to Vercel". **Fluxo de paciente só funciona/testa em PRODUÇÃO** (axiel-core-6ikl.vercel.app). Blindagem futura possível: usar `NEXT_PUBLIC_APP_URL` em vez do host nos links de paciente.

## 🟢 Redesign da ficha — 3 itens (21/06/2026) — CÓDIGO PRONTO, na branch `feat/exam-ai-analysis` (PR #6)

> `tsc` 0; `verify:i18n` 42/0/0. Sem migration. Testado por Marcelo no preview.

1. **Excluir/refazer relatório (caso de IA)**: não dava pra apagar/refazer casos gerados. Novo `archiveAiInsight()` (UPDATE review_status='archived' — some das listas que já filtram archived; reversível, status já no CHECK) + `archiveAiInsightAction` + `DeleteInsightButton` (client, window.confirm) plugado no `ai-insight-review-card`. Combina com "New draft" pra refazer.
2. **Demografia no cabeçalho**: o card "Dados do paciente" saiu; demografia (sexo · peso · altura · cidade) vira linha compacta sob o nome (via `liveIdentificacaoPt`). Edição segue em /edit. `patient-demographics-panel.tsx` ficou órfão (inofensivo).
3. **Questionários consolidados (Opção A escolhida por Marcelo)**: apareciam em 3 lugares (timeline + "Formulários aplicados" + "Evolução"). Timeline (Jornada) = histórico; questionários viram UM bloco no acordeão "Questionários" (cada um: sub-itens/seções, %/cor, clicável p/ detalhe da última resposta, botão "+ Preencher"). `AssessmentProgress` ganhou `latest_response_id` (assessment-progress-service + patient-portal-service); `PatientAssessmentProgressPanel` reformado (título clicável, header com CTA, render sempre); removidos os 2 blocos duplicados em page.tsx.

4. **"Fila de espera" vira ícone** (WaitlistButton 30x30, âmbar quando ativo, X vermelho no hover p/ remover) + **"Avaliação" acima do "Resumo do caso"** (reorder em page.tsx). Itens 6 e 8 do backlog.
5. **"Acompanhamento do tratamento"** (agregador, novo `patient-treatment-followup-panel.tsx`, sob o Resumo do caso): lista as **notas por sessão** (SOAP, cada uma clicável p/ `/schedule/[appointment_id]/session`, "+ Nota de sessão" → `/schedule/new?patient_id`) + **Evolução clínica como gráfico inline** (recharts, séries de questionários % no tempo de `getPatientEvolution`, menor=melhor) + link p/ `/evolution`. Resolve itens 7 e 9 (Resumo direciona; notas de sessão + evolução clínica unificadas num lugar). Decisões de Marcelo: nota amarrada a agendamento; sempre mostrar um gráfico.

REDESIGN DA FICHA: todos os itens do backlog FEITOS. Backlog restante = nenhum item de layout; ver memória do redesign.

## 🟢 Exames — Legenda Neuro ID na extração da IA (21/06/2026) — CÓDIGO PRONTO, na branch `feat/exam-ai-analysis` (PR #6)

> `tsc` 0; `verify:i18n` 42/0/0; `vitest run modules/neuro-id/__tests__/exam-legends.test.ts` 4/4. **Sem migration.** Não muda schema nem cálculo.

A IA que lê o PDF do exame (`services/exam-ai-service.ts`, OpenAI Vision `gpt-4.1-mini`) passava com prompt **genérico** → neurometria saía confusa e a biorressonância não entrava bem no Doc 1. Agora a extração injeta a **legenda do exame** por tipo, para leitura ancorada (verdadeira/verificável) na mesma interpretação da clínica.

- **`modules/neuro-id/exam-legends.ts`** (novo): `examLegendBlock(examType)` devolve o bloco de instrução por tipo.
  - **Neurometria**: 6 dimensões fixas (1 controle ansiedade/HPA; 2 HRV/cardio-cerebral; 3 fluxo/barorreflexo; 4 temperatura, faixa fixa **31,5–32,5 °C**; 5 SNA Tilt Test; 6 vias nervosas), regra de **agrupar achados por padrão** + citar valor medido + destacar 1 ponto positivo.
  - **Biorressonância**: escala %/OF-UF; extrair as **maiores emoções reais** e **relacioná-las a órgãos** (coração/pulmão/rim…), abrindo com "De acordo com a análise do exame, foi encontrado um perfil de…"; **proíbe** conteúdo esotérico/holístico (chakra/aura/Louise Hay/"energia-vibração-cura") — categoria "Wisdom teachings" EXCLUÍDA (fronteira fé/clínica, decisão de Marcelo).
  - `examType` desconhecido ('outro'/vazio) → sem legenda (prompt genérico).
- **`services/exam-ai-service.ts`**: monta `systemPrompt = SYSTEM_PROMPT + bloco da legenda` quando há legenda para o tipo. Resto do fluxo intacto (Vision PDF, ~120 palavras, temp 0.2, slice 1800).
- **Teste** `modules/neuro-id/__tests__/exam-legends.test.ts` (4 casos: dimensões+faixa; emoções+órgãos+frase canônica; proibição esotérica; tipo desconhecido = "").
- **Fonte das legendas** (destiladas dos manuais/relatórios, com campos `precisa_manual`): `../legendas_exames/legenda_neurometria.json` e `legenda_biorressonancia.json` (fora do repo, no diretório do projeto).
- **Pendência (OK)**: commit na branch + push + preview + Marcelo testa anexando um exame real. **MVP+ (não feito)**: preencher limiares `precisa_manual` lendo os manuais; promover legenda a config por clínica (hoje é asset de código, pois é específica de equipamento); RAG (pgvector) do manual completo como camada de profundidade.

## 🟢 Bio³ — 4 refinos visuais (19/06/2026) — CÓDIGO PRONTO, AGUARDA OK p/ deploy

> Brief `_BRIEF_BIO3_REFINOS.md`. `tsc` 0; `verify:i18n` 40/0/0. Sem migration. **Nenhuma mudança na lógica de cálculo.**

1. **Rótulos geral × eixo** (painel Bio³): topo usa `neuroId.indexCaption` ("Índice geral · todos os eixos · grau de disfunção (menor = melhor)"); cada um dos 3 cards ganha subtítulo `neuroId.cardSubtitle` ("disfunção do eixo"). (`indexLabel`/`goalLower` viraram legados, mantidos por paridade.)
2. **Relatório de Insight escaneável + demografia ao vivo**: `neuro-id-360-documents.tsx` agora renderiza Documento 1/2/3 em `<details>` recolhido (resumo no topo = título + síntese do review card). Demografia (Idade/Sexo/Peso/Altura/Local/Paciente) lida do **cadastro ao vivo** via novo `liveIdentificacaoPt(patient)` em `lib/patient-demographics.ts` (mapeia sexo→PT), passada por `ai-insight-panel` e pela ficha → `ai-insight-review-card` → `NeuroId360Documents` (prop `liveId`). Snapshot da IA é fallback; **Idade = "—" quando não há data de nascimento** (some o "0 ano"). Igual ao PDF (fonte única).
3. **Pirâmide com cores vivas**: `bands.ts` ganhou `colors.fillStrong` (tom saturado por banda); `NeuroPyramid` usa `fillStrong` + **borda = `colors.stroke`** (antes branca). Lógica por faixa intacta.
4. **Semáforo nos questionários** (`bandForDysfunction` sobre o % → verde/âmbar/vermelho na barra + valor, rótulo de texto mantido): `patient-assessment-progress-panel.tsx` (mini-barras da série), `app/patients/[id]/forms/[responseId]/page.tsx` (total + seções) e a lista de respostas em `app/patients/[id]/page.tsx`.

## 🟢 Bio³ — 5 fixes + redesign escaneável (19/06/2026) — CÓDIGO PRONTO, AGUARDA OK p/ deploy

> Brief `_BRIEF_BIO3_FIXES_UX.md`. `tsc` 0; `verify:i18n` 40/0/0. Testes: rodar `npm test` local (vitest não roda no sandbox). **Sem migration.** Nenhuma mudança na lógica de cálculo.

1. **Auto-gerar in-app**: `app/patients/[id]/forms/new/actions.ts` (submitFormAction) agora chama `autoUpsertNeuroIdDraft` após salvar — igual ao submit público. **Bug achado/corrigido**: `submitAssessmentResponse` (assessment-service) gravava `assessment_answers` em colunas inexistentes (`score`/`text_answer`) → preenchimento in-app estava quebrado; agora grava `section_id`/`value_number`/`value_text` (mesmas colunas do de-para/leitura).
2. **Decimais mantidos**: input do form de `step={1}` → `step="0.1"` (`inputMode=decimal`). Cálculo intacto (parseFloat). Hint de origem: import devolve `origins[code]="raw/max"` (ex.: "6/32") → exibido no campo como "normalizado de 6/32" (`neuroId.normalizedFrom`).
3. **Demografia no cadastro público**: `app/envio/[slug]` (intake-client + actions) captura nascimento/sexo/peso/altura → grava no insert (novo) e no update (preenche só o que falta, não sobrescreve terapeuta). Edição de perfil já tinha os campos. Idade via `ageFromDob`.
4. **Paste QRM/Q-SNA rebaixado**: bloco "Colar QRM/Q-SNA" virou `<details>` recolhido "Importar de documento externo (opcional)" no painel (`neuroId.segmentDetailsTitle/Hint`). Fase 2 (IA) segue ativa.
5. **Redesign escaneável da ficha**: painel Bio³ agora = pirâmide pequena (120px) + índice-herói + **3 cards de pilar** (% + cor da faixa + "comece aqui" no prioritário) + bloco **"Pontos de atenção"** (piores itens, barras coloridas, pior primeiro — via `getNeuroIdAttentionPoints(assessmentId)` lendo `patient_assessment_values`). Na página: **Plano + Suplementação** e **Questionários (Q-SNA · QRM + Evolução)** recolhidos em `<details>` (`patientProfile.accordion.*`). AI Insight/Documento 1 mantido como card-resumo (decisão Marcelo: escopo "Bio³ + 2 acordeões").

## 🔴 FIX Bio³ — "Importar respostas" não puxava nada (19/06/2026) — APLICADO no banco

> **Sintoma**: painel mostrava "Nenhuma resposta encontrada para importar." e a pirâmide não gerava, mesmo com questionários respondidos.
> **Causa-raiz**: em produção os pacientes respondem o **Q.R.M. — Questionário de Rastreamento Metabólico** (versão PT-BR do MSQ, seções em **português**: CABEÇA, MENTE, EMOÇÕES…), mas o de-para (`neuro_id_question_map`) só tinha linhas para template **"MSQ"** com seções em **inglês** (HEAD, MIND…). Nenhum template casava → draft vazio. Além disso `ensureClinicQuestionMap` **não re-semeia** clínica já semeada, então editar só o default não bastava.
> **Fix (2 partes)**:
> 1. `modules/neuro-id/question-map.ts`: +14 linhas Q.R.M. (`template_match: "Rastreamento Metab"`, `section_match` em PT) → mesmos codes `msq_*`. (Q.R.M. não tem seção PESO → `msq_weight` fica pendente.) PHQ-9/GAD-7/HPA já casavam pelo nome. **+5 linhas Q-SNA** (`template_match: "Q-SNA"`): total → `qsna_total` (Bioquímico, carga autonômica geral); `SONO`→`qsna_sono`, `EMOCIONAL`→`qsna_emocional`, `GASTROINTESTINAL`→`qsna_gi_visceral`, `NEUROCOGNITIVA`→`qsna_neurocognitiva` (Bioemocional). Codes já existiam no catálogo. As 5 seções Q-SNA sem code próprio (cardiovascular/respiratória/inflamatória/endócrino/envelhecimento) entram via o total.
> 2. **Backfill no banco** (clínica `98e98ef3…`): `INSERT` das mesmas 14 (Q.R.M.) + 5 (Q-SNA) linhas em `neuro_id_question_map` (aditivo, reversível via `active=false`). Tabela: 22→**41** linhas ativas.
> **Validação**: simulação SQL por seção bateu (Q.R.M.: CABEÇA 3.8, EMOÇÕES 3.1; Q-SNA: TOTAL 0.8, EMOCIONAL 3.0, SONO 1.0); `tsc` 0; `verify:i18n` 40/0/0; testes do de-para inalterados. **Commit `4bc0659`** feito local (main 1 à frente de origin) — **push pendente** (sandbox sem acesso ao GitHub; Marcelo dá `git push origin main` na máquina dele → Vercel deploya). O backfill já vale para o app atual independ, do deploy.

## 🟡 Mapa Bio³ — Auto-gerar ao responder questionário (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

## 🟡 Mapa Bio³ — Auto-gerar ao responder questionário (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

> ⚠️ Nada deployado (aguarda OK). `tsc` 0; verify:i18n 40. **Sem migration** (`auto_draft` é valor de `status`, texto; tabelas da 091). Brief: `_BRIEF_BIO3_AUTOGEN.md`. (A demografia, brief `_BRIEF_FIX_DEMOGRAFIA.md`, já foi feita e deployada — commit `008e9ce`.)

- **Gatilho pós-submit**: `app/api/forms/submit/route.ts` (submit público do paciente, admin client) chama `autoUpsertNeuroIdDraft(patient_id, clinic_id, supabase)` em try/catch (fire-and-forget — não derruba o submit).
- **`autoUpsertNeuroIdDraft` (novo em `neuro-id-service.ts`)**: roda `importQuestionnaireAnswers`; se draft vazio (template não mapeado) → **não gera, sem erro**. Senão computa e faz **upsert de UM `patient_assessment` `status='auto_draft'`** por paciente (idempotente: reaproveita o aberto, recria valores/scores) + grava `patient_neuro_id_scores` com **`is_partial=true`** (falta o Biomecânico/exame físico). Valores marcados `auto:<n>`.
- **Refactor**: `getNeuroIdCatalog`/`ensureClinicCatalog`/`ensureClinicQuestionMap`/`importQuestionnaireAnswers`/`getLatestNeuroIdMap` aceitam **client opcional** (helper `getDb`) — funcionam com server (sessão) ou admin (gatilho público).
- **Idempotência/finalização**: `createNeuroIdAssessment` (ao criar uma final) **consome** os `auto_draft` abertos do paciente (status→final). Depois disso, nova resposta abre um novo rascunho (evolução).
- **Painel**: `getLatestNeuroIdMap` agora traz `status` (join `patient_assessments`). Quando `auto_draft` → **banner** "Mapa parcial — complete o exame físico (Biomecânico)" + botão **"Revisar e completar"** (abre o form e roda `handleImport` para pré-preencher; terapeuta adiciona o Biomecânico → Calcular → final, is_partial=false). i18n `neuroId.autoDraftBanner/reviewComplete`.
- **Guarda-corpos**: auto_draft sempre `is_partial=true` (nunca final sem revisão humana); RLS por clinic_id; gatilho só mexe no Mapa.
- **Pendência (OK)**: commit/push + deploy. Sem migration.

## 🟡 Demografia do paciente — fonte única + legenda Bio³ (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

> ⚠️ Nada em prod / sem deploy (aguarda OK). `tsc` 0; verify:i18n 40. Brief: `_BRIEF_FIX_DEMOGRAFIA.md`. Fix do bug "Idade/Sexo/Peso/Altura/Local = não informado".

- **Migration `094_patient_demographics.sql` (arquivo, NÃO aplicada)**: `patients` += `sex text`, `weight_kg numeric`, `height_cm numeric` (date_of_birth/city já existiam; RLS já vale). Idade NUNCA armazenada.
- **`lib/patient-demographics.ts`** (novo): `ageFromDob(dob)` (idade derivada em runtime) + `patientIdentificacao(patient)` → {paciente, idade ("N anos"), sexo, peso ("N kg"), altura ("N cm"), local ("cidade / UF")}; null quando vazio. Teste `lib/__tests__/patient-demographics.test.ts`.
- **Tipos/serviço**: `Patient` += sex/weight_kg/height_cm; `updatePatient`/`createPatient` aceitam.
- **UI fonte única**: form de edição do paciente edita **DOB/sexo/peso/altura/cidade** (um lugar). Self-register (`/cadastro`) também captura sexo/peso/altura e faz **upsert no patients** (sem cópia paralela) — i18n `publicRegister.sex/weight/height`.
- **Geradores leem do cadastro** (regenerar relê): `insight-pdf-service` (`buildNeuroId360Pdf` ganhou `demographics?`; `identificacaoBlock` dá prioridade ao cadastro sobre o que a IA ecoou) — rotas do 360 e o `ai-insight-service` passam `patientIdentificacao(patient)`. Snapshot do AI insight ganhou age/sex/weight/height/city. Bio³ clínico (`buildNeuroIdMapPdf`) mostra linha de demografia. "Não informado" só quando realmente vazio.
- **Legenda Bio³**: `band()` "possíveis crises agudas" → "**pede cuidado prioritário**" (alinha com o Beat 6 suavizado). Demais legendas já estavam sem "crises agudas".
- **Pendência (OK)**: aplicar migration 094 + commit/push + deploy.

## 🟡 Mapa Bio³ — Relatório do paciente persuasivo-ético (7 beats) (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

> ⚠️ Nada em prod / sem deploy (aguarda OK). `tsc` 0; verify:i18n 40. **Sem migration** (só código). Briefs: `_BRIEF_BIO3_RELATORIO_PERSUASIVO.md` + copy aprovada `_COPY_BIO3_RELATORIO.md` (Aval/Termo 18/06).

- **`modules/neuro-id/report-copy.ts`** (novo): copy dos **7 beats** ("Eu te ouvi" → "Seu próximo passo"), variando por **faixa** (solto/tenso/bloqueado = 0–30/31–69/70–100) e **pilar prioritário**, com placeholders `{nome}{indice}{pilar}{hint}{q1}{q2}{sintoma}`. `buildPatientReportCopy()`, `copyBandForDysfunction()`. `PROHIBITED_TERMS` + `findProhibited()` (match por palavra inteira — não pega "procure"). Beat 1 tem variante honesta quando não há queixa (não inventa). Disclaimer obrigatório + salvaguarda de saúde mental (CVV 188) quando Bioemocional alto (≥70) ou PHQ-9 sinalizar.
- **PDF**: `buildNeuroIdPatientReportPdf()` (versão PACIENTE persuasiva, 7 beats, reusa pirâmide/bandas/índice) adicionada ao `neuro-id-pdf-service.ts`. A `buildNeuroIdMapPdf()` vira a versão **clínica interna** (preservada). Rota `/api/patients/[id]/neuro-id/pdf` serve **paciente por padrão**; `?view=clinical` = técnica interna. {q1}/{sintoma} = `patients.chief_complaint` (fallback gracioso).
- **Não recalcula scores** — só consome `patient_neuro_id_scores` + queixa do paciente.
- **Testes** `report-copy.test.ts`: variação por faixa/pilar, sem placeholders soltos, **zero termos proibidos** em toda combinação, salvaguarda condicional, cita queixa real, fallback honesto. `npm test` local.
- **Pendência (OK)**: commit/push + deploy. Sem migration.

## 🟡 Mapa Bio³ §8 — Questionários alimentam os pilares (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

> ⚠️ Nada em prod / sem deploy (aguarda OK). `tsc` 0; verify:i18n 40. Brief: `_BRIEF_BIO3_QUESTIONARIOS.md`.

MVP do §8: respostas de questionários validados (MSQ/PHQ-9/GAD-7/HPA) preenchem os itens dos 3 pilares automaticamente, com revisão humana antes de calcular.

- **Codes novos no catálogo** (`catalog.ts`, todos `higher_worse`, `band_type` symptom, flag `auto`): 15 `msq_*` + `phq9_depressao` + `gad7_ansiedade` + `hpa_cortisol_baixo/alto` + `hpa_adrenal`. Itens `auto` NÃO aparecem no form manual vazio (só quando importados).
- **Migration `093_neuro_id_question_map.sql` (arquivo, NÃO aplicada)**: de-para por clínica. **Decisão de eng.**: mapeia por TEMPLATE+SEÇÃO (MSQ 15 sistemas; HPA 3 seções) ou TOTAL (PHQ-9/GAD-7), via substring de nome/título — robusto e sem UUID por clínica (o brief sugeria question_id, mas o MSQ pontua por seção).
- **`modules/neuro-id/question-map.ts`**: `DEFAULT_QUESTION_MAP` (de-para §3 — MIND/EMOTIONS/HEAD/HEART/LUNGS/DIGESTIVE→emocional; JOINTS→biomecânico; EYES/EARS/NOSE/MOUTH/SKIN/ENERGY/WEIGHT/OTHER→bioquímico; PHQ-9/GAD-7 total→emocional; HPA cortisol→emocional, adrenal→bioquímico) + `normalizeToDysfunction10(raw,max)`.
- **Service** (`neuro-id-service.ts`): `ensureClinicQuestionMap` (seed default), `importQuestionnaireAnswers(patientId, clinicId)` — lê respostas (computa soma por seção/total de `assessment_answers`), normaliza 0–10, devolve **rascunho `auto`** + `sources` + `missing` (pendentes) + **alerta PHQ-9 item 9** (ideação, order_index 8 > 0). NÃO grava (revisão humana → `createNeuroIdAssessment`).
- **Painel**: botão **Importar respostas** → pré-preenche o form (badge "auto (questionário)") → revisão → **Calcular**. Itens sem resposta = pendente. Alerta PHQ-9 destacado (vermelho), não silenciado.
- **Testes** `question-map.test.ts` (normalização + cobertura dos 3 pilares + codes existem). `npm test` local.
- **Pendências (OK)**: aplicar migrations **093** (+ 092 já aplicada) e deploy. Catálogo prod vazio → re-semeia com os codes novos (incl. `auto`) na 1ª avaliação. **MVP+ (não feito)**: IA sugere de-para de template novo; suporte a intake.

## 🟡 Mapa Bio³ — Revisão: display DISFUNÇÃO + ordem fixa + contribuição (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

> ⚠️ Nada em prod / sem deploy (aguarda OK). `tsc` 0 erros; verify:i18n 40 namespaces. Só mudança de display/lógica — **sem migration nova** (scores já são disfunção; catálogo §2 inalterado).
> Briefs atualizados: `_BRIEF_BIO3_AJUSTE_PILARES.md` §1.5 + `_BRIEF_BIO3_VISUAL.md`.

- **DISPLAY trocado de equilíbrio → GRAU DE DISFUNÇÃO** (maior = pior; meta = baixar). `toEquilibrium` deixou de ser usado na UI/PDF (mantido no módulo). Painel e PDF mostram o número de disfunção direto.
- **Faixas (bands.ts) ajustadas**: 0–30 solto/verde · 31–69 tenso/âmbar · 70–100 bloqueado/vermelho (eram 35/65). Cor = faixa ABSOLUTA do número.
- **Ordem fixa da pirâmide** (base→topo): Bioemocional (origem) / Bioquímico (ponte) / Biomecânico (consequência) — antes era o inverso.
- **Índice = número-herói**: grande (40–48px), "Índice Bio · grau de disfunção" + banda + "meta: baixar". Prioridade = pilar de MAIOR disfunção ("Comece aqui").
- **Contribuição relativa** por pilar (soma 100%): `pillarContributions()` em `scoring.ts` + exibida no painel/PDF (mede por onde começar).
- **Legenda** das 3 faixas (0–30 / 31–69 / 70–100) na tela e no PDF.
- Testes `scoring.test.ts` atualizados (limites 30/31/69/70 + contribuição). ⚠️ rodar `npm test` local.
- **FASE 2 (IA segmentadora) inalterada** — segue funcionando (QRM/Q-SNA → rascunho → revisão → motor; qsna_total peso 0.5).
- **Pendência (OK)**: commit/push + deploy. Catálogo já está vazio em prod (092 aplicada antes) → re-semeia codes §2 na 1ª avaliação pós-deploy.

## 🟡 Mapa Bio³ — Ajuste de pilares + escala unificada + semáforo + IA segmentadora (18/06/2026) — CÓDIGO PRONTO, AGUARDA OK

> ⚠️ **Nada aplicado em produção / sem deploy** (Marcelo pediu OK). `tsc` 0 erros; verify:i18n 40 namespaces.
> Briefs: `_BRIEF_BIO3_AJUSTE_PILARES.md` + `_BRIEF_BIO3_VISUAL.md`.

**FASE 1 (determinística):**
- **Escala unificada**: TUDO 0–10 `higher_worse` (disfuncao = valor×10; sem inversão). Faixas por tipo: mobilidade solto/tenso/bloqueado · dor leve/mod/intensa · QRM/Q-SNA/sintomas baixo/mod/alto.
- **`modules/neuro-id/catalog.ts` remapeado (§2)**: TODA mobilidade/palpação → Biomecânico (codes `restr_*`); QRM e Q-SNA **segmentados** em sub-scores roteados (qrm_musculo_articular→biomecânico; qrm_total/qsna_total→bioquímico; qrm_coracao/pulmao/trato_digestivo/mente/emocoes + qsna_sono/emocional/gi_visceral/neurocognitiva→bioemocional). `qsna_total` peso **0.5** (overlap §4). `band_type` por item; `CATALOG_BY_CODE`.
- **`modules/neuro-id/bands.ts` (semáforo)**: `bandForDysfunction`/`bandForItem` (≤35 solto · 36–65 tenso · ≥66 bloqueado) + cores (verde-sálvia/âmbar/terracota) + ícone + `labelFor(itemType)`. Aplicado na pirâmide, índice, eixos e PDF — **sempre cor + rótulo + ícone** (acessível) + legenda. i18n `neuroId.band.*`.
- **Testes** `scoring.test.ts` reescritos (novos codes, peso 0.5, bandas). ⚠️ vitest não roda no sandbox — **rodar `npm test` local**.
- **Form**: agrupado pelos 3 pilares corrigidos, input 0–10 + faixa ao vivo, sem ↑melhor/↑pior; exames = select (lab).

**FASE 2 (IA segmentadora):**
- `modules/neuro-id/segment-instruments.ts` (prompt + `coerceSegmentDraft`, mapas domínio→code) + `segmentInstruments()` em `neuro-id-service.ts` (OpenAI `gpt-4.1-mini`, json_object, temp 0). Action `segmentInstrumentsAction`.
- UI no painel: colar **QRM/Q-SNA** → "Extrair com IA" → preenche o form (rascunho 0–10) → terapeuta **revisa/edita** → **Calcular** (motor determinístico grava). Guarda-corpo: IA só extrai do texto, não inventa; item não extraído = pendente (CTA).

**Pendências (aguardando OK):**
- **Migration `092_neuro_id_catalog_reseed.sql` (arquivo, NÃO aplicada)**: apaga o catálogo Neuro ID antigo (codes mudaram) p/ `ensureClinicCatalog` re-semear os novos. Sem isso, em prod o catálogo fica com codes velhos.
- Aplicar 092 + deploy Vercel (com seu OK). `/code-review --fix` é comando do Claude Code (indisponível no Cowork — revisão feita manualmente).

## 🟡 Mapa Bio³ / Índice Neuro ID — MVP (brief `_BRIEF_MAPA_NEURO_ID.md`) (16/06/2026) — NÃO APLICADO EM PROD

> ⚠️ **Migration 091 NÃO foi aplicada em produção** (Marcelo pediu OK antes de qualquer deploy).
> Código pronto e validado (tsc/i18n); aguardando OK para aplicar a migration.

3 eixos: **fisico** (Biomecânico), **bioquimico** (Bioquímico), **emocional** (Bioemocional),
conectados pelo SNA. Motor calcula **disfunção 0–100**; display = **equilíbrio (100 − disfunção)**;
menor equilíbrio = prioridade.

- **Migration `091_neuro_id_map.sql` (arquivo, NÃO aplicada)**: `assessment_items_catalog`
  (item→pilar, direção, input_type, scoring_rule jsonb, weight; unique clinic_id+code),
  `patient_assessments`, `patient_assessment_values`, `patient_neuro_id_scores`. RLS por
  clinic_id; values/scores herdam via assessment_id (EXISTS no parent).
- **Motor (puro)** `modules/neuro-id/`: `catalog.ts` (DEFAULT_CATALOG = mapa da seção 3, direção/pesos),
  `scoring.ts` (`scoreItem` por input_type, `computeNeuroId` → pilares/índice/prioridade, trata
  dado faltando = parcial + CTA, `toEquilibrium`), `__tests__/scoring.test.ts` (unit, roda no CI).
- **Service** `services/neuro-id-service.ts`: `ensureClinicCatalog` (seed default por clínica),
  `getNeuroIdCatalog`, `getLatestNeuroIdMap`, `createNeuroIdAssessment` (computa + grava values+scores).
- **UI**: `components/patient-neuro-id-panel.tsx` (mapa em **equilíbrio**: índice geral + 3 eixos +
  prioridade + parcial/CTA; formulário de avaliação por item) na ficha (após case summary/indicação).
  Action `app/patients/[id]/neuro-id/actions.ts` (parse `item__<code>` + posse do paciente).
- **PDF herói** `services/neuro-id-pdf-service.ts` (timbrado, 3 págs: pirâmide/índice/atenção →
  leitura por eixo → plano amarrado aos eixos + disclaimer) + rota `app/api/patients/[id]/neuro-id/pdf`.
- **i18n** namespace novo **`neuroId`** (40 namespaces) + registrado em `i18n/request.ts`.
- Validado: tsc **0 erros**; verify:i18n **40 namespaces, paridade OK**.
- **Pendências (aguardando OK)**: aplicar migration 091 em prod; rodar `/code-review --fix`
  (comando do Claude Code, indisponível no Cowork — revisão feita manualmente); deploy Vercel.
- **MVP+ (não feito)**: relatório de evolução antes/depois; parse automático de labs; pesos por clínica.

## ✅ Quick Wins da Jornada (brief `_BRIEF_QUICKWINS.md`) — #3 e #4 (16/06/2026)

Os 4 quick wins: **#1 (valor do plano)** e **#2 (view financeira por paciente)** já tinham sido
feitos (migrations 087 e 086). Nesta sessão, **#3** (completado) e **#4**:

- **#3 — Etapa unificada na LISTA de pacientes**: a derivação (`derivePatientJourneyStage`) já
  existia na ficha; agora a **lista** (`app/patients/page.tsx` + `patients-client.tsx`) deriva a
  etapa por paciente **sem N+1** (agrupa os `appointments` já carregados + 1 query
  `getActivePlanPatientIds(clinicId)`), mostra **badge** por linha e tem **filtro por etapa**
  (dropdown). i18n `patients.list.allStages` + reusa `patientPanels.intelligenceStrip.journey.stage`.
- **#4 — Indicação paciente→paciente**: migration **`090_patient_referral.sql` APLICADA**
  (`patients.referred_by_patient_id` → patients, on delete set null, indexada). `Patient` type +
  `updatePatient` aceitam o campo. `getClinicPatientsForPicker` (seletor) e `getPatientReferralInfo`
  (quem indicou + quantos/quais trouxe) no patient-service. Form de **edição** ganhou select
  "Indicado por"; **ficha** mostra "Indicado por X" + "Indicou N pacientes (nomes)".
  i18n `patientProfile.referral`. Fixtures de teste (action-rules, ai-placeholder) atualizados.
- Validado: tsc confiável **0 erros**; verify:i18n **39 namespaces, paridade OK**.
- **Pendência operacional**: deploy dos `.ts` na Vercel (087/086/088/089/090 já em produção).

## ✅ Feature de Suplementos — MVP (brief `_BRIEF_SUPLEMENTOS.md`) (16/06/2026)

Módulo multi-tenant: catálogo por clínica + recomendação manual por paciente → saída
**fórmula BR** / **links US** → seção Doc 3 do relatório Neuro ID 360. **Corte MVP** (sem IA;
a sugestão por IA é MVP+). Reaproveita treatment_plans, relatório 360 e branding.

- **Migrations `088_supplements.sql` + `089_supplements_fk_indexes.sql` APLICADAS**:
  `supplement_catalog` (catálogo por clínica: source manipulacao_br/dfh/pure_encapsulations/
  fullscript/outro, country BR/US, buy_url, default_dosage, form…), `patient_supplement_recommendations`
  (status draft→reviewed→approved→sent, output_type br_formula/us_link, source_of_suggestion,
  report_id→ai_insights, approved_at/reviewed_by), `patient_supplement_recommendation_items`
  (itens livres ou do catálogo). **RLS por clinic_id** (can_access_clinic/can_write_clinic_data);
  **itens herdam via EXISTS no parent** (recommendation_id). Policies verificadas (12 no total).
- **`services/supplement-service.ts`**: CRUD do catálogo; CRUD recomendação + itens;
  `approveSupplementRecommendation` (gate humano — carimba approved/reviewed_by/approved_at);
  `getApprovedSupplementRecommendation` (usada no relatório 360).
- **Settings**: `/settings/supplements` (page + actions + `supplement-catalog-form.tsx`),
  guard owner/manager/admin; card no hub (`settings.hub.items.supplements`). US exige buy_url; BR não.
- **Ficha do paciente**: `components/patient-supplements-panel.tsx` — criar recomendação (BR/US),
  adicionar itens (livre ou puxando do catálogo), **aprovar** (gate), e **saída** inline
  (fórmula BR timbrada-preview / lista de links US). **Disclaimer de compliance sempre visível**
  ("Uso profissional. Não substitui avaliação/medicação. Não trata nem cura."). Plugado em
  `app/patients/[id]/page.tsx` após o painel de prescrições.
- **Relatório Neuro ID 360 (Doc 3)**: `buildNeuroId360Pdf` ganhou `approvedSupplement?`;
  **decisão de produto: a recomendação manual aprovada SUBSTITUI o protocolo da IA** no Doc 3
  (quando existir; senão mantém a IA). A rota `reports/clinical-insight/pdf` carrega
  `getApprovedSupplementRecommendation` e passa ao gerador.
- **IA = MVP+ (NÃO neste corte)**: nada de auto-sugestão/auto-aprovação. O fluxo manual já tem
  o gate de aprovação humana; nada vai ao paciente sem `status=approved`.
- Validado: tsc confiável **0 erros**; verify:i18n **39 namespaces, paridade OK**; RLS conferida;
  FKs indexadas. **Pendência operacional**: deploy dos `.ts` na Vercel (088/089 já em produção).
  **Antes do commit**: rodar `/code-review --fix` (comando do Claude Code).

## ✅ Jornada do Paciente — Etapas 1, 3 e 4 (extensão, sem duplicar) (16/06/2026)

Auditoria da "jornada do cliente" (relatório em `AUDITORIA_JORNADA_PACIENTE_2026-06-16.md`):
~70% já existia, espalhado. Decisão: **estender o que há, não criar 5 tabelas novas**. As
etapas implementadas hoje reaproveitam dados já carregados na ficha (zero query extra onde
possível) e a jornada é sempre **derivada**, nunca digitada (preserva a fluidez).

- **Etapa 1 — Etapa clínica derivada**: `modules/patient-journey/stage.ts` (novo) →
  `derivePatientJourneyStage()` (função pura): deriva etapa (novo → avaliação agendada →
  avaliado → plano sugerido → em tratamento → reavaliação → manutenção → inativo → reativação)
  + próxima melhor ação, a partir de `appointments`, `treatment_plans.status`, `churnRisk`
  (do `patient-intelligence-service`) e status do paciente/pacote/assinatura. Exibida no
  `components/patient-intelligence-strip.tsx` (prop opcional `journey`, chip + próxima ação).
  Ligada em `app/patients/[id]/page.tsx` com dados já em memória. i18n `patientPanels.intelligenceStrip.journey`.
  ⚠️ Já existia `modules/patient-journey/` (snapshot-builder, master-flow com catálogo de
  stages, timeline) — **não foi duplicado**; `stage.ts` complementa derivando a etapa atual.
- **Etapa 3 — Financeiro por paciente (VIEW, sem tabela mantida)**: migration
  **`086_patient_financials_view.sql` APLICADA**. View `patient_financials` com
  `security_invoker=on` (RLS de clínica das tabelas-base aplica; `anon` sem SELECT,
  `authenticated` com SELECT → sem alerta `security_definer_view`). Agrega de
  `patient_payments` (status='paid') + `patient_offers`: receita, nº pagamentos, ticket médio,
  LTV, 1º/último pagamento, pendente, estornado, planos ofertados/aceitos. Reconciliação
  exata com a soma crua. Service `getPatientFinancials(patientId, clinicId)` + tipo
  `PatientFinancials` em `finance-service.ts`.
  - **Painel** `components/patient-financials-panel.tsx` na ficha, **gateado por gestor**
    (`isManager(profile.role)`): o dado só é buscado e o painel só renderiza para gestores
    (a view é visível a qualquer membro da clínica via RLS — a restrição "só gestor vê
    financeiro" é da CAMADA DE APP, então qualquer surfacing precisa do guard). Moeda via
    `useFormatMoney`. i18n `patientPanels.financials`.
- **Etapa 4 — Valor do plano de cuidado**: migration **`087_treatment_plan_value.sql`
  APLICADA** (`treatment_plans.plan_value_cents`, opcional, moeda da clínica). `TreatmentPlan`
  type + `createTreatmentPlan` + action `createTreatmentPlanAction` (parse "300"/"300,50" →
  centavos) + campo no form e exibição no card (`patient-treatment-plan-panel.tsx`, via
  `useFormatMoney`). i18n `patientPanels.treatmentPlan.createForm.value`.
- Validado: tsc confiável **0 erros**; verify:i18n **39 namespaces, paridade OK**; views/colunas
  verificadas no banco; advisor de segurança sem alerta novo.
- **Pendente da jornada (plano)**: Etapa 5 — indicação **paciente→paciente** (única tabela
  nova de fato; o `referral_conversions`/`referral-service` atual é clínica→clínica).
  **Pendência operacional**: deploy dos `.ts` na Vercel (migrations 086/087 já em produção).

## ✅ Relatórios Neuro ID 360 — padrão único + entrega ao paciente (16/06/2026)

**Envio ao paciente (e-mail + WhatsApp) após aprovação:**
- `approveAiInsightAsFinal` faz UPDATE em `ai_insights` via client do usuário. Faltava **policy de UPDATE** → migration **084_ai_insights_update_policy** (`can_write_clinic_data`). Sem ela, o aprovar dava "Unknown error" (PGRST116, 0 linhas).
- `sendApprovedInsightToPatient` agora retorna `InsightDeliveryResult` por canal (`sent|skipped_no_contact|failed|no_report` + erros), grava auditoria `ai_insight.report_sent`, e a action **aguarda** o resultado e mostra banner na tela de insights. Botão **"Reenviar ao paciente"** no painel (desabilita sem contato).
- E-mail via Resend: `sendSimpleEmail` agora **propaga o erro real** do SDK (antes engolia) e suporta `attachments`. Exige `RESEND_API_KEY` válida + `RESEND_FROM_EMAIL` com domínio verificado (o padrão `onboarding@resend.dev` só entrega ao dono da conta).
- WhatsApp via Twilio: envia o **PDF como mídia** (`sendWhatsAppMedia`) + texto. Limite de 1600 chars resolvido enviando o PDF, não texto. Sandbox exige `join` do número destino; `TWILIO_FROM_NUMBER=whatsapp:+14155238886`.

**Padrão visual + estrutura ÚNICOS para todos os relatórios:**
- `services/insight-pdf-service.ts` `buildNeuroId360Pdf({output, patientName, clinic})`: logo da clínica (de `clinics.logo_url`), barra superior em gradiente, fonte **serifada (Times)** justificada, título/subtítulo, tabela de Identificação, cabeçalhos de seção, **rodapé com tagline em todas as páginas** (configurável: migration **085 `clinics.report_tagline`**). PDF sobe no bucket `patient-docs` (URL assinada 7d) p/ anexo.
- Estrutura nova (espelha os modelos oficiais Carla Bueno): **Doc 1 — Relatório Funcional Integrado** (`mapa_integrativo`: identificacao, exames_avaliados, resultados_encontrados[{titulo,descricao}], sintese_clinico_funcional, conclusao_funcional, fase_jornada, observacao). **Doc 2 — Plano Integrativo Neuro ID** (`plano_regulacao`: identificacao, fase_jornada_nome/justificativa, direcao_terapeutica, plano_inicial[{titulo,descricao}] numerado, acompanhamento_evolucao, proximo_passo). **Doc 3 — Protocolo de Suplementação** (inalterado, exige aprovação). Campos antigos mantidos opcionais (fallback).
- `insight-schema.ts` (shape+coerce), `guardrails.ts` (prompt com tom "na prática", não-diagnóstico), `neuro-id-360-documents.tsx` (tela) e a rota `reports/clinical-insight/pdf` agora usam o **mesmo** gerador/estrutura.
- Validado: tsc **0 erros**; verify:i18n **39 namespaces OK**; PDF gera (`%PDF-`).
- ⚠️ Insights antigos usam campos antigos → PDF cai no fallback. Para ver o padrão novo, **gerar novo draft** e aprovar.

---

## ✅ Neuro ID 360 — Fase 1: Exames funcionais (15/06/2026)

Plano completo em `NEURO_ID_360_PLANO.md` (4 fases). Fase 1 concluída:
- **Migration `080_patient_functional_exams.sql` APLICADA**: tabela `patient_functional_exams` (clinic_id, patient_id, exam_type [neurometria|biorressonancia|outro], title, summary, findings jsonb, exam_date, created_by) + índices + RLS (can_access_clinic/can_write_clinic_data, espelhando patient_exams).
- `services/functional-exams-service.ts` (get/create/delete + tipo `PatientFunctionalExam`); `app/patients/[id]/functional-exams/actions.ts`.
- `components/patient-functional-exams-panel.tsx` (lista + form: tipo/data/título/achados) na ficha (`/patients/[id]`, após o card de exames laboratoriais). i18n `patientPanels.functionalExams` (PT/EN).
- Validado: tsc **0 erros**; verify:i18n **39 namespaces, paridade OK**.

### ✅ Fase 2 — Motor da IA: 3 documentos (15/06/2026)
- ⚠️ **Refinamento do usuário**: são **TRÊS** documentos — suplementação virou doc separado (exige aprovação humana).
- `lib/types`: `AiInsightOutput` ganhou (opcionais, compat) `mapa_integrativo` (NeuroMapaIntegrativo), `plano_regulacao` (NeuroPlanoRegulacao, **sem** suplementação) e `protocolo_suplementacao` (NeuroProtocoloSuplementacao: itens[{nome,objetivo,dose_sugerida,observacao}] + observacoes_gerais).
- `modules/ai-insights/insight-schema.ts`: shape + coerção dos 3 documentos. `guardrails.ts`: prompt reescrito (pt-BR) para gerar os 3 docs como **rascunho para revisão/aprovação profissional** (não diagnóstico, não prescrição definitiva); suplementação como doc 3 que exige aprovação humana explícita.
- `services/ai-insight-service.ts`: `AiInsightInputSnapshot` + `buildAiInsightInput` agora alimentam a IA com **questionários (assessments), exames laboratoriais, exames funcionais e prescrições** (além de intake/sessões/histórico).
- Compatível: telas/PDF antigos seguem lendo `structured_summary` (Fase 3 renderiza os 3 docs).
- Validado: tsc **0 erros**.

### ✅ Fase 4 — Envio dos documentos na aprovação (15/06/2026) — NEURO ID 360 COMPLETO
- `sendApprovedInsightToPatient` reescrito: `formatApprovedReport(out)` monta os 3 documentos (Mapa + Plano + Protocolo de Suplementação) em HTML + texto (fallback no resumo para insights antigos); envia por e-mail + WhatsApp. Como o envio só ocorre após APROVAÇÃO do profissional, a suplementação já passou por aprovação humana. Checkbox no card de revisão controla o envio (default ligado).
- **Neuro ID 360 (Fases 1–4) COMPLETO**. Pendência operacional: deploy dos `.ts` na Vercel.
- **Unificação (15/06)**: o antigo "Agente de Saúde" (HealthAgentPanel + `/api/health-agent`) foi aposentado da UI. `app/patients/[id]/health-agent/page.tsx` agora **redireciona** para `/patients/[id]/insights`; o `HealthAgentPanel` foi removido da ficha. Há **um só caminho**: AI Insights (gerar → revisar os 3 documentos via `AiInsightReviewCard` → aprovar → enviar). `health-agent-panel.tsx` e as rotas `/api/health-agent*` ficaram órfãos (inofensivos).
- Validado: tsc **0 erros**; verify:i18n 39 namespaces OK.

### ✅ Fase 3 — Telas + PDF dos 3 documentos (15/06/2026)
- `components/neuro-id-360-documents.tsx` (apresentacional, server-compat): renderiza Mapa Integrativo, Plano de Regulação e Protocolo de Suplementação (este em âmbar, com aviso "exige aprovação") quando presentes no `AiInsightOutput`.
- Usado no `ai-insight-review-card.tsx` (o profissional vê os 3 docs antes de aprovar).
- PDF (`app/patients/[id]/reports/clinical-insight/pdf/route.ts`): anexa os 3 documentos (1 página cada) do insight final/último, via `getLatestFinalAiInsight`/`getLatestAiInsight`.
- Validado: tsc **0 erros**.

## ✅ Questionários: domínio correto, encadeamento, toggle PT/EN (15/06/2026)

- **🐞 Link caía no app errado (login)**: os links de questionário eram montados com `NEXT_PUBLIC_APP_URL`, que no projeto Core na Vercel aponta para o **AXIEL Growth** (`growth.vercel.app`) → o paciente caía no login do Growth. `/f/[token]` no Core é público e abre direto (confirmado por fetch). Correção no código: `sendAssessmentsToPatient`/`sendOnboardingAssessments` aceitam `baseUrl`; a confirm action passa o **host da requisição**; a tela de confirmação usa link **relativo** (`/f/...`). ⚠️ **AÇÃO OPERACIONAL**: corrigir `NEXT_PUBLIC_APP_URL` do projeto Core na Vercel para o domínio do Core (senão os links de **WhatsApp/e-mail** e o cron de reavaliação continuam apontando errado).
- **Encadeamento Q1→Q2→fim (sem login)**: `/f/[token]?chain=t2,t3` — ao enviar um questionário, avança automático para o próximo; o último finaliza. A tela de confirmação abre **um botão** que percorre todos. `public-assessment-form` ganhou prop `chain`; botão vira "Salvar e continuar" (`publicForm.next`).
- **Toggle PT/EN** (`LanguageSwitcher`, que já funciona anônimo via cookie) nas 3 páginas públicas: `/cadastro/[slug]`, `/confirmar/[token]`, `/f/[token]`. Resolve a mistura de idiomas (antes o idioma vinha só do navegador).
- ⚠️ **Nuance pendente**: o *conteúdo* dos questionários é por template (Q-SNA/Q.R.M. são PT). Paciente EN com UI EN ainda recebe o questionário PT. Parear versão EN dos templates por idioma = feature separada.
- Validado: tsc **0 erros**; verify:i18n **39 namespaces, paridade OK**.

## ✅ Agenda — UX: excluir, arraste 30min, grade alinhada (15/06/2026)

- **Excluir pela agenda**: `softDeleteAppointment(id)` (appointment-service; seta `deleted_at` + limpa Zoom/Google) + filtro `.is("deleted_at", null)` em `getAppointments`. `deleteSessionAction` em `app/schedule/page.tsx`, threadada (ScheduleContainer → DayView/WeekView). Botão **"×"** (com `window.confirm`) no `DraggableDayCard` (dia) e `DraggableApptCard` (semana). i18n `schedule.calendar.delete/deleteConfirm`.
- **Arraste de 30 em 30 min**: `DroppableHourCell` virou célula de **meia hora** (prop `minute`, altura `HOUR_HEIGHT/2`); week e day renderizam 2 células/hora (`...__HH__MM` / `day__HH__MM`); `handleDragEnd` e `handleCellClick` parseiam o minuto.
- **Grade alinhada**: na semana, adicionada **linha sólida na hora cheia** (alinhada ao rótulo) + meia-hora tracejada leve. Dia já tinha separador por hora.
- Q-SNA e Q.R.M. marcados com `send_on_first_appointment=true` em produção (envio automático na 1ª sessão). Convites avulsos gerados p/ paciente "Dayane".
- **🐞 Fix exclusão (causa raiz)**: o RLS de SELECT de `appointments` esconde linhas com `deleted_at IS NOT NULL`. O `softDeleteAppointment` (client de usuário) fazia UPDATE + `.select().single()`; o RETURNING era filtrado pelo RLS → PostgREST retornava erro e **dava rollback no UPDATE** (nada era excluído). Corrigido: `softDeleteAppointment(id, clinicId)` usa **admin client** escopado por `clinic_id` + `.maybeSingle()`. `deleteSessionAction` passa `profile.clinic_id`.
- **Questionários na confirmação**: como WhatsApp Business não entrega texto livre a contato frio e os testes estavam sem e-mail/código de país, os links dos questionários de entrada agora aparecem **na tela de confirmação do paciente** (`confirmAppointmentAction` retorna `questionnaires`; `sendAssessmentsToPatient`/`sendOnboardingAssessments` retornam `links`).
- Q-SNA e Q.R.M. com `send_on_first_appointment=true` (envio automático na 1ª sessão).
- Validado: tsc **0 erros**; verify:i18n **39 namespaces, paridade OK**.

## ✅ Link de confirmação de agendamento (terapeuta → paciente) (15/06/2026)

O terapeuta clica num horário da agenda e, em vez de confirmar direto, pode **gerar um link** que reserva o horário como **pendente**; o paciente abre o link, completa os dados e **confirma o horário** que o profissional escolheu. Decisões do usuário: reserva **pendente**; envio por **copiar/WhatsApp/e-mail**; serve para **paciente novo e já cadastrado**.

- **Migration `078_appointment_confirmation_links.sql` APLICADA em produção (15/06/2026)**: `appointments_status_check` recriado incluindo **`'pending'`**; colunas `confirm_token_hash` (índice único parcial), `confirm_expires_at`, `confirmed_at`; `NOTIFY pgrst`. `Appointment.status` (lib/types) += `'pending'`; `common.appointmentStatus.pending` (PT/EN).
- **appointment-service**: `createPendingAppointmentWithToken` (status pending, **sem** os side-effects de confirmação — Zoom/Google/WhatsApp/questionários só rodam na confirmação), `getAppointmentByConfirmToken` (admin, valida expiração/status), `confirmAppointmentByToken` (enriquece paciente, status `confirmed`, `confirmed_at`, limpa token; idempotente via `.eq("status","pending")`). Token = `randomBytes(32)` + SHA-256.
- **Modal da agenda** (`create-session-modal.tsx`): seletor **Confirmar agora × Enviar link**. No modo link, chama `createConfirmationLinkAction` (em `app/schedule/page.tsx`, retorna `{url,phone,email}`) e mostra painel com **Copiar / WhatsApp (wa.me) / E-mail** (`emailConfirmationLinkAction` via `sendSimpleEmail`). Props `confirmLinkAction`/`emailLinkAction` threadadas por `schedule-container` (DayView + WeekView).
- **Página pública** `app/confirmar/[token]/` (page + confirm-client + actions): mostra clínica + horário proposto; paciente completa dados (mesmos campos do `/cadastro`, com endereço/bairro) + consentimentos (`data_processing` + `analytics_anonymized`, IP/UA) e confirma. Estados: inválido/expirado, sucesso. Rate limit `confirm-appt`. Rota liberada no `middleware.ts` (`/confirmar/`). Pós-confirmação dispara automações + questionários de entrada.
- **i18n**: namespace novo `confirmBooking` (PT/EN) + chaves novas em `schedule.modal` → **39 namespaces**.
- **Follow-ups concluídos (15/06)**: (1) **cor própria do horário pendente** — `session-card` (dia) e `DraggableApptCard` (semana) em **âmbar** + badge "Aguardando" (`schedule.card.awaiting`); (2) **integrações Zoom/Google na confirmação** — `runIntegrationsForAppointment(appointmentId)` exportado no appointment-service (carrega o appt joined + `createIntegrationsSideEffects`), disparado fire-and-forget na confirm action.
- Validado: tsc confiável **0 erros**; verify:i18n **39 namespaces, paridade OK**; migration 078 aplicada e verificada. **Pendência operacional**: deploy dos `.ts` na Vercel.

## ✅ Auto-cadastro do paciente + endereço + tendências anonimizadas (15/06/2026)

Fluxo para o paciente preencher os próprios dados antes da 1ª consulta, alimentando um "produto de tendências" agregado e anonimizado. Decisões do usuário: granularidade **cidade + estado**; entrada = **paciente ativo direto** (sem fila de aprovação).

- **Migration `077_self_register_and_trends.sql` APLICADA em produção (15/06/2026, projeto bfuulpvzedcrpmmjxles)**: `patients.neighborhood` (bairro); VIEW `patient_trends_agg` (`security_invoker=on` — ajustado para evitar o lint `security_definer_view`; `REVOKE` de anon/authenticated, só `postgres`/`service_role` têm grant) — agrega por state+city+faixa_etária só de pacientes com consentimento `analytics_anonymized` granted, `HAVING count(*) >= 5` (k-anonimato), **sem identificadores nem clinic_id**; `NOTIFY pgrst`. `consent_type` segue texto livre (novo valor `analytics_anonymized`, sem mudança de schema).
- **Auto-cadastro público** `app/cadastro/[slug]/` (page + `register-client.tsx` + `actions.ts`): `submitSelfRegistrationAction` (admin client, rate limit `self-register:{clinicId}` 30/h, dedup por email→phone com `.eq()`, cria/atualiza paciente `status='active'` com endereço/bairro/CPF/DOB). Grava 2 consentimentos em `patient_consents` (`data_processing` obrigatório + `analytics_anonymized` opt-in) com IP/user-agent (`headers()`), source `onboarding`. Rota liberada no `middleware.ts` (`/cadastro/`).
- **Tipos/serviço**: `Patient.neighborhood`; `createPatient`/`updatePatient` aceitam endereço completo + `neighborhood`; `anonymizePatient` zera `neighborhood`.
- **Produto de tendências**: `services/patient-trends-service.ts` (`getPatientTrends` via admin client, KPIs + por faixa etária) + `app/trends/page.tsx` (guard `isManager`, só agregados, banner de privacidade, tabela por região). Link de auto-cadastro adicionado ao hub `/links` (`links.registerTitle/registerDesc`).
- **i18n**: namespaces novos `publicRegister` e `trends` (PT/EN) → **38 namespaces**.
- Validado: tsc confiável **0 erros**; verify:i18n **38 namespaces, paridade OK**; migration 077 aplicada + advisor de segurança sem alerta para a view. **Pendências operacionais**: deploy dos `.ts` na Vercel; (opcional) auto-preencher cidade/UF a partir do CEP (ViaCEP); adicionar `/trends` à sidebar.

## ✅ Auditoria completa + correções + growth (10/06/2026)

Relatório completo em `AUDITORIA_COMPLETA_2026-06-10.md`. Implementado nesta sessão:

**Segurança (código):**
- `app/api/whatsapp/send-voice`: áudio TTS movido do bucket público `media` (que **nem existia** em prod — feature estava quebrada) para `patient-docs` privado + `createSignedUrl` 24h + escopo `clinic_id` explícito.
- `app/envio/[slug]/actions.ts`: allowlist MIME + magic bytes no upload público (PDF/JPG/PNG/WEBP/HEIC/texto, rejeita binário disfarçado); `.or()` com interpolação trocado por queries `.eq()/.in()` separadas (anti-injeção PostgREST).
- `app/api/asaas/charge`: se o insert em `patient_payments` falhar, agora cancela a cobrança no Asaas (DELETE best-effort) e retorna 500 — antes enviava link Pix sem registro.

**Banco (migrations 071–076 APLICADAS em produção 10/06):**
- **071**: policies "service role full access" das tabelas LGPD (`patient_consents`, `data_deletion_requests`) estavam com `TO public USING (true)` = **acesso total para qualquer authenticated/anon**. Recriadas `TO service_role`. (Achado do advisor `rls_policy_always_true`.)
- **072**: `search_path` fixo em 4 funções + REVOKE EXECUTE de `anon` em todas as SECURITY DEFINER.
- **073**: 78 índices de FK criados (advisor `unindexed_foreign_keys`).
- **074**: 25 policies em 19 tabelas reescritas com `(SELECT auth.uid())` via ALTER POLICY mecânico (advisor `auth_rls_initplan`). Verificado: 0 restantes.
- **075**: CHECK de `communication_logs.use_case` ganhou `trial_expiry_d3/d1` **e `dunning`** (que o dunning-service já usava mas o constraint barrava — dedup do dunning estava quebrado).
- **076**: programa de indicação (`clinics.referral_code` + `referred_by_clinic_id` + tabela `referral_conversions` com RLS; backfill de códigos feito).
- Verificado também: migrations 048/052/054 (CONTEXT antigo dizia "pendentes") **já estavam aplicadas**.

**CI**: `.github/workflows/ci.yml` — push/PR main: npm ci → typecheck (tsconfig.check.json) → verify:i18n → vitest.

**E-mail de trial expirando (D-3/D-1)**: `services/trial-expiry-service.ts` (lê `subscriptions.trial_ends_at` + status trialing; dedup via `communication_logs` use_case `trial_expiry_*`; e-mail ao owner via template `components/email/trial-expiry-email.tsx`, i18n `emails.trialExpiry.*`). Plugado no cron diário `/api/cron/automations`.

**Growth/PLG:**
- **Powered by AXIEL**: `components/powered-by-axiel.tsx` no booking público (`/book/[slug]`) e no portal (`/p/[token]`), com UTM; oculto quando o plano tem feature `white_label` (flag `show_powered_by` resolvida no server).
- **PostHog** (sem dependência npm — snippet inline): `components/analytics/posthog-provider.tsx` env-gated por `NEXT_PUBLIC_POSTHOG_KEY` (+ `NEXT_PUBLIC_POSTHOG_HOST`), montado no root layout; CSP atualizada; `lib/analytics.ts` (`track`/`identify`). Eventos: `signup_submitted`, `onboarding_completed`, `plan_selected` + identify no signup. **Pendente: criar conta PostHog e setar a env na Vercel.**
- **Programa de indicação (1 mês grátis p/ ambos)**: `services/referral-service.ts`; middleware captura `?ref=` em cookie `AXIEL_REF` (30d); vínculo na criação da clínica (onboarding-service, try/catch isolado); desconto do indicado no checkout Stripe via `STRIPE_REFERRAL_COUPON_ID`; conversão+recompensa do indicador no webhook (`processReferralConversion`); card "Indique e ganhe" no dashboard (managers); namespace `referral` (36º). **Pendente: criar coupon no Stripe (100% off, duration once) e setar `STRIPE_REFERRAL_COUPON_ID`.**

Validado: tsc confiável **0 erros**; verify:i18n **36 namespaces, paridade OK**. Pendências operacionais: env PostHog, coupon Stripe, e os itens MÉDIO do relatório de auditoria (rate limits do portal, iCal token, CSP nonce, etc.).

## ⚠️ Moeda por clínica/região (NÃO por idioma) — concluído 05/06

A moeda é da **clínica** (`clinic_settings.default_currency`: BRL/USD/EUR), nunca do idioma. O locale (next-intl) só formata separadores.

- **Fonte**: `getClinicCurrency(clinicId)` em `services/finance-service.ts`. Formatador puro: `formatMoney(cents, currency, locale)` em `lib/finance-utils.ts`.
- **Client**: `components/currency-provider.tsx` (`CurrencyProvider` + hooks `useFormatMoney()` / `useClinicCurrency()`). Já injetado no `Shell` (apps autenticadas) e na página `/p/[token]` (portal). Componentes client chamam `const money = useFormatMoney(); money(cents)` — sem prop-threading.
- **Server**: páginas usam `getClinicCurrency(clinic.id)` + `formatMoney(cents, cur, locale)` direto.
- **Criação de registros** grava na moeda da clínica: `createPaymentAdmin`, ofertas (`createMonetizationOffer`), produtos (`createProduct`).
- **BRL fixo é legítimo** apenas em: rotas Asaas (`/api/asaas/*` — gateway brasileiro, Pix/Boleto só existem em BRL), o param `order.currency` em produtos, e o default do `CurrencyProvider`.
- ~30 superfícies convertidas (financeiro, relatórios, produtos, hotmart, assinaturas, ofertas, dashboard, portal, e-mails, prompt da IA de finanças). Validado: `tsc -p tsconfig.check.json` = 0, `verify-i18n.mjs` = 0.

## Financeiro restrito a dono/admin — concluído

`lib/require-finance-access.ts` (`requireFinanceAccess()` → redirect se não `isManager`). Guard em `/financeiro` + repasse/nfse/relatorio. Sidebar/MobileNav recebem `canSeeFinance` do `Shell`. "Cliente" = outra clínica que usa o AXIEL (SaaS).

---

## ✅ Mapa anatômico (corpo/coluna/vísceras) — intake + sessão (07/06)

Campo de mapa anatômico com imagem + anotação em texto (v1), no questionário e na sessão.

- **Migration `070_body_map_field.sql` APLICADA**: `intake_question_type` ganhou valor `body_map`; `session_records.body_map_notes jsonb`.
- **Imagens REAIS recebidas** (08/06) em `public/anatomy/`: `Corpo.png`, `Vertebras.png`, `Visceras.png`, `SNA.png`. Registro em `modules/intake/anatomy-maps.ts` mapeia chave→arquivo real (`MAP_FILES`: corpo→Corpo.png, coluna→Vertebras.png, visceras→Visceras.png, sna→SNA.png) — necessário porque o sandbox não pode renomear no FS case-insensitive do macOS e o servidor (Linux) diferencia maiúsculas. Sobra um `coluna.png` (placeholder 7KB) não usado — pode apagar.
- **4º mapa adicionado**: Sistema Nervoso Autônomo (`sna`).
- **Intake**: tipo de pergunta "Mapa anatômico" no editor (escolhe o mapa, guardado em `intake_questions.placeholder`); fill (`patient-intake-form`) mostra a imagem + textarea de anotação. `updateIntakeFormWithQuestions`/action passam `placeholder`.
- **Sessão**: bloco "Mapa anatômico" no `session-recording-panel` (escolher mapa + nota, lista; mostra a imagem); `BodyMapNote[]` em `session_records.body_map_notes`; action/service gravam.
- i18n: `intake.types.body_map`/`maps.*`/`chooseMap`; `session.panel.bodyMap*`/`maps.*` (PT/EN).
- Validado: tsc 0 erros; verify-i18n paridade OK (35 namespaces). Imagens reais conferidas (PNG válidos, ~1,6–1,9 MB cada).

## ✅ Marcação do mapa — melhorias (v2.1) (08/06)

`BodyMapMarker` ganhou `label?` e `intensity?` (1 leve/2 moderada/3 forte → cor do pino). `body-map-input.tsx` reescrito: clicar adiciona pino; **arrastar** reposiciona (pointer capture); lista de pontos abaixo com seletor de **intensidade** (3 cores) e **descrição por ponto**; + campo de notas gerais. Rótulos centralizados em `common.bodyMap.*` (componente auto-traduz; removidos props de label dos callers). Action de sessão preserva label+intensity dos markers.

## 🐞 Fix: imagem do mapa 404 na Vercel (case) (08/06)

`anatomy-maps.ts` apontava para `Corpo.png/Visceras.png/SNA.png` (maiúsculos), mas o git versionou `corpo.png/visceras.png/sna.png` (minúsculos) + `Vertebras.png` (a coluna). No macOS (case-insensitive) parecia ok; na Vercel (Linux) dava 404. `MAP_FILES` corrigido para os nomes EXATOS do `git ls-files`. **Lição**: o nome real é o do git, não o do Finder.

## ✅ Mapa anatômico interativo — marcação por pinos (v2) (08/06)

- **Componente** `components/body-map-input.tsx`: `BodyMapInput` (controlado) — clicar na imagem adiciona pino numerado (coord % relativa), clicar no pino remove; textarea de notas; modo `readOnly`. `BodyMapField` (wrapper p/ formulário, hidden input com JSON `{markers,notes}`).
- **Intake**: `patient-intake-form` usa `BodyMapField` no campo `body_map` (answer = JSON). `BodyMapMarker {x,y}` em `lib/types`.
- **Sessão**: `session-recording-panel` usa `BodyMapInput`; `BodyMapNote` ganhou `markers?`; action/service parseiam markers.
- **Exibição legível**: `lib/intake-answer.ts` `formatIntakeAnswerSummary` (JSON → "N pontos marcados — notas") aplicado no contexto da sessão (top-3 anamnese) e no portal (info de saúde), evitando JSON cru.
- i18n: `intake.mapHint/mapClear`, `session.panel.bodyMapHint/bodyMapClear` (PT/EN).
- Validado: tsc 0 erros; verify-i18n paridade OK (35 namespaces).

## ✅ i18n da tela de intake + correção de duplicados/mapa (08/06)

- **Tela `/intake` e construtor traduzidos** (eram EN hardcoded): `app/intake/page.tsx`, `components/intake-form-builder.tsx`, `app/patients/[id]/intake/page.tsx` (título/voltar/sem-form) e `patient-intake-form` (placeholder do mapa via prop). Chaves novas em `intake` (hub*, saved*, status*, questionN, saveForm, fill*, questionsCount, viewMore, mapNotesPlaceholder).
- **Correção de dados**: o botão "Save intake form" da tela antiga criava **formulário novo** (duplicado) e virava o ativo (em EN). Desativado o duplicado "Patient Intake"; **Anamnese Integrativa** voltou a ser o único ativo. Limpo `placeholder` solto numa pergunta de texto. Adicionada 1 pergunta `body_map` funcional (placeholder=corpo) na Anamnese.
- ⚠️ **Nota**: a tela antiga `/intake` (IntakeFormBuilder) ainda **cria** formulário novo a cada save — ideal no futuro é unificar com o editor em lugar para não gerar duplicados.
- Validado: tsc 0 erros; verify-i18n paridade OK (35 namespaces).

## ✅ Editor de formulário de intake + modelos prontos (07/06)

O terapeuta agora controla as perguntas do intake (edição em lugar, sem duplicar) e pode partir de um modelo.

- **Service** `intake-service`: `getIntakeFormWithQuestionsById` + `updateIntakeFormWithQuestions` (diff: update form, delete removidas por id, upsert/insert; preserva ids → não quebra `intake_responses`).
- **Editor** `components/intake-form-editor.tsx` (client): editar/adicionar/remover/reordenar perguntas, tipo (short_text/long_text/number/date/yes_no) e obrigatória; **"Começar de um modelo"** carrega presets (substitui perguntas) e o terapeuta edita.
- **Modelos** `modules/intake/templates.ts`: 5 presets (integrativa, nutrição, fisioterapia, saúde mental, wellness).
- **Página** `app/intake/[id]/edit/page.tsx` + `actions.ts` (guard owner/manager/admin).
- **Atalhos** "Editar perguntas": na tela `/patients/[id]/intake` (gestores) e nos cards de `/intake` (ativo + salvos).
- **i18n**: novo namespace `intake` (PT/EN) registrado em `i18n/request.ts` (agora 35 namespaces). Obs: o restante da página `/intake` (títulos "Intake forms"/"Saved forms") segue em EN hardcoded — follow-up.
- Validado: tsc 0 erros; verify-i18n paridade OK (35 namespaces).

## ✅ Faixas por seção do Q-SNA + catálogo de testes (07/06)

- **Q-SNA faixas por seção** (dado): `section_bands` proporcionais por dimensão (max ~20) — 0–7 Equilibrado, 8–13 Disfunção moderada, 14+ Disfunção acentuada. Ajustável no editor de formulário.
- **Catálogo de testes clínicos** (Configurações): `clinic_settings.settings.clinical_test_catalog` (array de nomes; sem migration). Helper `getClinicalTestCatalog(clinicId)` em `clinic-service`. Action `app/settings/clinical-tests/actions.ts` (guard owner/manager/admin, dedup, max 100). Página `app/settings/clinical-tests/page.tsx` + `components/clinical-tests-catalog-form.tsx` (editor de lista). Card no hub (`settings/page.tsx`, key `clinicalTests`). i18n `settings.clinicalTests.*` + `settings.hub.items.clinicalTests`.
- **Sessão usa o catálogo**: `schedule/[id]/session` mescla catálogo da clínica + carry-forward (dedup) em `suggestedTests` → linhas prontas para preencher em toda sessão.
- Validado: tsc 0 erros; verify-i18n paridade OK.

## ✅ Grau + testes no prontuário/PDF e contexto da sessão (07/06)

- **PDF do prontuário** (`app/api/reports/paciente/[id]/route.ts`): seção de assessments agora mostra o **grau de disfunção** (via `gradeTotal` + `scoring_config`, na cor da faixa) além do % e seções; seção de notas de sessão lista os **testes clínicos presenciais** (nome: resultado (obs)) e passou a incluir registros que só têm testes (filtro atualizado). i18n `pdf.record.gradeLabel`/`clinicalTests` (PT/EN).
- **Contexto da sessão** (`schedule/[id]/session`): bloco "Testes da última sessão" no painel de contexto (até 6, de `prevRecords[0].clinical_tests`). i18n `session.page.lastSessionTests`.
- Validado: tsc 0 erros; verify-i18n paridade OK.

## 🐞 BUGFIX crítico: assert_same_clinic() quebrava inserts — Feature follow-up (07/06)

- **Migration `069_fix_assert_same_clinic_leads_field.sql` APLICADA**. A função tinha `ELSIF tg_table_name = 'leads' AND new.converted_patient_id IS NOT NULL` — em PL/pgSQL a referência ao campo é resolvida mesmo quando `tg_table_name <> 'leads'`, então **qualquer INSERT** nas tabelas avaliadas depois desse ELSIF (intake_questions, intake_responses, **session_records**, **follow_ups**, patient_offers, ai_insights, ai_requests) falhava com `record "new" has no field "converted_patient_id"`. Trigger está nessas 9 tabelas. Correção: aninhar a checagem do campo dentro do branch `'leads'`. Comportamento preservado.
- **Limpeza de intake** (problema original): a clínica IFWC tinha 3 `intake_forms` ativos e vazios (2 "Starter Patient Intake" + "Anamnese Integrativa"), todos com 0 perguntas/0 respostas → tela "Patient intake" abria em branco. Removidos os 2 duplicados; "Anamnese Integrativa" populada com 8 perguntas-padrão (long_text). Agora há 1 formulário ativo preenchível pelo terapeuta em `/patients/[id]/intake`.

## ✅ Testes clínicos presenciais — Feature 3 (07/06)

Espaço na sessão para registrar os testes presenciais (bateria própria da clínica, sem catálogo fixo).

- **Migration `068_session_clinical_tests.sql` APLICADA** — `session_records.clinical_tests jsonb` (array de `{name, result, notes?}`).
- **Tipo** `ClinicalTestResult` + `SessionRecord.clinical_tests`. `upsertSessionRecord` e `saveSessionRecord` (parse/sanitize: só linhas com `name`) gravam o campo.
- **Painel** (`session-recording-panel`): seção "Testes clínicos presenciais" no painel direito (linhas repetíveis nome/resultado/observação), serializada em hidden input.
- **Carry-forward**: a página da sessão passa `suggestedTests` (nomes do último `session_record` com testes, de outro agendamento); se a sessão atual ainda não tem testes, as linhas vêm pré-preenchidas com esses nomes e resultado em branco — vira a "bateria padrão" sem precisar de tela de configuração.
- i18n `session.panel.clinicalTests*`/`clinicalTest*` (PT/EN).
- Validado: `tsc -p tsconfig.check.json` = 0; `verify-i18n.mjs` paridade OK.
- **As 3 features do fluxo comercial estão concluídas** (grau de disfunção · resumo do caso · testes presenciais).

## ✅ Resumo do caso + queixa principal — Feature 2 (07/06)

Queixa principal fixa e resumo do caso sempre à vista (ficha + toda sessão).

- **Migration `067_patient_case_summary.sql` APLICADA** — `patients.chief_complaint text` + `patients.case_summary text`.
- **Tipos**: `Patient` ganhou os 2 campos; `updatePatient` Pick estendido. Fixtures de teste atualizados (action-rules, ai-placeholder).
- **Action** `app/patients/[id]/case-summary/actions.ts` (`saveCaseSummaryAction`, escopo de clínica via `updatePatient`, `revalidatePath`).
- **Card editável** `components/patient-case-summary-card.tsx` (client, `useActionState`, edição inline) na ficha logo após o `PatientIntelligenceStrip`.
- **Sessão**: bloco fixo (queixa principal + resumo) no topo de `schedule/[id]/session` — sempre visível; página passou a buscar `getPatientById`.
- i18n: `patientProfile.caseSummary.*` e `session.page.chiefComplaint/caseSummary` (PT/EN).
- Validado: `tsc -p tsconfig.check.json` = 0; `verify-i18n.mjs` paridade OK.
- **Próxima**: Feature 3 (testes clínicos presenciais na 1ª sessão).

## ✅ Grau de disfunção configurável — Feature 1 (07/06)

Fluxo comercial: o **motor** é o produto; os questionários (QRM, Q-SNA…) são dados por clínica. Cada template agora tem uma régua de interpretação própria.

- **Migration `066_template_scoring_bands.sql` APLICADA** — coluna `assessment_templates.scoring_config jsonb`: `{ total_bands[], section_bands[], flag_item_max }`. Cada faixa = `{min, max|null, label, color}` (`max:null` = aberto, ex.: 106+).
- **Tipos** `ScoreBand`/`ScoringConfig` em `lib/types.ts`. **Helper puro** `lib/assessment-grading.ts` (`gradeTotal`, `gradeSection`, `isItemFlagged`, `normalizeScoringConfig`).
- **Editor** (`assessment-form-editor` + `forms/[id]/edit/actions`): bloco "Grau de disfunção (faixas)" — edita faixas de total e de seção (min/máx/rótulo/cor) + checkbox "sinalizar itens na pontuação máxima". i18n `forms.builder.scoring*`/`band*` (PT/EN).
- **Exibição**: `assessment-progress-service` agora retorna `grade` (faixa do total), `sectionGrades` (faixa por seção, maior 1º), `flaggedCount` (itens no máx) e `latestTotal` da última resposta. Mostrado no `patient-assessment-progress-panel` (ficha) e badge no contexto da sessão (`schedule/[id]/session`). `getPatientAssessmentResponses` passou a trazer `assessment_templates(scoring_config)`.
- **Portal**: mantém enquadramento neutro — campos novos preenchidos com defaults, **sem** rótulo clínico ao paciente.
- **Pré-configurado (clínica IFWC)**: Q-SNA total 0-35/36-70/71-105/106+ (sem faixa de seção — aula não define limite por dimensão); QRM total ≤20 sem disfunção / >20 em disfunção, seção ≥10 disfunção; ambos com flag de item=máx.
- Validado: `tsc -p tsconfig.check.json` = 0; `verify-i18n.mjs` paridade PT/EN OK.
- **Próximas**: Feature 2 (resumo do caso + queixa principal fixa), Feature 3 (testes clínicos presenciais na 1ª sessão).

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
- ✅ **Financeiro restrito a dono/gestor/admin + fundação de moeda por clínica** (05/06/2026):
  - **Acesso**: `lib/require-finance-access.ts` (`isManager` = clinic_owner/clinic_manager/admin) nas 4 páginas (`/financeiro`, repasse, nfse, relatorio → redirect /dashboard). Sidebar/MobileNav filtram o item `/financeiro` via `canSeeFinance` (Shell busca `getCurrentUserProfile().role`). Colaborador comum não vê o Financeiro.
  - **Moeda**: `formatMoney(cents, currency, locale)` em `lib/finance-utils` + `getClinicCurrency(clinicId)` em `finance-service` (lê `clinic_settings.default_currency`). Decisão: **moeda por clínica/região** (não por idioma). Seletor já existe em Settings → Regional.
  - **PENDENTE (refactor coeso)**: ~28 telas ainda usam `formatBRL` fixo → converter para `formatMoney(moeda da clínica)`. Sem visível hoje (clínica = BRL); necessário quando uma clínica for USD/EUR.
- ✅ **Questionários automáticos na 1ª sessão + motor de progresso** (05/06/2026) — plano em `QUESTIONARIOS_AUTO_PLANO.md`:
  - **Migration `064`**: `assessment_templates.send_on_first_appointment` (flag). Checkbox "Enviar na primeira sessão" no editor de formulário (`assessment-form-editor` + `forms/[id]/edit/actions`), i18n `forms.builder.sendOnFirst`.
  - **`services/onboarding-assessment-service.ts`** (`sendOnboardingAssessments`, admin client): se 1ª sessão → cria convites dos templates marcados + envia link por **WhatsApp** (`sendWhatsAppText`) e **e-mail** (`email-service.sendSimpleEmail`, novo helper genérico). Idempotente (não reenvia convite aberto).
  - **Gatilhos**: `createAppointment` (side-effect) **e** booking público `app/api/book/[slug]` (após o insert; usa admin client). A pontuação/% já era automática no submit do form → cai na ficha.
  - **Portal**: seção "Questionários pendentes" no `patient-portal-dashboard` (PatientPortalData.pendingAssessments) — informativo (link seguro vai por WhatsApp/e-mail; fill nativo no portal = follow-up).
  - **Motor de progresso (fundação)**: `services/assessment-progress-service.ts` — `getAssessmentProgress(patientId, templateId)` (série de % + baseline + latest + deltaPct) e `getPatientAssessmentProgress`. Base para mostrar "variou X% desde o início" (UI = próxima fase).
  - Validado: tsc confiável 0 erros; verify:i18n paridade PT/EN OK.
  - **Fase 2 (progresso + reavaliação)**: `onboarding-assessment-service` refatorado → `sendAssessmentsToPatient` (reutilizável); action `resendAssessmentAction` (reavaliar = reenvia template). `PatientAssessmentProgressPanel` na ficha (`/patients/[id]`): série de % em mini-barras, delta em pts, contagem, botão **Reavaliar** por template (usa `getPatientAssessmentProgress`).
  - **Fase 3 (insight de IA pós-entrada, semiautomático)**: ao completar os questionários de entrada, o sistema sugere ao clínico gerar o insight (governança: rascunho→revisão, NÃO auto-publica ao paciente). Regra `onboardingInsightReady` em `action-rules.ts` + `getPatientsNeedingOnboardingInsight` (pacientes com resposta a template onboarding e sem ai_insight) plugado em `app/actions/page.tsx` + i18n `actions.suggestions.onboardingInsightReady`. Some sozinho quando o insight é gerado.
  - **Fase 4 (progresso no portal)**: seção "Sua evolução" no `patient-portal-dashboard` — série de % por questionário (mini-barras, baseline→último), framing neutro. `PatientPortalData.assessmentProgress` computado inline (admin client, sem sessão) reusando o tipo `AssessmentProgress`. i18n `portal.dashboard.progressTitle/progressHint`.
  - **Fase 5 (reavaliação automática por cadência)**: migration **065** `assessment_templates.reassessment_interval_days` (0=off). Campo no editor (`forms.builder.reassessLabel`). `processReassessments()` (admin client, idempotente, 50/template/run — pacientes ativos cuja última resposta passou do intervalo e sem convite aberto) plugado no cron diário `/api/cron/automations`. O gráfico de progresso enche sozinho.
  - **Pendente (opcional)**: fill nativo de questionário no portal (decisão: manter também o link WhatsApp/e-mail para quem não acessa o portal).
- ✅ **Asaas — extensões: Boleto + oferta/pacote + mensalidade recorrente** (05/06/2026):
  - `asaas-service` generalizado: `createAsaasCharge(billingType: PIX|BOLETO)`, `createAsaasSubscription` (busca a 1ª invoiceUrl). `AsaasBillingType`.
  - Rota `/api/asaas/charge` aceita `billing_type` (Pix/Boleto); grava `payment_method` certo. Botão Pix **e** Boleto nas sessões não pagas (`AsaasChargeButton` genérico).
  - Rota `/api/asaas/charge-offer` (nova): `session_package`→cobrança única; `membership`→assinatura recorrente Asaas. Botões Pix/Boleto no `patient-charge-panel` (quando `isAsaasConfigured()`).
  - **Migration `062_asaas_subscription_id.sql` APLICADA**: `patient_subscriptions.asaas_subscription_id` + índice único.
  - Webhook Asaas: trata **pagamento recorrente** (sem linha pendente pré-criada → acha assinatura por `asaas_subscription_id`, grava `patient_payments` paid + ativa a assinatura); não sobrescreve mais `payment_method` (preserva pix/boleto).
  - Validado: tsc confiável 0 erros; verify:i18n paridade PT/EN OK.
  - **Feature de Produtos (do zero, por fases)** — plano em `PRODUTOS_FEATURE_PLANO.md`:
    - **Fase 1** (migration **063** aplicada): `product_order_items` (itens do pedido, RLS) + `product_orders.asaas_payment_id`.
    - **Fase 2**: `services/product-order-service.ts` (`createProductOrder` com snapshot de preço/nome + totais; `getProductOrders`; `getProductOrderById` com itens; `cancelProductOrder`) + server actions `createProductOrderAction`/`cancelProductOrderAction`.
    - **Fase 3** (UI): `app/products/orders/new` (página) + `new-order-form.tsx` (carrinho: paciente opcional, selecionar produtos+qtd, taxa, totais) → cria via action. Botão "+ Novo pedido" em `/products/orders`. (PT-hardcoded, como o resto de Produtos.)
    - **Fase 4** (cobrança): rotas `/api/asaas/charge-order` (Pix/Boleto) e `/api/stripe/order-checkout` (cartão). Webhook Asaas dá baixa por `asaas_payment_id`; webhook Stripe trata `type=product_order` → `payment_status/status='paid'`. UI: botões Cartão·Pix·Boleto por pedido não pago em `/products/orders` (`order-charge-buttons.tsx`). Venda avulsa (sem paciente) = só cartão.
    - **Fase 5** (fulfillment): `markProductOrderPaid` (service, idempotente — usado pelos 2 webhooks; **baixa estoque** dos itens ao pagar); `markOrderDelivered` + action + botão "Marcar entregue" nos pedidos pagos.
    - **FEATURE DE PRODUTOS COMPLETA**: cadastrar produto → criar pedido (carrinho) → cobrar (cartão/Pix/Boleto) → webhook dá baixa + estoque → marcar entregue.
- ✅ **Pix via Asaas — Plano B implementado (sandbox-ready)** (05/06/2026): Stripe marcou Pix como **Ineligible** pra conta US (clínica = categoria proibida), então Pix vai por gateway BR.
  - **Migration `061_asaas_pix_fields.sql` APLICADA**: `patients.cpf`, `patients.asaas_customer_id`, `patient_payments.asaas_payment_id` + índice único parcial.
  - `lib/asaas.ts` (cliente HTTP: `ASAAS_API_KEY`, `ASAAS_BASE_URL` default sandbox, `asaasFetch`, `isAsaasConfigured`) + `services/asaas-service.ts` (`ensureAsaasCustomer` — exige CPF; `createAsaasPixCharge` → `invoiceUrl`).
  - Rota staff `app/api/asaas/charge/route.ts` (auth + rate limit; cria cliente+cobrança Pix; grava `patient_payments` pending; retorna `invoiceUrl`). Webhook `app/api/asaas/webhook/route.ts` (valida `ASAAS_WEBHOOK_TOKEN` no header `asaas-access-token`; `PAYMENT_RECEIVED/CONFIRMED`→paid, `PAYMENT_REFUNDED`→refunded; idempotente por `asaas_payment_id`).
  - UI: `AsaasPixButton` nas sessões não pagas (`/financeiro`), exibido quando `isAsaasConfigured()`. Reaproveita a UX de link (invoiceUrl = página Pix hospedada).
  - **middleware**: liberados `/api/asaas/webhook` **e `/api/stripe/webhook`** (este último estava faltando — bug latente: webhook do Stripe podia ser redirecionado pro login).
  - **Campo CPF** adicionado ao cadastro/edição de paciente (Patient type + patient-service create/update + forms new/edit + i18n `patients.new.cpf`). `ensureAsaasCustomer` usa esse CPF.
  - **Pendências pra testar** (só config): setar envs `ASAAS_API_KEY`/`ASAAS_BASE_URL`/`ASAAS_WEBHOOK_TOKEN`; cadastrar webhook no painel Asaas apontando pra `/api/asaas/webhook`.
  - Validado: tsc confiável 0 erros; verify:i18n paridade PT/EN OK.
- ✅ **Reconciliação Banco × Migrations (04/06/2026)** — descoberta crítica de drift:
  - **Causa-raiz**: o registro de migrations do Supabase só vai até a **045**; várias migrations constam "aplicadas" mas **não tiveram efeito** no banco (carimbadas sem rodar). **A fonte de verdade é o schema real (`information_schema`), nunca o registro.**
  - Varredura automática (parser dos 55 `.sql` × `information_schema`/`pg_catalog`) — relatório em `RECONCILIACAO_BANCO.md`.
  - **Corrigido e APLICADO em produção via conector Supabase**:
    - **055** — `appointments.status` (faltava → quebrava `/financeiro`, dashboard, booking, relatórios; ~15 pontos do código) + constraint + função/trigger `sync_package_sessions_used` + `patient_packages.updated_at` + backfill. (migration 012 era a origem, nunca aplicada de fato)
    - **056** — colunas additivas: `patients` (first_name/last_name/city/state/country/zip_code/address_line — mig 004), `plans` (slug/recommended/limits/price_usd_cents/price_eur_cents — mig 007), `clinic_users.zoom_personal_url` (mig 003), `assessment_responses.appointment_id` (mig 002)
    - **057** — `updated_at` em assessment_responses/assessment_templates/hotmart_purchases/repasse_rules + `session_records.session_type_id`
    - **058** — recria tabela **`session_feedback`** (NPS, mig 014) com RLS e índices
  - Verificado pós-aplicação: todos os itens CRÍTICO/ALTO presentes.
    - **059** — recria `product_orders` (em uso em `/products/orders`) e `zoom_recordings` (webhook + `zoom-service`) com índices e RLS (fiéis à mig 005)
  - Avaliação das 4 tabelas pendentes: `media` = **bucket de storage**, não tabela (não recriar); `meta_conversations` = **legado morto** (código marca "legacy table — no active bot"; Instagram usa `whatsapp_conversations`) — não recriar. `product_orders` e `zoom_recordings` recriadas (059).
    - **060** — camada cosmética/perf: recria os 10 triggers `set_<tabela>_updated_at` faltantes (via `set_updated_at`) + 18 índices de performance (assessment_*, hotmart_*, exam_results, finance_insights, patient_payments_status). Pula media/meta_conversations.
  - **Reconciliação 100% concluída** (055–060 aplicadas e verificadas). Banco bate com o repo em tudo que é usado. Sobra só `set_updated_at_assessment` (função duplicada, substituída pela genérica) e índices das 2 tabelas legadas não recriadas — irrelevantes.
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
  - **Métodos de pagamento DINÂMICOS** (atualizado 05/06): os checkouts **não fixam** `payment_method_types`. O Stripe mostra automaticamente o que estiver ativado no painel conforme a moeda — cartão sempre; Pix/Boleto aparecem sozinhos quando ativados em BRL. Motivo: fixar `['card','pix','boleto']` fazia o Stripe **rejeitar** a criação da sessão quando o método não estava ativo (quebrava checkout BRL antes de ativar Pix/Boleto). Helper `paymentMethodTypesForCurrency` removido. ⚠️ Pix no Stripe para **conta BR é invite-only e proíbe "telehealth/medicine vendors"** — pode não ser liberado; nesse caso, Pix via gateway BR (Asaas/Mercado Pago). Cartão/Boleto seguem pelo Stripe.
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
