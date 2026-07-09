# Instagram para produção externa — plano de ação

> Objetivo: o bot de Instagram responder DMs de **qualquer paciente** de **qualquer clínica** (não só das suas contas).
> Atualizado em 03/06/2026.

## Resumo honesto das expectativas

Isto **não é** uma tarefa de um dia. Como o Axiel Core é um SaaS (clínicas que não são suas vão conectar o Instagram delas), a Meta exige o nível **Advanced Access** da permissão de mensagens, e isso passa por **App Review + Verificação de Negócio**. Na prática:
- **Hoje (modo desenvolvimento):** o bot já funciona, mas **só** para até 25 contas que sejam suas / adicionadas como teste. Serve para você testar e gravar o vídeo da revisão.
- **Para clientes externos:** precisa da aprovação da Meta, que costuma levar **de semanas a alguns meses**.

Legenda: **[Meta]** = você faz no painel da Meta · **[código]** = eu faço · **[doc]** = texto/material a preparar.

---

## FASE 0 — Pré-requisitos (destravar o que está parado)
- [ ] **[Meta]** Converter a conta `jifwcenter` para **Profissional/Business** (estava com erro temporário — tentar de novo; ver dica no fim).
- [ ] **[Meta]** Cada clínica cliente também precisará ter conta **Business** ligada a uma **Página do Facebook**.
- [x] **[código]** Página de Privacidade pública (o Core já tem `/privacidade`).
- [ ] **[Meta]** App com ícone, nome e categoria preenchidos (Configurações → Básico).

## FASE 1 — Verificação de Negócio (Business Verification)
- [ ] **[Meta]** No **Meta Business Manager** → Configurações de Segurança → **Verificação de Negócio**: enviar documentos da empresa (CNPJ/registro, comprovante de endereço, etc.). **Pode levar dias.** É obrigatório para Advanced Access.

## FASE 2 — Deixar o app pronto para a revisão (requisitos técnicos)
A Meta testa estes pontos. Status atual:
- [x] **[código]** Webhooks configurados (callback + campo `messages` assinado). ✅
- [x] **[código]** "Humano assume" (a clínica pode desativar o bot numa conversa — `bot_disabled`). ✅
- [ ] **[código]** **Opt-out pelo paciente** — o paciente poder digitar "falar com atendente / humano / parar" e o bot escalar para uma pessoa e parar de responder. *(eu implemento — ver abaixo)*
- [ ] **[doc]** URL de **Exclusão de Dados** (data deletion) — o Core tem LGPD; confirmar a URL pública.

## FASE 3 — Submeter o App Review
- [ ] **[Meta]** Em **App Review → Permissions and Features**, pedir **Advanced Access** de:
  - `instagram_business_basic`
  - `instagram_business_manage_messages`
- [ ] **[doc]** Escrever a **justificativa de uso** (por que o app precisa ler/responder DMs) — eu te escrevo um rascunho.
- [ ] **[doc]** Gravar um **vídeo (screencast)** mostrando o fluxo: paciente manda DM → bot responde → paciente pede falar com humano → escala para atendente. *(o opt-out acima é necessário para esse vídeo)*
- [ ] **[Meta]** Submeter e aguardar (semanas).

## FASE 4 — Go Live
- [ ] **[Meta]** Mudar o app para modo **Live** (publicado).
- [ ] **[código]** No Core, cada clínica preenche o **Instagram Account ID** dela em Settings → WhatsApp Bot (o multi-clínica já está pronto). ✅
- [ ] **[Meta]** Cada clínica autoriza o app na conta dela (gera token + liga webhook).

---

## O que eu (código) vou fazer agora
Implementar o **opt-out pelo paciente** no bot de Instagram: quando a pessoa pedir para falar com um humano (ou "parar"), o bot responde uma vez avisando que vai chamar a equipe, **marca a conversa como "humano assume"** (`bot_disabled = true`) e para de responder automaticamente. Isso atende ao requisito da Meta e é o que você mostra no vídeo da revisão.

## Dica para destravar a conversão da `jifwcenter` (Fase 0)
O erro "There was a problem, try again later" some sozinho na maioria das vezes. Se persistir:
- Tentar pelo **computador** em instagram.com (Configurações → Tipo de conta → mudar para profissional → Business).
- Garantir que a conta está **ligada a uma Página do Facebook** da qual você é admin.
- Esperar algumas horas e tentar de novo (rede diferente ajuda).

---

## Fontes (requisitos atuais da Meta)
- App Review — Instagram Platform: https://developers.facebook.com/docs/instagram-platform/app-review/
- Messaging — Instagram API with Instagram Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- Overview of the Instagram API: https://developers.facebook.com/docs/instagram-platform/overview/
