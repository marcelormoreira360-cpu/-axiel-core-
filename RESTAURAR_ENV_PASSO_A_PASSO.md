# Restaurar variáveis de ambiente — passo a passo (por serviço)

> Como pegar o valor de CADA variável. Em todas, na Vercel:
> **Settings → Environment Variables → Add Environment Variable** → cole o valor → marque
> **Production, Preview e Development** → Save. No fim, **Redeploy**.
> Não cole valores secretos no chat — só na Vercel.

---

## 1) 📸 INSTAGRAM (prioridade)

### META_APP_SECRET
1. developers.facebook.com → app **AXIEL** → **Configurações do app → Básico**.
2. Campo **"Chave Secreta do Aplicativo"** → clique **Mostrar** (pode pedir senha) → **copie**.
3. Vercel: `META_APP_SECRET` = (cole).

### META_VERIFY_TOKEN
É um valor que **você inventou** quando configurou o webhook. Para recuperar/definir:
1. No app AXIEL → **Casos de uso → Instagram → Configurações da API → passo 3 (Configurar webhooks)**.
2. No campo **"Verificar token"**, defina um valor à sua escolha (ex.: `axiel_ig_verify_2026`) e salve lá.
3. Vercel: `META_VERIFY_TOKEN` = **o mesmo valor** (têm que ser idênticos).
> Se o webhook já está assinado e funcionando, isso só é usado se a Meta pedir re-verificação. Pode deixar por último.

---

## 2) 💬 WHATSAPP (se usa o bot por Meta)

### META_WHATSAPP_TOKEN e META_PHONE_NUMBER_ID
1. developers.facebook.com → app **AXIEL** → menu **WhatsApp → Configuração da API** (API Setup).
2. **Token de acesso** → copie → Vercel: `META_WHATSAPP_TOKEN`.
3. **Identificação do número de telefone** (Phone number ID, numérico) → copie → Vercel: `META_PHONE_NUMBER_ID`.

### (Opcional) Twilio — só se usa o canal legado Twilio
1. console.twilio.com → painel inicial.
2. **Account SID** → `TWILIO_ACCOUNT_SID`; **Auth Token** (Mostrar) → `TWILIO_AUTH_TOKEN`.
3. Seu número WhatsApp Twilio → `TWILIO_FROM_NUMBER` (ex.: `+14155238886`).

---

## 3) 📅 GOOGLE CALENDAR (você usava)

### GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET
1. console.cloud.google.com → selecione o projeto do AXIEL.
2. Menu **APIs e Serviços → Credenciais**.
3. Em **IDs do cliente OAuth 2.0**, clique no cliente do AXIEL.
4. **ID do cliente** → Vercel: `GOOGLE_CLIENT_ID`.
5. **Chave secreta do cliente** → Vercel: `GOOGLE_CLIENT_SECRET`.
> Se não achar a secret (Google às vezes esconde), clique em **"Redefinir chave secreta"** e use a nova.
> Confirme que a URI de redirecionamento inclui: `https://axiel-core-6ikl.vercel.app/api/integrations/google/callback`.

---

## 4) 💳 STRIPE (se cobra pelos planos)

### STRIPE_SECRET_KEY
1. dashboard.stripe.com → **Developers → API keys**.
2. **Secret key** → **Reveal** → copie → Vercel: `STRIPE_SECRET_KEY`.

### STRIPE_WEBHOOK_SECRET
1. Stripe → **Developers → Webhooks** → clique no endpoint do AXIEL (`.../api/stripe/webhook`).
2. **Signing secret** → **Reveal** → copie → Vercel: `STRIPE_WEBHOOK_SECRET`.
> Se não existir o webhook, crie um apontando para `https://axiel-core-6ikl.vercel.app/api/stripe/webhook`.

### STRIPE_PRICE_* (IDs dos preços)
1. Stripe → **Products** → abra cada produto/plano.
2. Copie o **Price ID** (começa com `price_...`) de cada um → Vercel:
   - `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_SCALE`, `STRIPE_PRICE_ENTERPRISE`.

---

## 5) 🎥 ZOOM (teleconsulta — se usa)
1. marketplace.zoom.us → **Manage → Build App** → seu app **Server-to-Server OAuth**.
2. Na aba **App Credentials**:
   - **Account ID** → `ZOOM_ACCOUNT_ID`
   - **Client ID** → `ZOOM_CLIENT_ID`
   - **Client Secret** → `ZOOM_CLIENT_SECRET`
3. Aba **Feature → Event Subscriptions** → **Secret Token** → `ZOOM_WEBHOOK_SECRET_TOKEN`.

---

## 6) 🔔 PUSH para pacientes (chaves geradas por mim — use estas)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = `BHrJVeVRW7XkYs8oCxi3st3XvgobU3rMEywmLxtkJEi3_XNNPcAeFq9b5aI3dI-Rf4l0ovj0CKiyW2ac3kZU-Jg`
- `VAPID_PRIVATE_KEY` = `Xo7DRyBB6ELH9tOeOFZq3LiQ9HO2gLXo3625QMrMzGQ`
- `VAPID_SUBJECT` = `mailto:mrodriguesmoreira@yahoo.com.br`
> Como são chaves novas, quem já tinha push ativado precisará reativar — normal.

---

## 7) 📞 VOZ (Daily — só se usa telefonia)
- `DAILY_API_KEY` = dashboard.daily.co → **Developers** → API key.

---

## 8) ⚙️ OPCIONAIS (valores que dá para definir você mesmo)
- `OPENAI_MODEL` = `gpt-4o-mini` (ou `gpt-4o`)
- `RESEND_FROM_EMAIL` = ex.: `IFWC <contato@jifwc.com>` (precisa do domínio verificado no Resend)
- `NEXT_PUBLIC_BASE_URL` = `https://axiel-core-6ikl.vercel.app`
- `NEXT_PUBLIC_DEFAULT_WHATSAPP_NUMBER` = seu número (ex.: `+5511999999999`)
- `SENTRY_ORG` / `SENTRY_PROJECT` = painel do Sentry (Settings da organização/projeto)
- `META_BOT_*` (booking url, método, nome) = opcionais; o bot já tem defaults

---

## Depois de adicionar tudo
1. **Redeploy** (Deployments → último → "..." → Redeploy).
2. Teste os recursos: agenda (Google), bot (WhatsApp/Instagram), cobrança (Stripe), etc.
3. **BACKUP:** rode no Terminal, na pasta do projeto, `npx vercel env pull .env.backup` para baixar um backup de todas as variáveis. Guarde esse arquivo num lugar seguro (e NÃO o suba para o Git).
