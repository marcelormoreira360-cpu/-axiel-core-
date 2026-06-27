# Guia — App Review da Meta (Messenger + Instagram)

Objetivo: liberar os bots para responder **leads reais (público)**. Hoje, em modo
de desenvolvimento, só respondem contas com papel no app (admin/dev/tester).

## Pré-requisitos
- App em modo **Live**: ✅ (Publicado)
- **Política de privacidade**: ✅ `https://axiel-core-6ikl.vercel.app/privacidade`
- **Verificação do Negócio** (Business Verification) do portfólio `jifwcenter`: ⚠️ CONFIRMAR.
  Costuma ser obrigatória; sem ela, o review trava. (Meta Business Suite → Configurações
  → Central de Segurança / Informações da empresa → Verificação.)
- **Opt-out para humano**: ✅ já implementado nos dois bots (o usuário pode pedir
  "falar com uma pessoa" e o bot escala + para de responder). Requisito-chave do review.

## Permissões a solicitar (Advanced Access)
- `pages_messaging` (Messenger)
- `instagram_business_manage_messages` (Instagram)
- `instagram_business_basic` (Instagram)
- `pages_manage_metadata` (se a Meta pedir — usada para assinar o webhook da Página)

## Justificativas — cole no campo "como o app usa" de cada permissão
> A revisão da Meta é feita em inglês; use os textos abaixo.

**pages_messaging**
> Our app is a customer-service assistant for a wellness clinic (Integrative &
> Functional Wellness Center). When a person sends a Direct Message to our Facebook
> Page, the app receives the message via webhook and replies automatically to answer
> questions about our services, qualify the inquiry, and help the person book an
> initial assessment, in the language the person used (Portuguese, English or Spanish).
> Users can ask to speak with a human at any time, which immediately hands the
> conversation to our staff and stops automated replies. We only message people who
> message us first, within the standard 24-hour messaging window.

**instagram_business_manage_messages**
> Same assistant, for Instagram. When a person sends a DM to our Instagram business
> account, the app receives it via webhook and replies automatically to answer
> questions and guide the person to book an appointment, in the language the person
> used. An opt-out to a human is always available. We only reply to people who
> contact us first.

**instagram_business_basic**
> Used to read the basic profile of the Instagram business account (account id) so
> the app can route each incoming message to the correct clinic configuration and
> respond on behalf of that account.

## Roteiro do screencast (grave a tela mostrando, com narração)
1. Mostre o app e a Página/conta do Instagram conectada.
2. De **outra conta** (uma conta de teste/sua segunda conta), envie uma DM para a
   Página (Messenger) e para o Instagram.
3. Mostre o **bot respondendo automaticamente** na tela do Messenger/Instagram.
4. Mostre o **bilíngue**: envie uma mensagem em inglês → o bot responde em inglês.
5. Mostre o **opt-out**: envie "I want to talk to a person" → o bot avisa que uma
   pessoa entrará em contato e para de responder automaticamente.
6. (Se pedirem) mostre o **fluxo de autorização**: como o negócio conecta a conta ao
   app (Instagram business login / conectar a Página).
- Narração: "This app is the customer-service assistant of our wellness clinic. It
  replies to DMs from people who message us first, answers questions and helps them
  book an appointment, and always lets the user reach a human."

## Submissão
1. App **AXIEL** → caso de uso de mensagens → passo **5. Concluir a análise do app**
   → **"Ir para Análise do app"**.
2. Adicione as permissões acima, cole as justificativas, anexe o screencast.
3. Preencha as **Notas de Análise** (como reproduzir: "Send a DM to the Page/IG; the
   app auto-replies; send 'talk to a person' to see the human handoff").
4. **Enviar**. Aprovação costuma levar de alguns dias a ~2 semanas.

## Depois da aprovação
- **Desligar a automação nativa** do Meta (Inbox → Automações) para não responder
  duplicado. A partir daí, os bots respondem os leads reais.

## Observações
- As **contas pessoais** (Facebook + Instagram `@marcelomoreira360`) usam as MESMAS
  permissões — o review cobre as duas. A ligação delas ao bot é configurada à parte
  (config no banco + inscrição do webhook), independente do review.
- **WhatsApp** é trilha separada (número WhatsApp Business + Twilio ou Cloud API),
  a fazer depois.
