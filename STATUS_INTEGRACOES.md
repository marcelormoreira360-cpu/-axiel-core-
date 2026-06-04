# Status — Instagram + Integração Growth↔Core

> Resumo do que está pronto e do que falta. Atualizado em 03/06/2026.

## 🟢 Integração Growth↔Core: NO AR (validada 03/06/2026)

Fluxo automático testado ponta a ponta: lead `stage='hot'` no Growth → POST ao Core →
**HTTP 200** `{ok:true, clinic_id, lead_id, created}` → Growth gravou `synced_to_health=true`
e `tenants.axiel_health_org_id = clinic_id`. Idempotência OK (reenvio = `already_synced`).
Bug corrigido no Growth: a chave não persistia por gap de permissão em `tenants` (agora via service role).

**Pendências finais (limpeza):** revogar no Core as chaves expostas no chat (`axg_ca69…`, `axg_2c04…`), mantendo só a que o Growth usa (`axg_bf1…`); apagar leads de teste (Core: tela Leads; Growth: `CLEANUP=1`).

---

## ✅ AXIEL CORE — pronto e no ar

| Item | Status |
|------|--------|
| Bot do Instagram multi-clínica (resolve a clínica por conta, sem dados fixos do IFWC) | ✅ no ar |
| Campo "Instagram Account ID" em Settings → WhatsApp Bot | ✅ no ar |
| Instagram Account ID da clínica gravado (`17841460053907081` = jifwcenter) | ✅ salvo |
| Correção do erro ao salvar a config do bot (coluna text x uuid) | ✅ no ar |
| Endpoint que recebe lead do Growth (`/api/integrations/growth/lead`) | ✅ testado (HTTP 200) |
| Migrations 051 e 052 aplicadas no banco | ✅ |
| Card "AXIEL Growth" em Settings → Integrações (gerar chave) | ✅ no ar |

## 🔲 AXIEL CORE — pendente

- **Ativar a conta `jifwcenter` como Profissional (Business) na Meta** — ⚠️ travado por **erro do próprio Instagram** ("There was a problem, try again later"), que é temporário. Depois disso: gerar token + ligar "Assinatura do webhook". (O campo `messages` já está assinado ✅.)
- **App da Meta em modo desenvolvimento** — para receber DMs de qualquer pessoa, o app precisará ser **publicado** (revisão da Meta). Para testar com a sua própria conta, o modo dev já basta.
- **Segurança:** gerar uma **chave de integração nova** e **revogar a que apareceu no chat** (`axg_2c04...`).

---

## ✅ AXIEL GROWTH — pronto

| Item | Status |
|------|--------|
| Coluna `axiel_core_api_key` na tabela `tenants` (cifrada) | ✅ aplicada |
| Schema já tinha os campos de handoff (`leads.synced_to_health`, `score`, `stage`, `consent`, `axiel_health_patient_id`; `tenants.axiel_health_org_id`) | ✅ |

## 🔲 AXIEL GROWTH — pendente

- **Código de envio (o mais importante):** a função/job que faz o `POST` para o endpoint do Core quando um lead vira `hot`/`scheduled`. (Pedido feito na conversa do Growth — confirmar se foi implementado.)
- **Tela "Connections → AXIEL Core"** para o cliente colar a chave (confirmar se existe ou criar).
- **Colar a chave nova do Core** na config do Growth.

---

## 🔌 Para LIGAR a integração Growth↔Core (quando os pendentes acima estiverem ok)

1. **Core:** gerar a chave em Settings → Integrações → AXIEL Growth.
2. **Growth:** colar essa chave na config + ter o código de envio funcionando.
3. **Testar:** um lead vira `hot` no Growth → deve aparecer em **Leads** no Core com origem "Axiel Growth".

## 📸 Para LIGAR o bot de Instagram (quando a Meta deixar)

1. Converter `jifwcenter` para conta **Business** (no app do Instagram).
2. No developers.facebook.com → app AXIEL → Instagram → API setup → **Gerar token** na linha da `jifwcenter`.
3. Ligar **"Assinatura do webhook"** dela.
4. Testar: mandar uma **DM de outra conta** para `@jifwcenter` → o bot responde.

---

## 📁 Documentos de referência (na pasta do projeto)

- `AXIEL_GROWTH_INTEGRATION_SPEC.md` — especificação completa da integração.
- `COLAR_NO_AXIEL_GROWTH.md` — texto para pedir o código de envio ao Growth.
- `CONTEXT.md` — histórico técnico do Core.
