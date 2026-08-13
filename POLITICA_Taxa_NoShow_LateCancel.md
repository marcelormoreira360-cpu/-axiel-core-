# Política de Cobrança de No-Show e Cancelamento Tardio

**Entidade:** Innovative Functional Wellness Center (IFWC) / OXIEL Core
**Autor:** Cobro (Billing & Recebíveis, Departamento Financeiro)
**Data:** 2026-08-13
**Escopo:** documento de política que guia a Fase 2 da feature de status de agendamento. Não é código.
**Status:** rascunho para decisão de Marcelo. Vários valores dependem de OK dele (ver seção 6).

---

## Princípio-mestre (decisão travada com Marcelo)

**Nunca existe cobrança automática por falta ou cancelamento tardio.** O software só distingue os status, registra a ocorrência e cria uma **pendência de decisão**. Quem decide cobrar ou dispensar é **Marcelo ou Dayane**, caso a caso. O disparo de qualquer cobrança real é fluxo do financeiro (Cobro entrega pronto) e depende de **OK explícito de Marcelo**. Nem o sistema nem o assistente debitam o paciente sozinhos.

Isto já está refletido no banco (migration 141): o ciclo de status grava `no_show`, `late_cancel` e `cancelled_notice`, e uma ocorrência que pode gerar taxa entra na fila com `event_type = 'fee_decision_pending'`. A política abaixo diz **o que fazer com essa pendência**.

### Definições

- **`no_show`:** paciente não compareceu e não avisou. Maior impacto (a agenda ficou ociosa sem chance de reposição).
- **`late_cancel`:** paciente cancelou, mas fora da janela mínima de aviso (default 24h). Impacto menor que o no-show, porque houve aviso, ainda que tarde.
- **`cancelled_notice`:** cancelou dentro da janela. **Não gera taxa nem pendência.** Fica registrado só como histórico.

---

## 1. Regra do valor da taxa

### Opções avaliadas

| Modelo | Como funciona | Prós | Contras |
|---|---|---|---|
| Valor fixo por clínica | Um valor único (ex.: US$50) para qualquer falta | Simples de comunicar e configurar | Injusto entre uma sessão de US$150 e um plano; pode parecer alto no serviço barato e baixo no caro |
| % do preço da sessão | Percentual sobre `session_types.price_cents` do serviço agendado | Proporcional ao serviço; escala sozinho quando o preço muda | Exige o preço cadastrado no tipo de sessão; valor "quebrado" |
| Valor cheio da sessão | Cobra 100% do preço da sessão perdida | Máxima proteção da agenda | Agressivo para a relação; alto risco de atrito e chargeback |

### Recomendação para a IFWC

Usar **percentual sobre o preço do serviço agendado (`session_types.price_cents`)**, com percentuais diferentes para cada status e um **teto/piso em dólar** para não gerar valores estranhos:

- **`no_show`: 50% do preço do serviço**, com **piso de US$50** e **teto de US$150**.
- **`late_cancel`: 25% do preço do serviço**, com **piso de US$25** e **teto de US$75**.

Racional: late_cancel sempre cobra **menos** que no_show (o paciente ao menos avisou). O percentual mantém proporção entre uma Manual Therapy (US$150) e uma Microfisioterapia (US$300) sem precisar de tabela manual. O piso evita "taxa de US$12" que não vale o esforço de cobrar; o teto evita que uma sessão cara (ou um item do plano de US$1.370) gere uma taxa punitiva de centenas de dólares logo na primeira falta.

Exemplos com os preços de referência 2026:

| Serviço | Preço | Taxa no_show (50%, piso 50 / teto 150) | Taxa late_cancel (25%, piso 25 / teto 75) |
|---|---|---|---|
| Manual Therapy | US$150 | US$75 | US$37,50 |
| Evaluation / Neurometria | US$200 | US$100 | US$50 |
| Microfisioterapia | US$300 | US$150 (teto) | US$75 (teto) |
| Hair Test | US$150 a 200 | US$75 a 100 | US$37,50 a 50 |

> Alternativa aceitável, se Marcelo preferir simplicidade absoluta: **fixo US$75 no_show / US$40 late_cancel** para qualquer serviço. Mais fácil de explicar ao paciente, menos justo entre serviços. É uma escolha de Marcelo (ver seção 6).

### Configurável por clínica

O valor **não** deve ser hardcoded. Cada clínica (multi-tenant) define os seus parâmetros: modelo (fixo ou %), percentual/valor de no_show, percentual/valor de late_cancel, piso, teto e janela. O Nucleo cuida da tabela de config e da UI; esta política define os **defaults da IFWC** acima. Preço de serviço é domínio do Margo; aqui só se **aplica** o preço vigente. Se um `session_type` estiver sem `price_cents`, o modelo % não consegue calcular: nesse caso cai no valor fixo de fallback e Cobro sinaliza o cadastro faltante.

---

## 2. Fluxo operacional da decisão

### Quem e quando

1. Sessão marcada como `no_show` ou `late_cancel` gera **pendência** (`fee_decision_pending`) na fila.
2. **Dayane** faz a triagem em até **48h** (2 dias úteis) da ocorrência. Ela pode **dispensar** direto nos casos de cortesia (regras abaixo) ou **encaminhar para cobrar**.
3. Caso de cobrança encaminhado vira rascunho de cobrança preparado por Cobro e **só dispara com OK de Marcelo**.
4. Pendência sem decisão em **7 dias** vira alerta para não ficar esquecida (dinheiro na mesa ou paciente cobrado tarde demais, o que é pior).

### O que considerar antes de cobrar

- **1ª ocorrência x reincidência:** primeira falta tende à cortesia; a partir da 2ª a régua aperta. O banco já sinaliza reincidência com `event_type = 'repeated_no_show'` (2+ no-shows), que deve **priorizar** a decisão de cobrar.
- **Paciente novo x antigo:** paciente de longa data com histórico limpo merece o benefício da dúvida; paciente novo sem vínculo e sem aviso é candidato natural à taxa (também filtra no-show recorrente de agenda).
- **Pacote x avulso:** ver seção 3. Em pacote a "taxa" pode ser **consumir/debitar uma sessão do plano** em vez de gerar cobrança nova.
- **Contexto humano:** emergência, saúde, luto, mal-entendido de horário. A clínica é de wellbeing; a política existe para proteger a agenda, não para punir. Na dúvida entre cobrar e a relação, preservar a relação e registrar o motivo.

### Política de cortesia na 1ª falta (recomendada)

**Sim, adotar cortesia na 1ª ocorrência.** Na primeira falta (no_show ou late_cancel) de um paciente:

- **Dispensar a taxa** e **enviar um aviso cordial** explicando a política e que a próxima falta poderá ser cobrada. Isso educa sem desgastar e deixa registro de que o paciente foi avisado (importante se depois houver disputa).
- A partir da **2ª ocorrência**, a pendência é tratada como candidata real a cobrança, sujeita ao OK de Marcelo.

Toda decisão (cobrar ou dispensar) grava **motivo e responsável** no log append-only (`appointment_status_events` / fila de decisão), para auditoria e para Marcelo aprovar com contexto.

---

## 3. Encaixe no financeiro que o Core já tem

Quando a decisão é **cobrar**, a taxa é tratada como uma **cobrança avulsa** e reaproveita a infraestrutura existente, sem inventar fluxo novo:

- **Registro:** a taxa entra como um lançamento em `patient_payments`, com um item/descritor claro do tipo "Taxa de falta (no-show)" ou "Taxa de cancelamento tardio", **vinculado ao `appointment_id`** de origem (rastreabilidade). Nada de misturar com o valor do serviço em si.
- **Meios de pagamento:** usa os mesmos canais já suportados no `patient_payments` (`pix`, `boleto`, `credit_card`, `debit_card`, `cash`, `transfer`). Para paciente EUA da IFWC, o caminho natural é **Stripe** (cartão), Zelle ou check; no Brasil, Pix/boleto via o gateway já integrado. O status da cobrança segue o CHECK existente (`paid` / `refunded` / `partially_refunded` / `failed`).
- **Idempotência:** cobrança via Stripe já tem índice único em `stripe_payment_intent_id`, então não há risco de cobrar a mesma taxa duas vezes pelo webhook.
- **Pacote (plano de 10 sessões, US$1.370):** duas opções de política, escolha de Marcelo (seção 6):
  - **(a) Debitar uma sessão do pacote** como "consumida" pela falta. Simples, não gera cobrança externa, o paciente sente a perda. Nota: hoje a lógica `sync_package_sessions_used` só consome sessão em `confirmed/checked_in/completed`; para o pacote "queimar" sessão por no-show seria preciso um ajuste explícito no Nucleo (não é o default atual).
  - **(b) Não debitar sessão e cobrar taxa avulsa** como no avulso. Mantém o pacote intacto e trata a falta como custo à parte.
  - Recomendação: **(a) para pacote** (mais limpo e sem cobrança nova a disparar), reservando cobrança avulsa para casos de reincidência.
- **Invoice/recibo:** quando cobrada, a taxa pode sair num recibo/superbill com o item neutro "Missed appointment fee" e o valor, **sem qualquer dado clínico** (regra de separação de dados). Só linha de serviço e valor.

O **Nucleo** cuida do dado e da UI (fila, botões cobrar/dispensar, cálculo do valor sugerido). **Cobro** cuida do rascunho da cobrança e da mensagem, e nada dispara sem OK de Marcelo.

---

## 4. Dispensa (waive)

**Quando dispensar:**

- 1ª ocorrência (cortesia, ver seção 2).
- Motivo humano legítimo (emergência, saúde, luto, erro de horário da própria clínica).
- Paciente antigo com histórico limpo e falta isolada.
- Valor calculado abaixo do piso ou irrelevante frente ao atrito de cobrar.
- Falha de comunicação da clínica (lembrete não enviado, confusão de agenda).

**Avisar o paciente ao dispensar?**

- **Na cortesia da 1ª falta: SIM, avisar.** É justamente o aviso educativo que protege a clínica na próxima vez ("desta vez sem custo, a política prevê taxa em faltas futuras"). Sem esse aviso, a cortesia vira expectativa de gratuidade permanente.
- **Nas demais dispensas (paciente antigo, motivo humano): opcional, tende a NÃO avisar.** Cobrar seria o evento; dispensar em silêncio evita constranger quem já estava numa situação difícil. Registrar internamente o motivo, mas não necessariamente mandar mensagem.

Toda dispensa grava motivo e responsável no log.

---

## 5. Reembolso, chargeback e comunicação ao paciente

### Reembolso / chargeback

- **Reembolso:** se uma taxa foi cobrada e depois se decide reverter (revisão do caso, paciente contestou com razão), usa-se o fluxo de refund já existente em `patient_payments` (`refunded_at`, `refund_amount_cents`, status `refunded`/`partially_refunded`). Cobro registra quem, valor, motivo, status e impacto no caixa. Reembolso real também depende de OK de Marcelo.
- **Chargeback:** taxa de falta é o lançamento com **maior risco de contestação** de cartão (o paciente sente que "pagou por nada"). Isso reforça a necessidade da política visível **antes** do agendamento (abaixo): sem consentimento prévio documentado, um chargeback de taxa de no-show é quase sempre perdido. Se ocorrer chargeback, Cobro registra e propõe tratamento; não se recobra o paciente por fora.

### Política visível ao paciente ANTES de agendar (bloqueador)

**Pré-requisito para cobrar qualquer taxa:** o paciente precisa ter conhecido e aceito a política de no-show/cancelamento **antes** de marcar. Sem isso, a cobrança é frágil (jurídica e de reputação) e o chargeback é praticamente certo.

- Exibir a política no fluxo de agendamento (site jifwc.com, quiz/booking, confirmação) e idealmente com aceite registrado (timestamp).
- **Sinalizar ao Termo/Lex (via Aurio):** o texto da política de no-show, a janela de 24h, o valor e a forma de aceite precisam ser **validados por compliance** antes de entrar em produção e antes de qualquer cobrança. É questão contratual/consentimento, fora do escopo de Cobro. Enquanto Lex não validar o texto e o ponto de aceite, a recomendação é **operar só em modo cortesia/aviso** (registrar e educar), sem cobrar de fato.

### Linguagem sugerida para o paciente (curta e cordial)

Textos de exemplo, a validar com Lex, em EN para paciente da IFWC (Orlando) e PT para paciente Brasil.

**Aviso de cortesia na 1ª falta (EN):**

> Hi [Name], we missed you at your appointment on [date]. No charge this time. As a courtesy reminder, our policy asks for at least 24 hours' notice to change or cancel a visit; future missed appointments may include a [valor] fee. We'd love to get you rebooked, just reply here. Warmly, IFWC.

**Aviso de cortesia na 1ª falta (PT):**

> Olá [Nome], sentimos sua falta na consulta de [data]. Sem cobrança desta vez. Como lembrete, pedimos aviso de no mínimo 24 horas para remarcar ou cancelar; faltas futuras podem incluir uma taxa de [valor]. Ficaremos felizes em remarcar, é só responder aqui. Um abraço, IFWC.

**Aviso de taxa (reincidência, após OK de Marcelo) (EN):**

> Hi [Name], regarding your missed appointment on [date], a [valor] fee applies per the cancellation policy you agreed to when booking. You can settle it here: [link]. If something came up, reply and let's talk, we're happy to help. Warmly, IFWC.

**Aviso de taxa (reincidência) (PT):**

> Olá [Nome], sobre a falta na consulta de [data], aplica-se uma taxa de [valor], conforme a política de cancelamento aceita no agendamento. O pagamento pode ser feito aqui: [link]. Se houve algum imprevisto, responda que a gente conversa. Um abraço, IFWC.

Tom: cordial, sem culpar, sem promessa de cura nem claim clínico, valor e prazo claros, porta aberta para remarcar.

---

## 6. Riscos e o que Marcelo precisa DECIDIR

### Decisões pendentes (travar valores)

1. **Modelo do valor:** percentual sobre o serviço (recomendado) ou valor fixo?
2. **Valor default no_show:** recomendado **50% (piso US$50 / teto US$150)**. Confirmar ou fixar em US$75.
3. **Valor default late_cancel:** recomendado **25% (piso US$25 / teto US$75)**. Confirmar ou fixar em US$40.
4. **Janela de aviso:** confirmar **24h** como default do late_cancel (poderia ser 48h para serviços longos).
5. **Cortesia na 1ª falta:** adotar? (recomendado **sim**, com aviso educativo).
6. **Pacote:** falta em pacote **debita uma sessão do plano** (recomendado) ou **cobra taxa avulsa**? Se debitar, requer ajuste explícito no Nucleo (o consumo hoje não conta no-show).

### Riscos

- **Chargeback / atrito** se cobrar sem a política aceita antes do agendamento. Mitigação: aceite prévio + validação de Lex (bloqueador da seção 5).
- **Preço faltante** em `session_types.price_cents` quebra o cálculo percentual. Mitigação: fallback em valor fixo + Cobro sinaliza cadastro.
- **Reputação:** clínica de wellbeing; taxa mal comunicada custa mais que a taxa arrecada. A régua conservadora (cortesia + teto) protege a relação.
- **Consistência multi-tenant:** defaults são da IFWC; outras clínicas configuram os seus. Não hardcodar.

### Escaladas

- **Valor/margem da taxa e do serviço:** validar com **Margo** via Aurio (a taxa deriva do preço do serviço, que é domínio dele).
- **Texto da política, janela, aceite e consentimento:** **Lex/compliance** via Aurio (bloqueador antes de cobrar de verdade).
- **Métrica de assinatura SaaS:** não se aplica aqui (é domínio do Pacto); esta política é da clínica.
- **Disparo real de qualquer cobrança/reembolso e ajuste no Stripe/Supabase:** pendente de **OK explícito de Marcelo**. Nem sistema nem assistente debitam o paciente sozinhos.

---

*Documento de política. O Nucleo implementa dado/UI em paralelo. Cobro prepara cobranças e mensagens prontas; nada dispara sem OK de Marcelo.*
