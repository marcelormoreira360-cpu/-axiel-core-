# Plano B — Pix via Asaas (caso o Stripe não libere Pix)

Desenho de integração. **Não implementado ainda** — serve para decisão e execução futura.
Motivo: o Stripe Pix para conta BR é invite-only e proíbe "telehealth/medicine vendors" (clínicas). O Asaas não tem essa restrição e é forte em Pix no Brasil.

## Princípio: reaproveitar o que já existe

O Asaas, ao criar uma cobrança, devolve um **`invoiceUrl`** (página hospedada com QR Pix + copia-e-cola). Isso encaixa **exatamente** na UX atual do botão "Cobrar" (gera link → copia/abre/envia ao paciente). E o registro do pagamento continua em `patient_payments` (`payment_method='pix'`), via webhook — igual ao Stripe. Ou seja: **mesma arquitetura, só troca o provedor do Pix.**

| Camada | Stripe (atual) | Asaas (plano B) | Reuso |
|--------|----------------|------------------|-------|
| Link de pagamento | `checkout.session.url` | `payment.invoiceUrl` | UI 100% |
| Confirmação | webhook `async_payment_succeeded` | webhook `PAYMENT_RECEIVED/CONFIRMED` | mesmo padrão |
| Registro | `patient_payments` (pix) | `patient_payments` (pix) | tabela 100% |
| Conciliação/painel | já conta pix | já conta pix | 100% |

## API do Asaas (resumo)

- **Auth**: header `access_token: <API_KEY>` (chave por conta; sandbox tem base URL separada).
  - Produção: `https://api.asaas.com/v3` · Sandbox: `https://api-sandbox.asaas.com/v3`
- **Cliente**: `POST /v3/customers` (name, cpfCnpj, email) → `id` (guardar como `asaas_customer_id` do paciente).
- **Cobrança Pix**: `POST /v3/payments` com `{ customer, billingType: "PIX", value, dueDate, externalReference, description }` → retorna `id`, **`invoiceUrl`**, status.
  - (Opcional) QR direto: `GET /v3/payments/{id}/pixQrCode` → `encodedImage` (base64), `payload` (copia-e-cola), `expirationDate`.
- **Webhook**: Asaas envia eventos (`PAYMENT_CREATED`, `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`) para o endpoint configurado, com um header de autenticação (token que você define no painel).

## Mudanças necessárias

### 1. Banco (migration 061)
```sql
alter table public.patients
  add column if not exists asaas_customer_id text;
alter table public.patient_payments
  add column if not exists asaas_payment_id text;
create unique index if not exists patient_payments_asaas_id_uidx
  on public.patient_payments(asaas_payment_id) where asaas_payment_id is not null;
```
(idempotência do webhook por `asaas_payment_id`, igual ao `stripe_payment_intent_id`)

### 2. Config (Settings → Integrações)
- Guardar a **API key do Asaas por clínica** (hasheada/segura, como já se faz com `clinic_integration_keys`) + o **token do webhook**.
- Flag por clínica: "provedor de Pix = stripe | asaas" (decide qual usar quando a moeda é BRL).

### 3. Serviço `services/asaas-service.ts` (novo)
- `ensureAsaasCustomer(patient)` → cria/recupera `asaas_customer_id`.
- `createPixCharge({ clinicId, patientId, amountCents, dueDate, externalReference, description })` → cria cobrança, retorna `{ invoiceUrl, asaasPaymentId }`.
- `fetchPixQrCode(asaasPaymentId)` (opcional, se quiser exibir QR no portal em vez de link).

### 4. Rota staff `app/api/asaas/charge/route.ts` (novo)
- Espelha `charge-session`/`charge-offer`: auth `getCurrentClinic`, valida sessão/oferta da clínica, chama `createPixCharge`, grava um `patient_payments` **status='pending'** com `asaas_payment_id` (ou só registra na confirmação — decidir), retorna `invoiceUrl`. Rate limit igual (60/min).

### 5. Webhook `app/api/asaas/webhook/route.ts` (novo)
- Valida o token do header (configurado no painel Asaas).
- `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → acha `patient_payments` por `asaas_payment_id` (ou cria), seta `status='paid'`, `payment_method='pix'`, `paid_at`. Idempotente.
- `PAYMENT_REFUNDED` → `status='refunded'`. `PAYMENT_OVERDUE` → log.

### 6. UI
- Mínimo: no botão "Cobrar" (e no painel de cobrança), quando a clínica usa Asaas para Pix, chamar `/api/asaas/charge` em vez do Stripe e exibir o `invoiceUrl` no **mesmo componente de link** que já existe.
- Cartão continua no Stripe; Pix vai pelo Asaas. (Pode-se oferecer os dois botões: "Pix (Asaas)" e "Cartão (Stripe)".)

## Decisões a tomar antes de implementar

1. **Pix pending na criação ou só na confirmação?** Criar já como `pending` mostra a cobrança em aberto no painel; ou registrar só quando `PAYMENT_RECEIVED` chega (mais limpo, mas sem visibilidade do "aguardando"). Recomendo `pending` na criação.
2. **Link hospedado (`invoiceUrl`) ou QR embutido?** O link é o caminho rápido (reusa tudo). QR embutido no portal é mais bonito, mais trabalho.
3. **Cartão também migra pro Asaas?** Não recomendo — o Stripe já faz cartão (US+BR) bem. Asaas só para Pix (e boleto, se quiser unificar BR).
4. **Sandbox primeiro**: validar todo o fluxo no `api-sandbox.asaas.com` antes do live.

## Esforço estimado

Pequeno-médio: 1 migration + 1 service + 2 rotas (charge + webhook) + ajuste de 1 componente de UI. ~Reaproveita 80% (UI de link, tabela, painel, conciliação).

Sources: [Asaas — Cobranças via Pix](https://docs.asaas.com/docs/cobrancas-via-pix) · [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca) · [Get QR Code](https://docs.asaas.com/reference/get-qr-code-for-pix-payments) · [Fluxos de Webhook](https://docs.asaas.com/docs/fluxos-de-webhook)
