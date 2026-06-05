# Feature de Produtos — plano completo (catálogo → pedido → cobrança → entrega)

Construção por fases. **Hoje: Fase 1 (modelo de dados)**. As demais entram em sessões seguintes.

## Estado atual
- Tabelas existentes: `products` (catálogo) e `product_orders` (cabeçalho do pedido, sem itens).
- `app/products/*` permite cadastrar produtos; `app/products/orders` só **lê** pedidos (e nunca há nenhum, pois nada cria).
- **Faltava**: itens do pedido, criação de pedido, cobrança e baixa de estoque.

## Modelo de dados (Fase 1 — migration 063)
- **`product_order_items`** (novo): `order_id` (FK), `clinic_id`, `product_id` (FK, nullable), `name` (snapshot), `unit_price_cents`, `quantity`, `line_total_cents`.
- **`product_orders.asaas_payment_id`** (novo) — para cobrar via Asaas (Pix/Boleto), espelhando `stripe_payment_intent_id`.
- Índices + RLS (via `clinic_id`, padrão `can_access_clinic`/`can_write_clinic_data`).

## Fases seguintes

### Fase 2 — serviço + criação de pedido
- `services/product-order-service.ts`: `createOrder({ patientId, items[] })` → calcula subtotal/total, insere `product_orders` + `product_order_items`, status `pending`/`unpaid`.
- Server actions: criar/cancelar pedido.
- (Opção) decremento de `inventory_quantity` ao marcar pago.

### Fase 3 — UI de criação
- Tela "Novo pedido" (ou no perfil do paciente): selecionar produtos + quantidades → resumo → criar pedido.
- Melhorar `/products/orders`: lista com status, total, botão de ação.

### Fase 4 — cobrança (reaproveita o que já existe)
- Gerar link de pagamento do pedido:
  - **Cartão**: Stripe checkout (metadata `type=product_order`, `order_id`).
  - **Pix/Boleto**: Asaas (`createAsaasCharge`), grava `asaas_payment_id` no pedido.
- Webhooks (Stripe + Asaas) passam a reconhecer `product_order`: marcam `product_orders.payment_status='paid'` + `status='paid'` e (opcional) baixam estoque. Idempotente pelos ids já existentes.

### Fase 5 — fulfillment
- Marcar `delivered`, registrar entrega; relatório simples de vendas de produto.

## Reaproveitamento
- Cobrança: a infra de Stripe (checkout) e Asaas (`createAsaasCharge` + webhook) já existe — Fase 4 é mais "ligar" do que construir.
- Conciliação: `patient_payments` pode receber o pagamento do pedido (já tem `payment_method`, status), aparecendo no painel financeiro como qualquer outro recebimento.

## Decisões em aberto (resolver na Fase 2/3)
1. Estoque: decrementar na criação do pedido ou só quando pago? (recomendo: quando pago)
2. Pedido sempre ligado a um paciente, ou venda avulsa também?
3. Impostos (`tax_cents`): manual por pedido ou regra fixa por clínica?
