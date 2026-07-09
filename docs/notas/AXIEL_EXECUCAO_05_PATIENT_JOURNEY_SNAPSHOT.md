# AXIEL CORE — EXECUÇÃO 05
## Patient Journey Snapshot — Implementação Incremental

Fluxo central:
Lead → Form → Patient → Session → Insight → Snapshot → Next Step → Product Support → Follow-up → Membership

## Objetivo

Conectar os dados essenciais do paciente em uma visão curta, segura e útil para decisão rápida.

O profissional deve entender o contexto em menos de 5 segundos, sem abrir várias telas.

## Regra de implementação

Não criar módulo solto.
Não substituir telas existentes.
Adicionar o Snapshot como camada progressiva em pontos onde ele gera valor.

## Ordem incremental

### Etapa 1 — Builder puro

Arquivos:
- `/modules/patient-journey/snapshot-builder.ts`
- `/modules/patient-journey/patient-context.ts`
- `/modules/patient-journey/next-step-rules.ts`

Objetivo:
Criar uma função pura que recebe dados e retorna um Snapshot padronizado.

Entrada:
- patient
- appointments
- intake responses
- session records
- ai insights
- follow-ups

Saída:
- patient_name
- patient_status
- latest_insight_title
- latest_insight_summary
- latest_insight_status
- last_session_date
- last_session_summary
- key_notes
- next_step
- attention_needed
- pending_reviews_count
- follow_up_status

Por que vem primeiro:
Permite testar a inteligência do Snapshot sem mexer na UI.

Resultado esperado:
Um Snapshot coerente mesmo quando faltam dados.

---

### Etapa 2 — Service central

Arquivos:
- `/services/patient-snapshot-service.ts`
- `/services/patient-journey-service.ts`

Objetivo:
Buscar os dados reais do paciente e montar o Snapshot.

Por que vem depois:
A UI não deve conhecer várias tabelas. A tela pede o Snapshot; o service monta.

Resultado esperado:
Qualquer tela consegue chamar `getPatientSnapshot(patientId)`.

---

### Etapa 3 — Componente visual

Arquivos:
- `/components/patient-snapshot.tsx`
- `/components/latest-insight-card.tsx`
- `/components/next-step-card.tsx`
- `/components/patient-journey-timeline.tsx`

Objetivo:
Mostrar o Snapshot com visual AXIEL:
- curto
- calmo
- premium
- máximo 5 itens visíveis
- ações limitadas

Resultado esperado:
Um card reutilizável para Schedule, Patient Profile, Dashboard e Portal.

---

### Etapa 4 — Schedule Drawer

Local:
- `/schedule`

Objetivo:
Ao clicar em uma Session, abrir o drawer e mostrar o Patient Snapshot.

Por que vem primeiro na UI:
É o ponto de maior impacto. O profissional precisa do contexto antes ou durante a Session.

Resultado esperado:
A Agenda deixa de ser só calendário e passa a mostrar contexto real.

---

### Etapa 5 — Patient Profile

Local:
- `/patients/[id]`

Objetivo:
Mostrar o Snapshot no topo do perfil.

Por que vem depois:
O Patient Profile é a visão completa. O Snapshot deve guiar antes do histórico longo.

Resultado esperado:
O usuário entende o paciente antes de navegar em detalhes.

---

### Etapa 6 — Dashboard

Local:
- `/dashboard`

Objetivo:
Usar Snapshot para guiar Next Best Actions.

Por que vem depois:
O Dashboard só fica inteligente depois que o Snapshot já existe.

Resultado esperado:
O AXIEL começa a dizer o que merece atenção.

---

### Etapa 7 — Patient Portal Lite

Local:
- `/p/[token]`

Objetivo:
Mostrar uma versão simples e segura para o paciente.

Regra:
Não mostrar detalhes sensíveis.
Não mostrar linguagem clínica complexa.
Não mostrar informação em revisão como se fosse final.

Resultado esperado:
O paciente entende progresso e próximo passo sem ansiedade.

---

## Regras de UX

- Máximo 3 ações por área
- Máximo 5 itens visíveis por seção
- Usar Session, Insight e Next Step
- Esconder detalhes em View details
- Texto curto
- Sem diagnóstico
- Sem prescrição
- Sem promessa clínica

## Regras de AI

A AI pode ajudar a organizar:
- summary
- patterns
- attention needed
- possible Next Step

A AI não pode:
- diagnosticar
- prescrever
- prometer resultado
- substituir o profissional

Todo Insight usado no Snapshot deve:
- estar como Final, ou
- aparecer claramente como In Review.

## MVP

Entra agora:
- Snapshot no Schedule Drawer
- Snapshot no Patient Profile
- Snapshot no Dashboard
- Snapshot Lite no Patient Portal
- Builder + service central
- Timeline curta

Fica para fase futura:
- cache/materialized snapshot
- scoring de prioridade
- alertas automáticos avançados
- AI agent criando ações automaticamente
- comunicação automática por WhatsApp/SMS/email

## Resultado final da execução

O AXIEL passa a conectar dados soltos em contexto útil:

Form → Session → Insight → Snapshot

Este é o primeiro ponto onde o produto começa a parecer inteligente.
