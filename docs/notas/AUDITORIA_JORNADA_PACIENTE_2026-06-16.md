# Auditoria — Jornada do Paciente (16/06/2026)

> Objetivo: cruzar o que o prompt "Jornada do Cliente & Valor Percebido" pediu contra o
> que o AXIEL Core **já tem**, e propor extensão sem duplicar nem prejudicar a fluidez do app.

## Veredito em uma linha

**~70% da jornada já está construída.** O risco do prompt original não é falta de feature —
é **recriar do zero o que já existe** (5 tabelas novas que duplicam tabelas atuais quase 1:1)
e jogar trabalho manual extra no terapeuta. O que falta de verdade é **pouco e cirúrgico**:
uma camada que *consolide e leia* o que já é capturado, mais 3 lacunas reais.

---

## 1. Pedido do prompt × o que já existe

| Pedido no prompt | Tabela nova que pediu | O que JÁ existe | Status |
|---|---|---|---|
| Next Best Action | `next_best_actions` | `action_suggestions` (+ `action-suggestion-service`) — **37 registros em uso**, com prioridade e status | ✅ Existe — **não criar** |
| Care Plan | `care_plans` | `treatment_plans` + `treatment_plan_steps` (objetivo, steps, status active/paused/completed) | ✅ Existe — só falta **valor do plano** |
| Progress Report | `progress_reports` | `patient-intelligence-service` (timeline) + `evolution-service` (biomarkers/scores/vitais) + `monthly-report`/`insight-pdf` | ✅ Existe — **não criar** |
| Métricas financeiras por paciente | `patient_financial_metrics` | `business-analytics-service` (agregado por clínica) + `patient_payments` (159 linhas) + `patient_offers` | ⚠️ Parcial — falta **recorte por paciente** |
| Patient Journey (etapas) | `patient_journeys` | Dados existem espalhados: `leads.stage`, `appointments`, `treatment_plans.status`, `patient_offers.status`, `patients.status`, churnRisk | ⚠️ Falta só o **conceito unificado de etapa** (derivar, não tabela) |
| Risco de abandono | — | `patient-intelligence-service` → `computePatientEngagement()` (churnRisk none/low/medium/high) | ✅ Existe |
| Retenção / pacotes / alertas | — | `follow-up-service`, `package-service` (auto-renew), `dashboard-alerts-service`, `waitlist-service`, `broadcast-service` (reativação 30/60d) | ✅ Existe |
| Indicação **paciente → paciente** | (parte de journey) | Só existe indicação **clínica → clínica** (`referral_conversions`, `referral-service`) | ❌ **Lacuna real** |

## 2. Etapas da jornada — cobertura atual

lead ✅ · qualificado ✅ · agendado ✅ · avaliado ⚠️ · plano sugerido ✅ · plano aceito ✅ ·
em tratamento ✅ · reavaliação ✅ · manutenção ✅ · follow-up ✅ · inativo ⚠️ ·
reativação ⚠️ · indicação ❌

As etapas marcadas ⚠️/❌ **não precisam de tabela nova** — precisam de um campo derivado e de
preencher 3 buracos.

---

## 3. As únicas lacunas reais (o que vale a pena fazer)

1. **Etapa unificada da jornada (derivada, sem tabela nova).** Hoje não há um único lugar que
   diga "este paciente está na etapa X". Os dados existem; falta uma função que os leia e
   resolva a etapa atual + a próxima melhor ação (que já está em `action_suggestions`).

2. **Recorte financeiro por paciente.** Receita, ticket médio, LTV e nº de sessões por paciente
   — `business-analytics` já calcula isso no agregado; falta expor por paciente. **Faz-se com
   uma VIEW** sobre `patient_payments` + `patient_offers`, não com tabela mantida à mão.

3. **Valor do plano de cuidado.** `treatment_plans` não guarda o valor esperado. Resolver com
   **1 coluna** (`plan_value_cents`) ou ligando ao `patient_offers` que já tem preço.

4. **Indicação paciente→paciente.** Genuinamente ausente. Aqui sim cabe **1 tabela pequena**
   (ou reuso do modelo de `referral_conversions` adaptado ao paciente).

---

## 4. Plano de extensão recomendado (mínimo, preserva fluidez)

**Princípio:** a jornada deve *ler* o que o terapeuta já registra no fluxo normal (agenda,
sessão, plano, pagamento). Nada de nova tela de digitação só para "alimentar a jornada" —
isso é o que mataria a praticidade.

- **Etapa 1 — Camada de leitura (0 tabela nova).** Serviço `patient-journey-service` que
  *deriva* a etapa atual a partir de leads/appointments/treatment_plans/offers/churnRisk e
  devolve `{ etapa, próxima_ação, risco, oportunidade }` reaproveitando `action_suggestions`.
- **Etapa 2 — Strip/timeline na ficha (reuso de UI).** Mostrar a etapa + próxima ação no
  componente que **já existe** (o "Next Step" da ficha do paciente), sem tela nova.
- **Etapa 3 — VIEW financeira por paciente (0 tabela mantida).** `patient_financials` como
  view sobre `patient_payments`/`patient_offers`.
- **Etapa 4 — 1 coluna em `treatment_plans`** para valor do plano.
- **Etapa 5 — Indicação paciente→paciente** (única tabela nova de fato), só se for prioridade
  comercial agora.

**Resultado:** entrega a "Jornada do Cliente" do prompt com **no máximo 1 tabela nova + 1
coluna + 1 view**, em vez de 5 tabelas. Sem duplicação, sem RLS nova de risco em massa, sem
peso extra no dia a dia do terapeuta.

## 5. O que NÃO fazer

- Não criar `next_best_actions`, `care_plans`, `progress_reports`, `patient_journeys`,
  `patient_financial_metrics` — duplicam `action_suggestions`, `treatment_plans(+steps)`,
  a timeline de intelligence/evolution e o agregado de analytics.
- Não criar telas de cadastro só para "marcar etapa" — a etapa deve ser derivada.
