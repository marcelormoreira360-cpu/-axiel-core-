# Mapa de strings cravadas (i18n) — AXIEL Core

Gerado por varredura automática de `app/` e `components/`. **460 candidatos** em **102 arquivos**.

> ⚠️ Heurístico: pode haver falso-positivo (texto técnico) e algum falso-negativo. Serve para dimensionar e priorizar, não como lista cirúrgica final.
> Inclui texto cravado em **qualquer idioma** (PT cravado também precisa ir pro i18n).


## 🟢 Tier 1 — NÚCLEO CLÍNICO / JORNADA DO PACIENTE  (190 strings · 30 arquivos)

### `app/patients/[id]/edit/page.tsx` — 24
- L30: Editar paciente
- L31: Atualize os dados cadastrais
- L50: Email
- L55: [attr] email@exemplo.com
- L60: Telefone
- L86: Data de nascimento
- L95: Status
- L101: Ativo
- L102: Inativo
- L103: Arquivado
- L111: Sexo
- L116: [attr] Ex: feminino, masculino...
- L121: Cidade
- L126: [attr] Cidade
- L131: Peso (kg)
- L137: [attr] Ex: 68
- L142: Altura (cm)
- L148: [attr] Ex: 170
- L156: Notas clínicas
- L161: [attr] Observações relevantes sobre o paciente...
- L168: Indicado por
- L179: Outro paciente que indicou este. Ajuda a identificar quem mais traz indicações.
- L202: Zona de perigo
- L209: Anonimizar dados do paciente

### `components/neuro-id-360-documents.tsx` — 21
- L104: Relatório Funcional Integrado — Neuro ID
- L110: [attr] Exames e informações avaliadas
- L112: [attr] Resultados encontrados
- L115: [attr] Principais achados
- L116: [attr] Padrões observados
- L117: [attr] Achados funcionais
- L118: [attr] Desregulação do sistema nervoso (SNA)
- L121: [attr] Síntese clínico-funcional
- L122: [attr] Conclusão funcional
- L123: [attr] Fase na Jornada Neuro ID
- L133: Plano Integrativo Neuro ID
- L141: [attr] Fase na Jornada Neuro ID
- L145: [attr] Direção terapêutica
- L147: [attr] Plano integrativo inicial
- L150: [attr] Próximos passos
- L151: [attr] Orientações iniciais
- L152: [attr] Recomendações de rotina
- L155: [attr] Acompanhamento da evolução
- L156: [attr] Próximo passo
- L166: Protocolo de Suplementação
- L183: [attr] Observações gerais

### `app/leads/[id]/page.tsx` — 17
- L79: Ready to move forward
- L80: Convert this lead into a patient when they are ready to begin.
- L94: Contact info
- L95: Simple and easy to read.
- L101: Name
- L105: Phone
- L109: Email
- L113: Source
- L117: Main complaint
- L125: Notes
- L126: What the team needs to know.
- L132: [attr] Next Steps for this lead
- L140: Send simple message
- L141: Lead nurturing. No medical advice.
- L146: [attr] Email this lead
- L156: [attr] Text this lead
- L168: [attr] Lead AI insights

### `components/schedule-container.tsx` — 17
- L87: Promise
- L246: Promise
- L249: Promise
- L253: Promise
- L254: Promise
- L580: Promise
- L785: Promise
- L788: Promise
- L789: Promise
- L790: Promise
- L1254: Promise
- L1255: Promise
- L1275: Promise
- L1278: Promise
- L1279: Promise
- L1280: Promise
- L1281: Promise

### `app/leads/new/page.tsx` — 13
- L10: [attr] Adicionar lead
- L14: [attr] Nome do lead
- L18: [attr] email@exemplo.com
- L25: [attr] Com o que precisa de ajuda?
- L29: Instagram
- L30: Google
- L31: Facebook
- L32: Website
- L33: Indicação
- L34: Outro
- L38: [attr] Sobre o que perguntou?
- L41: Salvar lead
- L42: Cancelar

### `app/envio/[slug]/intake-client.tsx` — 12
- L198: Passo 1 de 2 — Identificação
- L260: [attr] Seu nome
- L301: Prefiro não informar
- L302: Feminino
- L303: Masculino
- L304: Outro
- L362: [attr] seu@email.com
- L428: Passo 2 de 2 — Arquivos e observações
- L574: Resumo do envio
- L576: Paciente
- L580: Arquivos
- L586: Clínica

### `app/patients/[id]/prontuario/print/page.tsx` — 9
- L102: Prontuário Eletrônico
- L115: Data de nascimento
- L119: Telefone
- L123: E-mail
- L129: Observações:
- L135: Histórico de sessões
- L138: Nenhum registro de sessão.
- L184: Notas adicionais
- L191: Observações-chave

### `components/session-insight-generator.tsx` — 9
- L51: AI Insight
- L52: Disponível após salvar
- L71: AI Insight
- L72: Sessão salva — pronto para gerar
- L99: AI Insight
- L119: AI Insight
- L120: Falha ao gerar
- L147: AI Insight gerado
- L148: Pendente de revisão

### `components/ai-insight-panel.tsx` — 9
- L58: Simple insight review
- L83: AI insight could not be updated.
- L92: No insight yet
- L104: View details
- L110: Next Steps
- L115: No review points available.
- L120: Validation history
- L130: No validation history yet.
- L135: Safety note

### `app/patients/[id]/prescriptions/print/page.tsx` — 8
- L116: Medicina Integrativa
- L125: Receituário
- L133: Data de nascimento
- L139: Telefone
- L149: Medicamentos
- L173: Suplementos e Fitoterápicos
- L196: Nenhum item prescrito ativo.
- L212: Válido somente com assinatura do profissional

### `components/session-type-list.tsx` — 7
- L10: Promise
- L11: Promise
- L12: Promise
- L13: Promise
- L14: Promise
- L15: Promise
- L225: Zoom

### `app/schedule/[id]/reminder/page.tsx` — 5
- L31: Enviar lembrete de consulta
- L32: Escolha o canal e personalize a mensagem antes de enviar.
- L42: Paciente
- L51: [attr] Lembrete por e-mail
- L61: [attr] Lembrete por SMS

### `components/ai-insight-review-card.tsx` — 5
- L58: [attr] Notas de revisão (opcional) — clique no 🎤 para ditar
- L63: Enviar os documentos ao paciente por e-mail e WhatsApp ao aprovar
- L94: View details
- L101: Key context
- L114: Patterns

### `app/patients/[id]/prontuario/page.tsx` — 4
- L82: Prontuário
- L114: Observações gerais
- L124: Nenhum registro de sessão ainda
- L232: Sessão sem anotações.

### `app/patients/[id]/insights/page.tsx` — 3
- L52: AI Insights
- L67: Envio do relatório ao paciente
- L80: Insight aprovado. Deseja criar um follow-up para este paciente?

### `app/patients/[id]/forms/page.tsx` — 3
- L41: Formulários
- L61: Nenhum formulário preenchido ainda.
- L62: Clique em "Novo formulário" para aplicar um questionário.

### `app/patients/[id]/portal-link/page.tsx` — 3
- L53: Link do portal do paciente
- L79: Links recentes
- L108: Nenhum link gerado ainda.

### `components/create-session-modal.tsx` — 3
- L26: Promise
- L27: Promise
- L28: Promise

### `app/patients/[id]/products/page.tsx` — 2
- L223: [attr] Ex: Magnésio Dimalato
- L233: [attr] Por que este produto foi indicado?

### `app/patients/[id]/forms/[responseId]/page.tsx` — 2
- L78: Pontuação por seção
- L155: Observações

### `app/schedule/page.tsx` — 2
- L220: Olá!
- L222: Confirme o horário e complete seu cadastro neste link:

### `app/leads/page.tsx` — 2
- L18: Leads
- L34: [attr] Nenhum lead ainda

### `components/patient-intake-form.tsx` — 2
- L8: Promise
- L50: Selecione

### `components/copy-portal-link-card.tsx` — 2
- L17: Secure patient link
- L18: This private link expires in 7 days. Share it only with the patient.

### `app/patients/[id]/evolution/page.tsx` — 1
- L47: Evolução clínica

### `components/intake-form-builder.tsx` — 1
- L17: Promise

### `components/zoom-session-banner.tsx` — 1
- L94: Link paciente:

### `components/patient-neuro-id-panel.tsx` — 1
- L55: [attr] Pirâmide Bio³ — peso de cada eixo no total, cor por gravidade

### `components/teleconsulta-notes.tsx` — 1
- L15: Promise

### `components/session-drawer.tsx` — 1
- L36: Promise


## 🟡 Tier 2 — OPERACIONAL / NEGÓCIO  (144 strings · 29 arquivos)

### `components/monetization-offer-form.tsx` — 16
- L5: Promise
- L16: Nova oferta
- L17: Pacotes de sessões e assinaturas.
- L21: Nome da oferta
- L25: [attr] Ex: Pacote 4 sessões
- L32: Tipo
- L39: Pacote de sessões
- L40: Assinatura recorrente
- L45: Cobrança
- L50: Mensal
- L51: Anual
- L56: Sessões
- L72: Valor (R$)
- L84: Moeda
- L95: Descrição (opcional)
- L99: [attr] Descrição interna da oferta

### `components/monetization-lists.tsx` — 15
- L18: Promise
- L19: Promise
- L20: Promise
- L66: [attr] No packages or memberships yet
- L116: [attr] Excluir
- L127: Price
- L131: Sessions
- L143: Nome
- L153: Preço (R$)
- L181: Cobrança
- L187: Mensal
- L188: Anual
- L193: Descrição
- L245: [attr] No patient plans assigned
- L269: Used

### `app/monetization/page.tsx` — 14
- L146: Packages and memberships.
- L147: Define simple offers for each clinic. No payment processing is connected yet.
- L154: Session packages
- L159: Memberships
- L164: Active patient plans
- L169: Active offer value
- L178: Clinic offers
- L179: Simple and flexible
- L191: Patient plans
- L192: Manual tracking
- L200: This user needs to be assigned to a clinic before creating offers.
- L206: Add a patient first. Then return here to assign a package or membership.
- L208: Create an active offer first. Then assign it to a patient.
- L214: Structure only

### `app/products/orders/new-order-form.tsx` — 9
- L70: Paciente (opcional)
- L76: Venda avulsa (sem paciente)
- L83: Produtos
- L131: Taxa/frete (R$, opcional)
- L141: Observações
- L145: [attr] Opcional
- L153: Subtotal
- L154: Taxa/frete
- L155: Total

### `app/hotmart/page.tsx` — 8
- L43: Hotmart
- L44: Compras e assinaturas sincronizadas automaticamente
- L58: Receita total
- L62: compras confirmadas
- L65: Total de compras
- L70: Canceladas
- L75: Chargebacks
- L77: contestações

### `components/patient-offer-form.tsx` — 7
- L12: Promise
- L19: Assign to patient
- L20: Track package or membership usage manually.
- L26: Choose patient
- L34: Choose offer
- L52: [attr] Optional internal note
- L55: Assign offer

### `components/product-form.tsx` — 7
- L19: Add Product
- L20: Keep product support clear, safe, and easy to review.
- L26: [attr] Magnesium Support
- L51: [attr] Short product description.
- L58: [attr] Supports relaxation and normal nervous system function.
- L98: Create Product
- L99: Save draft

### `components/sell-product-modal.tsx` — 7
- L22: Vender produto
- L23: Registre uma venda manual para esta clínica.
- L40: Pendente
- L41: Pago
- L42: Falhou
- L48: Registrar venda
- L49: Cancelar

### `app/communications/compose-modal.tsx` — 6
- L81: Nova mensagem
- L95: Canal
- L154: Assunto
- L159: [attr] Assunto do e-mail
- L167: Mensagem
- L172: [attr] Digite sua mensagem...

### `app/communications/page.tsx` — 6
- L46: mensagens no histórico
- L51: templates ativos
- L56: templates ativos
- L63: envios com erro
- L96: Nenhum template ainda.
- L117: Histórico de envios

### `components/assinaturas-client.tsx` — 6
- L118: Nenhuma assinatura encontrada.
- L131: Paciente
- L132: Plano
- L133: Valor
- L134: Renova em
- L135: Status

### `app/products/new/page.tsx` — 5
- L52: [attr] Ex: Magnésio Dimalato 300mg
- L75: [attr] Descrição opcional do produto
- L99: [attr] 0,00 (opcional)
- L122: [attr] Ex: MAG-300 (opcional)
- L134: [attr] Informações sobre uso seguro, contraindicações, etc. (opcional)

### `app/whatsapp/page.tsx` — 4
- L143: via Twilio + GPT-4o-mini
- L157: total no histórico
- L175: Configuração Twilio
- L226: Nenhuma conversa ainda.

### `components/offer-list.tsx` — 4
- L42: Promise
- L43: Promise
- L44: Promise
- L45: Promise

### `app/products/orders/new/page.tsx` — 3
- L26: Novo pedido
- L27: Selecione produtos e quantidades para gerar um pedido.
- L32: [attr] Nenhum produto ativo

### `app/billing/page.tsx` — 3
- L74: Escolha seu plano
- L99: Histórico de faturas
- L135: [attr] Baixar PDF

### `components/product-suggestion-card.tsx` — 3
- L18: Safety questions
- L29: Approve
- L30: Ignore

### `components/product-card.tsx` — 3
- L35: View details
- L36: Add to patient
- L37: Sell

### `components/follow-up-list.tsx` — 3
- L22: Promise
- L23: Promise
- L24: Promise

### `app/settings/whatsapp/whatsapp-bot-form.tsx` — 2
- L208: [attr] ex: 1031933676681061
- L214: [attr] ex: 17841400000000000

### `app/products/page.tsx` — 2
- L31: Produtos
- L49: [attr] Nenhum produto ainda

### `app/assinaturas/page.tsx` — 2
- L8: Clínica
- L9: Assinaturas

### `app/whatsapp/[phone]/page.tsx` — 2
- L33: Atendimento humano
- L35: Bot ativo

### `components/patient-exams-panel.tsx` — 2
- L186: [attr] Ex: TSH
- L200: [attr] mUI/L

### `app/products/orders/order-charge-buttons.tsx` — 1
- L44: Abrir

### `app/products/orders/page.tsx` — 1
- L105: [attr] Nenhum pedido ainda

### `app/whatsapp/[phone]/conversation-client.tsx` — 1
- L151: [attr] Digite sua mensagem...

### `components/mfa-settings.tsx` — 1
- L131: [attr] QR Code 2FA

### `components/follow-up-form.tsx` — 1
- L7: Promise


## ⚪ Tier 3 — RESTO / ADMIN  (126 strings · 43 arquivos)

### `app/clinics/page.tsx` — 14
- L108: Configurações
- L109: Configuração da clínica
- L110: Nome, URL de agendamento e perfil de prática.
- L136: Tipo de clínica
- L208: [attr] Ex: Clínica especializada em medicina integrativa e funcional em São Paulo.
- L237: [attr] contato@suaclinica.com.br
- L277: [attr] Rua Exemplo, 123 — Sala 45
- L284: Cidade
- L288: [attr] São Paulo
- L295: Estado
- L327: [attr] Logo
- L334: Logo e cor primária
- L390: [attr] Nenhuma clínica conectada
- L438: [attr] Nenhum membro na equipe

### `components/form-builder.tsx` — 13
- L21: void | Promise
- L33: Form details
- L34: Keep it short and easy to complete.
- L39: Form name
- L44: [attr] Form name
- L49: Category
- L63: Short description
- L67: [attr] Describe when this form should be used.
- L75: Questions
- L76: Show up to 5 questions here. Add more later in View details.
- L95: View details
- L104: Save draft
- L105: Create Form

### `components/patient-snapshot.tsx` — 12
- L83: Patient Snapshot
- L84: Context for the next decision.
- L93: Latest Insight
- L98: Last Session
- L105: Key Notes
- L114: Next Step
- L121: Attention:
- L122: Follow-up:
- L123: Patient status:
- L131: Open patient
- L134: Add note
- L137: Create follow-up

### `components/relatorios-charts.tsx` — 10
- L208: Nenhum pagamento registrado.
- L229: Nenhuma sessão registrada.
- L250: Nenhum agendamento no período.
- L312: receita
- L313: sessões
- L314: novos pacientes
- L332: [attr] Novos pacientes por mês
- L338: [attr] Métodos de pagamento
- L341: [attr] Tipos de sessão
- L344: [attr] Origem dos agendamentos

### `components/form-question-card.tsx` — 6
- L30: [attr] Remove question
- L37: Question
- L43: [attr] Write a simple question
- L48: Type
- L64: Options
- L69: [attr] Option A, Option B, Option C

### `components/communication-template-card.tsx` — 4
- L14: Promise
- L49: Assunto
- L53: [attr] Assunto do e-mail
- L61: Mensagem

### `components/onboarding-flow.tsx` — 4
- L236: Nome muito curto — mínimo 2 caracteres.
- L249: [attr] Logo preview
- L346: [attr] colega@suaclinica.com.br
- L466: Criar minha clínica

### `app/profissionais/page.tsx` — 3
- L8: Gestão
- L9: Equipe
- L10: Produtividade, receita e NPS por profissional.

### `app/links/links-hub.tsx` — 3
- L79: [attr] Abrir
- L96: Promise
- L193: Promise

### `app/onboarding/plan/page.tsx` — 3
- L9: Onboarding
- L10: Escolha seu plano
- L24: Não tem certeza ainda?

### `components/global-search.tsx` — 3
- L79: [attr] Abrir busca global
- L197: [attr] Buscar pacientes, sessões, leads…
- L206: [attr] Fechar

### `components/clinic-edit-form.tsx` — 3
- L9: Promise
- L99: [attr] minha-clinica
- L104: clinica-axiel

### `components/body-map-field.tsx` — 3
- L74: Selected areas
- L76: No area selected yet.
- L86: [attr] Add a short note

### `components/pwa-register.tsx` — 3
- L7: Promise
- L56: Instalar AXIEL Core
- L57: Acesso rápido na tela inicial

### `components/inbox-client.tsx` — 3
- L76: Conversas com pacientes via portal
- L95: [attr] Buscar paciente ou mensagem…
- L146: Você:

### `app/error.tsx` — 2
- L13: AXIEL Core
- L14: Algo deu errado

### `app/global-error.tsx` — 2
- L15: Algo deu errado.
- L16: O erro foi registrado automaticamente. Tente novamente.

### `app/not-found.tsx` — 2
- L7: AXIEL Core
- L8: Página não encontrada

### `app/forms/import-templates-button.tsx` — 2
- L19: Promise
- L37: Promise

### `app/profissionais/[id]/page.tsx` — 2
- L23: Profissional
- L24: Relatório de Produtividade

### `app/get-started/page.tsx` — 2
- L79: Configuração
- L80: Começar em minutos

### `app/offline/page.tsx` — 2
- L6: AXIEL Core
- L7: Sem conexão

### `components/notification-bell.tsx` — 2
- L113: [attr] Notificações
- L126: Notificações

### `components/send-message-box.tsx` — 2
- L19: Promise
- L24: value ?

### `components/form-invitation-panel.tsx` — 2
- L82: [attr] Buscar paciente...
- L143: Link gerado (válido por 15 dias)

### `components/voice-dictation.tsx` — 2
- L124: [attr] Ditar nota de voz
- L137: [attr] Parar gravação

### `app/upgrade/page.tsx` — 1
- L64: AXIEL Core

### `app/forms/delete-template-button.tsx` — 1
- L10: Promise

### `app/results/page.tsx` — 1
- L219: Retenção e engajamento

### `app/book/[slug]/page.tsx` — 1
- L148: s !== "done") as Exclude

### `app/pricing/pricing-client.tsx` — 1
- L340: contato@axielcore.com

### `components/convert-lead-button.tsx` — 1
- L26: void | Promise

### `components/lgpd-requests-client.tsx` — 1
- L45: Nenhuma solicitação de exclusão recebida.

### `components/zoom-recordings-panel.tsx` — 1
- L70: Gravações Zoom

### `components/patient-assessment-progress-panel.tsx` — 1
- L129: Evolução dos questionários

### `components/evolution-charts.tsx` — 1
- L237: Vitais por sessão

### `components/communication-log-list.tsx` — 1
- L28: Nenhuma mensagem enviada.

### `components/form-patient-picker.tsx` — 1
- L59: [attr] Buscar paciente...

### `components/assessment-fill-form.tsx` — 1
- L52: Promise

### `components/appointment-form.tsx` — 1
- L19: Promise

### `components/lead-pipeline-board.tsx` — 1
- L165: Drop here

### `components/dashboard/dashboard-realtime-kpis.tsx` — 1
- L24: previous) return

### `components/analytics/nps-trend-chart.tsx` — 1
- L20: Média:
