# Para colar na conversa do AXIEL Growth

> Copie todo o conteúdo abaixo (da linha "Preciso implementar..." até o final) e
> cole como **uma única mensagem** na conversa do projeto AXIEL Growth.

---

⚠️ ATENÇÃO: isto é uma TAREFA DE DESENVOLVIMENTO (escrever código no app), NÃO é para gerar um relatório, documento ou Social Audit. Você me entregou um Social Audit antes — não era isso. O que preciso é que você ESCREVA O CÓDIGO no backend do Growth que faz uma chamada HTTP POST a uma API externa (o AXIEL Core) quando um lead esquenta, e implemente a migration/coluna para guardar a chave. Implemente de fato no projeto, não descreva.

Preciso implementar o envio do lead quente para o AXIEL Core (handoff). O lado do Core já está pronto e recebe via webhook. Implemente a chamada de saída no Growth seguindo este contrato exato:

**Quando disparar:** quando um lead passa para `stage = 'hot'` ou `stage = 'scheduled'` (o que ocorrer primeiro). Não enviar se `stage = 'patient'`, nem reenviar se já houve sincronização bem-sucedida.

**Endpoint:**
```
POST https://axiel-core-6ikl.vercel.app/api/integrations/growth/lead
```

**Headers:**
```
Authorization: Bearer <CHAVE_DE_INTEGRACAO>
Content-Type: application/json
Idempotency-Key: <leads.id>
```

A `<CHAVE_DE_INTEGRACAO>` é gerada pelo cliente no AXIEL Core em `Settings → Integrações → AXIEL Growth` e colada no Growth. **Precisamos de um lugar para guardar essa chave por tenant** — sugiro adicionar uma coluna `axiel_core_api_key text` na tabela `tenants` (e um campo na config do tenant para o cliente colar). Implemente isso também.

**Body (JSON) — mapeado das colunas de `leads`:**
```json
{
  "growth_lead_id": "<leads.id>",
  "growth_tenant_id": "<leads.tenant_id>",
  "name": "<leads.name>",
  "email": "<leads.email>",
  "phone": "<leads.phone>",
  "score": <leads.score>,
  "stage": "<leads.stage>",
  "interest": "<leads.interest>",
  "pain": "<leads.pain>",
  "source_platform": "<leads.source_platform>",
  "consent": {
    "granted": <leads.consent>,
    "text": "<leads.consent_text>",
    "at": "<leads.consent_at em ISO 8601>"
  }
}
```

**Resposta de sucesso (200):**
```json
{ "ok": true, "clinic_id": "<uuid>", "lead_id": "<uuid>", "created": true }
```

**O que fazer com a resposta:**
- Gravar o `clinic_id` retornado em `tenants.axiel_health_org_id` (se ainda estiver vazio).
- Marcar `leads.synced_to_health = true`.
- NÃO gravar o `lead_id` em `leads.axiel_health_patient_id` — esse campo é para o `patient_id` que o Core devolve só quando o lead vira paciente (fase 2). Por enquanto, só `synced_to_health = true` e o `clinic_id` no tenant.

**Tratamento de erros / retries:**
- `401 invalid_key` → chave errada/ausente: não sincronizar, sinalizar para o cliente reconfigurar a chave.
- `429 rate_limited` → reenfileirar com backoff.
- `5xx`/timeout → retry com backoff exponencial (até ~3 tentativas). O `Idempotency-Key` garante que reenvios não criem leads duplicados.
- `422 missing_contact` → o lead não tem nome/telefone/email; não enviar.

**Importante:** o envio deve usar o **service role / server-side** (nunca expor a chave no client). Idealmente um job/edge function que observa a mudança de `stage` para `hot`/`scheduled`.
