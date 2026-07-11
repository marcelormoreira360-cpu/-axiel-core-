# AXIEL Core — Auditoria 2026-07-10: Economia, Eficácia, Facilidade e Praticidade

> Auditoria independente, verificada no repositório (evidência arquivo:linha), somente-leitura: nada foi alterado.
> Mesma lente aplicada ao AXIEL Growth ("auditoria lote 2: economia recorrente de IA" e afins), agora rodada no Core.
> Objetivo: gastar menos, funcionar melhor, ser mais fácil e mais prático de operar/vender, sem perder qualidade.

---

## 1. Veredito

A engenharia do Core é madura e, em vários pontos, melhor que a do Growth: idempotência de pagamento sólida (Stripe/Asaas), dedup de webhooks correto, guardrails clínicos fortes e consistentes, logger sem PHI, rate-limit distribuído. Não há bug P0 de correção clássica (nenhum modelo inválido, nenhuma cobrança dupla, nenhum PHI em log).

Os ganhos estão em três frentes concretas:

1. **Economia:** dá para cortar de forma realista **40% a 60% da fatura mensal de IA** sem tocar na qualidade percebida. A maior parte vem de uma linha (o único ponto que ainda paga `gpt-4o`) mais cache de insights e deduplicação de PDF.
2. **Praticidade / venda trilíngue:** três travas reais para vender a outra clínica. A mais séria não é idioma, é **vazamento de identidade**: em 5 canais o bot de uma clínica sem config responde como IFWC (nome do Marcelo, preços de Orlando).
3. **Facilidade:** a infraestrutura de feedback (toasts) está montada e praticamente ociosa. As três jornadas mais usadas (agendar, criar paciente, registrar sessão) salvam em silêncio ou, ao falhar, jogam o usuário numa tela de erro global perdendo o que digitou.

O padrão certo para quase tudo já existe dentro do próprio código. Na maioria dos casos é replicar o que já está bom (pipeline de leads, painel de cobrança, guarda SEC-01 do Meta-WhatsApp, cache de finance-insights) para os pontos que ficaram para trás.

---

## 2. Eixo ECONOMIA (custo de IA sem perder qualidade)

Motor único: OpenAI. Não há RAG vetorial (nenhum `text-embedding-*`), então "reuso de contexto" aqui é o system prompt da Clara. Quase tudo já roda em tier barato (`gpt-4.1-mini` para trabalho interno, `gpt-4o-mini` para chat de volume), sobreponível por `OPENAI_MODEL`. As exceções e desperdícios:

| # | Achado | Evidência | Ação | Impacto |
|---|--------|-----------|------|---------|
| **P0-1** | Clara clínica (health-agent) usa **`gpt-4o` hardcoded** no prompt MAIOR do sistema (exames + medicações + suplementos + 6 sessões + formulários + anamnese num só call). É o único ponto pagando tier premium; todo o resto já é mini. | `app/api/health-agent/route.ts:386` | Trocar por `process.env.OPENAI_MODEL ?? "gpt-4.1-mini"`. Se a rota estiver morta (não achei chamador no front), remover. | `gpt-4o` custa ~6x o `4.1-mini`. Sendo o call de maior contexto, **-80% a -85%** nesse ponto. |
| **P1-1** | Insights de negócio (Results) são **regenerados por LLM a cada abertura da página e a cada troca de período** (1m/3m/6m/12m), sem cache. O finance-insights já tem cache com TTL de 6h; o business-analytics não. | `components/results-insights.tsx:42`; `app/api/results/insights/route.ts:26`; sem cache em `services/business-analytics-service.ts:247-296` | Persistir por `clinic_id`+`months`+`period` com TTL, copiando `getLatestFinanceInsight` (`services/ai-finance-insight-service.ts:30-52`). Regenerar só no botão "atualizar". | **-70% a -90%** das chamadas dessa feature. |
| **P1-2** | Upload de exame funcional envia **o mesmo PDF em base64 em duas chamadas paralelas** (síntese + extração de métricas). Paga o input do documento duas vezes por upload. | `app/patients/[id]/functional-exams/actions.ts:48-51` → `exam-ai-service.ts:147` e `:199` | Fundir num único call que devolve `{ sintese, metrics }`. O PDF (input dominante) passa a ir 1x. | **-40% a -50%** de tokens de input por upload de neurometria/biorressonância. |
| **P2-1** | Transcrição (Whisper) **não é medida por uso real** (minuto de áudio). É só liberada por flag de plano. O custo de STT é invisível e não há como cobrar por consumo. | `app/api/transcribe/route.ts:28,102`; `zoom-service.ts:441`; `meta/whatsapp/route.ts:247` | Capturar duração e gravar minutos por clínica (mesma ideia do `tokens_used` que o ai-insight já grava). | Fecha o vazamento silencioso e habilita cobrança por minuto. |
| **P2-2** | System prompt da Clara (~2k tok, com bloco de EMERGÊNCIA grande) é reenviado inteiro a cada mensagem, e o **bloco dinâmico do passo do funil fica no meio**, quebrando o prefixo estável do cache automático da OpenAI. | `lib/whatsapp-bot-defaults.ts:152-174` | Reordenar: persona + regras fixas + EMERGÊNCIA primeiro (prefixo estável ativa cache), passo dinâmico por último. | Cache automático dá ~50% off no input cacheado. Como é o fluxo de MAIOR volume (todo inbound Meta/WhatsApp), **-30% a -45%** do input. |
| **P2-3** | Regras mecânicas (proibir "—", emoji, formato) repetidas em ~8 prompts e delegadas ao LLM (caro e não-determinístico: o "—" escapa). | `lib/whatsapp-bot-defaults.ts:173,240,255`; `session/actions.ts:211`; `exam-ai-service.ts:37` | Pós-processar em código (regex) na saída e enxugar a instrução. | Ganho real: **o travessão nunca vaza** (requisito seu) sem pagar reescrita por IA. |
| **P2-4** | Whisper nos canais Meta/WhatsApp **sem guarda de tamanho** (transcribe e zoom têm cap de 25 MB; esses dois não). | `app/api/meta/whatsapp/route.ts:232-244`; `app/api/whatsapp/webhook/route.ts:44-56` | Adicionar cap de 25 MB antes do fetch, paridade com `transcribe/route.ts:71`. | Fecha porta a mídia grande gerando STT sem teto. |

**Já está forte (não mexer):** tiers baratos por padrão e sobreponíveis por env; Zoom prefere o transcript nativo antes de pagar Whisper (`zoom-service.ts:367`); caps de 25 MB no transcribe e no zoom; histórico do bot truncado (`slice(-2/-12/-20)`) e transcrição do escriba cortada em 12.000 chars; `AbortSignal.timeout(15_000)` no WhatsApp; `tokens_used` já gravado no ai-insight; `temperature:0` nas extrações.

**Estimativa consolidada:** com P0-1 + P1-1 + P1-2 + P2-2, é razoável projetar **redução de 40% a 60% na fatura mensal de IA**, sem perda de qualidade (P0-1 troca `gpt-4o` por `gpt-4.1-mini`, forte para JSON clínico; o resto é cache e deduplicação, que não tocam a saída).

---

## 3. Eixo EFICÁCIA (funciona certo, é resiliente, sem perder qualidade)

Sem P0. Todos os model ids são válidos e atuais. Os achados são de resiliência e consistência:

| # | Achado | Evidência | Ação |
|---|--------|-----------|------|
| **P1** | **Nunca loga o modelo REAL retornado** pela OpenAI. O que grava em `ai_requests` é o nome esperado (env), não `response.model`. Se a OpenAI servir outro snapshot, é invisível. (Foi exatamente o último fix do Growth.) | `services/ai-insight/workflow.ts:11-16`; `generation.ts:64`; nenhum `response.model` em `services/` ou `app/` | Logar `response.model` / `data.model` em cada chamada e persistir. |
| **P2** | **Model hardcoded ignora `OPENAI_MODEL`** em dois surfaces (troca central não os alcança). | `app/api/health-agent/route.ts:386`; `services/business-analytics-service.ts:290` | Usar `process.env.OPENAI_MODEL ?? <default>`. (P0-1 da economia resolve o primeiro.) |
| **P2** | **Default de modelo diverge:** chat/bots assumem `gpt-4o-mini`, escriba/insights/exames assumem `gpt-4.1-mini`. Uma única env não serve os dois grupos (hoje `gpt-4.1-mini` sobrescreve os bots). | bots em `meta/*`, `voice/gather:90`, `twilio-bot-engine.ts:129` vs `session/actions.ts:224`, `exam-ai-service.ts:80` | Separar `OPENAI_MODEL_CHAT` e `OPENAI_MODEL_REPORT`. |
| **P2** | **Timeout ausente em várias chamadas OpenAI** (só o WhatsApp usa `AbortSignal`). Numa OpenAI lenta, a função Vercel pendura. | `health-agent:379`, `telehealth/summary:28`, `meta/webhook:120`, `facebook:183`, `instagram:208`, `voice/gather:86` | Adicionar `signal: AbortSignal.timeout(15_000)` a todas. |
| **P2** | **Sem retry/backoff nas chamadas OpenAI** (só o envio ao Meta tem). Um 429/5xx transitório cai direto no fallback. | `chat.completions.create` em `services/*` e `app/api/*` sem retry | Envolver as chamadas críticas (insight/escriba) em retry com backoff. |
| **P2** | **CronGuard não protege contra execução concorrente** (checa só `status='success'` recente, não `'running'` em voo). | `lib/cron-guard.ts:60-79` | Checar `'running'` recente ou usar advisory lock / índice único por janela. |
| **P2** | **`JSON.parse` frágil no business-analytics** (sem try/catch): saída malformada derruba todo o insight, sem fallback (o resto do sistema tem parse defensivo). | `services/business-analytics-service.ts:299-300` | Parse defensivo + fallback como em `generation.ts:56-60`. |
| **P2** | **Cobertura de teste ausente no núcleo de IA e billing.** Os 14 testes cobrem helpers, não idempotência de webhook Stripe/Asaas, nem fallback de modelo, nem geração de insight/escriba. | `lib/__tests__/` (só helpers) | Adicionar testes de idempotência (evento duplicado não duplica linha) e de fallback de IA. |

**Já está comprovadamente forte (não mexer):** idempotência de pagamento em duas camadas (Stripe pré-check + índice único parcial; Asaas fail-closed); dedup de webhooks de mensagem (`meta_processed_messages` ON CONFLICT DO NOTHING; SMS por `MessageSid`); validação de assinatura fail-closed com `timingSafeEqual`; feature-gate fail-closed no bot; guardrails clínicos fortes e consistentes (escriba, ai-insight, health-agent, incluindo a regra de não julgar evidência do método); degradação graciosa da IA (`buildAiFallbackOutput`); logger sem PHI (telefone mascarado); rate-limit distribuído via RPC atômico.

> Nota: o Core não cobra crédito por chamada de IA (usa feature-gate + rate-limit), então "cobrança atômica com reembolso" do Growth não é defeito aqui, é um modelo diferente.

---

## 4. Eixo FACILIDADE (fácil de usar, sem perder qualidade)

Diagnóstico de infraestrutura: `sonner` está instalado e o `<Toaster/>` montado (`app/layout.tsx:9`), mas **só 2 componentes no app inteiro chamam `toast()`**. A ferramenta de feedback existe e está parada. 18 `loading.tsx` cobrem as rotas-topo, mas há 114 páginas. `EmptyState` é bem feito e usado em só 11 lugares.

| # | Achado | Onde | Ação |
|---|--------|------|------|
| **P0** | Agendar sessão que falha joga o usuário na tela de erro global e **perde o formulário inteiro** (a action dá `throw`, o form só faz `await action` sem catch). | `app/schedule/new/page.tsx:54,65,82,96`; `components/appointment-form.tsx:71-73` | Retornar erro como valor (não throw), mostrar inline preservando os campos, toast no sucesso. |
| **P0** | Erro ao criar paciente **não aparece** (a action redireciona com `?error=...`, ex. "limite de pacientes, faça upgrade", mas a página lê só `name` e ignora `error`). Usuário clica Salvar e volta pra tela igual, sem explicação. | `app/patients/new/actions.ts:39,52` vs `page.tsx:94-96` | Ler e renderizar `searchParams.error` num banner. |
| **P0** | Registrar sessão no modal salva **em silêncio** (modo "now" faz `action(); onClose(); refresh()` sem toast e sem catch). | `components/create-session-modal.tsx:149-153` | try/catch, toast de sucesso, erro inline (reusar o `setError` que já existe). |
| **P1** | Mudar status de agendamento é otimista **sem rollback nem feedback de erro** (se falhar, o badge fica errado e o usuário não sabe). O CRM de leads já faz certo. | `components/session-drawer.tsx:52-59` | Copiar o padrão de `lead-pipeline-board.tsx:180-201` (guardar estado, reverter no erro). |
| **P1** | **Confirmações de sucesso sumidas em geral:** nenhuma mutation do dia a dia dispara toast; a "confirmação" é um `router.refresh()` (29 usos), o que dá sensação de tela muda. | `app/layout.tsx:9` (Toaster ocioso) | Padronizar toast pós-mutation. Maior impacto/menor custo, a lib já está pronta. |
| **P1** | 57 `throw new Error(...)` em server actions sobem para a `error.tsx` de página inteira em vez de erro inline (para validação de fluxo isso é fricção). | `app/schedule/new/page.tsx`; `app/actions/*` | Nas actions de formulário, retornar `{ error }` e tratar no cliente. |
| **P2** | Estado vazio inconsistente: lista de pacientes reimplementa o próprio `<div>` em vez do `EmptyState` do design system (idem schedule/financeiro/dashboard). | `app/patients/patients-client.tsx:252-275` | Migrar telas de alto tráfego para `EmptyState`. |
| **P2** | Skeleton falta nas sub-rotas de uso real (perfil do paciente `app/patients/[id]`, financeiro/repasse, whatsapp/[phone]): mostra a tela anterior congelada. | 18 `loading.tsx` para 114 páginas | Adicionar `loading.tsx` nas sub-rotas mais abertas. |
| **P2** | Dois `confirm()` nativos sobraram para exclusão (o app tem `ConfirmDialog` próprio), em arquivos `.fuse_hidden*` (provável lixo de merge). | `components/.fuse_hidden*` | Conferir se é código morto e remover. |

**Já está bom (não mexer):** o pipeline de leads é o padrão-ouro de feedback (update otimista + rollback + mensagem inline); painel de cobrança bem resolvido (loading, erro traduzido, copiar link); onboarding guiado sólido (multi-step, barra de progresso, validação por passo); `error.tsx` amigável sem stack; modal de criar sessão rico (cadastro inline, busca com fallback, modo "enviar link").

> O maior ganho de facilidade com o menor esforço é **ligar o toast que já está montado e padronizar o feedback de mutation**. O padrão certo já existe no próprio código (pipeline de leads, painel de cobrança); é replicar.

---

## 5. Eixo PRATICIDADE (operar e vender para várias clínicas, sem perder qualidade)

A base multi-tenant é sólida (settings por clínica, moeda por clínica, catálogos data-driven). Os problemas são vazamentos pontuais de idioma e de identidade, não a arquitetura.

| # | Achado | Evidência | Ação |
|---|--------|-----------|------|
| **P0** | **Vazamento cross-tenant: bot de outra clínica responde como IFWC.** Em SMS, Facebook, Instagram, Voz e um caminho do WhatsApp, sem config da clínica o bot cai no `IFWC_DEFAULT_CONFIG` (nome do Marcelo, "IFWC", preços de Orlando/SP/Maringá). Só o Meta-WhatsApp recusa esse fallback (SEC-01). | Fallback ativo: `sms/webhook:172`, `meta/facebook:328`, `meta/instagram:295`, `voice/webhook:74`, `voice/gather:159`, `whatsapp/webhook:110`. Guarda correta: `meta/whatsapp:467` | Aplicar a regra SEC-01 aos outros canais: sem config, não responder com identidade/preços da IFWC. Default genérico/neutro. |
| **P0** | **pt-PT não existe na interface.** `LOCALES` só tem `pt-BR` e `en`; `messages/` só tem `en/` e `pt-BR/`; `resolveLocale` joga qualquer `pt*` para `pt-BR`. Trava a venda em Portugal. | `i18n/locales.ts:4,7`; `i18n/get-locale.ts:25`; `components/language-switcher.tsx` | Criar `messages/pt-PT/*` nativo, adicionar `pt-PT` em `LOCALES`, ajustar `resolveLocale` e o switcher para 3 opções. |
| **P0** | **pt-PT já é oferecido a paciente/voz/WhatsApp, sem lastro na UI.** Clínica PT configura pt-PT e a equipe continua vendo pt-BR. | `patients/[id]/edit/page.tsx:170`; `settings/voice/page.tsx:55`; `settings/whatsapp/whatsapp-bot-form.tsx:15` vs ausência em `messages/` | Alinhar com o item anterior (completar pt-PT de verdade). |
| **P0** | **Páginas inteiras com strings cravadas, várias misturando PT+EN.** `monetization` 100% em inglês; `leads` mistura PT+EN; `billing`, `products`, `profissionais`, `assinaturas`, `onboarding` cravadas em PT. A clínica no outro idioma vê texto errado. | `monetization/page.tsx:154-214`; `leads/page.tsx:18-47`; `billing:74,99`; `products:31-49`; `profissionais:8-10`; `assinaturas:8-9`; `onboarding:23` | Mover para namespaces em `messages/` e trocar por `t(...)`. |
| **P1** | **Rótulos de status de fatura cravados em PT** (`Pago/Aberto/Cancelado/...`): enum→label leak. | `billing/page.tsx:110-114` | Mapear status Stripe → chave i18n. |
| **P1** | **Vitais e escala do registro de sessão cravados** (`dor/energia/humor/sono` e escala fixa 1-5), não configuráveis por clínica. Sua preferência: escala de dor / campos SOAP por clínica; aqui nem 1-10 existe. | `components/session-recording-panel.tsx:33-40,763` | Tornar vitais e escala uma setting por clínica, como já se faz com `clinical-tests`/`session-types`. |
| **P1** | **Form do bot WhatsApp pré-preenche IFWC como default para qualquer clínica nova** (nome, clínica, cidades/preços). Onboarding começa com dados de outra. | `settings/whatsapp/whatsapp-bot-form.tsx:27`; `lib/whatsapp-bot-defaults.ts:26-74` | Default vazio/neutro; IFWC só como seed do tenant IFWC. |
| **P2** | Fallback de nome de paciente cravado em PT ("Paciente") em página bem internacionalizada. | `schedule/[id]/session/page.tsx:66` | `t("patientFallback")`. |
| **P2** | Rótulos do seletor de moeda cravados em PT e defaults Brasil-cêntricos (`America/Sao_Paulo` + `BRL`). | `settings/regional/page.tsx:38-40,62` | i18n nos rótulos; default derivado do locale da clínica. |
| **P2** | `formatBRL` legado com BRL cravado (o correto é `formatMoney` com a moeda da clínica). Risco de regressão. | `lib/finance-utils.ts:5-6` | Deprecar `formatBRL`, padronizar `formatMoney`. |

**Já está prático (não mexer):** superfície de settings por clínica rica e real (`clinical-tests`, `session-types`, `offers`, `supplements`, `regional`, `branding`, `voice`, `whatsapp`, `practitioners`); catálogo de exames por clínica; moeda por clínica bem tratada (Pix/Boleto só em BRL, cartão em USD/EUR); página de sessão bem internacionalizada; assessments data-driven; semáforo de exame por faixa de referência; templates de comunicação por chave; Meta-WhatsApp já isola por clínica (SEC-01, o padrão a replicar).

---

## 6. Plano de execução sugerido (por esforço x retorno)

**Lote 1 — quase de graça, retorno alto (dá para fazer hoje):**
- Economia P0-1: `gpt-4o` → `gpt-4.1-mini` no health-agent (uma linha, -80% naquele ponto).
- Eficácia P1: logar `response.model` real.
- Praticidade P0: aplicar a guarda SEC-01 (do Meta-WhatsApp) aos outros 4 canais para matar o vazamento IFWC. **Este é o mais urgente: hoje uma clínica cliente pode falar como a IFWC.**
- Facilidade P1: ligar toast de sucesso nas 3 mutations principais (agendar, criar paciente, registrar sessão).

**Lote 2 — meio dia cada, corta custo e fricção:**
- Economia P1-2: fundir as 2 chamadas de PDF de exame numa só.
- Economia P1-1: cache de business-insights espelhando o de finance-insights.
- Facilidade P0: erro inline (não throw) em agendar/criar paciente/registrar sessão, preservando o formulário.
- Eficácia P2: timeout `AbortSignal` em todas as chamadas OpenAI; separar `OPENAI_MODEL_CHAT`/`_REPORT`.

**Lote 3 — trilha de comercialização trilíngue:**
- Praticidade P0: criar `messages/pt-PT/*` nativo + `pt-PT` em `LOCALES` + switcher de 3 opções.
- Praticidade P0/P1: mover as páginas cravadas (`monetization`, `leads`, `billing`, `products`, etc.) para i18n.
- Praticidade P1: vitais e escala de dor configuráveis por clínica.

**Lote 4 — higiene e economia recorrente:**
- Economia P2-2: reordenar o system prompt da Clara para ativar o cache automático.
- Economia P2-3: pós-processar "—"/formato em código.
- Economia P2-1/P2-4: medir Whisper por minuto e adicionar cap de tamanho nos canais Meta.
- Eficácia P2: retry/backoff nas chamadas de IA; CronGuard contra concorrência; parse defensivo no analytics; testes de idempotência e fallback.

---

*Auditoria somente-leitura. Nada foi alterado no código. Cada achado tem evidência arquivo:linha para conferência.*
