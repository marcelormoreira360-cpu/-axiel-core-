# AXIEL CORE — EXECUÇÃO 13
## Results / Analytics Dashboard

## Objetivo

Criar uma área simples e visual para acompanhar os resultados da clínica sem transformar o AXIEL em uma ferramenta pesada de BI.

A tela deve ajudar o dono ou gerente da clínica a entender rapidamente:

- receita;
- volume de Sessions;
- novos pacientes;
- novos leads;
- conversão;
- produtos vendidos;
- memberships ativos;
- follow-ups pendentes.

O foco não é mostrar muitos gráficos.  
O foco é responder: **“Como a clínica está indo e qual ação simples devemos tomar agora?”**

---

## Princípio central

```txt
Clareza > Quantidade de dados
Ação > Relatório
Visual > Técnico
```

---

## Local no produto

Rota recomendada:

```txt
/results
```

Nome visível:

```txt
Results
```

Subtítulo:

```txt
Understand your clinic’s progress.
```

---

## Métricas principais

A tela deve mostrar:

1. Revenue
2. Sessions
3. New Patients
4. New Leads
5. Conversion Rate
6. Products Sold
7. Active Memberships
8. Pending Follow-ups

---

## Regra de UX

No topo, mostrar no máximo **3 cards principais**:

1. Revenue
2. Sessions
3. Conversion Rate

As demais métricas ficam em uma seção secundária com no máximo 5 itens visíveis.

Dados avançados devem ficar em:

```txt
View details
```

---

## Business Insights

Adicionar uma área:

```txt
Business Insights
```

Ela deve usar AI placeholder no MVP.

Exemplos seguros:

- “You have more new leads this week. Consider reviewing follow-ups today.”
- “Pending follow-ups are increasing. Create time to review them.”
- “Product Support is growing. Review inventory before the next busy day.”

Não usar linguagem técnica.

---

## Telas necessárias

### MVP

```txt
/results
```

### Futuro

```txt
/results/revenue
/results/conversion
/results/products
/results/memberships
```

---

## Componentes necessários

```txt
/components/results-metric-card.tsx
/components/business-insight-card.tsx
/components/results-summary-section.tsx
```

---

## Services

```txt
/services/results-analytics-service.ts
```

Responsabilidade:

- buscar métricas essenciais;
- calcular conversão;
- gerar dados simples para cards;
- retornar Business Insights placeholder.

---

## Modules

```txt
/modules/results/analytics-types.ts
/modules/results/business-insight-rules.ts
/modules/results/results-summary.ts
```

---

## Tabelas envolvidas

A Execução 13 usa dados já existentes:

```txt
patients
leads
appointments
follow_ups
products
product_orders
product_order_items
patient_products
patient_offers
subscriptions
usage_events
```

Tabela opcional para insights comerciais salvos:

```txt
business_insight_events
```

---

## MVP

Entram no MVP:

- página `/results`;
- 3 cards principais;
- seção de métricas secundárias;
- Business Insights placeholder;
- View details colapsado;
- dados simples por clínica;
- nenhuma análise complexa.

---

## Fase futura

Fica para depois:

- gráficos avançados;
- comparação mês a mês;
- previsão de receita;
- cohort analysis;
- LTV;
- CAC;
- relatórios exportáveis;
- dashboards por unidade;
- AI real com histórico completo.

---

## Riscos

### Risco de UX

Mostrar métricas demais e deixar a tela ansiosa.

### Risco de produto

Fazer Analytics parecer um módulo isolado, sem ligação com a jornada.

### Risco técnico

Depender de tabelas incompletas ou inconsistentes durante o MVP.

---

## Resultado esperado

Ao final da execução, a clínica deve conseguir abrir o Results Dashboard e entender rapidamente:

- como está a receita;
- quantas Sessions aconteceram;
- se os leads estão virando pacientes;
- se follow-ups estão atrasando;
- se Products e Memberships estão contribuindo;
- qual ação simples deve receber atenção.

O AXIEL passa a ajudar a clínica a enxergar o negócio sem perder a experiência calma e premium.
