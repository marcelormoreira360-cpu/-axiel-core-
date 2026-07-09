# Guia — Ligar a IA no Messenger do Facebook (AXIEL Core)

O código do bot já existe e está pronto: `app/api/meta/facebook/route.ts`.
Este guia é só a parte de configuração na Meta + Vercel. Siga na ordem.

**Webhook (URL que a Meta vai chamar):**
`https://axiel-core-6ikl.vercel.app/api/meta/facebook`
*(confirmar se é esse o domínio de produção ou se há domínio próprio)*

**3 variáveis que o código espera** (a `OPENAI_API_KEY` já está no Vercel):
- `META_APP_SECRET` — vem do app na Meta
- `META_FACEBOOK_PAGE_TOKEN` — vem da Página na Meta
- `META_VERIFY_TOKEN` — você inventa (qualquer senha aleatória)

---

## FASE 1 — Usar o app AXIEL que já existe (NÃO criar novo)

> O app **AXIEL** (ID `1468755454577652`) já existe, está **Publicado** e já tem o
> caso de uso **Messenger** pronto. Use ele. NÃO use o "AXIEL Growth" (ID
> 3096261297430300) — esse é do produto Growth (publicação de conteúdo).

1. Em **developers.facebook.com → Meus apps**, abra o app **AXIEL**.
2. No **Painel**, seção **Casos de uso neste app**, clique em
   **Interagir com os clientes no Messenger from Meta**.

## FASE 2 — Dentro do caso de uso Messenger

3. Aqui ficam, no mesmo lugar, as seções de: permissões (`pages_messaging`),
   tokens de acesso e webhooks. As próximas fases acontecem dentro desta tela.

## FASE 3 — Conectar a Página e gerar o Page Token

9. Vá em **Messenger → Settings / Configurações**.
10. Seção **Access tokens / Tokens de acesso** → **Connect / Add (Conectar página)**.
11. Conecte a Página **Integrative and Functional Wellness Center** (@jifwcenter). Se pedir, autorize o app a acessar o ativo.
12. Ao lado da página conectada → **Generate token / Gerar token** → **copie** esse valor.
    → Esse é o **`META_FACEBOOK_PAGE_TOKEN`**. Guarde num lugar seguro.

## FASE 4 — Pegar o App Secret

13. Menu lateral → **App settings / Configurações do app → Basic / Básico**.
14. No campo **App secret / Chave secreta** → **Show / Mostrar** → **copie**.
    → Esse é o **`META_APP_SECRET`**.

## FASE 5 — Criar o Verify Token (você inventa)

15. Não vem da Meta. Gere uma string aleatória. No Terminal do Mac:
    ```
    openssl rand -hex 16
    ```
    Copie o resultado. → Esse é o **`META_VERIFY_TOKEN`**.
    (Você vai usar o MESMO valor em dois lugares: no Vercel e no painel do webhook.)

## FASE 6 — Colar as 3 variáveis no Vercel

16. Acesse o **Vercel → projeto do AXIEL Core → Settings → Environment Variables**.
17. Adicione as três, ambiente **Production** (e Preview, se quiser testar em preview):
    - `META_APP_SECRET` = (Fase 4)
    - `META_FACEBOOK_PAGE_TOKEN` = (Fase 3)
    - `META_VERIFY_TOKEN` = (Fase 5)
18. Salve.

## FASE 7 — Deploy (Claude faz, com seu OK)

19. O ajuste bilíngue (PT/EN) está pronto no código, só falta subir.
    Claude faz: `commit` + `push` → o Vercel faz deploy automático.
    **Importante:** o deploy precisa estar no ar ANTES da Fase 8 (senão a verificação do webhook falha).

## FASE 8 — Configurar o webhook na Meta

20. Volte em **Messenger → Settings → Webhooks**.
21. **Add Callback URL / Editar**:
    - **Callback URL:** `https://axiel-core-6ikl.vercel.app/api/meta/facebook`
    - **Verify token:** o MESMO valor da Fase 5
    - **Verify and save / Verificar e salvar** → deve ficar verde
      (a Meta chama a URL, o código responde o desafio).
22. Em **Webhook fields / Campos**, assine o campo **`messages`**
    (opcional: `messaging_postbacks`). **Subscribe**.
23. Em **Subscribed pages**, confirme que a Página **IFWC** está inscrita no webhook.

## FASE 9 — Testar (modo desenvolvimento)

24. Enquanto o app está em **Development**, o bot só responde a contas com papel no app (você é admin).
25. Pela sua conta pessoal, mande uma DM para a Página **IFWC** no Messenger.
    → O bot deve responder em segundos, na mesma Inbox.
26. **Teste o bilíngue:** mande uma mensagem **em inglês** e confirme que ele responde em inglês.

## FASE 10 — Liberar ao público (App Review)

27. Quando estiver funcionando, peça **Advanced Access** para a permissão **`pages_messaging`** em **App Review**.
    Vai precisar de:
    - App em modo **Live** (toggle no topo do painel)
    - **Política de privacidade:** `https://axiel-core-6ikl.vercel.app/privacidade` (você já tem)
    - **Business Verification** (verificação do negócio, pode ser exigida)
    - **Screencast** demonstrando o bot respondendo
28. Aprovação leva dias. Até lá, funciona só com contas com papel no app.

---

## Pontos de atenção

- **Não rode as Automations nativas do Meta junto com o bot.** Desligue as automações da Inbox (resposta instantânea / ad replies) quando o AXIEL estiver ativo, senão respondem duplicado.
- **Janela de 24h:** a Meta só deixa responder dentro de 24h da última mensagem do lead. Para lead novo (acabou de escrever) está sempre ok.
- **Human takeover:** o código tem o flag `bot_disabled` por conversa. Quando você assume manualmente, o bot deve calar. (Gatilho automático ao responder pela Inbox é um refinamento futuro.)
- **Token de página:** o token gerado em dev pode expirar. Para produção estável, depois trocar por token de longa duração / System User.
