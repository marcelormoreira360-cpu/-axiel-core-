# Spec: Pirâmide Bio³ a partir de múltiplos instrumentos (questionários + exames)

> Rascunho para revisão de Marcelo. Objetivo: além dos questionários, alimentar os 3 pilares
> (Biomecânico, Bioquímico, Bioemocional) com os DESEQUILÍBRIOS medidos na neurometria e na
> biorressonância, de forma verdadeira, sensata e cientificamente prudente.
> Convenção Bio³: tudo é GRAU DE DISFUNÇÃO 0–100%, MAIOR = PIOR (menor = melhor).

## 1. Princípios (o que mantém isto honesto)

1. **Cada instrumento vira % a partir da SUA própria referência.** Nada inventado.
2. **Roteamento por domínio fisiológico** para os 3 pilares, com **peso explícito** por instrumento.
3. **Peso por força de evidência:** questionários validados e neurometria medida = espinha dorsal;
   biorressonância (leitura funcional/energética, não validada) = contribuição menor e rotulada.
4. **Rastreável:** cada pilar mostra os instrumentos que contribuíram e o peso. Auditável.
5. **Gracioso com o que falta:** instrumento ausente não entra; `is_partial = true` sinaliza incompletude.
6. **Rótulo:** o resultado é um "índice funcional integrativo", NÃO diagnóstico.

## 2. Normalização (valor do instrumento -> disfunção 0–100%)

- **Questionário (já existe):** `disfuncao = (bruto / max) * 100`. Mantido.
- **Métrica de exame com faixa numérica** (ex.: temperatura): desvio da faixa ideal, escalado por um
  desvio máximo plausível e travado em 0–100. Ex.: temperatura abaixo de 31,5 °C →
  `min(100, (31,5 - valor) / 5,0 * 100)` (5 °C abaixo = 100%).
- **Métrica de exame com rótulo qualitativo** (o aparelho imprime leve/moderado/alto/grave): mapa
  rótulo → banda (usa a classificação do PRÓPRIO aparelho, não inventa):
  `natural/normal=10 · leve=30 · moderado=55 · alto=70 · muito alto=85 · grave=90`.
- **Métrica de balanço** (ex.: simpático/parassimpático): desvio do equilíbrio 50/50.
  Ex.: simpático 70,97% → `((70,97 - 50) / 50) * 100 ≈ 42%`.
- **Item positivo/preservado** (ex.: barorreflexo ótimo 96,44%): disfunção baixa (≈ `100 - valor`),
  reduz o pilar (sinal de que há reserva).

## 3. Tabela de roteamento — NEUROMETRIA (alto rigor, ancorado no manual)

Escalas confirmadas no Manual de Neurometria (págs entre parênteses). Disfunção 0–100% (maior = pior),
travada em [0,100].

| Dimensão (métrica) | Ideal / range (manual) | Disfunção % | Pilar(es) | Peso |
|---|---|---|---|---|
| 1. Controle de ansiedade | ≥90% ótimo; <40% severo (723–729) | `(90 − valor)/50 × 100` | Bioemocional | 1.0 |
| 2. Cardio-funcional / HRV | escala −4 a +4, 0 ideal (765, 773) | `\|valor\|/4 × 100` | Bioemocional 0.7 · Bioquímico 0.3 | 1.0 |
| 3a. Índice barorreflexo (positivo) | ≥90% ótimo; <70% grave (171, 756) | `(90 − valor)/20 × 100` | Bioquímico | 1.0 |
| 3b. Resposta hemodinâmica / fluxo | <10% aceitável; >40% grave (756–758) | `(valor − 10)/30 × 100` | Bioquímico | 1.0 |
| 4. Temperatura periférica | 31,5–32,5 °C ideal (714, 734) | desvio fora da faixa `/3 °C × 100` (corte de grave não está no manual → default 3 °C) | Bioemocional 0.6 · Bioquímico 0.4 | 1.0 |
| 5. Freq./amplitude simpático×parassimpático | 50/50; simpático >60% rompe (171, 775) | `\|simpático% − 50\|/50 × 100` | Bioemocional | 1.0 |
| 6a. Capacidade adaptativa / variabilidade autonômica (positivo) | quanto maior melhor, 0–100% (714) | `100 − valor` | Bioemocional | 0.8 |
| 6b. Eixo cérebro-intestino | só rótulo qualitativo (755) | rótulo→banda | Bioquímico 0.5 · Bioemocional 0.5 | 0.6 |

Neurometria quase não toca o **Biomecânico** (esse vem do exame físico/mobilidade do terapeuta).
Onde o exame imprimir só rótulo (sem o número), cai no mapa rótulo→banda da seção 2.

## 4. Tabela de roteamento — BIORRESSONÂNCIA (rigor menor, rotulada)

| Métrica | Como vira % | Pilar | Peso sugerido |
|---|---|---|---|
| Carga emocional (categoria Psychology) | proporção/intensidade dos itens na faixa de excesso (OF-UF 7–10 / % 70–100) → 0–100% | Bioemocional | **0.4** (menor; "carga funcional", não validado) |

A categoria esotérica (Wisdom teachings) continua FORA. Biorressonância só entra no Bioemocional.

## 5. Agregação por pilar

`disfuncao_pilar = média ponderada de TODOS os itens que caem no pilar`
(itens de questionário + neurometria + biorressonância, cada um com seu peso da tabela × o peso do roteamento).
`indice_geral = média dos 3 pilares` (como hoje). `priority_pillar = maior disfunção`.

- Só questionário → pilar = questionário (comportamento atual, sem regressão).
- Exame chega → entra na média ponderada e refina o pilar.
- Cada pilar guarda a lista de contribuintes (instrumento + peso + % ) para exibir/auditar.

## 6. Implementação (estende o que existe, não reescreve)

- O catálogo Bio³ (`assessment_items_catalog`) já tem `pillar`, `weight`, `input_type`, `scoring_rule`.
- Adicionar `input_type = "exam_metric"` (ou reusar `lab`) com `scoring_rule` carregando: faixa de referência
  OU mapa rótulo→banda OU fórmula de balanço, + o roteamento de pilar/peso.
- Um passo de extração transforma o relatório do exame (os valores já destilados pela legenda) nesses itens,
  com revisão humana antes de gravar (mesmo gate dos questionários: rascunho → terapeuta confirma → calcula).
- Tudo rastreável: `patient_assessment_values` guarda valor + origem (qual exame, qual métrica).

## 7. Governança

- Rotular como "índice funcional integrativo" (não diagnóstico).
- Pesos **configuráveis por clínica** (default acima), e **revisados por prudência científica** antes de produção.
- Biorressonância sempre com peso menor e rótulo de "carga funcional".

## 8. Decisões (status)

1. **Pesos:** questionário 1.0 / neurometria 1.0 / biorressonância 0.4. APROVADO.
2. **Escalas/desvios das métricas numéricas:** RESOLVIDO pelo manual (seção 3, com páginas).
   Único ponto sem número no manual: corte de "grave" da temperatura, default de 3 °C de desvio = 100%
   (ajustável; Marcelo pode mandar a página se houver). Eixo cérebro-intestino fica em rótulo→banda.
3. **Mapa rótulo→banda** (leve=30 / moderado=55 / grave=90). APROVADO.
4. **Biorressonância** só no Bioemocional. APROVADO.
5. **Revisão humana** obrigatória antes de a métrica do exame entrar na pirâmide. SIM.

Todas as decisões fechadas. Próximo passo: implementar no motor de scoring (seção 6).
