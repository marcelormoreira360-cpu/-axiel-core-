# BRIEF — Auto-gerar Mapa Bio³ ao responder questionário

> Quando o paciente responde um questionário mapeado (MSQ/PHQ-9/GAD-7/HPA), o sistema gera AUTOMATICAMENTE um Mapa Bio³ parcial (rascunho) — sem o terapeuta criar manualmente. O Biomecânico (exame físico) fica pendente até o terapeuta preencher. Alinha com o princípio de Marcelo: "preencheu → aparece". Times: Nucleo + Forja.

## 1. Reusa o que já existe (não recriar)
- `importQuestionnaireAnswers(patientId)` — aplica o de-para e gera valores.
- `ensureClinicQuestionMap(clinicId)` — semeia o de-para default (MSQ/PHQ-9/GAD-7/HPA).
- `createNeuroIdAssessment` / `computeNeuroId` — calcula eixos + índice + prioridade.
- `getLatestNeuroIdMap` — leitura p/ o painel.
- Falta só: um GATILHO na submissão da resposta + criação idempotente de um rascunho automático.

## 2. Fluxo
1. Paciente envia respostas (`app/envio/[slug]`, `app/f/[token]`) — ou terapeuta registra.
2. Hook pós-submit: se o template estiver mapeado para a clínica → roda `importQuestionnaireAnswers` → cria/atualiza UM `patient_assessment` com `status='auto_draft'` + valores (marcados "auto (questionário)") → `computeNeuroId` → grava `patient_neuro_id_scores` com `is_partial=true` enquanto faltar o Biomecânico.
3. Painel do paciente mostra a **pirâmide parcial** + banner: "Mapa parcial — complete o exame físico (Biomecânico) para finalizar." + botão "Revisar e completar".
4. Terapeuta revisa, adiciona o Biomecânico, recalcula → `status='final'`, `is_partial=false`.

## 3. Idempotência (importante)
- NÃO criar 1 avaliação por resposta. Manter **um** rascunho `auto_draft` por paciente; novas respostas **atualizam** esse rascunho até o terapeuta finalizar.
- Depois de finalizado, uma nova resposta abre um **novo** rascunho (nova rodada/reavaliação) — assim dá pra acompanhar evolução.

## 4. Guarda-corpos
- Rascunho automático NÃO vira relatório final ao paciente sem revisão humana (mesma regra de sempre).
- `is_partial=true` → sempre CTA; nunca apresentar como completo sem o Biomecânico.
- Template não mapeado → não gera nada (silencioso, sem erro).
- RLS por `clinic_id`; o gatilho só mexe no Mapa, nada além.

## 5. Aceite
- [ ] Responder o MSQ gera o Mapa Bio³ parcial automaticamente (sem criação manual).
- [ ] Biomecânico pendente sinalizado; terapeuta completa → final.
- [ ] Sem duplicar avaliações (1 rascunho auto por paciente até finalizar).
- [ ] Template não mapeado não gera nem quebra.
- [ ] Testes verdes.

## 6. Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md e _BRIEF_BIO3_AUTOGEN.md. Implemente o gatilho que auto-gera o Mapa Bio³ quando um questionário mapeado é respondido: no pós-submit das respostas (assessment_responses / intake), se o template estiver no de-para da clínica (ensureClinicQuestionMap), rode importQuestionnaireAnswers e crie/atualize UM patient_assessment status='auto_draft' (idempotente: um rascunho auto por paciente até finalizar), compute e grave patient_neuro_id_scores com is_partial=true enquanto faltar o Biomecânico. No painel, mostre a pirâmide parcial + banner 'complete o exame físico' + botão 'Revisar e completar'; ao completar e recalcular, status='final', is_partial=false. Template não mapeado = não gera (sem erro). Reuse o que já existe (import, cálculo, de-para). Não apresente como final sem revisão humana. Atualize os testes e deixe verde. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."

> Pode rodar junto com `_BRIEF_FIX_DEMOGRAFIA.md` na mesma sessão (são independentes e se complementam).
