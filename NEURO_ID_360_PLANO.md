# Neuro ID 360 — Relatórios Integrativos (plano)

> Decisão (15/06/2026): substituir o insight de IA genérico por **dois documentos
> estruturados**, gerados de TODOS os dados do paciente. Ao aprovar, enviar **os dois**
> ao paciente (e-mail + WhatsApp). Espaço novo para exames funcionais.

## Os dois documentos (saída da IA)

### Documento 1 — Mapa Integrativo Neuro ID 360 ("o que foi identificado")
- principais achados do atendimento
- padrões observados
- leitura integrativa do caso
- achados funcionais
- elementos biomecânicos
- elementos bioemocionais
- sinais de desregulação do sistema nervoso (SNA)
- possíveis fatores bioquímicos envolvidos
- prioridades de atenção

### Documento 2 — Plano Inicial de Regulação ("o que fazer agora")
- próximos passos
- orientações iniciais
- recomendações de rotina
- sugestões de regulação
- suplementação inicial (quando indicada)
- exames complementares recomendados
- prioridades
- recomendação de continuidade

## Fontes de dados que a IA deve cruzar
- Questionários respondidos (assessment_responses + answers): Q-SNA, Q.R.M., etc.
- Anamnese / intake (intake_responses)
- Exames laboratoriais (patient_exams) + biomarcadores
- **Exames funcionais (NOVO)**: neurometria, biorressonância — campo estruturado a criar
- Sessões/notas (session_records), queixa principal, resumo do caso
- Medicamentos/suplementos (patient_prescriptions)

## Fases

**Fase 1 — Exames funcionais (fundação, pré-requisito)**
- Migration: tabela `patient_functional_exams` (clinic_id, patient_id, exam_type, summary, findings jsonb, exam_date, created_by) com RLS por clínica.
- Service + actions (CRUD) + card na ficha do paciente ("Exames funcionais: neurometria, biorressonância…").
- i18n.

**Fase 2 — Novo schema de saída da IA (Mapa + Plano)**
- Substituir `AiInsightOutput` por `{ mapa_integrativo: {...9 seções}, plano_regulacao: {...8 seções} }`.
- Atualizar prompt de geração (lê todas as fontes, incl. exames funcionais) + guardrails/disclaimer.
- Migração de compatibilidade para insights antigos (fallback de leitura).

**Fase 3 — Telas + PDF**
- Card de revisão e página do insight renderizam os dois documentos (seções).
- PDF: dois documentos (ou um PDF com as duas partes).

**Fase 4 — Envio ao paciente (aprovação)**
- `sendApprovedInsightToPatient` envia **os dois** documentos (e-mail + WhatsApp; e-mail é o canal garantido).
- Mantém push.

## Observações
- Disclaimer de IA / não-diagnóstico permanece em ambos os documentos.
- WhatsApp texto-livre tem limite da Meta (contato frio); e-mail é o canal principal.
- Branding: "Mapa Integrativo Neuro ID 360" e "Plano Inicial de Regulação".
