# BRIEF — Quick Wins da Jornada do Paciente (AXIEL Core)

> As lacunas pequenas que levam a jornada de ~70% → ~90%. Acabamento, não features novas.
> Preparado pelo squad (Nucleo + Forja, via Axiel). **Ler `CONTEXT.md` antes.** `/code-review --fix` antes do commit.

Ordem por **retorno ÷ esforço** (faça de cima pra baixo).

---

## 1. Valor do plano no `treatment_plan`  ·  Esforço: **S (P)**
**O quê:** coluna `total_value` (numeric) em `treatment_plans` (ou computar a partir dos steps/offers) + exibir na UI do plano.
**Por quê:** sem isso não dá pra ver receita por plano nem alimentar o financeiro/attach rate.
**Onde:** migration + tela do treatment_plan + onde o plano é listado.
**Aceite:** todo plano mostra valor; soma bate com offers/payments.

## 2. Recorte financeiro por paciente (view)  ·  Esforço: **S–M (P–M)**
**O quê:** view SQL agregando por `patient_id`: total pago, em aberto, nº de planos, ticket, último pagamento (LTV por paciente). Expor num card na ficha.
**Por quê:** Aurio/Margo pedem; base de LTV, churn e decisão de pacote.
**Onde:** migration (view, respeitando RLS por `clinic_id`) + card na ficha do paciente.
**Aceite:** ficha mostra resumo financeiro do paciente; números batem com `patient_payments`.

## 3. Etapa unificada do paciente  ·  Esforço: **M**
**O quê:** status único da jornada (lead → triagem → avaliação → plano → tratamento → follow-up → retenção) **derivado** dos dados que já existem (não criar fluxo paralelo).
**Por quê:** hoje a etapa está espalhada; um status só = pipeline claro e base pro Next Best Action.
**Onde:** função/computed status + badge na ficha e na lista de pacientes.
**Aceite:** cada paciente tem 1 etapa coerente com seus dados; filtro por etapa na lista.

## 4. Indicação paciente → paciente  ·  Esforço: **M**
**O quê:** campo "indicado por" (referência a outro paciente/origem) + contagem de indicações por paciente.
**Por quê:** canal de crescimento orgânico mais barato; identifica promotores.
**Onde:** migration (`referred_by_patient_id` ou origem) + campo no intake/ficha + relatório simples "quem mais indica".
**Aceite:** registrar indicação; ver quantos cada paciente trouxe.

---

### Sugestão de execução
Fazer **1 e 2 juntos** (ambos destravam o financeiro e são baratos), depois **3**, depois **4**.
Cada um é um commit pequeno com `/code-review --fix`. Nenhum exige feature nova — só completar o que já existe.
