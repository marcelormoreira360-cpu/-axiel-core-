# SPEC — Pipeline Doc 1 persuasivo + Doc 2 (Neuro ID) no AXIEL Core

> Status: **PLANO FINALIZADO — 5 decisões travadas por Marcelo (2026-08-21). Pronto para a sessão do repo executar por fases. Nada rodado em prod ainda.**
> Autor: Forja (engenharia/dados/segurança). Data: 2026-08-21. Branch-base: `main` (última migration = `147`; próxima livre = `148`).
> Escopo: transformar o Doc 1 "Relatório Funcional Integrado" (hoje `mapa_integrativo`) e o Doc 2 "Plano Integrativo" (hoje `plano_regulacao`) numa geração automática que (a) integra de fato as 3 fontes de exame, (b) tem tom persuasivo-ético, (c) obedece as regras novas de conduta, entregue em DOIS canais (render in-app + PDF). **Sem codificar, sem migration em prod até OK de Marcelo por fase.**

---

## 0. Decisões travadas (Marcelo, via Oxiel — 2026-08-21)

- **D1 = HÍBRIDO.** Scaffold determinístico (casca de segurança) + preenchimento LLM ancorado nos números brutos e sínteses de exame. É o modelo de toda a arquitetura abaixo (§2).
- **D2 = default por clínica + override por insight/paciente.** `conduta_emocional` nasce de uma config na tabela `clinics` (`default_conduta_emocional`) e pode ser sobrescrita por insight na coluna `ai_insights.conduta_emocional`. Resolução: override do insight › default da clínica › `"conduzida_pelo_profissional"`.
- **D3 = OS DOIS CANAIS.** O relatório é (1) renderizado NO APP (portal do paciente + review card do terapeuta) E (2) gera o PDF persuasivo integrado. Fluxo: rascunho → aprovação de Marcelo/terapeuta → PDF → envio. Ambos consomem a MESMA fonte (`final_output` do Doc 1 aprovado). O `neuro-id-pdf-service.ts` passa a ser alimentado pelas sínteses de exame + números brutos; a view in-app (`components/neuro-id-360-documents.tsx`) mostra o mesmo conteúdo.
- **D4 = migration 148 APROVADA.** Colunas aditivas para alerta/auditoria (`ai_insights.clinical_flags`, `ai_insights.conduta_emocional`, `clinics.default_conduta_emocional`). SQL pronto em §15; impacto RLS em §9. Aplicar em prod só com OK, validando antes na sessão do repo (cuidado com o drift de migrations conhecido — nada de `db push` cru).
- **D5 = detecção DETERMINÍSTICA via "policy layer".** Onde há score (ex.: PHQ-9 item 9 de ideação), um módulo determinístico calcula `clinical_flags`. **Os limiares/níveis/ações NÃO são hardcodados por Forja** — vêm de uma política do **Selo (compliance)** que o `mental-health-policy` (novo módulo) consome. Enquanto a política do Selo não sai, o módulo fica com um stub explícito (retorna `[]` / "policy pending") e um ponto de integração único. Ver §7.4.

---

## 1. Estado atual confirmado (file:line reais)

### 1.1 Onde os documentos vivem hoje
- **Doc 1 = `mapa_integrativo`** dentro de `AiInsightOutput`.
  - Schema/JSON shape: `modules/ai-insights/insight-schema.ts:63-82` (bloco `mapa_integrativo`), coerção em `coerceMapa` `insight-schema.ts:115-137`.
  - Tipo: `lib/types.ts:333-351` (`NeuroMapaIntegrativo`), com campos "novos" + `// Campos antigos (fallback)`.
- **Doc 2 = `plano_regulacao`** dentro do mesmo `AiInsightOutput`.
  - Schema: `insight-schema.ts:84-104`; coerção `coercePlano` `insight-schema.ts:139-160`; tipo `lib/types.ts:357-374`.
- **Doc 3 = `protocolo_suplementacao`**: `insight-schema.ts:106-112`, `coerceProtocolo:162-173`, tipo `lib/types.ts:377-385`.
- Os três saem de **UMA única chamada LLM**: prompt em `modules/ai-insights/guardrails.ts:9-122` (`buildAiInsightSystemPrompt`), orquestração `services/ai-insight/workflow.ts:9-77` → `services/ai-insight/generation.ts` (`generateAiInsightOutput`).
- Limite de texto por campo: `guardrails.ts:124-129` (`normalizeInsightText`, **corta em 3200 chars/campo**), teto de "~1,5 página" repetido no prompt (`guardrails.ts:108-109`).

### 1.2 O snapshot de entrada (o que a LLM realmente recebe)
- Builder: `services/ai-insight/input-builder.ts:83-195`; tipo `AiInsightInputSnapshot:13-81`.
- **Exames funcionais** entram em `functional_exams` (`input-builder.ts:172-177`) e levam **só `type/title/date/summary`** (prosa comprimida por `normalizeInsightText`). O tipo do campo está em `input-builder.ts:61-66`.
- **Bio³/neuro_id** entra em `input-builder.ts:184-193` e leva **só os %s agregados** (`indice_geral, fisico_pct, bioquimico_pct, emocional_pct, priority_pillar, is_partial`).
- **Os valores BRUTOS por métrica NÃO trafegam** ao Doc 1. Eles existem, confirmados por gate humano, em `patient_functional_exams.metrics_values` (`services/functional-exams-service.ts:14-20`; migration `supabase/migrations/100_functional_exam_metrics.sql`), e há helper de fusão `mergeConfirmedMetrics` (`modules/neuro-id/exam-metrics.ts:178-189`) — mas o input-builder **não os lê**.

### 1.3 Métricas e legendas (a matéria-prima já estruturada)
- Catálogo de métricas: `modules/neuro-id/exam-metrics.ts:48-95` (`EXAM_METRICS`), com `code/label/unit/instrument/extractHint/rawMin/rawMax` por métrica.
- Metadados de exibição por code: `exam-metrics.ts:100-101` (`EXAM_METRIC_META`).
- Legendas clínicas (instrução de leitura): `modules/neuro-id/exam-legends.ts` — neurometria `:22-50`, **biorressonância `:52-80`** (foco Psicologia/Emoções, emoção→órgão, proibido esotérico/diagnóstico), teste capilar `:82-103`.
- Extração de métricas do PDF: `services/exam-ai-service.ts:187-229` (`extractExamMetrics`) + síntese em prosa `analyzeExamPdf:125-175`.

### 1.4 O relatório persuasivo SEPARADO (o "outro" documento)
- `services/neuro-id-pdf-service.ts:294-…` (`buildNeuroIdPatientReportPdf`): PDF persuasivo de 7 "beats".
- Copy dos beats: `modules/neuro-id/report-copy.ts` — `buildPatientReportCopy:130-160`, beats 1-7 `:61-122`.
- **Consome APENAS scores** (`report-copy.ts:6-8` "Não recalcula nada — só consome scores"); **não vê nenhuma síntese de exame**.
- Guardrails de texto já existentes aqui: `PROHIBITED_TERMS` (`report-copy.ts:35-37`) + `findProhibited` (`:39-48`); bloco de salvaguarda **hardcoded CVV 188** (`report-copy.ts:127`), acionado por `showSafeguard` default `emocional_pct >= 70` (`neuro-id-pdf-service.ts:310`).

### 1.5 Governança / status (o que já existe)
- Revisão por insight: `lib/types.ts:408` → `AiInsightReviewStatus = "pending_review" | "needs_changes" | "final" | "archived"`; campos de aprovação em `AiInsight` (`lib/types.ts:410-427`: `final_output, approved_by, approved_at, reviewer_notes, changes_made`). Migrations `082/083/084`.
- Regras de governança textuais: `modules/ai-insights/governance.ts:5-14`.
- **Mapeamento com o pedido de Marcelo:** o ciclo `RASCUNHO→REVISADO→APROVADO` já EXISTE como `pending_review → needs_changes → final`. "Só exporta após aprovado" = exportar apenas quando `review_status === "final"` (usar `final_output`). Não precisa de enum novo; precisa **garantir o gate no ponto de export** (§7).

### 1.6 Diagnóstico confirmado (bate com o brief)
- **PROBLEMA 1 (biorressonância se perde):** `mapa_integrativo` não tem slot estruturado bioemocional; depende do LLM emitir item voluntário em `resultados_encontrados` (texto livre, `insight-schema.ts:75-77`) e, sob teto de 1,5 página (`guardrails.ts:108-109`), colapsa no `emocional_pct`. **CONFIRMADO.**
- **PROBLEMA 2 (neurometria confusa):** valores brutos por métrica não chegam ao Doc 1 (`input-builder.ts:184-193` só leva %s); o LLM re-extrai números da prosa de `summary`. **CONFIRMADO.**
- **PROBLEMA 3 (Rota A):** o doc que integra exames (`mapa_integrativo`, tom educativo — `guardrails.ts:20-54`) e o doc persuasivo (`report-copy.ts`, só scores) são **dois artefatos que não se cruzam**. **CONFIRMADO.**

---

## 2. Arquitetura-alvo (visão)

**Decisão Rota A recomendada: "scaffold determinístico + preenchimento LLM ancorado".**

Em vez de escolher entre "LLM livre" (hoje no `mapa_integrativo`) e "copy determinística" (hoje no `report-copy.ts`), unir os dois:

1. **Camada determinística (a casca de segurança)** controla o que é arriscado e não pode variar:
   - estrutura fixa das 6 seções do Doc 1 e 4 blocos do Doc 2;
   - injeção determinística da síntese de biorressonância (slot próprio);
   - injeção determinística de ≥1 âncora positiva;
   - bloco de crise / hotline por país (render condicional, nunca gerado pela LLM);
   - passagem dos valores brutos da neurometria para o snapshot;
   - pós-processamento: `findProhibited`, remoção de travessão, checagem de "palavras proibidas ao paciente" (exame/neurometria/protocolo/número de sessões).
2. **Camada LLM (o texto caloroso e integrado)** preenche apenas os campos narrativos de cada seção, recebendo como entrada os **números brutos já estruturados** + as **sínteses de exame já prontas** + os **beats persuasivos como exemplar de tom** (few-shot), nunca reinventando números.

Racional (trade-off, em linguagem simples): a parte que, se sair errada, causa dano (crise, promessa de cura, expor "exame/protocolo", inventar número) fica em **código testável**, não na sorte do modelo. A parte que precisa soar humana e conectada fica na LLM, mas **alimentada com dados verdadeiros** em vez de prosa comprimida. É o mesmo princípio que já usamos na fusão Bio³ (IA extrai, código converte).

---

## 3. Mudanças de SCHEMA (`insight-schema.ts` + `lib/types.ts`)

> Nenhuma dessas mudanças exige migration por si só (o `output` é `jsonb`). Ver §6 para o único campo que vale a pena persistir em coluna.

### 3.1 Novos campos no `mapa_integrativo` (Doc 1)
Adicionar ao shape (`insight-schema.ts:63-82`) e ao tipo `NeuroMapaIntegrativo` (`lib/types.ts:333-351`):

```
mapa_integrativo: {
  // ...campos atuais...
  leitura_neurometrica: NeuroSecaoItem[]      // achado→significa→o que sente, 1..n itens, ancorados em valor bruto
  leitura_bioemocional: {                     // SLOT ESTRUTURADO dedicado (Problema 1)
    temas: string[]                           // 3–4 temas macro (NUNCA item-a-item)
    sintese: string                           // parágrafo qualitativo; SEM número, SEM diagnóstico
  }
  leitura_bio3: NeuroSecaoItem                // "Leitura do Mapa Bio³" (os 3 eixos + índice geral)
  ancora_positiva: string                     // ≥1 achado Normal/preservado (injeção obrigatória)
  abertura_calorosa: string                   // seção 1
  conexao_aha: string                         // seção 4
  porque_agir_agora: string                   // seção 5 (ver variante 'possibilidade' em §5)
  proximo_passo: string                       // seção 6
  fase_jornada: string                        // já existe
}
```

Enums e campos de conduta (novos). **D2 travado:** `conduta_emocional` é RESOLVIDA no server (override do insight › default da clínica › fallback), não vem da LLM. O valor RESOLVIDO é gravado no `output` para o render/PDF; a fonte-de-verdade de auditoria são as colunas (migration 148, §15):

```
// resolvido no server e ecoado no output do Doc 1 (para render/PDF consumirem sem re-resolver):
conduta_emocional: "conduzida_pelo_profissional" | "no_documento"
clinical_flags: string[]     // ex.: "depressao","desesperanca","luto_perinatal","medicacao_ausente","gestacao"
crisis_hotline_block: {      // parametrizado por país/locale — só RENDERIZA sob condição (§5.4)
  country: string            // "BR" | "US" | ...
  render: boolean            // computado (não vem da LLM)
  text: string               // resolvido do i18n por país
} | null
```

**Onde cada coisa mora (D2):**
- `clinics.default_conduta_emocional` (coluna nova, migration 148) = default da clínica.
- `ai_insights.conduta_emocional` (coluna nova, migration 148) = override por insight (null = herda o default da clínica). É a coluna auditável.
- `mapa_integrativo.conduta_emocional` (no jsonb do output) = o valor JÁ RESOLVIDO, só para render/PDF não precisarem re-resolver. Nunca é editável pela LLM (o `coerceMapa` descarta o que a LLM mandar e injeta o valor resolvido).

`coerceMapa` (`insight-schema.ts:115-137`) passa a coagir os novos campos:
- `leitura_bioemocional.temas`: `list(v, 4)` (teto 4); `sintese`: `str()`.
- `leitura_neurometrica` / `leitura_bio3`: `coerceSecaoItens`.
- `ancora_positiva/abertura_calorosa/conexao_aha/porque_agir_agora/proximo_passo`: `str()`.
- `conduta_emocional`: coerção de enum com fallback `"conduzida_pelo_profissional"`.
- `clinical_flags`: `list()` filtrado por um allow-list de flags conhecidas (evita flag inventada).
- `crisis_hotline_block`: **NÃO** aceitar da LLM; sempre recomputado no server (§5.4). Se vier no JSON, descartar.

> Compatibilidade: manter todos os campos atuais como opcionais (o padrão da casa em `lib/types.ts:341-350` já faz isso com "// Campos antigos (fallback)"). Insights antigos continuam renderizando.

### 3.2 Novos campos no `plano_regulacao` (Doc 2)
Adicionar (shape `insight-schema.ts:84-104`, tipo `lib/types.ts:357-374`):

```
plano_regulacao: {
  onde_queremos_chegar: string                 // bloco 1
  tres_pilares: {                              // bloco 2
    nervoso: string
    emocional: string
    estilo_de_vida: string
  }
  como_caminhar_juntos: string                 // bloco 3 (varia por formato_atendimento)
  proximos_passos: string                      // bloco 4 (campo já existe como array; ver nota)
  formato_atendimento: "remoto" | "presencial" | "hibrido"
  suplementacao_stage: "nao_iniciada" | "pendente_dados_seguranca" | "ponteiro_doc3"
  conduta_emocional: (herda do output)
  fase_jornada: string
}
```
- **Doc 2 NÃO repete resultados** (regra do brief item 7): a coerção/validação deve rejeitar/limpar blocos que reproduzam os achados do Doc 1. Suplementação **apenas como ponteiro** (`suplementacao_stage="ponteiro_doc3"`), nunca lista de itens (isso é Doc 3).

### 3.3 Onde declarar os enums
Criar `modules/ai-insights/neuro-enums.ts` com:
- `CONDUTA_EMOCIONAL`, `FORMATO_ATENDIMENTO`, `SUPLEMENTACAO_STAGE`, `FASE_JORNADA` (lista canônica de fases), `KNOWN_CLINICAL_FLAGS`, `CRISIS_HOTLINE_BY_COUNTRY`.
- `CRISIS_HOTLINE_BY_COUNTRY` = `{ BR: { text_key: "crisis.br" }, US: { text_key: "crisis.us" }, ... }` resolvido via i18n (§8), **não** hardcoded como hoje em `report-copy.ts:127`.

---

## 4. Mudanças no INPUT (`input-builder.ts`)

### 4.1 Passar valores brutos da neurometria (Problema 2)
No `AiInsightInputSnapshot` (`input-builder.ts:13-81`), enriquecer `functional_exams`:

```
functional_exams: Array<{
  type, title, date, summary,                         // como hoje
  metrics: Array<{ code, label, unit, value }>        // NOVO: de metrics_values (gate humano)
}>
```
- Fonte: já temos `getPatientFunctionalExams` (traz `metrics_values`, `functional-exams-service.ts:14-17`). Mapear cada `code→{label,unit}` por `EXAM_METRIC_META` (`exam-metrics.ts:100-101`).
- **Só entram métricas com `metrics_reviewed_at != null`** (gate humano; brute values não confirmados não vão ao paciente). Isso é uma regra de segurança: dado bruto não revisado nunca chega ao Doc 1.
- Formato do snapshot: valor + unidade + label legível (ex.: `{code:"neuro_temperatura", label:"Temperatura periférica", unit:"°C", value:28.8}`), para a LLM ancorar sem re-extrair de prosa.

### 4.2 Separar a origem biorressonância (Problema 1)
- Marcar no snapshot a síntese de biorressonância como **origem própria** (não misturar no bloco genérico). Opção: um campo `bioemocional_source: { summary: string } | null` derivado do exame `type === "biorressonancia"` (usa `analyzeExamPdf`/`summary` já existente + a legenda `exam-legends.ts:52-80`).
- Essa síntese é injetada **determin**isticamente no slot `leitura_bioemocional` (§2), agrupada em 3–4 temas macro. A LLM só reescreve o tom, sem inventar emoções fora da síntese.

### 4.3 Passar país/locale (para o bloco de crise + i18n)
- **CORREÇÃO (code-review Fase 0):** NÃO existe `clinics.country` nem `clinics.locale` (a migration `056` adiciona `country` em **patients**, não em clinics). A fonte real e correta é o **paciente**: `patients.country` (default `'Brasil'`, migration `056`) + `patients.locale`. Isso também é mais correto clinicamente: a linha de crise é pelo país do PACIENTE (política do Selo), não da clínica.
- Implementado na Fase 0 como `patient.country` no snapshot (já havia `patient.locale`). O `crisis_hotline_block` (§5.4) e os textos i18n (§8) resolvem por `patient.country`/locale resolvido.

---

## 5. Mudanças no PROMPT/guardrails (`guardrails.ts`)

### 5.1 Unificar tom persuasivo + 6 seções (Doc 1)
Reescrever `buildAiInsightSystemPrompt` (`guardrails.ts:9-122`) para pedir o Doc 1 na **anatomia de 6 seções** (brief item 7):
1. abertura calorosa (`abertura_calorosa`);
2. retrato-herói + pirâmide Bio³ (`leitura_bio3` + índice) — números **para o profissional**, ao paciente traduzidos;
3. 3 leituras achado→significa→o que sente (`leitura_neurometrica` + `leitura_bioemocional` + demais);
4. a conexão "aha" (`conexao_aha`);
5. por que agir agora joga a favor (`porque_agir_agora`) — **variante "possibilidade"** quando `clinical_flags` inclui saúde mental (tom de esperança, nunca medo);
6. próximo passo (`proximo_passo`).

Injetar os **beats de `report-copy.ts` como few-shot de TOM** (exemplar), não como texto final. A copy aprovada por Aval/Termo vira o "molde de voz".

### 5.2 Guardrails de TEXTO AO PACIENTE (brief item 6) — reforçar no prompt E no pós-processamento
No prompt (texto): manter o que já existe (`guardrails.ts:45-53`: sem travessão, sem julgar evidência, respeitar medicação, não-diagnóstico) e **adicionar**:
- (a) **NUNCA** expor "exame", "neurometria", "biorressonância", "protocolo" ou número de sessões ao paciente. O protocolo do exame é insumo **interno**. Ao paciente: "a sua avaliação apontou uma direção de cuidado" + "sessões terapêuticas de acompanhamento" (sem quantidade).
- (b) SEMPRE injetar ≥1 âncora positiva (`ancora_positiva`).
- (c) proibir travessão "—".
- (d) sem promessa de cura, associação≠causalidade, sem enfraquecer a evidência do método.

**Pós-processamento determinístico** (novo `modules/ai-insights/patient-text-guardrails.ts`), rodado sobre os campos do Doc 1/Doc 2 destinados ao paciente ANTES de salvar:
- `findProhibited` (reusar `report-copy.ts:39-48`) + expandir `PROHIBITED_TERMS` com um **léxico "não-ao-paciente"**: `exame|exames|neurometria|biorressonância|protocolo|nº de sessões|X sessões`. Se aparecer → marcar o insight `needs_changes` com nota ("termo interno vazou ao paciente") em vez de exportar.
- remover/rejeitar travessão `—`.
- garantir presença de `ancora_positiva` (se vazio → `needs_changes`).
- Isso NÃO é censura silenciosa: sinaliza ao terapeuta no gate (§7), não reescreve escondido.

### 5.3 `conduta_emocional` (brief item 3)
- Default `conduzida_pelo_profissional`. Quando assim, **suprimir do texto ao paciente** qualquer bloco de crise/encaminhamento a saúde mental (o profissional cuida pessoalmente). Implementação: o pós-processamento **remove** o `crisis_hotline_block` e qualquer frase de encaminhamento, e o prompt instrui a LLM a **não** gerar esse conteúdo.
- Quando `no_documento`: ver §5.4.

### 5.4 `crisis_hotline_block` parametrizado por país (brief item 4)
- **Determinístico, nunca da LLM.** Recomputado no server a partir de `clinic.country`:
  - BR → CVV 188 / SAMU 192; US → 988; fallback → texto genérico "procure ajuda imediata / serviço de emergência local".
  - Texto vem do i18n por país (§8), substituindo o hardcode atual `report-copy.ts:127`.
- Só renderiza quando **`conduta_emocional === "no_documento"` E** existe flag de depressão/desesperança em `clinical_flags`. Hoje fica OFF por decisão de Marcelo (default `conduzida_pelo_profissional`), mas o campo/infra existe.

### 5.5 Acomodar sem estourar limite
- O teto de 3200 chars/campo (`guardrails.ts:124-129`) hoje é global. Com 6 seções em campos separados, o limite por campo passa a ser natural (cada seção é curta). Reduzir o teto por campo para ~1200–1500 e **remover a instrução "~1,5 página somando todos os exames"** (`guardrails.ts:108-109`), que é justamente o que colapsa a biorressonância. O controle de tamanho vira por-seção, não por-documento.

### 5.6 Destino da neurometria bruta
- O prompt deve instruir: use os `metrics` já fornecidos (valor+unidade+label) — **não re-extraia números de prosa**. "1 a 2 dados-âncora por achado" (já em `guardrails.ts:32-33`).

---

## 6. Rota A — os 2 artefatos, entregues em 2 canais (D3 travado)

Fonte única de verdade: o **Doc 1 (`mapa_integrativo`) aprovado** (`ai_insights.final_output`, `review_status === "final"`). Os dois canais leem a MESMA estrutura de 6 seções; não há copy paralela divergente.

- **Unir no Doc 1 (`mapa_integrativo`)**, que passa a ser persuasivo E integrado (§2/§5).
- **`report-copy.ts`**: **preservar como fonte de TOM/estrutura** (exemplar few-shot + faixas `copyBandForDysfunction:163-167` + `PROHIBITED_TERMS`/`findProhibited` reusados no pós-processamento). Não deletar; vira biblioteca de guardrails+voz.

### 6.1 Canal A — render IN-APP (portal do paciente + review do terapeuta)
- Componente existente: `components/neuro-id-360-documents.tsx` (já renderiza `mapa_integrativo`/`plano_regulacao`). Evoluir para as 6 seções (Doc 1) e 4 blocos (Doc 2), com o slot bioemocional e a âncora positiva.
- Review do terapeuta: `components/ai-insight-review-card.tsx` + `components/ai-insight-panel.tsx` mostram o RASCUNHO (`output`) com o selo de gate clínico (§7) e permitem editar/aprovar → grava `final_output` + `review_status="final"`.
- Portal do paciente: renderiza **só quando `review_status === "final"`**, lendo `final_output` (mesma estrutura). Sem PDF obrigatório para ver in-app.
- O `crisis_hotline_block` e a supressão por `conduta_emocional` valem IGUAL nos dois canais (a resolução é no server, §5.3/§5.4, e já vem no output).

### 6.2 Canal B — PDF persuasivo integrado
- **`buildNeuroIdPatientReportPdf`** (`neuro-id-pdf-service.ts:294`): **deprecar a geração de conteúdo por scores**, manter como **renderizador de PDF** alimentado pelo **Doc 1 aprovado** (as 6 seções + slot bioemocional + números brutos), aproveitando layout/pirâmide `drawPyramid`, header/footer e branding.
- Rotas de PDF que passam a exigir `review_status==="final"` e a ler `final_output`: `app/api/patients/[id]/neuro-id/pdf/route.ts` e `app/api/reports/paciente/[id]/route.ts` (confirmar na sessão do repo qual é a canônica; unificar para uma fonte).
- Fluxo D3: rascunho (LLM) → terapeuta/Marcelo revisa e aprova no review card → PDF gerado do `final_output` → envio ao paciente. **Nunca gerar PDF de insight não-`final`.**

### 6.3 Garantia de paridade in-app ↔ PDF
- Ambos consomem o MESMO objeto Doc 1. Um teste de paridade (Fase 6) confere que as seções renderizadas in-app == seções do PDF (mesmos campos, mesma supressão de crise).

---

## 7. Gate clínico interno (`clinical_flags` → revisão)

- Quando `clinical_flags` traz depressão/desesperança/luto perinatal/medicação ausente/gestação: o insight **nasce `pending_review` com um selo visível** ("Revisão clínica necessária: <flags>") no painel do terapeuta. Nada é gerado nem enviado automático (equivalente ao gate Salvo, já é a cultura da casa).
- **Trava do Doc 3 (suplementação):** se faltar dado de segurança (medicação em uso, gestação, condições — derivável de `prescriptions`/`antecedents` no snapshot), **não gerar `protocolo_suplementacao`**; em vez disso `plano_regulacao.suplementacao_stage = "pendente_dados_seguranca"` e um `data_limitations` explicando o que falta. (`data_limitations` já existe, `insight-schema.ts:59`.)
- Sinalização no produto: badge no card do insight (`ai-insight-review-card.tsx`) + item em `practitioner_review_points`. Sem auto-envio. O envio ao paciente só quando `review_status === "final"`.

### 7.4 Policy layer de saúde mental (D5 travado)
Novo módulo `modules/ai-insights/mental-health-policy.ts` — o ÚNICO ponto que decide flags/ações de risco. **Forja não hardcoda limiares.**

- **Interface estável (consome a política do Selo):**
  ```
  type MentalHealthPolicy = {
    version: string;                       // versão da política do Selo (auditoria)
    triggers: Array<{
      flag: string;                        // ex.: "ideacao_suicida"
      source: "phq9" | "gad7" | "qsna" | "intake";
      rule: PolicyRule;                    // ex.: { field: "phq9_item9", op: ">=", value: 1 }
      level: "info" | "attention" | "urgent";
      actions: string[];                   // ex.: ["gate_review","block_doc3","offer_crisis_block"]
    }>;
  };
  detectClinicalFlags(snapshot, policy): { flags: string[]; level: string; actions: string[] }
  ```
- **Entrada determinística:** roda sobre scores já calculados no snapshot (assessments com `score_percentage`/itens; ex.: PHQ-9 item 9 de ideação). Sem LLM decidindo risco.
- **Stub enquanto o Selo não entrega:** `mental-health-policy.ts` inicia com `EMPTY_POLICY` (`triggers: []`, `version: "pending-selo"`), retornando `flags: []`. Isso NÃO desliga o gate humano geral (o insight ainda nasce `pending_review`); só não dispara ações automáticas de risco até a política existir. Ponto de integração único: quando o Selo passar a política (limiares + níveis + ações), ela é carregada aqui (arquivo de config versionado ou tabela `clinic_policies`, a definir com o Selo) sem mexer no resto do pipeline.
- **Ações que a política pode pedir** (o pipeline já sabe executar): `gate_review` (força `pending_review` + badge), `block_doc3` (trava suplementação, `suplementacao_stage="pendente_dados_seguranca"`), `offer_crisis_block` (habilita `crisis_hotline_block` quando `conduta_emocional==="no_documento"`).
- **Requisito para o Selo (deixar explícito no handoff):** a política precisa entregar, por trigger, o `source`+`rule` (como ler o score), o `level` e a lista de `actions` do conjunto acima. Compliance FDA/FTC/LGPD/HIPAA é responsabilidade do Selo; Forja só executa o que a política mandar.

---

## 8. Camada i18n (en / pt-BR / pt-PT)

- Namespaces existentes: `messages/{locale}/insights.json`, `neuroId.json`, `reports.json`.
- Chaves **de UI/rótulos** (títulos das 6 seções, dos 4 blocos, selos do gate, labels de conduta/formato): adicionar em `neuroId.json` (ou `insights.json`), nos 3 locales.
- Chaves de **crise por país** (`crisis.br`, `crisis.us`, `crisis.fallback`): a hotline é por PAÍS DA CLÍNICA, mas o texto renderiza no LOCALE DO PACIENTE → precisa das 3 traduções por país.
- **O conteúdo dos documentos (texto ao paciente) NÃO é i18n estático** — é gerado pela LLM no locale do paciente (`languageInstruction`, já em `guardrails.ts:17`). i18n cobre só a moldura (rótulos, disclaimers fixos, crise).
- Rodar `verify:i18n` a cada lote (padrão da casa).

---

## 9. Migrations, RLS, multi-tenant (D4 travado)

- **`output`/`final_output` são `jsonb`** → os campos NARRATIVOS do Doc 1/Doc 2 **não exigem migration** (menor risco).
- **Migration 148 (aditiva, aprovada — SQL exato em §15):**
  - `ai_insights.clinical_flags text[] not null default '{}'` — flags do gate, para alerta/filtro sem varrer JSON.
  - `ai_insights.conduta_emocional text` (nullable; null = herda a clínica) — override por insight (D2).
  - `clinics.default_conduta_emocional text not null default 'conduzida_pelo_profissional'` — default por clínica (D2).
  - **CHECK** nos dois `conduta_emocional` para o enum (`'conduzida_pelo_profissional' | 'no_documento'`).
- **Impacto RLS/multi-tenant:**
  - `ai_insights` já é tenant-scoped por `clinic_id` (policies `082/084`); `clinics` já é scoped pelo acesso do usuário. **Colunas aditivas herdam as policies existentes — nenhuma policy nova.**
  - Nenhum dado cruza tenant: `clinical_flags`/`conduta_emocional` são por-linha, sempre sob o `clinic_id` da linha.
  - `country` da clínica já existe (migration `056`) — sem migration para a hotline.
  - `notify pgrst` no fim para recarregar o schema (padrão da casa, ver `100_functional_exam_metrics.sql:15`).
- **Governança:** aplicar em prod só com OK de Marcelo (via Oxiel); validar antes na sessão do repo. Atenção ao drift de migrations conhecido — **não rodar `db push` cru**.

---

## 10. Decisões — TRAVADAS (ver §0)

As 5 decisões foram batidas por Marcelo em 2026-08-21 e estão consolidadas em **§0**. D1=híbrido · D2=default clínica + override insight · D3=in-app **e** PDF · D4=migration 148 aprovada · D5=policy layer determinístico consumindo a política do Selo. O restante deste SPEC reflete essas decisões.

---

## 11. Plano faseado (D3=ambos; branch → gates → merge)

Ordem de **menor risco → maior valor**. **Cada fase roda NA SESSÃO DO REPO:** branch própria → `pnpm typecheck` + `pnpm verify:i18n` + testes + `/code-review --fix` → merge. **Forja (aqui) não codifica nem faz deploy.** O que precisa de OK de Marcelo está marcado.

- **Fase 0 — Plumbing do snapshot (risco mínimo, saída inalterada).** [repo]
  - `input-builder.ts`: passar `metrics` brutos (só `metrics_reviewed_at != null`), `bioemocional_source`, `clinic.country/locale`.
  - Testes: métricas só entram revisadas; sem regressão no output atual.
  - **OK de Marcelo:** não requer (sem mudança visível).
- **Fase 1 — Schema aditivo Doc 1 + coerção.** [repo]
  - `insight-schema.ts` + `lib/types.ts` + `coerceMapa`; criar `modules/ai-insights/neuro-enums.ts` (§14). Campos novos opcionais/vazios (LLM ainda não preenche).
  - Testes: coerção dos novos campos, allow-list de flags, descarte de `crisis_hotline_block`/`conduta_emocional` vindos da LLM.
  - **OK de Marcelo:** não requer (aditivo, invisível).
- **Fase 2 — Pós-processamento de guardrails ao paciente.** [repo]
  - `modules/ai-insights/patient-text-guardrails.ts`: léxico "não-ao-paciente" + travessão + âncora positiva → marca `needs_changes`. Plugado no `workflow.ts` após geração.
  - Testes: léxico (exame/neurometria/protocolo/sessões), travessão, âncora ausente.
  - **OK de Marcelo:** não requer.
- **Fase 3 — Prompt Doc 1 nas 6 seções + tom persuasivo (o coração).** [repo]
  - Reescrever `buildAiInsightSystemPrompt`; beats de `report-copy.ts` como few-shot; ajustar limites (§5.5); slot bioemocional determinístico; usar `metrics` brutos.
  - Testes: paciente-ouro (caso Amanda, `project_doc1_persuasivo`) — 6 seções presentes, biorressonância no slot próprio em 3–4 temas, sem número vazando, sem termo interno.
  - **OK de Marcelo:** SIM — validar o TOM/conteúdo do Doc 1 gerado antes de seguir (é o que vai ao paciente).
- **Fase 4 — Migration 148 + conduta_emocional + crise por país + policy layer/gate.** [repo + prod]
  - Migration 148 (§15): validar na sessão do repo → **aplicar em prod só com OK de Marcelo**.
  - Resolver `conduta_emocional` no server (override › clínica › fallback); `crisis_hotline_block` determinístico por `clinic.country` + i18n (3 locales × países); `mental-health-policy.ts` com `EMPTY_POLICY` stub (§7.4); selo de gate no `ai-insight-review-card.tsx`; trava do Doc 3.
  - Testes: supressão de crise quando `conduzida_pelo_profissional`; hotline certa por país; stub retorna `[]` sem quebrar o gate humano.
  - **OK de Marcelo:** SIM (migration em prod) + **handoff Selo** (política real de gatilhos entra depois, sem re-deploy do pipeline).
- **Fase 5 — Doc 2 (4 blocos) + formato/suplementação.** [repo]
  - Schema + prompt do `plano_regulacao`; garantir "não repete resultados"; suplementação só como ponteiro (`suplementacao_stage`); `formato_atendimento`.
  - Testes: Doc 2 não duplica achados do Doc 1; sem lista de suplementos no Doc 2.
  - **OK de Marcelo:** SIM — validar conteúdo do Doc 2.
- **Fase 6 — Canais D3: render in-app + PDF integrado + gate de export.** [repo]
  - `components/neuro-id-360-documents.tsx`: 6 seções/4 blocos; `ai-insight-review-card.tsx`/`ai-insight-panel.tsx`: fluxo aprovar → `final_output`.
  - `neuro-id-pdf-service.ts`: alimentar `buildNeuroIdPatientReportPdf` com o Doc 1 aprovado; deprecar geração por scores; rotas de PDF exigem `review_status==="final"`.
  - Testes: PDF só de insight `final`; **teste de paridade in-app ↔ PDF** (mesmas seções, mesma supressão de crise).
  - **OK de Marcelo:** SIM — validar os dois canais lado a lado antes de liberar envio ao paciente.

**Checklist por fase (repo):** `pnpm typecheck` · `pnpm verify:i18n` · testes unit (`modules/neuro-id/__tests__`, novo `modules/ai-insights/__tests__`) · `/code-review --fix` · conferência de que nenhum termo interno vaza ao paciente.

---

## 12. Riscos

- **R1 — Vazar termo interno ao paciente** ("exame/neurometria/protocolo/nº sessões"). Mitigação: léxico determinístico na Fase 2 + gate. É o risco de credibilidade mais alto.
- **R2 — Crise mal endereçada** (hotline errada por país, ou aparecer quando não deveria). Mitigação: determinístico por `clinic.country`, default OFF, gate clínico. Toca compliance (Selo).
- **R3 — LLM inventar número** apesar de receber os brutos. Mitigação: prompt "use só os `metrics` fornecidos" + o léxico não pega isso — considerar validação de que números citados ∈ conjunto fornecido (Fase 3, best-effort).
- **R4 — Regressão em insights antigos** (campos novos ausentes). Mitigação: tudo opcional/fallback, padrão já existente no tipo.
- **R5 — Detecção de `clinical_flags`** falso-negativo/positivo. Mitigação (D5 travado): detecção determinística sobre score, e os limiares vêm da política do Selo via `mental-health-policy.ts` (§7.4), não de chute de engenharia. Até a política existir, stub `EMPTY_POLICY` (não dispara ação automática, mas o gate humano geral permanece).
- **R6 — Custo/latência** de mais dados no prompt. Baixo; os brutos são poucos codes. Monitorar `tokens_used` (já gravado, `workflow.ts:31-39`).

---

## 13. Marca do que roda ONDE

- **Sessão do repo (dev pesado + deploy):** todas as Fases 0–6 (código, prompt, migration 148, testes, PDF, canais).
- **Forja (aqui):** este SPEC + rascunho de schema/tipos (§14) e da migration 148 (§15) + decisões de segurança/RLS. **Não codifico feature nem aplico migration em prod nem faço deploy daqui.**
- **Selo (compliance):** política de detecção de saúde mental (D5, limiares/níveis/ações que o `mental-health-policy.ts` consome) e revisão do texto de crise (FDA/FTC/LGPD/HIPAA). Handoff = a interface `MentalHealthPolicy` em §7.4/§14.4.

---

## 14. Rascunho EXATO de schema (tipos + Zod) — pronto para a Fase 1

> Convenção da casa: `insight-schema.ts` valida por **coerção manual** (não Zod). Mantenho esse padrão para o `output` (compatibilidade com insights antigos) e adiciono **Zod só para o `MentalHealthPolicy`** (config externa do Selo, que se beneficia de validação em runtime). Zod já está no projeto (`zod ^3.24.1`).

### 14.1 `modules/ai-insights/neuro-enums.ts` (novo)
```ts
export const CONDUTA_EMOCIONAL = ["conduzida_pelo_profissional", "no_documento"] as const;
export type CondutaEmocional = (typeof CONDUTA_EMOCIONAL)[number];
export const DEFAULT_CONDUTA_EMOCIONAL: CondutaEmocional = "conduzida_pelo_profissional";

export const FORMATO_ATENDIMENTO = ["remoto", "presencial", "hibrido"] as const;
export type FormatoAtendimento = (typeof FORMATO_ATENDIMENTO)[number];

export const SUPLEMENTACAO_STAGE = ["nao_iniciada", "pendente_dados_seguranca", "ponteiro_doc3"] as const;
export type SuplementacaoStage = (typeof SUPLEMENTACAO_STAGE)[number];

// Allow-list de flags conhecidas (coerção descarta qualquer flag fora daqui).
export const KNOWN_CLINICAL_FLAGS = [
  "depressao", "desesperanca", "ideacao_suicida", "luto_perinatal",
  "medicacao_ausente", "gestacao", "condicao_renal", "condicao_hepatica",
] as const;
export type ClinicalFlag = (typeof KNOWN_CLINICAL_FLAGS)[number];

// País da clínica -> chave i18n do texto de crise (texto renderiza no locale do paciente).
export const CRISIS_HOTLINE_BY_COUNTRY: Record<string, string> = {
  BR: "neuroId.crisis.br",   // CVV 188 / SAMU 192
  US: "neuroId.crisis.us",   // 988
};
export const CRISIS_HOTLINE_FALLBACK_KEY = "neuroId.crisis.fallback";

export function coerceCondutaEmocional(v: unknown, fallback: CondutaEmocional = DEFAULT_CONDUTA_EMOCIONAL): CondutaEmocional {
  return (CONDUTA_EMOCIONAL as readonly string[]).includes(String(v)) ? (v as CondutaEmocional) : fallback;
}
```

### 14.2 Tipos novos em `lib/types.ts` (aditivos — não remover os atuais)
```ts
// --- Doc 1: leitura bioemocional (SLOT dedicado; Problema 1) ---
export type NeuroLeituraBioemocional = {
  temas: string[];   // 3–4 temas macro; NUNCA item-a-item
  sintese: string;   // qualitativo; sem número, sem diagnóstico
};

// Bloco de crise — SEMPRE computado no server, nunca da LLM.
export type CrisisHotlineBlock = {
  country: string;   // "BR" | "US" | ...
  render: boolean;
  text: string;      // resolvido do i18n no locale do paciente
};

// Estende NeuroMapaIntegrativo (adicionar estes campos ao type existente, todos opcionais):
//   abertura_calorosa?: string;              // seção 1
//   leitura_bio3?: NeuroSecaoItem;           // seção 2 (retrato-herói + pirâmide)
//   leitura_neurometrica?: NeuroSecaoItem[]; // seção 3a (achado→significa→sente)
//   leitura_bioemocional?: NeuroLeituraBioemocional; // seção 3b
//   ancora_positiva?: string;                // âncora positiva obrigatória
//   conexao_aha?: string;                    // seção 4
//   porque_agir_agora?: string;              // seção 5 (variante "possibilidade" se flag saúde mental)
//   proximo_passo?: string;                  // seção 6
//   conduta_emocional?: CondutaEmocional;    // valor RESOLVIDO (eco p/ render/PDF)
//   clinical_flags?: ClinicalFlag[];         // eco p/ render/gate
//   crisis_hotline_block?: CrisisHotlineBlock | null;

// Estende NeuroPlanoRegulacao (Doc 2 — 4 blocos), todos opcionais:
//   onde_queremos_chegar?: string;           // bloco 1
//   tres_pilares?: { nervoso: string; emocional: string; estilo_de_vida: string }; // bloco 2
//   como_caminhar_juntos?: string;           // bloco 3 (varia por formato_atendimento)
//   formato_atendimento?: FormatoAtendimento;
//   suplementacao_stage?: SuplementacaoStage;
//   conduta_emocional?: CondutaEmocional;
```

### 14.3 `coerceMapa` / `coercePlano` — deltas (`insight-schema.ts`)
```ts
// dentro de coerceMapa(...):
abertura_calorosa: str(m.abertura_calorosa) || undefined,
leitura_bio3: coerceSecaoItens([m.leitura_bio3])[0],            // 1 item
leitura_neurometrica: coerceSecaoItens(m.leitura_neurometrica), // n itens
leitura_bioemocional: m.leitura_bioemocional
  ? { temas: list(m.leitura_bioemocional.temas, 4), sintese: str(m.leitura_bioemocional.sintese) }
  : undefined,
ancora_positiva: str(m.ancora_positiva) || undefined,
conexao_aha: str(m.conexao_aha) || undefined,
porque_agir_agora: str(m.porque_agir_agora) || undefined,
proximo_passo: str(m.proximo_passo) || undefined,
// RESOLVIDOS NO SERVER (nunca da LLM): injetados fora do coerce, após detectClinicalFlags/resolveConduta.
// coerceMapa DESCARTA o que a LLM mandar nestes campos:
// conduta_emocional / clinical_flags / crisis_hotline_block  -> setados pelo workflow, não aqui.

// coercePlano(...): onde_queremos_chegar, tres_pilares{nervoso,emocional,estilo_de_vida},
// como_caminhar_juntos, formato_atendimento (coerce enum), suplementacao_stage (coerce enum).
```
> Regra de ouro de segurança: os 3 campos resolvidos no server (`conduta_emocional`, `clinical_flags`, `crisis_hotline_block`) são **sobrescritos pelo `workflow.ts`** depois do coerce, para que a LLM nunca controle crise/conduta.

### 14.4 `MentalHealthPolicy` com Zod (`modules/ai-insights/mental-health-policy.ts`, novo)
```ts
import { z } from "zod";

export const PolicyRuleSchema = z.object({
  field: z.string(),                          // ex.: "phq9_item9"
  op: z.enum([">=", ">", "==", "<=", "<"]),
  value: z.number(),
});
export const PolicyActionSchema = z.enum(["gate_review", "block_doc3", "offer_crisis_block"]);
export const MentalHealthPolicySchema = z.object({
  version: z.string(),
  triggers: z.array(z.object({
    flag: z.string(),
    source: z.enum(["phq9", "gad7", "qsna", "intake"]),
    rule: PolicyRuleSchema,
    level: z.enum(["info", "attention", "urgent"]),
    actions: z.array(PolicyActionSchema),
  })),
});
export type MentalHealthPolicy = z.infer<typeof MentalHealthPolicySchema>;

// STUB até o Selo entregar a política real (nenhum limiar hardcodado por Forja):
export const EMPTY_POLICY: MentalHealthPolicy = { version: "pending-selo", triggers: [] };

export function detectClinicalFlags(
  snapshot: AiInsightInputSnapshot,
  policy: MentalHealthPolicy = EMPTY_POLICY,
): { flags: string[]; level: "info" | "attention" | "urgent" | null; actions: string[] } {
  // avalia policy.triggers contra scores JÁ calculados no snapshot (determinístico).
  // stub: sem triggers -> { flags: [], level: null, actions: [] }
  // NÃO desliga o gate humano geral (insight ainda nasce pending_review).
}
```

---

## 15. Rascunho EXATO da migration 148 (aditiva) — pronto para a sessão do repo

> Arquivo: `supabase/migrations/148_ai_insight_conduta_e_flags.sql`. **Aditivo e idempotente** (`if not exists`). Não aplicar em prod sem OK de Marcelo; validar antes na sessão do repo. **Não** usar `db push` cru (drift conhecido).

```sql
-- 148_ai_insight_conduta_e_flags.sql
-- Neuro ID Doc 1 persuasivo: conduta emocional (default por clínica + override por insight)
-- e clinical_flags do gate de saúde mental (auditoria/alerta). Aditivo; RLS herdado.

-- Default POR CLÍNICA (D2)
alter table public.clinics
  add column if not exists default_conduta_emocional text
    not null default 'conduzida_pelo_profissional';

alter table public.clinics
  drop constraint if exists clinics_default_conduta_emocional_check;
alter table public.clinics
  add constraint clinics_default_conduta_emocional_check
    check (default_conduta_emocional in ('conduzida_pelo_profissional', 'no_documento'));

-- Override POR INSIGHT (D2) + flags do gate (D5)
alter table public.ai_insights
  add column if not exists conduta_emocional text,               -- null = herda a clínica
  add column if not exists clinical_flags   text[] not null default '{}';

alter table public.ai_insights
  drop constraint if exists ai_insights_conduta_emocional_check;
alter table public.ai_insights
  add constraint ai_insights_conduta_emocional_check
    check (conduta_emocional is null
           or conduta_emocional in ('conduzida_pelo_profissional', 'no_documento'));

comment on column public.clinics.default_conduta_emocional is
  'Default da clínica p/ condução do bloco emocional/crise no Doc 1 (Neuro ID). Override por insight em ai_insights.conduta_emocional.';
comment on column public.ai_insights.conduta_emocional is
  'Override por insight (null = herda clinics.default_conduta_emocional). conduzida_pelo_profissional suprime bloco de crise no texto ao paciente.';
comment on column public.ai_insights.clinical_flags is
  'Flags do gate de saúde mental (ex.: depressao, ideacao_suicida) detectadas deterministicamente (policy layer do Selo). Auditoria/alerta; não decide sozinho o envio.';

-- Índice p/ alerta/filtro por flags sem varrer JSON (GIN em array).
create index if not exists ai_insights_clinical_flags_idx
  on public.ai_insights using gin (clinical_flags);

notify pgrst, 'reload schema';
```

**Impacto RLS/multi-tenant (revisar na sessão do repo antes de aplicar):**
- Colunas aditivas em `ai_insights` e `clinics`; **as policies existentes (tenant por `clinic_id`) já cobrem as colunas novas** — nada de policy nova.
- Sem backfill destrutivo: `default_conduta_emocional` assume o default seguro (`conduzida_pelo_profissional`) em todas as clínicas; `clinical_flags` nasce `'{}'`; `conduta_emocional` do insight nasce `null` (herda a clínica). Comportamento pré-existente preservado (crise OFF por padrão).
- `check` garante o enum no banco (defesa em profundidade além do TS/coerce).
- Rollback (se preciso): `drop column`/`drop constraint`/`drop index` correspondentes — todas as mudanças são reversíveis e não tocam dados existentes.
