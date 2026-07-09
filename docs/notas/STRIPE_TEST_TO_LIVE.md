# Stripe: virada Test → Live (recebimento)

Contexto: clínica **Integrative & Functional Wellness Center** (EUA, moeda **USD**, cobrança por **cartão** via Stripe). Fluxo já validado ponta a ponta em **sandbox/test** em 05/06/2026 (pagamento de US$ 200 caiu como `paid`/`USD`/cartão via webhook). Este arquivo é só a virada para dinheiro real.

> ⚠️ Em Live, cada cobrança é **dinheiro de verdade**. Faça o smoke test com US$ 1 e reembolse.

---

## Pré-checagem (5 min)

- [ ] Conta Stripe ativada para cobranças (sem pendências em **Settings → Account**).
- [ ] Domínio de produção no ar: `https://axiel-core-6ikl.vercel.app` (ou o domínio final).
- [ ] `clinic_settings.default_currency = USD` (já está).

---

## 1. Chave secreta Live

- [ ] Stripe → desligue o **Test mode** (canto superior) para entrar em **Live**.
- [ ] **Developers → API keys → Secret key** → copie o **`sk_live_…`**.
- [ ] Vercel → projeto **axiel-core-6ikl** → **Settings → Environment Variables** (**Production**) → edite **`STRIPE_SECRET_KEY`** = `sk_live_…`.

> Lição aprendida: o valor antigo era `mk_…` (chave inválida → erro 401 "Invalid API Key"). A chave do Stripe **sempre** começa com `sk_live_` (secret) ou `pk_live_` (publishable). Nunca use `mk_`, `rk_` no `STRIPE_SECRET_KEY`.

---

## 2. Webhook Live

- [ ] Stripe (em **Live**) → **Developers → Webhooks → Add destination**.
- [ ] **Endpoint URL:** `https://axiel-core-6ikl.vercel.app/api/stripe/webhook`
- [ ] **Payload style: Snapshot** (NÃO "Thin" — o app lê o objeto completo). Se criar as duas, **apague a Thin**.
- [ ] **Eventos** (mínimo): `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `async_payment_failed`, `expired`, `charge.refunded`, `charge.dispute.created`, `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid`, `invoice.payment_failed`. (Pode usar "Select all events".)
- [ ] Copie o **Signing secret** (`whsec_…`) da destinação **Snapshot**.
- [ ] Vercel → **`STRIPE_WEBHOOK_SECRET`** = esse `whsec_…` (Production).

> O `whsec_` de Live é **diferente** do de test. Se errar, o pagamento é cobrado no Stripe mas **não registra** no app (falha de assinatura).

---

## 3. Aplicar (obrigatório)

- [ ] Vercel → **Deployments → ⋯ → Redeploy**. (Mudar env var **não** atualiza sozinho.)
- [ ] No app: **Cmd + Shift + R** (limpa cache).

---

## 4. Smoke test em Live (1 cobrança real pequena)

- [ ] `/financeiro` → **Cobrar** uma sessão → abra o link → no checkout **NÃO** deve aparecer "TEST MODE".
- [ ] Pague com um **cartão real** (valor pequeno; ideal criar uma sessão de US$ 1 só pra isso).
- [ ] Confirme que cai em **"Pagamentos recentes"** como `paid`/cartão/USD.
- [ ] **Reembolse** essa cobrança no Stripe (Payments → a cobrança → Refund) → valida o evento `charge.refunded`.

---

## 5. Limpeza antes de abrir pra pacientes

- [ ] Remover/arquivar **dados de teste** (pagamentos de seed e o teste do sandbox), se não quiser que contem na receita.
- [ ] Conferir preços reais das sessões/ofertas/produtos em USD.
- [ ] `STRIPE_WEBHOOK_SECRET` e `STRIPE_SECRET_KEY` = ambos **Live**, sem sobra de valores de test.

---

## Lembretes importantes

- **Pix/Boleto não existem em USD.** São só para clínicas no Brasil (BRL, via Asaas). Já estão escondidos automaticamente nesta clínica.
- **Trocar env var ⇒ sempre Redeploy.**
- **Snapshot, nunca Thin**, no webhook.
- Nunca exponha `sk_live_` nem `whsec_` (live) em prints, chat ou código — só nas env vars da Vercel.

## Rollback rápido

Se algo quebrar em Live: volte `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` para os valores de **test** na Vercel + Redeploy. O app volta ao sandbox sem cobrar ninguém.
