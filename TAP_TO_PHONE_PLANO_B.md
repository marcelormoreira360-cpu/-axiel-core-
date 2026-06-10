# Tap to Phone (pagamento presencial por aproximação) — Estrutura mapeada / Plano B

> Status: **MAPEADO, NÃO IMPLEMENTADO.** Só ativar quando a demanda real aparecer.
> Atualizado em: 06/06/2026

## Decisão (resumo)

A clínica **não precisa** de maquininha nem de Tap to Phone para começar a operar o presencial.
O que já temos cobre 100% das cobranças:

- **Stripe** → pagamentos online, links de cobrança, assinaturas/recorrência (USD/EUR/BRL online).
- **Asaas** → Pix e Boleto em BRL (gateway brasileiro já integrado, rotas `/api/asaas/*`).

Portanto, para o paciente presente na recepção, basta **Pix (Asaas)** ou **link de pagamento (Stripe)** — ele paga pelo próprio celular.

## Por que Square e Stripe Tap NÃO servem aqui

- **Square**: não opera no Brasil. Descartado de vez.
- **Stripe Tap to Pay**: **não disponível no Brasil**. No BR a Stripe é só online. A ideia de "paciente dá tap no celular da clínica" só roda, no Brasil, com provedores nacionais de Tap to Phone.

## Quando o Tap to Phone passa a ser necessário

Só ativar se aparecer demanda real por alguma destas 3 situações que Pix/link não resolvem bem:

1. **Cartão físico presente** — paciente quer aproximar/passar o cartão de crédito ou débito dele e não usa Pix nem quer instalar nada.
2. **Parcelamento no crédito no balcão** — tratamento caro, paciente quer parcelar Nx na hora (Pix não parcela).
3. **Fechamento imediato sem fricção** — encerrar o pagamento no atendimento sem depender de o paciente abrir app/copiar chave (reduz "depois eu pago" e inadimplência).

## Opções (quando for ativar) — custo-benefício

Todas transformam o celular em maquininha por aproximação, **sem aparelho, sem adesão, sem mensalidade**:

| Provedor | Taxas (abr/2026) | Observação |
|---|---|---|
| **InfinitePay (InfiniteTap)** | débito ~0,75% · crédito à vista ~2,69% (menor do mercado) · Pix grátis | **Melhor custo-benefício** como provedor principal só do presencial |
| **Mercado Pago** | um pouco maior | **API mais completa** (presencial + online + Pix); opção se quiser unificar tudo num provedor só |
| **PagBank (Tap On)** | competitivo | Alternativa sólida; ativa em quantos celulares quiser |

## Estratégia recomendada (quando ativar)

- **Principal**: InfinitePay (InfiniteTap) — mais barato, grátis.
- **Backup (redundância sem custo fixo)**: Mercado Pago instalado no mesmo celular. Como nenhum tem mensalidade, dá para manter os dois prontos e só usar o segundo se o primeiro falhar.
- **Não consolidar na Stripe** para presencial no Brasil (não funciona). Manter Stripe = online; Asaas = Pix/Boleto; Tap = cartão físico no balcão.

## Próximo passo (quando decidir ativar)

1. Abrir conta no provedor escolhido e instalar o app no celular da recepção.
2. Avaliar se vale integrar via API ao AXIEL Core (registrar o pagamento presencial no fluxo financeiro) ou apenas conciliar manualmente no início.
3. Atualizar `STATUS_INTEGRACOES.md` e este arquivo.
