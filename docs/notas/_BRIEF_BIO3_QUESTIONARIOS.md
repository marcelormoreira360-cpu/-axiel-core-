# BRIEF — §8 Bio³: questionários do paciente alimentam os pilares automaticamente

> Quando o paciente responde os questionários, o sistema preenche os itens dos 3 pilares e gera a pirâmide — sem digitação manual desses itens. (O Biomecânico de palpação continua sendo o exame físico do terapeuta.)
> Ler `CONTEXT.md`. Encaixa em `_BRIEF_BIO3_AJUSTE_PILARES.md` (§8) e usa o motor `modules/neuro-id/`.

## 1. Fontes que JÁ existem no Core
- **Questionários validados** (`assessment_templates`/`assessment_questions`/`assessment_answers`, catálogo em `app/forms/forms-catalog.ts`): **PHQ-9**, **GAD-7**, **Eixo HPA**, **MSQ** (15 sistemas, 0–4). Perguntas tipo escala com `min_score`/`max_score`.
- **Intake** (`intake_forms`/`intake_questions`/`intake_responses`): questionário enviado antes.
Tudo enviado ao paciente por link (`app/envio/[slug]`, `app/f/[token]`).

## 2. Como liga ao Bio³ (camada de mapeamento)
Nova tabela `neuro_id_question_map` (por clínica):
```
neuro_id_question_map (
  id, clinic_id not null,
  source text,              -- 'assessment' | 'intake'
  template_key text,        -- ex.: 'msq-en', 'phq9-pt', 'gad7-pt', 'hpa-pt'
  question_id uuid,         -- pergunta específica (ou null = template inteiro)
  catalog_code text,        -- code do assessment_items_catalog (pilar destino)
  agg text default 'sum',   -- 'sum'|'avg' quando várias perguntas → 1 code
  norm_min numeric, norm_max numeric,  -- normaliza p/ 0–10 (usa min/max da pergunta)
  weight numeric default 1, active bool default true
)
```
Setup **uma vez por template** (não por paciente).

## 3. IA sugere o de-para (humano aprova 1x)
Um passo de IA lê as perguntas do template + o catálogo dos 3 pilares e **propõe** o mapeamento `question_id → catalog_code` (pilar, normalização, peso). O humano revisa e aprova. (Mesma filosofia da segmentadora: IA estrutura, humano valida; não inventa.)

### De-para sugerido (defaults p/ os templates atuais)
- **PHQ-9** (total) → `emocional` (novo code `phq9_depressao`), normaliza 0–27 → 0–10.
- **GAD-7** (total) → `emocional` (`gad7_ansiedade`), 0–21 → 0–10.
- **Eixo HPA** → seção estresse/SNA → `emocional`; seção adrenal/hormonal → `bioquimico` (`hpa_*`).
- **MSQ** por sistema (0–4 cada) → códigos `msq_<sistema>`:
  - mente, emoções, cabeça, coração, pulmão, trato digestivo → **emocional**
  - articulações/músculos → **biomecanico**
  - energia/atividade, peso, pele, olhos, ouvidos, nariz, boca/garganta, outros → **bioquimico**
> Esses `msq_*`, `phq9_*`, `gad7_*`, `hpa_*` entram no `assessment_items_catalog` (todos `higher_worse`, faixa `symptom` baixo/moderado/alto). A IA segmentadora de QRM/Q-SNA continua válida em paralelo.

## 4. Fluxo automático (o que muda pro Marcelo)
1. Paciente responde o(s) questionário(s) por link (já existe).
2. Ao abrir o Mapa Bio³ do paciente (ou num botão "Importar respostas"), o sistema lê as respostas mais recentes, aplica o `neuro_id_question_map`, normaliza p/ disfunção 0–10 e cria os `patient_assessment_values` correspondentes — **marcados como "auto (questionário)"**.
3. Terapeuta **revisa** os itens auto-preenchidos + digita só o **Biomecânico** (exame físico) e o que faltar.
4. Motor calcula → pirâmide + Índice Bio.
→ Itens sem resposta = pendente (CTA), não chuta.

## 5. Compliance / gate
Mesma regra: bem-estar funcional, sem diagnóstico/cura; revisão humana antes de finalizar; RLS por `clinic_id`. PHQ-9 alto / item 9 (ideação) → respeitar o alerta clínico existente (Salvo) — não silenciar.

## 6. Corte MVP
- **MVP:** tabela `neuro_id_question_map` + de-para sugerido pelos defaults da §3 (começar pelo **MSQ**, que cobre os 3 pilares) + importação das respostas → `patient_assessment_values` (auto) + revisão na tela.
- **MVP+:** passo de IA que sugere o de-para de um template novo; suporte a intake.
- **Depois:** "outros mapas" (questionário que meça algo fora dos 3 Bios).

## 7. Aceite
- [ ] `neuro_id_question_map` com RLS; setup 1x por template.
- [ ] Responder o MSQ preenche automaticamente itens dos 3 pilares (normalizados), marcados como auto.
- [ ] Terapeuta revisa antes de finalizar; itens faltando = pendente.
- [ ] Alerta PHQ-9 item 9 preservado.
- [ ] Testes do mapeamento/normalização verdes.

## 8. Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md e este _BRIEF_BIO3_QUESTIONARIOS.md. Implemente o MVP do §8: (1) tabela `neuro_id_question_map` (RLS por clinic_id) + os novos codes `msq_*`/`phq9_*`/`gad7_*`/`hpa_*` no assessment_items_catalog (todos higher_worse, band_type symptom); (2) de-para inicial com os defaults da §3, começando pelo MSQ; (3) serviço que lê as respostas (assessment_answers) do paciente, aplica o mapa, normaliza p/ disfunção 0–10 e cria patient_assessment_values marcados 'auto (questionário)'; (4) na tela do Mapa Bio³, botão 'Importar respostas' + revisão humana antes de calcular; itens sem resposta = pendente. Preserve o alerta do PHQ-9 item 9. Depois (MVP+): passo de IA que sugere o de-para de um template. Não invente valores; só normalize respostas existentes; humano revisa. Atualize os testes e deixe verde. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."
