# Brief — Medicação (carga): extrair do QRM e pontuar no Bioquímico

> Design fechado com Marcelo (27/06). Decisões: **IA extrai + terapeuta confirma** (gate);
> suplemento **não pontua**; mapa de cor **0 sem carga · 1-2 verde · 3-4 amarelo · 5+ vermelho**.

## Contexto (o que JÁ existe e vamos reusar)
- Item **`medicacao_carga`** já está no catálogo (`modules/neuro-id/catalog.ts`), pilar **Bioquímico**, escala 0-10 (valor × 10 = disfunção). O motor já pontua e leva pra pirâmide.
- Bandas (`modules/neuro-id/bands.ts`): disfunção **≤30 Baixo (verde)**, **31-69 Moderado (amarelo)**, **≥70 Alto (vermelho)**.
- Pipeline de valor: `confirmedExamMetrics()` → linhas em `patient_assessment_values` (origem `exam:`), inseridas em `createNeuroIdAssessment` e `autoUpsertNeuroIdDraft` (`services/neuro-id-service.ts`). **Mesmo caminho** pra medicação (origem `med:`).
- Gate: o **"Rever / editar"** do Mapa Bio³ já mostra/edita os valores dos itens antes de recalcular. Reusar como confirmação humana (sem gate novo).
- Pergunta-fonte: campo de **texto livre** no QRM ("Coloque todos os medicamentos e suplementos que está tomando"), seção MEDICAMENTO/SUPLEMENTAÇÃO.

## Mapa contagem → valor (escala 0-10 do item)
`medicationLoadValue(count)`: `0 → 0` · `1-2 → 2` (Baixo/verde) · `3-4 → 5` (Moderado/amarelo) · `5+ → 8` (Alto/vermelho). Bate com as bandas acima. Suplementos **não entram na contagem**.

## A construir
1. **`lib/medication-load.ts`** (puro + teste): `medicationLoadValue(count)` e os limiares de cor. Trivial e testável.
2. **Extração por IA** — `extractMedicationLoad(text)` em `services/` (padrão do `exam-ai-service`): recebe o texto livre, devolve `{ medications: string[], supplements: string[], medication_count: number }`. Prompt com guarda-corpo: só classifica/conta, não diagnostica; na dúvida marca como "a confirmar". Sem chave → devolve vazio (não quebra).
3. **Gatilho + gate (sem migration):** botão **"Extrair medicação (IA)"** (na Avaliação, perto de "Importar achados", ou no painel Bio³). Roda a IA, mostra a **separação remédio × suplemento + a contagem** pro terapeuta revisar/corrigir, e ao confirmar **semeia o `medicacao_carga`** (valor pelo mapa) no rascunho do Mapa Bio³. O terapeuta ainda pode ajustar no "Rever / editar". Decisão de NÃO rodar IA automática a cada rascunho (custo/latência) — é ação deliberada e gated.
4. **Wiring no scoring:** ao confirmar, gravar `medicacao_carga` em `patient_assessment_values` (origem `med:`), no mesmo ponto onde entram as `confirmedExamMetrics`, pra entrar no Bioquímico + pirâmide. Persistir a contagem confirmada (em `patients.assessment_data` sob chave reservada `_medicacao` OU coluna nova — avaliar; provável sem migration via assessment_data).
5. **Registro legível:** opcionalmente, anexar na Anamnese/Integração a lista "Remédios: ... / Suplementos: ..." pro relatório (texto, gated).

## Segurança clínica
É só **indicador de carga** (nº de medicamentos), nunca diagnóstico/conduta. Passa pelos gates Salvo/Aval no que virar texto de relatório. Linguagem prudente.

## Aceite
- Texto livre com 3 remédios + 2 suplementos → conta **3** → `medicacao_carga` valor 5 → Bioquímico/pirâmide em **amarelo**.
- Terapeuta consegue corrigir a separação/contagem antes de pontuar.
- `tsc` 0, testes do mapa verdes, `next build` ok. Sem promessa de cura.

## Tamanho / risco
~3-5 arquivos (lib + serviço IA + 1 ação + UI do gate + wiring no neuro-id-service) + testes. Provavelmente **sem migration**. Mexe no motor de scoring → revisar com cuidado; build não verifica o arrasto/IA logado (prova visual com Marcelo no deploy).
