# Go-live — pendências e checklist final (Recebimento de pacientes)

Estado em 05/06/2026. Tudo de código e banco está pronto; faltam ações no painel do Stripe e um smoke test.

## ✅ Já concluído

- **Código** (Fases 1–3): commitado e no GitHub (`4f88c1a`) → deploy na Vercel.
- **Banco**: migrations 053–060 aplicadas e verificadas; schema reconciliado; registro de migrations ressincronizado (001–060).
- **Reconciliação**: `appointments.status`, `session_feedback` (NPS), colunas de `patients`/`plans`, `product_orders`, `zoom_recordings` e cia. recuperados.
- **Auditoria (correções aplicadas)**: repasse conta só `paid`; `boleto` no registro manual; webhook captura erro nos inserts + anti-duplicação; NFSe exige pagamento `paid` quando vinculado; handlers de checkout expirado e disputa.
- **Config**: `clinic_settings.default_currency = BRL` (Pix/Boleto garantidos nos checkouts da clínica). ✓

## ⏳ Pendente — painel do Stripe (sem isso, Pix/Boleto não funcionam)

- [ ] **Ativar Pix** na conta (Settings → Payment methods). Para empresa BR pode ser *invite-only* — se não aparecer, solicitar liberação.
- [ ] **Ativar Boleto** na conta (mesmo lugar).
- [ ] No **endpoint do webhook** (Developers → Webhooks → seu endpoint `/api/stripe/webhook`), garantir que estes eventos estão marcados:
  - [ ] `checkout.session.completed`
  - [ ] **`checkout.session.async_payment_succeeded`** ← novo, essencial p/ Pix/Boleto
  - [ ] **`checkout.session.async_payment_failed`** ← novo
  - [ ] **`checkout.session.expired`** ← novo (loga Pix/Boleto expirados)
  - [ ] **`charge.dispute.created`** ← novo (alerta de chargeback)
  - [ ] `charge.refunded`
  - [ ] `customer.subscription.created` / `updated` / `deleted` / `paused` / `resumed`
  - [ ] `invoice.paid` / `invoice.payment_failed`
- [ ] Conferir as env vars na Vercel (produção): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

## 🧪 Smoke test (modo teste do Stripe primeiro)

- [ ] **Cartão**: cobrar uma sessão (botão Cobrar em `/financeiro`) com `4242 4242 4242 4242` → cai em "Pagamentos recentes" como "Cartão de crédito".
- [ ] **Pix (o teste mais importante)**: gerar cobrança, escolher Pix → o pagamento **NÃO** aparece como pago de imediato; só após confirmar o Pix de teste → entra como "PIX". (Valida o tratamento assíncrono do webhook.)
- [ ] **Conciliação manual**: registrar pagamento "Pendente" + comprovante → aparece em "Pagamentos pendentes" → **Confirmar** move pra recentes; **Descartar** remove.
- [ ] **Painel ao vivo**: abrir o artifact "Pagamentos — ao vivo" e dar Reload → números batem.

> Checklist de teste detalhado: `RECEBIMENTO_TESTE_CHECKLIST.md`.

## 🚀 Virada para produção real

- [ ] Trocar para chaves **live** (`sk_live_…`) e o `STRIPE_WEBHOOK_SECRET` do endpoint live.
- [ ] 1 cobrança real pequena via **Pix** (ex.: R$ 1,00) de uma sessão → confirmar que cai como `paid` método "PIX".
- [ ] Reembolsar essa cobrança de teste (valida `charge.refunded`).

## 🔧 Se algo der errado

| Sintoma | Causa provável |
|---------|----------------|
| Pix/Boleto não aparece no checkout | Não ativados na conta Stripe, ou oferta/clínica em moeda ≠ BRL |
| Pix pago não registra | Falta o evento `async_payment_succeeded` no webhook |
| "column … does not exist" / 42703 | Cache do PostgREST — rodar `notify pgrst, 'reload schema';` |
| Erro 429 ao gerar link | Rate limit (60/min por clínica) — aguardar |
