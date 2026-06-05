# Checklist de teste — Pix via Asaas

> Faça tudo no **sandbox** primeiro (`api-sandbox.asaas.com`). Status esperado do pagamento: `pending` (cobrança criada) → `paid` (após confirmar no Asaas, via webhook).

## 0. Pré-requisitos

- [ ] Migration **061** aplicada (`patients.cpf`, `patients.asaas_customer_id`, `patient_payments.asaas_payment_id`). ✓ (já aplicada)
- [ ] Conta **sandbox** criada em `sandbox.asaas.com`.
- [ ] Em **Integrações → API**, gerar a **chave do sandbox**.
- [ ] Env vars no projeto (Vercel/local):
  - [ ] `ASAAS_API_KEY` = chave do sandbox
  - [ ] `ASAAS_BASE_URL` = `https://api-sandbox.asaas.com/v3`
  - [ ] `ASAAS_WEBHOOK_TOKEN` = um token que você inventa (ex.: string aleatória)
- [ ] No painel Asaas, **Integrações → Webhooks**: criar webhook
  - [ ] URL = `https://SEU_APP/api/asaas/webhook`
  - [ ] Token de autenticação = **o mesmo** `ASAAS_WEBHOOK_TOKEN`
  - [ ] Eventos: pelo menos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`
- [ ] Deploy com as env vars (o botão "Pix" só aparece quando `ASAAS_API_KEY` está setada).

## 1. Preparar dados

- [ ] Cadastrar um **paciente de teste com CPF** válido (`/patients/new` → campo CPF). No sandbox, qualquer CPF de formato válido serve.
- [ ] Garantir que existe uma **sessão passada não paga** desse paciente, com tipo de sessão que tenha **valor** (`price_cents > 0`).

## 2. Gerar a cobrança Pix

- [ ] Em `/financeiro`, na seção **Sessões não pagas**, o botão **Pix** aparece ao lado de "Cobrar".
- [ ] Clicar **Pix** → deve gerar um **link** (invoiceUrl da página Asaas).
- [ ] Abrir o link → página do Asaas com **QR Code Pix + copia-e-cola**.

**Verificar no banco** (`patient_payments`): nova linha com `status='pending'`, `payment_method='pix'`, `asaas_payment_id` preenchido, `appointment_id` correto.

## 3. Confirmar o pagamento (sandbox)

- [ ] No painel sandbox do Asaas, em **Cobranças**, achar a cobrança e **simular o recebimento** (no sandbox o Asaas permite marcar como recebida / confirmar Pix).
- [ ] O Asaas dispara `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → seu webhook.

**Verificar:**
- [ ] `patient_payments` da cobrança virou `status='paid'`, com `confirmed_at` e `paid_at` preenchidos.
- [ ] No `/financeiro`, o pagamento saiu de "Pendentes" e entrou em "Pagamentos recentes" como **PIX**.
- [ ] No **painel ao vivo** (artifact), Reload → o Pix aparece na distribuição por método.

## 4. Idempotência e reembolso

- [ ] Reenviar o mesmo evento `PAYMENT_RECEIVED` no painel Asaas → **não** duplica o pagamento (índice único em `asaas_payment_id`).
- [ ] Simular um **estorno** (`PAYMENT_REFUNDED`) → `patient_payments` vira `status='refunded'`.

## 5. Casos de erro (esperados)

- [ ] Paciente **sem CPF** → clicar Pix retorna erro claro: "CPF do paciente é obrigatório...". Preencher o CPF e repetir.
- [ ] Sessão **já paga** → botão retorna "Esta sessão já foi paga." (409).
- [ ] Sem `ASAAS_API_KEY` → botão Pix nem aparece.

## 6. Virada para produção

- [ ] Conta de produção Asaas **aprovada** (KYC concluído).
- [ ] Trocar env: `ASAAS_API_KEY` = chave **de produção**, `ASAAS_BASE_URL` = `https://api.asaas.com/v3`.
- [ ] Recriar o **webhook** no painel de produção (mesmo `ASAAS_WEBHOOK_TOKEN` ou um novo, refletido na env).
- [ ] 1 cobrança real pequena (ex.: R$ 1,00) via Pix, pagar de verdade, confirmar `paid`.
- [ ] Estornar essa cobrança de teste.

## Se algo der errado

| Sintoma | Causa provável |
|---------|----------------|
| Botão "Pix" não aparece | `ASAAS_API_KEY` não setada no ambiente |
| "CPF do paciente é obrigatório" | Paciente sem CPF — preencher no cadastro |
| Pago no Asaas mas não vira `paid` | Webhook não configurado, URL errada, ou `ASAAS_WEBHOOK_TOKEN` diferente entre env e painel |
| Webhook retorna 401 | Token do header `asaas-access-token` ≠ `ASAAS_WEBHOOK_TOKEN` |
| Erro 429 ao gerar | Rate limit (60/min por clínica) — aguardar |
