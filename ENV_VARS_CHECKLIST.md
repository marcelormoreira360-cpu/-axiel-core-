# Variáveis de ambiente — checklist de restauração (Vercel)

> Todas foram apagadas. Esta é a lista COMPLETA que o app usa.
> Restaure as dos recursos que você realmente usa. Marque conforme adiciona.
> Em todas, marque os 3 ambientes (Production, Preview, Development).
> Atualizado em 03/06/2026.

---

## ✅ OBRIGATÓRIAS — o build TRAVA sem elas (já restauradas)
- [x] `NEXT_PUBLIC_SUPABASE_URL` = `https://bfuulpvzedcrpmmjxles.supabase.co`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave **Publishable** do Supabase (`sb_publishable_...`)
- [x] `SUPABASE_SERVICE_ROLE_KEY` = chave **Secret** do Supabase (`sb_secret_...`)
- [x] `NEXT_PUBLIC_APP_URL` = `https://axiel-core-6ikl.vercel.app`
- [x] `CRON_SECRET` = `45aa0d726c164dfdf5a0200a15cea75c09a901b0ddd9e001`
- [x] `RESEND_API_KEY` = chave do Resend (`re_...`)
- [x] `OPENAI_API_KEY` = chave da OpenAI (`sk-...`)

## 📸 INSTAGRAM (objetivo de agora)
- [x] `META_INSTAGRAM_TOKEN` = token gerado para a `jifwcenter`
- [ ] `META_APP_SECRET` = Meta app → Configurações → Básico → "Chave Secreta do Aplicativo" (Mostrar) *(adicionando agora)*
- [ ] `META_VERIFY_TOKEN` = o valor que está no webhook do Instagram (campo "Verificar token"). Se não souber, defina um valor novo aqui E no campo do webhook na Meta (têm que ser iguais).

## 💬 WHATSAPP (se usa o bot de WhatsApp)
- [ ] `META_WHATSAPP_TOKEN` = token da WhatsApp Cloud API (Meta app → WhatsApp → API Setup)
- [ ] `META_PHONE_NUMBER_ID` = ID do número (mesmo lugar)
- [ ] `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` = só se usa o canal **Twilio** (legado). Se usa só Meta, ignore.

## 👍 FACEBOOK Messenger (se usa o bot no Messenger)
- [ ] `META_FACEBOOK_PAGE_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ACCESS_TOKEN_2`, `META_PAGE_ID_1`, `META_PAGE_ID_2` = tokens/IDs das Páginas do Facebook (Meta app). Se não usa Messenger, ignore.

## 💳 STRIPE (cobrança/assinaturas — se usa)
- [ ] `STRIPE_SECRET_KEY` = painel Stripe → Developers → API keys (secret)
- [ ] `STRIPE_WEBHOOK_SECRET` = Stripe → Webhooks → o endpoint → Signing secret
- [ ] `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_SCALE`, `STRIPE_PRICE_ENTERPRISE` = IDs dos preços (Stripe → Products)

## 📅 GOOGLE CALENDAR (você usava — provável precisar)
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` = Google Cloud Console → Credentials (o OAuth client do AXIEL)

## 🎥 ZOOM (teleconsulta — se usa)
- [ ] `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN` = Zoom Marketplace → seu app

## 🔔 PUSH para pacientes (se usa notificações push)
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` = par de chaves VAPID (se não tiver, dá para gerar novas — me peça)

## 📞 VOZ (telefonia Daily — se usa)
- [ ] `DAILY_API_KEY` = painel do Daily

## ⚙️ OPCIONAIS (têm padrão; só se quiser personalizar)
- [ ] `OPENAI_MODEL` (padrão: `gpt-4o-mini`)
- [ ] `RESEND_FROM_EMAIL` (remetente dos e-mails)
- [ ] `NEXT_PUBLIC_BASE_URL` (geralmente igual à APP_URL)
- [ ] `NEXT_PUBLIC_DEFAULT_WHATSAPP_NUMBER`
- [ ] `SENTRY_ORG`, `SENTRY_PROJECT` (monitoramento de erros)
- [ ] `META_BOT_BOOKING_URL`, `META_BOT_CLINIC_METHOD`, `META_BOT_HUMAN_NAME`, `META_BOT_PRACTITIONER_NAME` (fallbacks do bot — opcionais)

> `NODE_ENV` é definido automaticamente pela Vercel — **não** precisa adicionar.

---

## Ordem recomendada
1. ✅ As 7 obrigatórias (feito) → build verde.
2. 📸 Instagram: `META_APP_SECRET` (+ `META_VERIFY_TOKEN`) → bot responde.
3. 📅 Google Calendar (você usava).
4. As demais conforme for usando cada recurso.

## ⚠️ Para nunca mais perder
Depois de tudo restaurado, **exporte/anote as variáveis** num lugar seguro (gerenciador de senhas). E considere usar o **`vercel env pull`** para ter um backup. Assim, se algo apagar de novo, você recoloca em minutos.
