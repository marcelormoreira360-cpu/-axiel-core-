# Questionários automáticos na 1ª sessão + motor de progresso

Feature: ao marcar a **primeira sessão**, o paciente recebe automaticamente os questionários marcados; ele responde, cai na ficha já com **score + %**. Desenhado para evoluir para o **loop de progresso** (reavaliar → mostrar melhora).

## O que JÁ existe (reaproveitar)
- Templates + perguntas + escala (`assessment_templates`/sections/questions).
- Convite com link público: `createAssessmentInvitation({template_id, patient_id, clinic_id})` → `/f/{token}`.
- **Pontuação automática no submit** (`/api/forms/submit`): `total_score`, `score_percentage`, `section_scores` → `assessment_responses` (aparece na ficha).
- Envio: WhatsApp (`sendWhatsAppText`), e-mail (`email-service`/Resend).
- Gatilho de agendamento: `createAppointment()` (dashboard) **e** insert direto em `app/api/book/[slug]` (booking público — sem sessão, exige admin client).

## Decisões (travadas)
- Config: **checkbox por formulário** (`send_on_first_appointment`).
- Canais: **WhatsApp + E-mail + Portal**.
- Escopo: **baseline agora + motor de progresso desenhado**.

## Fase 1 — Baseline (envio na 1ª sessão)
1. **Migration 064**: `assessment_templates.send_on_first_appointment boolean default false`.
2. **Service `onboarding-assessment-service.ts`** (admin client, funciona no booking público):
   - `isFirstAppointment(patientId, clinicId, startsAt)` — não há sessão anterior.
   - `getOnboardingTemplates(clinicId)` — templates ativos com a flag.
   - `sendOnboardingAssessments(appt)` — para cada template: cria convite + envia link por WhatsApp e e-mail. Idempotente (não reenvia se já há convite aberto do mesmo template).
3. **Hooks**: chamar `sendOnboardingAssessments` em `createAppointment` (side-effect, fire-and-forget) **e** no booking público após o insert.
4. **UI**: checkbox "Enviar na primeira sessão" na edição do formulário (`app/forms/[id]/edit`) + action.
5. **Portal**: nova seção "Questionários pendentes" no portal do paciente, listando convites em aberto com link — cobre o canal Portal.

## Fase 2 — Motor de progresso (próxima)
- `getAssessmentProgress(patientId, templateId)` — série de `score_percentage` ao longo do tempo + **delta vs. baseline**.
- Reavaliação: ação "Reavaliar" (reenvia o mesmo template) + opção de cadência (a cada N sessões / mensal) na config.
- UI de progresso: gráfico na ficha do paciente e no portal ("sua pontuação caiu X% desde o início").

## Fase 3 — Valor agregado (depois, opcional)
- Insight de IA pós-entrada (anamnese + 2 questionários) → resumo no portal.
- Marcos automáticos (metade do pacote, 1 mês) com os números.

## Riscos/atenção
- Booking público = sem sessão → usar **admin client** ao criar convites e enviar.
- Idempotência: não reenviar se já existe convite aberto (evita spam se o paciente remarca).
- "Primeira sessão" = nenhum appointment com `starts_at` anterior (excluir cancelados).
