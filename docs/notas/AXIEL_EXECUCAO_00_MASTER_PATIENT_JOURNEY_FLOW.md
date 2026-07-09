# AXIEL Core — Execução 00
## Master Patient Journey Flow + SaaS Business Journey

Esta execução organiza a arquitetura-mãe do AXIEL Core antes de novos módulos.  
O objetivo é garantir que o produto seja uma plataforma inteligente de jornada do paciente e também uma base SaaS comercializável para clínicas.

---

## 1. Objetivo da Execução 00

Criar uma estrutura clara conectando duas jornadas:

### Patient Journey
Lead → Form → Patient → Session → Insight → Snapshot → Next Step → Follow-up → Products → Portal → Membership

### SaaS Business Journey
Clinic Signup → Trial → Plan Selection → Billing → Upgrade/Downgrade → Subscription Management → Usage Limits

A Execução 00 evita módulos soltos e cria uma lógica central para todo o produto.

---

## 2. Fluxo principal do paciente

Lead  
↓  
Form  
↓  
Patient  
↓  
Session  
↓  
Insight  
↓  
Snapshot  
↓  
Next Step  
↓  
Follow-up  
↓  
Products  
↓  
Portal  
↓  
Membership

Este fluxo mostra como uma pessoa entra no AXIEL, vira paciente, passa por Sessions, gera contexto, recebe acompanhamento e permanece engajada.

---

## 3. Fluxo principal da clínica

1. Receber lead.
2. Enviar ou preencher Form.
3. Converter Lead em Patient.
4. Agendar Session.
5. Registrar notas e key observations.
6. Revisar Insight.
7. Ver Snapshot.
8. Definir Next Step.
9. Criar Follow-up.
10. Adicionar Product Support quando fizer sentido.
11. Manter paciente ativo por Portal e Membership.

A clínica deve sempre saber: quem precisa de atenção agora e qual é o próximo passo.

---

## 4. Fluxo comercial SaaS

Clinic Signup  
↓  
Trial  
↓  
Plan Selection  
↓  
Billing  
↓  
Upgrade / Downgrade  
↓  
Subscription Management  
↓  
Usage Limits

Billing é uma camada comercial do SaaS.  
Não faz parte direta da jornada clínica do paciente.

---

## 5. Como cada módulo se conecta

| Módulo | Função na jornada | Conecta com |
|---|---|---|
| Leads | Entrada da jornada | Forms, Patients |
| Forms | Coleta estruturada | Patients, Sessions, Insights |
| Patients | Centro do histórico | Sessions, Forms, Snapshot |
| Schedule / Session | Atendimento | Session notes, Insights, Snapshot |
| Insights | Organização inteligente | Forms, Sessions, Validation, Snapshot |
| Snapshot | Resumo rápido | Dashboard, Schedule, Patient Profile, Portal |
| Next Step | Próxima ação clara | Follow-ups, Product Support |
| Follow-ups | Continuidade | Dashboard, Patient Profile |
| Products | Product Support | Patient, Next Step, Follow-up |
| Portal | Versão simples para paciente | Snapshot lite, Next Step |
| Membership | Retenção | Billing paciente/clínica, Patient Offers |
| Billing SaaS | Comercialização do AXIEL | Plans, Subscriptions, Usage Limits |

---

## 6. Quais dados passam de uma etapa para outra

### Lead → Form
- nome
- contato
- origem
- motivo principal
- status

### Form → Patient
- respostas
- body map
- observações
- data de envio
- categoria do formulário

### Patient → Session
- dados básicos
- histórico essencial
- última Session
- Snapshot

### Session → Insight
- session notes
- key observations
- intake responses
- patient history

### Insight → Snapshot
- latest insight
- insight status
- summary
- patterns
- attention needed

### Snapshot → Next Step
- next step sugerido
- follow-up timing
- pending reviews
- attention needed

### Next Step → Follow-up
- motivo
- data
- mensagem
- status

### Next Step → Product Support
- produto ou categoria de suporte
- motivo
- review date
- vínculo com Session ou Insight

### Product Support → Portal
- support items aprovados
- Next Step simples
- mensagem segura para o paciente

### SaaS Billing
- clinic_id
- plan
- usage
- features
- subscription status
- limits

---

## 7. Telas necessárias

### Patient Journey

- `/dashboard`
- `/leads`
- `/forms`
- `/forms/new`
- `/patients`
- `/patients/[id]`
- `/patients/[id]/forms`
- `/schedule`
- `/insights`
- `/follow-ups`
- `/products`
- `/patients/[id]/products`
- `/p/[token]`

### SaaS Business Journey

- `/onboarding`
- `/onboarding/plan`
- `/settings/billing`
- `/settings/usage`
- `/settings/team`
- `/admin/plans`

---

## 8. Componentes principais

### Patient Journey

- `LeadCard`
- `FormBuilder`
- `FormQuestionCard`
- `PatientFormView`
- `BodyMapField`
- `SessionCard`
- `SessionDrawer`
- `PatientSnapshot`
- `LatestInsightCard`
- `NextStepCard`
- `PatientJourneyTimeline`
- `FollowUpCard`
- `ProductCard`
- `PatientProductCard`
- `ProductSuggestionCard`

### SaaS Business Journey

- `PlanCard`
- `UsageLimitCard`
- `BillingStatusCard`
- `FeatureAccessBadge`

---

## 9. Tabelas envolvidas

### Patient Journey

- `leads`
- `patients`
- `intake_forms`
- `intake_questions`
- `form_submissions`
- `intake_responses`
- `body_map_marks`
- `appointments`
- `session_records`
- `ai_insights`
- `ai_validation_events`
- `action_suggestions`
- `follow_ups`
- `products`
- `product_categories`
- `patient_products`
- `product_orders`
- `product_order_items`
- `product_suggestions`
- `product_refill_reminders`
- `patient_portal_links`
- `patient_portal_access_logs`
- `patient_offers`

### SaaS Business Journey

- `clinics`
- `users`
- `clinic_users`
- `plans`
- `subscriptions`
- `billing_events`
- `usage_events`
- `feature_flags`
- `audit_logs`

---

## 10. Regras de UX

1. Máximo 3 ações principais por tela.
2. Máximo 5 itens visíveis por seção.
3. Usar linguagem humana.
4. Usar sempre:
   - Session
   - Insight
   - Next Step
5. Esconder complexidade em `View details`.
6. O sistema deve guiar a clínica.
7. O usuário nunca deve pensar: “o que eu faço agora?”
8. O paciente deve ver apenas o que é simples, seguro e útil.
9. Snapshot deve ser contexto rápido, não relatório.
10. Products deve ser Product Support, não loja complexa.

---

## 11. Segurança e privacidade

1. Todo dado clínico deve ter `clinic_id`.
2. RLS deve estar ativo em todas as tabelas sensíveis.
3. Usuário só acessa dados da própria clínica.
4. Relações cruzadas entre clínicas devem ser bloqueadas.
5. Links do portal devem usar token seguro, hash e expiração.
6. AI nunca deve gerar diagnóstico.
7. AI nunca deve prescrever.
8. Insight precisa de validação humana antes de uso final.
9. Logs de validação e acesso devem ser preservados.
10. Billing SaaS não deve expor dados clínicos.
11. Feature flags e permissões devem limitar acesso por plano e role.

---

## 12. O que entra no MVP

### Patient Journey MVP

- Leads simples
- Conversão Lead → Patient
- Forms básicos
- Body Map simples
- Schedule / Session
- Session notes
- Insight com validação humana
- Patient Snapshot
- Next Step
- Follow-up básico
- Product Support básico
- Patient Portal simples

### SaaS Business MVP

- Plans: Starter, Professional, Enterprise
- Subscription record
- Trial status
- Usage events
- Feature flags
- Billing settings page
- Usage limits simples

---

## 13. O que fica para fase futura

- Booking online completo
- Stripe Checkout completo
- upgrade/downgrade automático
- billing por uso
- AI avançada
- automações completas por WhatsApp/SMS/email
- Memberships avançados
- Product recommendations avançadas
- multi-location avançado
- integrações externas
- relatórios comerciais avançados
- marketplace

---

## 14. Resultado esperado

Ao final da Execução 00, o AXIEL Core deve ter:

1. uma jornada do paciente conectada;
2. uma camada SaaS comercial separada;
3. clareza de dependência entre módulos;
4. base para escalar sem criar funcionalidades soltas;
5. foco em simplicidade, segurança e experiência premium.

---

## 15. Riscos técnicos ou de produto

| Risco | Impacto | Como evitar |
|---|---|---|
| Criar módulos soltos | Produto confuso | Sempre conectar ao fluxo central |
| Misturar billing com cuidado clínico | UX ruim | Billing fica em Settings/Admin |
| AI parecer diagnóstico | Risco clínico | Human validation obrigatória |
| Snapshot virar relatório | Perde simplicidade | Máximo 5 itens visíveis |
| Forms complexos demais | Usuário abandona | Builder simples e visual |
| Products virar loja | Perde foco AXIEL | Usar Product Support |
| RLS fraco | Risco de privacidade | clinic_id + policies |
| Limites de plano mal planejados | Problema comercial | Feature flags + usage limits |
| Portal expor demais | Risco ao paciente | Versão simplificada |

---

## Recomendação de implementação

Começar pela conexão prática:

Lead → Form → Patient → Session

Depois evoluir para:

Session → Insight → Snapshot → Next Step

Essa sequência sustenta todo o produto.
