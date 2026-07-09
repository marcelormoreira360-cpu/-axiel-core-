# Retomar amanhã — onde paramos (04/06/2026)

> Leia isto primeiro na próxima sessão. Resume exatamente onde paramos e o que fazer.

---

## ✅ O que está funcionando (não mexer)
- **App no ar e conectando** (login OK em `axiel-core-6ikl.vercel.app`).
- **Integração Growth ↔ Core** validada ponta a ponta (lead `hot` → POST → 200 → `synced_to_health`).
- **Variáveis essenciais restauradas** após o apagão (Supabase, OpenAI, Resend, App URL, Cron, Meta).
- **Backup feito**: arquivo `.env.backup` (guardar em lugar seguro; NÃO subir pro Git).

## 🔴 DESCOBERTA-CHAVE — a causa do Instagram não funcionar
Existem **DOIS projetos na Vercel** ligados ao mesmo Git:
- `axiel-core`
- `axiel-core-6ikl`  ← **este serve o site de produção** (`axiel-core-6ikl.vercel.app`) e é para onde o **webhook do Instagram aponta**.

Hoje, tudo que configuramos para o Instagram (variáveis META, e os logs que olhamos) foi no projeto **`axiel-core` (o errado)**. Por isso a verificação do webhook da Meta "não aparecia nos logs" — ela bate no `axiel-core-6ikl`, e a gente olhava o `axiel-core`.

## 🛠️ PLANO para amanhã (corrigir o Instagram)
1. No Vercel, **trocar para o projeto `axiel-core-6ikl`** (seletor de projeto no topo-esquerdo).
2. Em **Settings → Environment Variables** do `axiel-core-6ikl`, conferir/adicionar (todos os ambientes):
   - `META_INSTAGRAM_TOKEN` (token gerado para a `jifwcenter`)
   - `META_APP_SECRET` (Chave Secreta do app, Meta → Básico)
   - `META_VERIFY_TOKEN` = `axiel_ig_verify_2026`
   - (conferir se as outras essenciais também estão: Supabase, OpenAI, Resend, App URL, Cron — o login funciona, então provavelmente já estão)
3. **Redeploy** do `axiel-core-6ikl` (esperar verde).
4. Na Meta (app AXIEL → Casos de uso → Instagram → passo 3), clicar **"Verificar e salvar"** com:
   - URL: `https://axiel-core-6ikl.vercel.app/api/meta/instagram`
   - Verificar token: `axiel_ig_verify_2026`
5. Abrir os **logs do projeto `axiel-core-6ikl`** (modo Live) e clicar Verificar — agora **deve aparecer** o GET. Esperado: GET 200.
6. Confirmar webhook field **`messages`** assinado + assinatura da conta `jifwcenter` ativada.
7. **Testar**: DM de outra conta para `@jifwcenter` → o bot responde. Testar o opt-out ("falar com atendente").

> ⚠️ Verificar TAMBÉM: provavelmente os dois projetos são deploys do mesmo Git. Vale decidir se quer **apagar/arquivar o projeto duplicado** (`axiel-core`) para nunca mais confundir — mas só depois de confirmar qual é o certo.

## 📌 Pendências menores (sem pressa)
- Variáveis opcionais (Twilio/Stripe/Zoom/Daily/Push) — restaurar só quando for usar cada recurso. Ver `ENV_VARS_CHECKLIST.md` e `RESTAURAR_ENV_PASSO_A_PASSO.md`.
- Chaves de Push (VAPID) já geradas (estão no `RESTAURAR_ENV_PASSO_A_PASSO.md`).
- App Review da Meta (Advanced Access) para o Instagram responder a QUALQUER paciente — ver `INSTAGRAM_PRODUCAO_PLANO.md`.

## 📁 Documentos de referência
- `STATUS_INTEGRACOES.md` — estado geral.
- `AUDITORIA_AXIEL_CORE.md` — auditoria do sistema.
- `ENV_VARS_CHECKLIST.md` + `RESTAURAR_ENV_PASSO_A_PASSO.md` — variáveis.
- `INSTAGRAM_PRODUCAO_PLANO.md` — caminho do App Review.
