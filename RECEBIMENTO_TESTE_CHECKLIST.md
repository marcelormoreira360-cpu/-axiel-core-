# Checklist de teste — Recebimento de pacientes (Fases 1–3)

> Rode na ordem. Comece **em modo de teste do Stripe** (chaves `sk_test_…`) antes de cobrar de verdade.
> Status esperado dos pagamentos: `pending` (aguardando) → `paid` (confirmado).

---

## 0. Pré-requisitos (confirmar antes de testar)

- [ ] Migration **053** aplicada (colunas Stripe + `boleto` no CHECK + índice único)
- [ ] Migration **054** aplicada (`status='pending'`, `proof_path`, `confirmed_at`)
- [ ] No Stripe: **Pix** e **Boleto** ativados na conta (BR)
- [ ] No Stripe: endpoint do webhook tem os eventos `checkout.session.completed`, **`checkout.session.async_payment_succeeded`**, **`checkout.session.async_payment_failed`**, `charge.refunded`, `customer.subscription.*`, `invoice.*`
- [ ] Env vars em produção: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`
- [ ] Deploy da Vercel concluído (último commit no ar)
- [ ] Bucket de storage `patient-docs` existe (para os comprovantes)

> Dica: use o **Stripe CLI** ou a aba **Webhooks → tentativas** do dashboard pra ver se cada evento chega com `200`.

---

## 1. Cobrança de sessão pela clínica (`/financeiro`)

Pré: ter uma sessão passada não paga, com tipo de sessão que tenha **valor** e clínica em **BRL** (senão Pix/Boleto não aparecem).

- [ ] Em `/financeiro`, na seção **Sessões não pagas**, clicar **Cobrar** → link é gerado
- [ ] Abrir o link: aparecem **Cartão, Pix e Boleto** (BRL); só **Cartão** se a moeda for USD
- [ ] **Cartão** (teste `4242 4242 4242 4242`): paga → cai em **Pagamentos recentes** com método "Cartão de crédito"
- [ ] **Pix** (modo teste): ao escolher, o pagamento fica **pendente**; o registro **NÃO** aparece como pago até confirmar o Pix de teste → depois aparece com método "PIX"
- [ ] A mesma sessão já paga não gera novo link (mostra "já foi paga")

**Verificar no banco** (`patient_payments`): `payment_method` correto (não tudo "credit_card"), `status='paid'`, `stripe_payment_intent_id` preenchido, sem linha duplicada.

---

## 2. Cobrança de pacote / mensalidade (perfil do paciente)

Pré: ter ofertas ativas em **Configurações → Ofertas** (uma `session_package` e uma `membership`), em **BRL** se quiser Pix.

- [ ] No perfil do paciente, painel **Cobrar pacote ou plano**: a oferta aparece no select
- [ ] **Pacote** (`session_package`): gera link, mostra "pagamento único"; pagar com cartão de teste → cria **pacote** (painel Pacotes) **e** registro em `patient_payments`
- [ ] **Mensalidade** (`membership`): gera link, mostra "apenas cartão"; o checkout é de **assinatura** (não aceita Pix); pagar → cria assinatura ativa
- [ ] Tentar cobrar mensalidade de novo no mesmo paciente → bloqueia ("já tem plano ativo")
- [ ] Sem ofertas ativas → painel mostra o link "Criar em Configurações → Ofertas"

---

## 3. Portal do paciente (fluxo antigo, não pode ter regredido)

- [ ] Pelo portal `/p/[token]`, o paciente ainda consegue pagar oferta/sessão (agora com Pix/Boleto em BRL)
- [ ] O pagamento feito pelo portal aparece no `/financeiro`

---

## 4. Conciliação manual — Zelle / transferência / dinheiro

- [ ] **Novo pagamento** → escolher **Pendente** + anexar um comprovante (imagem ou PDF)
- [ ] O pagamento aparece na seção **Pagamentos pendentes** (não em "recentes")
- [ ] **Ver comprovante** abre o arquivo (URL assinada)
- [ ] **Confirmar** move o pagamento para "recentes" e some dos pendentes
- [ ] **Descartar** remove um pendente (testar com um pendente de teste)
- [ ] Registrar um pagamento como **Recebido** (não pendente) → entra direto em recentes

**Verificar**: comprovante > 10MB é recusado; arquivo de outra clínica não abre (escopo por `clinic_id`).

---

## 5. KPIs e receita (regressão importante)

- [ ] Um pagamento **pendente** **NÃO** soma na "Receita do mês" nem em "Por forma de pagamento"
- [ ] Ao **confirmar** o pendente, a receita do mês aumenta
- [ ] O gráfico de 6 meses só conta pagamentos `paid`

---

## 6. Reembolso (sanidade)

- [ ] Reembolsar um pagamento de teste no Stripe → o evento `charge.refunded` marca o `patient_payments` como `refunded` (ou `partially_refunded`)

---

## 7. Idempotência do webhook (opcional, mas recomendado)

- [ ] No dashboard do Stripe, **reenviar** um `checkout.session.completed`/`async_payment_succeeded` já processado → **não** cria pagamento/pacote duplicado (o índice único + checagem garantem)

---

## Quando passar pra produção real

1. Trocar para as chaves **live** (`sk_live_…`) e o `STRIPE_WEBHOOK_SECRET` do endpoint live.
2. Fazer **1 cobrança real pequena** via Pix (ex.: R$ 1,00) de uma sessão e confirmar que cai como `paid` com método "PIX".
3. Reembolsar essa cobrança de teste.

---

## Se algo quebrar

- **"column … does not exist" / 42703** → migration não aplicada ou cache do PostgREST; rode `notify pgrst, 'reload schema';`.
- **Pix/Boleto não aparece no checkout** → não estão ativados na conta Stripe, ou a oferta/clínica está em **USD**.
- **Pix pago não registra** → o evento `async_payment_succeeded` não está registrado no webhook (passo 0).
- **Erro ao gerar link (429)** → rate limit (60/min por clínica); aguarde.
