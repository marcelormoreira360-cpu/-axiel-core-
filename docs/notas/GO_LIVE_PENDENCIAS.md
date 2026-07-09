# Go-live — pendências e checklist final (Recebimento de pacientes)

Atualizado em 05/06/2026. Reescrito para o cenário atual: **a clínica de teste/produção está nos EUA, em USD, e cobra por cartão (Stripe)**. Pix/Boleto/Asaas ficam parkados para quando houver clínica no Brasil.

## ✅ Já concluído

- **Código** (Fases 1–3 de recebimento + Asaas + Produtos + Questionários + Moeda + Acesso ao Financeiro): commitado localmente (`0999f52`). **Falta `git push`.**
- **Banco**: migrations 053–065 aplicadas e verificadas; schema reconciliado; registro de migrations ressincronizado.
- **Auditoria (correções aplicadas)**: repasse conta só `paid`; webhook captura erro nos inserts + anti-duplicação; NFSe exige pagamento `paid` quando vinculado; handlers de checkout expirado e disputa.
- **Moeda por clínica/região**: ~30 superfícies exibem na moeda da clínica (BRL/USD/EUR); fonte única = coluna `clinic_settings.default_currency`. Os fluxos do Stripe (sessão, oferta, pacote, assinatura, pedido de produto) são currency-aware. **Não há conversão de câmbio** — a moeda só troca símbolo/formato.
- **Clínica de teste migrada para USD**: `default_currency = USD`; dados relabelados (pagamentos, ofertas, assinaturas, produtos, pedidos). Seed de exemplo em USD aplicado (sessões $75–$175, ofertas, 3 produtos).
- **Financeiro restrito** a dono/admin (`requireFinanceAccess` + filtro na navegação).

## ⏳ Pendente — subir o código

- [ ] `git push` do commit `0999f52`.
- [ ] Commitar + push do fix `session-checkout` (passou a ler a moeda da coluna, não do JSON).

## 💳 Stripe — cartão em USD (caminho desta clínica)

- [ ] Conferir env vars na Vercel (produção): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.
- [ ] No endpoint do webhook (`/api/stripe/webhook`), garantir os eventos:
  - [ ] `checkout.session.completed`
  - [ ] `charge.refunded`
  - [ ] `charge.dispute.created` (alerta de chargeback)
  - [ ] `customer.subscription.created` / `updated` / `deleted` / `paused` / `resumed`
  - [ ] `invoice.paid` / `invoice.payment_failed`
- [ ] (Opcional, sem custo) manter também os eventos assíncronos `checkout.session.async_payment_succeeded/failed/expired` — só são exercidos por Pix/Boleto, mas não atrapalham.

> **Pix/Boleto: não ativar.** São métodos exclusivos do Brasil (BRL). Numa conta/clínica US eles aparecem como *ineligible*. Cartão em USD cobre 100% desta clínica.

## 🧪 Smoke test (modo teste do Stripe, em USD)

- [ ] **Cartão**: cobrar uma sessão (botão Cobrar em `/financeiro`) com `4242 4242 4242 4242` → cai em "Pagamentos recentes" como "Cartão de crédito", valor em **$**.
- [ ] **Conciliação manual**: registrar pagamento "Pendente" + comprovante → aparece em "Pagamentos pendentes" → **Confirmar** move pra recentes; **Descartar** remove.
- [ ] **Telas em USD**: conferir Financeiro, Relatórios, Ofertas, Produtos e o Portal — tudo deve aparecer com **$**. Se algo surgir em R$, reportar a tela.
- [ ] **Painel ao vivo**: abrir o artifact "Pagamentos — ao vivo" e dar Reload → números batem.

> Checklist de teste detalhado: `RECEBIMENTO_TESTE_CHECKLIST.md`.

## 🔍 Antes de confiar em produção

- [ ] Rodar `/code-review --fix` no commit de moeda (mexeu em ~30 telas).
- [ ] Trocar para chaves **live** (`sk_live_…`) e o `STRIPE_WEBHOOK_SECRET` do endpoint live.
- [ ] 1 cobrança real pequena no cartão (ex.: $1.00) → confirmar que cai como `paid`.
- [ ] Reembolsar essa cobrança (valida `charge.refunded`).

## 🅿️ Parkado — só quando houver clínica no Brasil

- [ ] Asaas (Pix/Boleto/mensalidade): env vars de sandbox (`ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`) + webhook. Código já pronto (`lib/asaas.ts`, `services/asaas-service.ts`, rotas `/api/asaas/*`).
- [ ] Stripe Pix/Boleto: ativar na conta BR (invite-only) — alternativa ao Asaas.

## 🔧 Se algo der errado

| Sintoma | Causa provável |
|---------|----------------|
| Valor aparece em R$ numa tela USD | Superfície ainda não lê a moeda da clínica — reportar a tela |
| Cobrança sai em moeda errada | Registro (oferta/produto/pedido) gravado em moeda antiga — relabelar no banco |
| "column … does not exist" / 42703 | Cache do PostgREST — rodar `notify pgrst, 'reload schema';` |
| Erro 429 ao gerar link | Rate limit (60/min por clínica) — aguardar |
