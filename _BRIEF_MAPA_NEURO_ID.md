# BRIEF DE BUILD — Mapa / Índice Neuro ID (AXIEL Core)

> Feature visual que transforma a avaliação em **pirâmide de % por 3 eixos** (Report of Findings com a cara do método). Une avaliação clínica + marca + conversão.
> Preparado pelo squad (Nucleo + Laudo + Forja + Celso, via Axiel). **Ler `CONTEXT.md` antes.** `/code-review --fix` antes do commit.
> Encaixa com `_BRIEF_SUPLEMENTOS.md` e `_BRIEF_QUICKWINS.md`.

## ▶️ KICKOFF — COLE ISTO NA SESSÃO DO REPO DO CORE
> Você está no repo do AXIEL Core. Leia primeiro `CONTEXT.md` (raiz) e depois este `_BRIEF_MAPA_NEURO_ID.md` (raiz) — a spec completa está aqui.
>
> Tarefa: implementar o **MVP da feature Mapa Bio³** (Índice Neuro ID).
>
> Decisões já tomadas (não reabrir):
> - 3 eixos: **Biomecânico** ("corpo & movimento"), **Bioquímico** ("energia & química interna"), **Bioemocional** ("mente & equilíbrio"), conectados pelo SNA.
> - O motor calcula **disfunção 0–100** por item; o display ao paciente é **% de equilíbrio** (= 100 − disfunção); **menor equilíbrio = prioridade**.
> - Fontes por eixo + mapa item→pilar: seções 2 e 3. Modelo de dados: seção 4. Relatório (1 PDF herói + evolução): seção 5.
>
> Ordem de build (corte MVP, seções 3–5):
> 1. Migrations com RLS por `clinic_id`: `assessment_items_catalog`, `patient_assessments`, `patient_assessment_values`, `patient_neuro_id_scores` (modelo na seção 4).
> 2. Seed do catálogo com o mapa item→pilar da seção 3 (com direção e pesos default).
> 3. Motor de cálculo: item → disfunção 0–100 → média ponderada por pilar → índice geral → prioridade; trata dado faltando (score parcial + flag/CTA).
> 4. Tela do Mapa (pirâmide + índice + prioridade), exibindo em **equilíbrio**.
> 5. PDF herói timbrado (≤4 páginas) com o plano amarrado aos eixos.
>
> Regras: siga os padrões do `CONTEXT.md`; multi-tenant/RLS obrigatório; compliance (bem-estar funcional, sem diagnóstico nem promessa de cura). Prefira editar arquivos existentes a criar novos. Pergunte só em decisão de produto ambígua. Ao terminar, rode `/code-review --fix` e me mostre o que mudou. **NÃO faça deploy em produção sem meu OK.**

## 0. Nomes e display (DEFINIDO por Marcelo 2026-06-18)
- **Nome do produto/relatório:** **Mapa Bio³** ("os 3 Bios"). Score = **Índice Bio**.
- **Os 3 eixos (assinatura)** + palavra simples p/ o paciente:
  - 🦴 **Biomecânico** — "corpo & movimento" (Terapia Manual)
  - 🌿 **Bioquímico** — "energia & química interna" (Naturopatia)
  - 🧠 **Bioemocional** — "mente & equilíbrio" (Microfisioterapia)
  - conectados pelo **SNA**.
- **Display ao paciente = "% de EQUILÍBRIO"** (maior = melhor). O eixo de MENOR equilíbrio = prioridade.

## 1. Direção da métrica
**Motor calcula DISFUNÇÃO 0–100** (maior = pior). **Display ao paciente = EQUILÍBRIO = 100 − disfunção** (escolha de Marcelo). Visão do terapeuta pode mostrar disfunção; paciente vê equilíbrio. Mesma engine, só flag de exibição.

## 2. Os 3 eixos e suas FONTES (confirmado por Marcelo)
| Eixo (pilar clínico) | De onde vem o score |
|---|---|
| **Físico** (Terapia Manual) | avaliação prática do terapeuta: dor + mobilidade musculoesquelética |
| **Bioquímico** (Naturopatia) | questionários + exames (sangue, cabelo) + medicação + intestino/hormonal |
| **Emocional / Neuro** (Microfisioterapia) | relato emocional + achados autonômicos/cranianos (SNA) do terapeuta + QSNA + (quando houver) exames de sistema nervoso (HRV/neurometria) |

Conectados pelo **SNA**.

## 3. Motor de pontuação (o coração — sem isso a % é chute)
Cada **item de entrada** vira um score de disfunção **0–100**:
- item 0–10 "maior = melhor" (mobilidade): `disfuncao = (10 − valor) × 10`
- item 0–10 "maior = pior" (dor, rigidez, QSNA): `disfuncao = valor × 10`
- resposta de questionário (sim/não, escala): mapa configurável → 0–100
- exame laboratorial: fora da faixa → leve(25)/moderado(50)/alto(75–100) por marcador (regra configurável)
- medicação: flag de carga por classe (ex.: anti-hipertensivo pontua no eixo bioquímico/cardiovascular) — peso configurável

Cada item tem: **pilar, direção, peso** (default + ajustável por clínica).
- `pilar_% = média ponderada dos itens DISPONÍVEIS daquele pilar`
- `indice_geral = média ponderada dos 3 pilares`
- `prioridade = pilar com maior %`
- **Dados faltando:** calcula com o que há + marca `parcial (aguardando exame X)` → isso vira **CTA para pedir o exame** (justifica o pedido).

### Mapa item→pilar (do SOAP atual de avaliação)
- **Físico:** dor; mobilidade sacro-ilíaca; cápsula do quadril; lombar; (visceral+diafragma — parcial).
- **Emocional/Neuro:** tronco simpático; infra/supra clavicular + plexo cardíaco/pulmonar; vago + gânglio cervical; vago orelha + temporal; sutura occipto-mastoide; QSNA; relato emocional; sono.
- **Bioquímico:** intestino; ciclo/hormonal; medicação; exames sangue/cabelo; QRM.
*(Tabela editável: cada clínica pode remapear/repesar seus próprios itens.)*

## 4. Modelo de dados (novo — mínimo)
```sql
assessment_items_catalog (
  id, clinic_id not null, code text, label text,
  pillar text,                 -- 'fisico' | 'bioquimico' | 'emocional'
  direction text,              -- 'higher_worse' | 'higher_better'
  input_type text,             -- 'scale_0_10' | 'boolean' | 'choice' | 'lab' | 'med'
  scoring_rule jsonb,          -- regra de normalização → 0-100
  weight numeric default 1, active bool default true
)
patient_assessments (
  id, clinic_id not null, patient_id not null, assessed_at,
  source text,                 -- 'soap' | 'questionnaire' | 'lab' | 'manual'
  status text default 'draft'
)
patient_assessment_values (
  id, assessment_id not null, item_code text,
  raw_value text, dysfunction_score numeric   -- 0-100 calculado
)
patient_neuro_id_scores (
  id, assessment_id not null, patient_id not null,
  fisico_pct numeric, bioquimico_pct numeric, emocional_pct numeric,
  indice_geral numeric, priority_pillar text,
  is_partial bool, computed_at
)
```
RLS por `clinic_id` em todas; valores/scores herdam via `assessment_id`.

## 5. Saída — estratégia de relatório (DEFINIDA: 1 herói + camadas)
- **1 "Mapa Neuro ID" (PDF herói, 2–4 pág, timbre da clínica):**
  1. pirâmide + índice geral + ponto de atenção principal
  2. por eixo: o que foi avaliado + o que revela (linguagem de cuidado/personalização)
  3. plano proposto **amarrado aos eixos** (justificativa do tratamento)
  4. próximos passos / acompanhamento
- **Reavaliação:** relatório de **evolução (1 pág)** com pirâmide antes→depois (cuidado contínuo + retenção + prova).
- **Interno/anexo opcional:** raciocínio clínico completo (Doc 1 funcional / Doc 2 plano / Doc 3 suplementação do Laudo).

## 6. Cadeia de valor (liga no resto)
Laudo+Forja (motor) → pirâmide no relatório 360 + portal → **Celso** usa como roteiro de fechamento ético (eixo de maior % = gap → tratamento que fecha o gap) → eixo **Bioquímico** alto → puxa a **feature de Suplementos** (`_BRIEF_SUPLEMENTOS.md`).

## 7. Compliance (Termo/Aval)
Mapa **funcional de bem-estar**, NÃO diagnóstico de doença. Sem promessa de cura. Linguagem "sugere / pode estar associado / merece acompanhamento". Disclaimer no PDF. HIPAA/RLS por clínica. % é ferramenta de comunicação clínica, não laudo médico.

## 8. Corte de escopo
- **MVP:** catálogo de itens + motor de cálculo (seção 3) + tela do Mapa (pirâmide + índice) + PDF herói (seção 5, item único).
- **MVP+:** relatório de evolução (antes/depois); CTA de exame parcial.
- **Depois:** parse automático de labs; pesos avançados por clínica; sugestão de suplemento a partir do eixo bioquímico.

## 9. Critérios de aceite
- [ ] Motor calcula 3 eixos + índice a partir do catálogo, com pesos e direção corretos.
- [ ] Eixo de MAIOR % é marcado como prioridade.
- [ ] Dado faltando → score parcial + flag/CTA (não quebra).
- [ ] PDF herói sai timbrado, ≤4 páginas, com plano amarrado aos eixos.
- [ ] RLS isola por clínica (teste entre tenants).
- [ ] `/code-review --fix` limpo.

## 10. Kickoff (cole ao abrir a sessão do Core)
> "Leia `CONTEXT.md` e este `_BRIEF_MAPA_NEURO_ID.md`. Implemente o **MVP** (seções 3–5, corte MVP). Comece pelo `assessment_items_catalog` + seed com o mapa item→pilar da seção 3, depois o motor de cálculo (`patient_neuro_id_scores`), depois a tela do Mapa e o PDF herói. % = disfunção (seção 1). Pergunte só em decisão de produto ambígua. Ao terminar, `/code-review --fix`."
