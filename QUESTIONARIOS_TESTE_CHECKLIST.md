# Checklist de teste — Questionários automáticos + Progresso + Insight IA

> Jornada: entrada (baseline) → evolução (reavaliação) → insight de IA. Teste na ordem.

## 0. Pré-requisitos
- [ ] Migrations **064** (send_on_first_appointment) e **065** (reassessment_interval_days) aplicadas. ✓ (já aplicadas)
- [ ] Deploy com o código no ar.
- [ ] Envio configurado: WhatsApp (Twilio — `sendWhatsAppText`) e e-mail (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`). Se algum não estiver, o canal é só pulado (não quebra).
- [ ] `CRON_SECRET` setado (para testar a reavaliação automática).
- [ ] Ter **2 formulários** de avaliação cadastrados (com perguntas pontuadas).

## 1. Configuração (por formulário)
- [ ] Editar cada um dos 2 formulários → marcar **"Enviar na primeira sessão"** → salvar.
- [ ] (Opcional p/ reavaliação) Em um deles, setar **"Reavaliar a cada (dias)"** = ex. `30`.

**Verificar:** `assessment_templates.send_on_first_appointment = true` nos 2; `reassessment_interval_days = 30` no escolhido.

## 2. Onboarding — envio na 1ª sessão
- [ ] Cadastrar/escolher um paciente **com telefone e e-mail** (e sem sessões anteriores).
- [ ] Criar a **primeira sessão** dele (na agenda OU pelo booking público `/book/[slug]`).
- [ ] O paciente recebe os 2 questionários por **WhatsApp** e **e-mail** (links `/f/...`).
- [ ] No **portal** do paciente: seção **"Questionários pendentes"** lista os 2.
- [ ] Criar uma **segunda** sessão pro mesmo paciente → **NÃO** reenvia (só na 1ª).

**Verificar:** 2 linhas em `assessment_invitations` (completed_at nulo) para o paciente.

## 3. Resposta + pontuação (baseline)
- [ ] Abrir um dos links `/f/[token]` e responder o formulário.
- [ ] Na **ficha do paciente**: a resposta aparece com **score e %**.

**Verificar:** `assessment_responses` com `score_percentage`/`total_score`; `assessment_invitations.completed_at` preenchido.

## 4. Progresso + reavaliação manual
- [ ] Na ficha, seção **"Evolução dos questionários"** mostra o questionário respondido (1 ponto).
- [ ] Clicar **"Reavaliar"** → reenvia o link → responder de novo (com outra pontuação).
- [ ] O painel agora mostra **2 pontos** + o **delta** ("X% → Y%").
- [ ] No **portal**, seção **"Sua evolução"** mostra o mini-gráfico.

## 5. Insight de IA (semiautomático)
- [ ] Após o paciente responder os questionários de entrada, abrir **/actions** (Central de ações).
- [ ] Aparece a sugestão **"Gerar insight de entrada para [Paciente]"**.
- [ ] Clicar → vai pra ficha → gerar o insight de IA (botão do Health Agent).
- [ ] O insight nasce como **rascunho (pending review)** → revisar/aprovar.
- [ ] Após aprovar, ele aparece no **portal** do paciente.
- [ ] A sugestão em /actions **some** (já que o insight foi gerado).

## 6. Reavaliação automática (cron)
- [ ] No formulário com `reassessment_interval_days = 30`, ter um paciente **ativo** cuja última resposta seja **> 30 dias atrás** (para teste, dá pra ajustar a data da resposta no banco ou setar o intervalo = 0/1 temporariamente).
- [ ] Disparar o cron manualmente:
  ```bash
  curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU_APP/api/cron/automations
  ```
  (resposta inclui `"reassessments": { "resent": N }`)
- [ ] O paciente recebe o questionário de novo (novo convite).
- [ ] Rodar o cron **de novo** → **não** reenvia (já há convite aberto). Idempotente.
- [ ] Paciente inativo **não** recebe.

## 7. Casos de erro / borda
- [ ] Paciente sem telefone nem e-mail → convite é criado, mas sem envio (só aparece no portal).
- [ ] Remarcar a 1ª sessão (cancelar e criar outra) → não duplica convites (idempotência por convite aberto).
- [ ] Formulário sem a flag → não é enviado no onboarding.

## Se algo der errado
| Sintoma | Causa provável |
|---------|----------------|
| Não enviou WhatsApp | Twilio não configurado / número do paciente inválido (canal é pulado) |
| Não enviou e-mail | `RESEND_API_KEY`/`RESEND_FROM_EMAIL` ausentes |
| Não sugeriu o insight | Paciente já tem um `ai_insight`, ou não respondeu template de onboarding |
| Cron não reenviou | `CRON_SECRET` errado, intervalo não vencido, paciente inativo, ou convite já aberto |
