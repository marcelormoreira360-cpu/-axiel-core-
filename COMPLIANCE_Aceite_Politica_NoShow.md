# Aceite de Consentimento da Política de No-Show e Cancelamento Tardio

**Entidade:** Innovative Functional Wellness Center (IFWC) / OXIEL Core
**Autor:** Lex (Head of Compliance & Legal), com as lentes de Selo (Privacidade & Dados) e Termo (Contratos, Claims & Consumer)
**Data:** 2026-08-13
**Status:** rascunho PRONTO para revisão de Marcelo. Nada vai a produção nem habilita cobrança real sem OK explícito dele. Itens marcados "ADVOGADO HUMANO" exigem validação de advogado licenciado na Flórida antes de operar.
**Documento-irmão:** `POLITICA_Taxa_NoShow_LateCancel.md` (Cobro define valores, janela e fluxo operacional). Este documento define o **gate de consentimento** que torna a taxa defensável.

> **Aviso de escopo (Lex não é advogado):** este material é apoio de compliance, preparação e sinalização de risco. Não é parecer jurídico oficial, não substitui advogado, não vincula. O ato jurídico oficial (aprovar o texto contratual, confirmar defensabilidade sob a lei da Flórida e FTC) é de advogado humano licenciado. Mesma lógica do CPA no financeiro.

---

## 0. Briefing rápido (o que este documento resolve)

A feature de taxas está travada de propósito: o Core distingue `no_show` e `late_cancel`, cria uma "pendência de decisão", mas **não dispara cobrança**. O bloqueador de compliance para destravar não é o valor (isso é Cobro/Margo), é **provar que o paciente conheceu e aceitou a política ANTES de agendar**. Sem esse aceite registrado, uma taxa de falta é o lançamento com maior probabilidade de virar chargeback perdido e atrito de reputação.

Este documento entrega:
1. Os requisitos para a taxa ser **cobrável com defensabilidade** (lente Termo).
2. **Onde e quando** capturar o aceite no fluxo real do Core (a-validar Nucleo/Forja).
3. **O que gravar** para auditoria e o modelo de dado reaproveitando o que já existe (lente Selo).
4. O **texto da política** ao paciente, versionado, trilíngue mais ES.
5. O **checklist** para ligar a cobrança com segurança, separando decisão de Marcelo do que precisa de advogado humano.

---

## 1. Requisitos de compliance para a taxa ser cobrável com defensabilidade
### (lente Termo: FTC, consumer practices, escopo LMT-FL, OON/superbill)

A defensabilidade de uma taxa de no-show/late-cancel se sustenta em quatro pilares. Se qualquer um falhar, a cobrança fica frágil (chargeback e reclamação de consumidor):

### 1.1. Divulgação clara ANTES do compromisso (pré-agendamento)
- A política precisa estar **visível e legível antes de o paciente confirmar o horário**, não escondida em link de rodapé nem enviada só depois da falta.
- Deve dizer, em linguagem simples: (a) existe janela mínima de aviso (default 24h da IFWC); (b) faltar ou cancelar fora da janela **pode** gerar taxa; (c) como o valor é definido (percentual do serviço, com piso/teto, ou valor fixo, conforme a clínica configura); (d) que há cortesia na 1ª ocorrência quando aplicável; (e) como a taxa seria cobrada (mesmo meio de pagamento/cartão em arquivo, link de pagamento).
- Princípio FTC/consumer: **sem surpresa e sem letra miúda enganosa.** O termo material (que pode haver cobrança e mais ou menos quanto) tem que estar à vista no momento da decisão, não em local que exija esforço para encontrar.

### 1.2. Aceite afirmativo e registrado (opt-in, não opt-out)
- Aceite tem que ser **ação positiva do paciente**: marcar uma caixa de "Li e concordo" ou tocar num botão "Aceito a política e confirmar agendamento". **Não** pode ser caixa pré-marcada, nem "ao continuar você concorda" implícito sem clique dedicado.
- O aceite tem que ser **registrado com prova**: quem, quando, qual versão do texto, de qual canal (ver seção 3). É esse registro que ganha ou perde um chargeback.
- Recomendação de robustez: **botão de confirmar desabilitado até a caixa ser marcada.** Isso deixa o aceite inequívoco e auditável.

### 1.3. Valor e forma de cálculo visíveis (transparência de preço)
- O paciente não precisa ver centavos exatos no ato (o valor final depende do serviço e da decisão manual da clínica), mas precisa entender **a regra**: "pode haver taxa de falta/cancelamento tardio, tipicamente um percentual do valor do serviço, com limite mínimo e máximo" ou o valor fixo da clínica.
- **Nunca** apresentar como "grátis/sem custo" e depois cobrar. A regra apresentada tem que bater com a regra aplicada. Se a IFWC opera em modo cortesia+aviso hoje, o texto não pode prometer isenção permanente.
- Boa prática (opcional, a decidir com Cobro): mostrar a **faixa** ("no-show: até US$150; cancelamento tardio: até US$75") reduz alegação de surpresa.

### 1.4. Janela e direito do consumidor claros
- A **janela** (24h) tem que estar no texto e ser a mesma configurada em `clinics.cancellation_window_hours`. Divergência entre o texto e o sistema é munição para o paciente numa disputa.
- **Direito do consumidor / porta de saída:** o texto deve deixar claro que cancelamento **dentro** da janela não gera taxa, e que há canal para falar sobre imprevistos (emergência, saúde). Isso alinha com a política de cortesia do Cobro e reduz atrito. Uma taxa que não admite exceção humana parece abusiva e convida à contestação.
- **Não** usar linguagem de penalidade/multa punitiva. Enquadrar como **taxa por horário reservado e não utilizado** (a agenda foi bloqueada), que é o racional defensável de uma clínica de serviço por hora.

### 1.5. Escopo de prática LMT na Flórida (lente Termo)
- A cobrança de taxa administrativa de no-show **não é ato clínico** e está dentro do que um estabelecimento de massagem/LMT pode fazer como prática comercial. Uma taxa de "horário reservado não utilizado" é prática de negócio comum e legítima.
- **Cuidado de linguagem (claim):** o texto da política é comunicação da clínica ao paciente e **não pode conter claim de tratar/curar/diagnosticar doença** nem promessa clínica. O texto abaixo é neutro (fala de horário, aviso e taxa), sem nenhum claim de saúde. Manter assim.
- **Não** vincular a taxa a "resultado de tratamento" nem sugerir que faltar prejudica a cura (isso mistura ato clínico com cobrança e é evitável). Taxa é administrativa, ponto.
- ADVOGADO HUMANO: confirmar se a IFWC, como estabelecimento licenciado (MM44640) e LMT (MA103089), tem qualquer exigência estadual da Flórida de **como** exibir política de cancelamento de estabelecimento de saúde/massagem. Não é esperado que haja regra específica de forma, mas a confirmação é ato jurídico.

### 1.6. OON / superbill (lente Termo)
- A IFWC é **out-of-network** e emite **superbill** para o paciente buscar reembolso do próprio seguro. A taxa de no-show/late-cancel **não é serviço de saúde reembolsável** e **não entra no superbill** com código de procedimento (CPT/ICD). Colocar taxa de falta como se fosse serviço clínico no superbill é risco de má representação a pagador.
- No recibo, a taxa sai como **linha administrativa neutra** ("Missed appointment fee" / "Taxa de falta"), **sem código clínico e sem qualquer dado de saúde**. Isso já está alinhado com a seção 3 da política do Cobro. Mantido.
- Seguro/pagador em geral **não reembolsa** taxa de no-show; portanto a taxa é responsabilidade direta do paciente (self-pay), o que reforça a necessidade do aceite prévio como base da cobrança.

### 1.7. O que reduz risco de chargeback (resumo operacional)
Um chargeback de taxa de falta se ganha com prova. Ter em mãos, por cobrança:
1. Registro de aceite da política (versão, timestamp, canal, IP/user-agent quando web).
2. O texto exato da versão aceita (arquivado, versionado).
3. O evento da falta no log append-only (`appointment_status_events`), com horário do agendamento e da não presença.
4. Evidência do aviso de cortesia na 1ª ocorrência (mostra boa-fé e que o paciente foi educado antes de qualquer cobrança).
5. Cálculo do valor conforme regra publicada (piso/teto), não arbitrário.

> **Fronteira Lex:** os itens acima são orientação de compliance e boas práticas de consumer/FTC e de disputa de cartão. **Não são parecer jurídico.** A confirmação de que este desenho é suficiente e defensável sob a lei da Flórida, FTC Act e regras da rede de cartão é **ato de advogado humano**. Lex prepara e sinaliza; o advogado valida e assume.

---

## 2. Onde e quando capturar o aceite no fluxo do Core
### (a-validar com Nucleo/Forja: rotas reais confirmadas por leitura do código, mas a implementação é deles)

**Princípio:** o aceite entra **imediatamente antes de o paciente confirmar o horário**, em todo ponto de entrada que cria um agendamento. Depois de confirmado é tarde (a divulgação tem que ser prévia).

### 2.1. Agendamento público (`app/book/[slug]`) — ponto principal
- O fluxo hoje tem os passos: `profissional → service → date → slot → info → done`. O passo **`info`** é onde o paciente digita nome/e-mail/telefone e clica em **Confirmar** (o botão que chama POST `/api/book/[slug]`).
- **Ponto de captura:** dentro do passo `info`, **abaixo dos campos e acima do botão Confirmar**, exibir o resumo curto da política + a caixa de aceite afirmativo. **O botão "Confirmar" fica desabilitado até a caixa ser marcada.**
- O POST `/api/book/[slug]` passa a receber o sinal de aceite (ex.: `policy_accepted: true` + `policy_version`) e a gravar o registro (seção 3) na mesma transação lógica em que cria patient+appointment (`createPublicBooking` em `services/appointment-service.ts`, que já resolve `patient_id` antes de criar o `appointment`).
- **Guard de servidor (importante):** o POST deve **recusar** o booking se `policy_accepted` não vier verdadeiro **e** a clínica tiver a política de taxa ligada. Aceite só no front é burlável; a checagem final é no servidor.

### 2.2. Agendamento por voz (Vapi / Clara → `/api/vapi`, `/api/p/book`)
- No canal de voz não há caixa para marcar. O aceite tem que ser **verbal e registrado**: a Clara **lê** o resumo da política e pede confirmação falada ("posso confirmar que você está de acordo com a política de cancelamento de 24 horas?"), e o "sim" é gravado como aceite (canal `voice`, com referência à chamada/transcrição).
- ADVOGADO HUMANO: aceite verbal por IA é mais fraco que clique/texto para fins de disputa. Recomendação Lex: para o canal de voz, **preferir modo cortesia+aviso** (sem cobrar) até haver validação jurídica de que o aceite verbal registrado é suficiente, OU enviar em seguida um SMS/e-mail com a política e um link de confirmação (aceite por texto, mais forte). A-decidir com Marcelo.

### 2.3. Self-register / link de agendamento / confirmação (`app/join/[token]`, `app/confirmar/[token]`, `app/schedule/new` interno)
- **Links de agendamento e self-register** que levam o paciente a marcar sozinho: mesmo padrão do 2.1 (aceite antes de confirmar).
- **`app/confirmar/[token]` (paciente confirma um horário já criado pela clínica):** se o horário foi criado internamente pela recepção, o aceite pode ser capturado **neste passo de confirmação** (é o momento em que o paciente age). Exibir o resumo + caixa antes do botão "Confirmar horário".
- **Agendamento criado 100% internamente pela clínica (staff marca pelo paciente, `app/schedule/new`), sem passo de confirmação do paciente:** aqui não há clique do paciente. Duas opções, a-decidir: (a) a política vira parte do **onboarding/intake** assinado uma vez pelo paciente (aceite guarda-chuva, renovado por versão); (b) enviar link de confirmação com aceite. Sem um desses, uma taxa sobre agendamento puramente interno é frágil.

> **A-validar Nucleo/Forja:** as rotas acima foram confirmadas por leitura do código (existem `app/book/[slug]`, `app/confirmar/[token]`, `app/join/[token]`, `app/api/book/[slug]`, `app/api/p/book`, `/api/vapi`). O **desenho de UI, o gating do botão e o guard de servidor** são implementação do Forja com dado do Nucleo. Lex especifica o requisito; não fixa a rota final nem o componente.

---

## 3. O que gravar para auditoria + modelo de dado
### (lente Selo: captura de consentimento, LGPD/HIPAA, minimização, append-only)

### 3.1. Princípio Selo: reaproveitar `patient_consents`, não criar do zero
O Core já tem a tabela **`patient_consents`** (migration 045), usada como **log append-only** de consentimento e já reaproveitada pela migration 132 (opt-in por canal) exatamente por guardar a prova: `granted`, `ip_address`, `user_agent`, `source`, `created_at`. O padrão é: **o estado atual é a linha mais recente** (`created_at DESC`) daquele `consent_type` para o paciente. Vamos seguir o mesmo padrão em vez de criar tabela nova.

Campos existentes hoje em `patient_consents`:
`id, clinic_id, patient_id, consent_type, granted, ip_address, user_agent, source, notes, created_at`.

**Novo valor de `consent_type`:** `no_show_policy`.

### 3.2. O que precisa ser gravado (mínimo para defensabilidade)
| Dado | Onde | Por quê |
|---|---|---|
| Paciente/lead | `patient_id` (já resolvido no booking, existente ou novo) | Quem aceitou |
| Tipo | `consent_type = 'no_show_policy'` | Identifica o consentimento |
| Aceite | `granted = true` | Aceite afirmativo |
| Momento | `created_at` (timestamptz) | Prova temporal (antes do agendamento) |
| Canal | `source`: `website` \| `confirm_link` \| `self_register` \| `voice` \| `intake` | De onde veio |
| Prova técnica (web) | `ip_address`, `user_agent` | Robustez em chargeback |
| **Versão da política** | ver 3.3 | Prova de QUAL texto foi aceito |
| **Vínculo ao agendamento** | ver 3.3 | Liga o aceite ao appointment que gerou a taxa |

### 3.3. Gap: versão da política e vínculo ao agendamento
`patient_consents` **não tem** hoje colunas para versão do texto nem para `appointment_id`. Duas formas de resolver, a-validar pelo Forja:

**Opção A (recomendada Lex, mais defensável): migration aditiva mínima.** Adicionar duas colunas nullable em `patient_consents`:
```
policy_version   text        -- ex.: 'no_show_v1.0'
appointment_id   uuid references public.appointments(id) on delete set null
```
Vantagem: consulta limpa ("qual versão o paciente aceitou e para qual agendamento"), sem parsear texto. Índice já existente `(patient_id, consent_type, created_at DESC)` continua servindo. Aditivo e idempotente, não quebra os usos atuais (canais, LGPD).

**Opção B (sem migration): usar `notes` como JSON estruturado.** Gravar `notes = '{"policy_version":"no_show_v1.0","appointment_id":"...","window_hours":24}'`. Vantagem: zero schema change. Desvantagem: dado semiestruturado, consulta mais frágil e menos auditável. Aceitável como ponte, não como final.

**Arquivo do texto versionado:** o texto de cada versão (v1.0 abaixo) precisa ficar **arquivado e imutável** (no repo e/ou tabela de versões `policy_texts`, a-decidir com Nucleo). Guardar só `policy_version` na linha de aceite só vale se o texto daquela versão puder ser recuperado exatamente. Recomendação Selo: versão = string estável + texto arquivado no repo sob controle de versão (git já dá imutabilidade e data).

### 3.4. Minimização e separação de dados (Selo)
- O registro de aceite **não contém dado clínico nem de saúde.** É só: quem, quando, qual versão, qual canal, qual agendamento. Mantém a regra de separação de dados.
- **BR (LGPD) x EUA (HIPAA/FL):** o aceite em si é dado cadastral/contratual, não é PHI. Mas como `patient_consents` é escopada por `clinic_id` com RLS (staff só lê a própria clínica) e o Core trata paciente EUA sob HIPAA e paciente BR sob LGPD, o registro herda o mesmo tratamento das demais linhas de consentimento. Nada novo de risco de privacidade é introduzido, **desde que** o `notes`/campos não recebam dado clínico (garantir no código).
- **Retenção:** manter o registro de aceite pelo tempo em que a cobrança possa ser contestada (janela de chargeback + prazo de cobrança), alinhado à política de retenção geral. Append-only: **nunca** sobrescrever um aceite; um novo aceite (nova versão) é uma nova linha. A revogação, se um dia existir, é `granted = false` numa nova linha, mantendo o histórico.
- **Direito de eliminação (LGPD/erasure):** se o paciente pedir exclusão, o aceite pode precisar ser **retido como prova de obrigação/defesa em disputa** mesmo após pedido de exclusão de outros dados. Isso é exceção legítima de retenção. ADVOGADO HUMANO confirma o balanço entre erasure e retenção para defesa.

### 3.5. Estado consultável
Para saber "este paciente aceitou a política vigente?": buscar a linha mais recente de `consent_type = 'no_show_policy'` do paciente; se `granted = true` **e** `policy_version` = versão vigente da clínica, está coberto. Se a versão vigente mudou desde o aceite, tratar como **reaceite necessário** no próximo agendamento (não invalida taxas passadas, que se defendem pela versão que estava vigente à época).

---

## 4. Texto da política ao paciente (v1.0)
### Curto, cordial, sem jargão, sem claim clínico, sem promessa

**Versão:** `no_show_v1.0` · **Data:** 2026-08-13 · **Status:** rascunho a aprovar por Marcelo e validar por advogado humano antes de publicar.

**Notas de uso:**
- `[X]` = janela em horas (default 24, vem de `clinics.cancellation_window_hours`).
- O texto fala em "pode haver taxa" e "definida pela clínica" de propósito: não promete isenção permanente nem finge que nunca cobra. Bate com a operação de cortesia+aviso do Cobro.
- Sem o caractere travessão. Sem claim de saúde. Neutro e administrativo.

### 4.1. Texto curto (exibido no ponto de aceite, acima da caixa)

**pt-BR**
> **Política de agendamento e cancelamento.** Seu horário fica reservado só para você. Se precisar remarcar ou cancelar, pedimos aviso com pelo menos [X] horas de antecedência. Faltas sem aviso ou cancelamentos feitos com menos de [X] horas podem incluir uma taxa, definida pela clínica (em geral um percentual do valor do serviço, com limite mínimo e máximo). Na primeira vez, quando aplicável, é apenas um lembrete, sem cobrança. Cancelamentos dentro do prazo não têm nenhum custo. Se surgir um imprevisto, fale com a gente, estamos aqui para ajudar.
>
> ☐ Li e concordo com a política de agendamento e cancelamento.

**EN**
> **Scheduling and cancellation policy.** Your appointment time is reserved just for you. If you need to reschedule or cancel, we ask for at least [X] hours' notice. Missed appointments with no notice, or cancellations made with less than [X] hours' notice, may include a fee set by the clinic (usually a percentage of the service price, with a minimum and a maximum). The first time, when it applies, is just a friendly reminder with no charge. Cancellations made within the window are always free. If something comes up, reach out, we're happy to help.
>
> ☐ I have read and agree to the scheduling and cancellation policy.

**pt-PT**
> **Política de marcação e cancelamento.** O seu horário fica reservado apenas para si. Caso precise de remarcar ou cancelar, pedimos aviso com, no mínimo, [X] horas de antecedência. Faltas sem aviso, ou cancelamentos feitos com menos de [X] horas, podem incluir uma taxa, definida pela clínica (habitualmente uma percentagem do valor do serviço, com um limite mínimo e máximo). Da primeira vez, quando aplicável, é apenas um lembrete, sem qualquer cobrança. Cancelamentos dentro do prazo não têm qualquer custo. Se surgir algum imprevisto, fale connosco, estamos aqui para ajudar.
>
> ☐ Li e concordo com a política de marcação e cancelamento.

**ES**
> **Política de citas y cancelación.** Su cita queda reservada solo para usted. Si necesita reprogramar o cancelar, le pedimos aviso con al menos [X] horas de antelación. Las ausencias sin aviso, o las cancelaciones hechas con menos de [X] horas, pueden incluir un cargo definido por la clínica (por lo general un porcentaje del precio del servicio, con un mínimo y un máximo). La primera vez, cuando corresponda, es solo un recordatorio, sin cobro. Las cancelaciones dentro del plazo no tienen ningún costo. Si surge algún imprevisto, contáctenos, estamos aquí para ayudar.
>
> ☐ He leído y acepto la política de citas y cancelación.

### 4.2. Versão longa (página de política / link "ver detalhes")
Para quem clicar em "ver política completa", reaproveitar o mesmo texto acima acrescido de: a faixa de valores vigente da clínica (ex.: "no-show: até US$150; cancelamento tardio: até US$75"), a forma de cobrança (link de pagamento ou cartão em arquivo), e o canal de contato para imprevistos. Manter neutro e sem claim. Detalhe de valores vem do Cobro/Margo; Lex valida só a linguagem.

> **Fronteira:** este é texto de apoio pronto para uso. **Não é cláusula contratual oficial** até Marcelo aprovar e advogado humano validar a redação sob a lei da Flórida e FTC. Palavras como "taxa", "reservado" e "sem cobrança na primeira vez" foram escolhidas para serem claras e não punitivas; a validação final da redação é jurídica.

---

## 5. Checklist para LIGAR a cobrança real com segurança

### 5.1. Compliance / produto (pré-requisitos técnicos do gate)
- [ ] Texto v1.0 aprovado por Marcelo (seção 4).
- [ ] Texto v1.0 validado por **advogado humano** (redação, defensabilidade FL/FTC).
- [ ] Aceite afirmativo implementado no ponto de captura (seção 2.1), com **botão Confirmar desabilitado até marcar a caixa**.
- [ ] **Guard de servidor** recusa booking sem aceite quando a política de taxa está ligada (não confiar só no front).
- [ ] Registro de aceite gravado em `patient_consents` com `consent_type='no_show_policy'`, `policy_version`, canal e (web) IP/user-agent (seção 3).
- [ ] Migration aditiva (Opção A) ou fallback JSON (Opção B) decidida com Forja e aplicada.
- [ ] Texto de cada versão **arquivado imutável** (repo/git) e recuperável pela `policy_version`.
- [ ] Janela do texto = `clinics.cancellation_window_hours` (sem divergência texto x sistema).
- [ ] Fluxo de voz (Clara/Vapi): definido se opera em cortesia+aviso ou com aceite verbal+confirmação por texto (seção 2.2).
- [ ] Agendamento 100% interno: definido como o aceite guarda-chuva/intake ou link de confirmação cobre esses casos (seção 2.3).
- [ ] Recibo/superbill: taxa sai como linha administrativa neutra, sem código clínico nem dado de saúde (seção 1.6, já alinhado com Cobro).
- [ ] Trilíngue mais ES publicado e revisado por falante nativo (Selo/Verbo checam pt-PT e ES).

### 5.2. O que Marcelo precisa DECIDIR / APROVAR
1. **Aprovar o texto v1.0** ou pedir ajuste de tom.
2. **Modo de largada:** ligar cobrança de fato só nos canais com aceite forte (web/confirmação por texto) e manter **cortesia+aviso** onde o aceite é fraco (voz), até validação. (Recomendação Lex: sim.)
3. **Mostrar faixa de valores** no ponto de aceite (ex.: "até US$150") ou só a regra? (Recomendação Lex: mostrar a faixa reduz alegação de surpresa.)
4. **Reaceite por versão:** ao mudar a política, exigir novo aceite no próximo agendamento? (Recomendação Lex: sim.)
5. Confirmar os itens de valor/janela que já estão na política do Cobro (seção 6 daquele doc), pois o texto ao paciente depende deles.

### 5.3. O que precisa passar por ADVOGADO HUMANO (ato jurídico oficial)
1. Validar que o desenho (divulgação prévia + aceite afirmativo registrado + versão) é **suficiente e defensável** sob a lei da Flórida, FTC Act e regras de rede de cartão.
2. Aprovar a **redação final** do texto v1.0 como termo de consumidor.
3. Confirmar exigências estaduais da Flórida (se houver) sobre exibição de política de cancelamento por estabelecimento de massagem/LMT licenciado.
4. Confirmar o balanço **retenção do aceite x direito de eliminação** (LGPD) e retenção para defesa em disputa (EUA).
5. Confirmar a suficiência do **aceite verbal por IA** (canal de voz) antes de cobrar por esse canal.
6. Confirmar que a taxa **fora do superbill** e como self-pay está correta do ponto de vista de billing a pagador.

---

## 6. Riscos sinalizados (autoridade consultiva "pare e revise")

- **RISCO ALTO, cobrar sem aceite prévio registrado:** chargeback quase certo e reclamação de consumidor. Este é o bloqueador que o gate resolve. **Recomendação Lex: manter a cobrança travada até 5.1 estar completo e o advogado validar.**
- **RISCO MÉDIO, aceite verbal por IA (voz):** mais fraco em disputa. Mitigar com cortesia+aviso ou confirmação por texto até validação jurídica.
- **RISCO MÉDIO, texto x sistema divergentes:** se o texto diz 24h e a config diz outra coisa, o paciente ganha a disputa. Amarrar texto à `cancellation_window_hours`.
- **RISCO MÉDIO, agendamento interno sem clique do paciente:** taxa sobre horário que o paciente nunca "aceitou" ativamente é frágil. Resolver via intake/confirmação.
- **RISCO BAIXO/REPUTAÇÃO:** clínica de wellbeing; taxa mal comunicada custa mais que arrecada. A régua conservadora (cortesia + porta para imprevistos + linguagem não punitiva) protege a relação. Já está no desenho.
- **RISCO de privacidade (baixo, controlado):** registro de aceite não pode receber dado clínico. Garantir no código que `notes`/campos só levam metadado de consentimento.

---

## 7. Divisão de trabalho (quem fez o quê)

- **Lex (consolidação):** requisitos de defensabilidade, integração das lentes, checklist, sinalização de risco, fronteiras do que exige advogado humano.
- **Termo (lente contratos/claims/consumer):** pilares FTC/consumer da seção 1, escopo LMT-FL (1.5), OON/superbill (1.6), redação neutra sem claim do texto v1.0.
- **Selo (lente privacidade/dados):** reaproveitamento de `patient_consents`, modelo de dado (seção 3), minimização, retenção x erasure, append-only, estado consultável.
- **Escaladas:** valores/janela/faixa → Cobro/Margo via Aurio (já na política-irmã). Rotas/UI/migration → Nucleo/Forja. Ato jurídico oficial → advogado humano. Disparo real de cobrança/refund → OK explícito de Marcelo.

---

*Documento de apoio de compliance. Preparado e pronto para revisão. Nada aqui é parecer jurídico oficial nem vai a produção ou habilita cobrança sem OK de Marcelo e validação de advogado humano nos itens marcados.*
