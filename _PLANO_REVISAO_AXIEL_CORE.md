# Programação de Revisão & i18n — AXIEL Core (checklist 100%)

> Objetivo: revisar **executando** cada setor em **pt-BR (idioma-mestre)**, fechando bugs/UX **e** garantindo que toda string vira **chave de i18n**. Com o pt-BR 100%, en e pt-PT viram cópia das chaves.

## Como rodar cada setor (o loop)

1. **Você executa** a jornada do setor no app (pt-BR), do começo ao fim.
2. **Anota** na coluna do setor: texto em inglês/cravado, bug, UX, estado faltando (vazio/erro/loading).
3. **Me passa o setor** → eu (a) corrijo os bugs, (b) movo **todas** as strings pro i18n (valor pt-BR + en), (c) deixo verde (CI/preview).
4. **Marca ✅ Fechado** e vai pro próximo.
5. No fim: gero **pt-PT** (cópia das chaves) + revisão nativa dos termos clínicos.

### Para cada tela, conferir (os 4 C):
- **Conteúdo**: algum texto fixo em inglês ou que não muda de idioma?
- **Correção**: o fluxo funciona? botões, salvar, validação?
- **Estados**: vazio, carregando, erro, sem permissão.
- **Coerência**: termos/clínicos e tom batendo com o resto.


**Total: 110 telas em 13 setores.**


## 1. Entrada · Auth & Onboarding  (13 telas)
*Como testar:* Criar conta, login, MFA, reset de senha, fluxo de onboarding/plano, telas públicas de preço/termos.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/auth/login` |  |  |
| ☐ | `/auth/mfa` |  |  |
| ☐ | `/auth/reset-password` |  |  |
| ☐ | `/auth/signup` |  |  |
| ☐ | `/auth/update-password` |  |  |
| ☐ | `/clinics` |  |  |
| ☐ | `/get-started` |  |  |
| ☐ | `/onboarding` |  |  |
| ☐ | `/onboarding/plan` |  |  |
| ☐ | `/onboarding/ready` |  |  |
| ☐ | `/pricing` |  |  |
| ☐ | `/privacidade` |  |  |
| ☐ | `/termos` |  |  |


## 2. Captação · Leads & Agendamento público  (7 telas)
*Como testar:* Criar/editar lead, ver detalhe; abrir link público de agendamento, cadastro e confirmação como se fosse o paciente.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/book/[slug]` |  |  |
| ☐ | `/cadastro/[slug]` |  |  |
| ☐ | `/confirmar/[token]` |  |  |
| ☐ | `/leads` |  |  |
| ☐ | `/leads/[id]` |  |  |
| ☐ | `/leads/new` |  |  |
| ☐ | `/links` |  |  |


## 3. Intake & Formulários  (8 telas)
*Como testar:* Montar/editar formulário, enviar link, responder como paciente (/envio, /f). Conferir tipos de pergunta e validação.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/envio/[slug]` |  |  |
| ☐ | `/f/[token]` |  |  |
| ☐ | `/forms` |  |  |
| ☐ | `/forms/[id]` |  |  |
| ☐ | `/forms/[id]/edit` |  |  |
| ☐ | `/forms/new` |  |  |
| ☐ | `/intake` |  |  |
| ☐ | `/intake/[id]/edit` |  |  |


## 4. Paciente · Perfil & Jornada clínica (NÚCLEO)  (18 telas)
*Como testar:* Criar paciente, editar cadastro/demografia, abrir perfil, Bio³, intake, formulários, evolução, prontuário, insights/relatórios, health-agent, mensagens, portal-link, produtos, prescrição (print).

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/patients` |  |  |
| ☐ | `/patients/[id]` |  |  |
| ☐ | `/patients/[id]/edit` |  |  |
| ☐ | `/patients/[id]/evolution` |  |  |
| ☐ | `/patients/[id]/forms` |  |  |
| ☐ | `/patients/[id]/forms/[responseId]` |  |  |
| ☐ | `/patients/[id]/forms/new` |  |  |
| ☐ | `/patients/[id]/health-agent` |  |  |
| ☐ | `/patients/[id]/insights` |  |  |
| ☐ | `/patients/[id]/intake` |  |  |
| ☐ | `/patients/[id]/messages` |  |  |
| ☐ | `/patients/[id]/portal-link` |  |  |
| ☐ | `/patients/[id]/prescriptions/print` |  |  |
| ☐ | `/patients/[id]/products` |  |  |
| ☐ | `/patients/[id]/prontuario` |  |  |
| ☐ | `/patients/[id]/prontuario/print` |  |  |
| ☐ | `/patients/[id]/reports/clinical-insight` |  |  |
| ☐ | `/patients/new` |  |  |


## 5. Agenda & Sessões  (7 telas)
*Como testar:* Criar/editar agendamento, abrir sessão, registrar SOAP/notas, teleconsulta.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/schedule` |  |  |
| ☐ | `/schedule/[id]` |  |  |
| ☐ | `/schedule/[id]/reminder` |  |  |
| ☐ | `/schedule/[id]/session` |  |  |
| ☐ | `/schedule/[id]/telehealth` |  |  |
| ☐ | `/schedule/new` |  |  |
| ☐ | `/teleconsulta/[appointmentId]` |  |  |


## 6. Mensagens & Comunicação  (4 telas)
*Como testar:* Caixa de entrada, compor mensagem, automações/templates, integração Hotmart.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/automacoes` |  |  |
| ☐ | `/communications` |  |  |
| ☐ | `/hotmart` |  |  |
| ☐ | `/inbox` |  |  |


## 7. Financeiro & Monetização  (13 telas)
*Como testar:* Faturas, NFS-e, relatório, repasse; ofertas/monetização; assinaturas; produtos e pedidos; telas de pagamento/sucesso.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/assinaturas` |  |  |
| ☐ | `/billing` |  |  |
| ☐ | `/billing/success` |  |  |
| ☐ | `/financeiro` |  |  |
| ☐ | `/financeiro/nfse` |  |  |
| ☐ | `/financeiro/relatorio` |  |  |
| ☐ | `/financeiro/repasse` |  |  |
| ☐ | `/monetization` |  |  |
| ☐ | `/pagamento/sucesso` |  |  |
| ☐ | `/products` |  |  |
| ☐ | `/products/new` |  |  |
| ☐ | `/products/orders` |  |  |
| ☐ | `/products/orders/new` |  |  |


## 8. Relatórios & Analytics  (4 telas)
*Como testar:* Dashboard, resultados, analytics, relatórios. Conferir rótulos de gráficos, métricas, estados vazios.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/analytics` |  |  |
| ☐ | `/dashboard` |  |  |
| ☐ | `/relatorios` |  |  |
| ☐ | `/results` |  |  |


## 9. Equipe & Profissionais  (3 telas)
*Como testar:* Listar/editar profissionais, convidar membro (/join token).

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/join/[token]` |  |  |
| ☐ | `/profissionais` |  |  |
| ☐ | `/profissionais/[id]` |  |  |


## 10. Configurações  (22 telas)
*Como testar:* TODO o /settings/* (perfil, branding, integrações, lembretes, LGPD, ofertas, segurança, tipos de sessão, suplementos, voz, whatsapp, regional, uso) + admin.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/admin/audit` |  |  |
| ☐ | `/admin/plans` |  |  |
| ☐ | `/settings` |  |  |
| ☐ | `/settings/billing` |  |  |
| ☐ | `/settings/branding` |  |  |
| ☐ | `/settings/clinical-tests` |  |  |
| ☐ | `/settings/equipe` |  |  |
| ☐ | `/settings/integrations` |  |  |
| ☐ | `/settings/integrations/hotmart` |  |  |
| ☐ | `/settings/integrations/nfse` |  |  |
| ☐ | `/settings/lembretes` |  |  |
| ☐ | `/settings/lgpd` |  |  |
| ☐ | `/settings/offers` |  |  |
| ☐ | `/settings/practitioners` |  |  |
| ☐ | `/settings/profile` |  |  |
| ☐ | `/settings/regional` |  |  |
| ☐ | `/settings/security` |  |  |
| ☐ | `/settings/session-types` |  |  |
| ☐ | `/settings/supplements` |  |  |
| ☐ | `/settings/usage` |  |  |
| ☐ | `/settings/voice` |  |  |
| ☐ | `/settings/whatsapp` |  |  |


## 11. Portal do Paciente  (3 telas)
*Como testar:* Entrar como paciente, verificar acesso, ver relatórios/mensagens no portal.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/p/[token]` |  |  |
| ☐ | `/portal` |  |  |
| ☐ | `/portal/verificar` |  |  |


## 12. Sistema & Avulsos  (3 telas)
*Como testar:* Tela raiz, follow-ups, offline, ações.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/actions` |  |  |
| ☐ | `/follow-ups` |  |  |
| ☐ | `/offline` |  |  |


## 13. Outras telas (revisar encaixe)  (5 telas)
*Como testar:* Telas não classificadas — conferir a que setor pertencem.

| ✅ | Tela (rota) | i18n ok | Bugs/UX encontrados |
|----|-------------|---------|----------------------|
| ☐ | `/` |  |  |
| ☐ | `/trends` |  |  |
| ☐ | `/upgrade` |  |  |
| ☐ | `/whatsapp` |  |  |
| ☐ | `/whatsapp/[phone]` |  |  |
