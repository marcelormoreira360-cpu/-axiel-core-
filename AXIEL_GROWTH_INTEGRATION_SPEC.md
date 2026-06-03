# AXIEL Growth ⇄ AXIEL Core — Especificação de Integração (v0.2)

> Atualizado em: 02/06/2026 — agora com o **schema real do Growth** (migrations 0001–0016).
> Mudança v0.2: o Growth **já tem** os campos de handoff prontos (`leads.synced_to_health`,
> `leads.axiel_health_patient_id`, `leads.score`, `leads.stage`, `leads.consent*`,
> `tenants.axiel_health_org_id`). A integração no Core encaixa nesses campos.

## 0. Reconciliação de nomes — ✅ CONFIRMADO (02/06/2026)

O schema do Growth chama o produto clínico de **"AXIEL Health"**
(`tenants.axiel_health_org_id`, `leads.axiel_health_patient_id`, `leads.synced_to_health`,
`stage = 'patient'`). **AXIEL Health = AXIEL Core — é o mesmo produto** (nomes diferentes em
cada base). Onde o schema do Growth diz "axiel_health", leia-se AXIEL Core.

> Sugestão futura: padronizar o nome em algum momento para evitar confusão na manutenção.

---

## 1. Visão geral

- **Axiel Growth**: captação + aquecimento de leads (conteúdo, postagem, nurturing). Produto **vendido isoladamente**.
- **Axiel Core**: gestão clínica (lead → atendimento → prontuário → portal).
- **Conexão (diferencial pago)**: quando o Growth aquece um lead e ele faz contato, o lead "cai quente" no Core, com todo o contexto do aquecimento. Quem tem os dois ganha o fluxo ponta-a-ponta.

Princípio: os dois produtos permanecem **independentes**. A integração é um *add-on opt-in*, não um acoplamento.

---

## 2. Decisões de arquitetura (recomendadas)

| Tema | Decisão | Motivo |
|------|---------|--------|
| Infra | **Apps/DBs separados** + webhook/API versionada | Growth precisa rodar/vender sozinho; DB compartilhado acoplaria migrations, RLS e deploys |
| Direção | **Growth → Core** no v1; contrato já pronto p/ bidirecional | Handoff é o valor imediato; feedback Core→Growth fica p/ Fase 2 |
| Identidade | **Integration Key por clínica** (mapeamento), não `clinic_id` compartilhado | Mesmo padrão já usado no Core p/ tokens de Zoom/Meta por clínica |

---

## 3. Modelo de identidade (mapeado ao schema real)

- **Growth**: tenant = `tenants.id`. Já tem coluna `tenants.axiel_health_org_id` reservada para guardar o **`clinic_id` do Core**.
- **Core**: clínica = `clinics.id` (`clinic_id`).

Fluxo de pareamento (Integration Key, uma vez por cliente):
1. No Core, a clínica gera uma **Integration Key** em `Settings → Integrações → Axiel Growth`.
2. Core guarda a chave **hasheada** (`clinic_integration_keys.key_hash → clinic_id`).
3. No Growth, o cliente cola a chave na config do tenant.
4. Na 1ª chamada, o Core valida a chave, resolve o `clinic_id` e **devolve esse `clinic_id`**; o Growth grava em `tenants.axiel_health_org_id`. A partir daí o vínculo está fechado nos dois lados.
5. Sem chave válida → 401, mensagem descartada (mesma postura SEC-01 do bot).

> Vantagem: o Growth continua vendável sozinho (sem chave, só não sincroniza). A chave é o "plugue" pago.

---

## 4. Contrato do Webhook (Growth → Core)

### Endpoint
```
POST https://<core-domain>/api/integrations/growth/lead
Authorization: Bearer <INTEGRATION_KEY>
Content-Type: application/json
Idempotency-Key: <growth_lead_id>   # evita lead duplicado em retries
```

### Payload (mapeado direto das colunas de `leads` do Growth)
```jsonc
{
  "growth_lead_id": "<leads.id>",          // uuid do lead no Growth (idempotência)
  "growth_tenant_id": "<tenants.id>",      // tenant do Growth (auditoria/checagem)
  "name": "Maria S.",                      // leads.name
  "email": "maria@exemplo.com",            // leads.email   (dedup)
  "phone": "+5511999999999",               // leads.phone   (dedup)
  "score": 82,                             // leads.score (0-100)
  "stage": "hot",                          // leads.stage: captured|cold|warm|hot|scheduled|patient
  "interest": "microfisioterapia",         // leads.interest
  "pain": "enxaqueca crônica",             // leads.pain
  "source_platform": "instagram",          // leads.source_platform
  "consent": {                             // leads.consent / consent_text / consent_at
    "granted": true,
    "text": "Aceito ser contatado…",
    "at": "2026-06-02T14:29:00Z"
  }
}
```

### Mapeamento Growth → Core (`leads` do Core)
| Growth (`leads.*`) | Core (`leads.*`) |
|---|---|
| `id` | `growth_lead_id` (novo, único por clínica) |
| `name` | `full_name` |
| `email` / `phone` | `email` / `phone` (chave de dedup) |
| `score` | `score` (novo) |
| `stage` | `stage` (mapear — ver abaixo) + `warming_context.growth_stage` |
| `interest` / `pain` | `warming_context` (jsonb) + resumo em `notes` |
| `source_platform` | `source = 'axiel_growth'`; plataforma em `warming_context` |
| `consent*` | `patient_consents` (registro de consentimento) |

**Mapa de `stage`** (Growth → Core): `hot/scheduled` → entra como lead ativo no Core (stage inicial do Core, ex. `new_lead`); `patient` → não reenviar (já virou paciente). `captured/cold/warm` normalmente **não** são enviados (só "quente" cruza a ponte) — confirmar o gatilho (§7).

### Resposta do Core
```jsonc
{ "ok": true, "lead_id": "uuid-no-core", "created": true }   // ou "created": false (atualizado)
```

### Regras
- Dedup por `phone` (e `email`) **dentro da clínica** — reaproveita a lógica de auto-criação de lead que os bots já usam.
- `source = "axiel_growth"`.
- Sem `consent.granted = true` → o lead entra **sem PII de marketing** ou é rejeitado (decisão de produto — ver §6).
- Rate limit por Integration Key (padrão `checkRateLimitDb` do Core).

---

## 5. Mudanças no lado do Core

- **Nova rota**: `app/api/integrations/growth/lead/route.ts` (valida chave → resolve clínica → upsert de lead idempotente).
- **Nova tabela** `clinic_integration_keys`: `id, clinic_id, key_hash, label, is_active, created_at, last_used_at`.
- **Novos campos em `leads`**: `score int`, `growth_lead_id text` (único por clínica, idempotência), `warming_context jsonb`, e `source` aceitando `"axiel_growth"`.
- **Consentimento**: gravar em `patient_consents` (estrutura já existe no Core).
- **Feature gate**: conexão Growth = add-on / plano Pro+ (monetiza o diferencial) via `canUseFeature`.
- **UI**: card "Axiel Growth" em `Settings → Integrações` (gerar/rotacionar Integration Key, ver status/last_used).
- Migration única cobrindo tabela + colunas.

### Retorno Core → Growth (já previsto no schema do Growth)
- **Imediato** (resposta do POST): Core devolve o `clinic_id` → Growth grava em `tenants.axiel_health_org_id`.
- **Na conversão**: quando o lead vira paciente no Core, o Core avisa o Growth com o `patient_id` → Growth grava `leads.axiel_health_patient_id` e `synced_to_health = true` (a unique index `leads_tenant_patient_uq` garante 1 paciente ↔ 1 lead).
- **Fase 2 (opcional)**: desfecho (`esfriou`/`perdido`) volta ao Growth para recalibrar o score. Mesmo modelo de chave, sentido inverso.

---

## 6. Captação de dados do paciente para análise / comercialização

> Objetivo: usar os dados de forma **analítica** e/ou **comercializável sem expor o paciente**.
> Dado de saúde é **sensível** (LGPD Art. 11) — só é comercializável **anonimizado e agregado**.

### Princípios
- **Separar PII de features clínicas.** PII (nome, telefone, email, CPF, endereço) nunca entra na camada analítica.
- **Pseudonimização**: cada paciente vira um `subject_id` aleatório, sem caminho de volta ao identificável.
- **Consentimento de uso secundário**: flag explícita por paciente (`patient_consents`, purpose `analytics_secondary_use`). Só entra quem consentiu.
- **Agregação com k-anonimato**: nenhuma exportação revela grupos com menos de **k pacientes** (sugestão k≥10). Sem linhas individuais para fora.
- **Sem reidentificação**: proibido cruzar exports com dados externos que reidentifiquem.

### Estrutura sugerida
- **View/tabela des-identificada** `analytics_patient_features`: `subject_id, clinic_id?, faixa_etária, sexo, sintomas, biomarcadores, evolução, desfecho` — **sem PII**.
- **Camada de exportação agregada**: gera só métricas/coortes (ex.: "% de melhora por faixa etária"), nunca registros individuais.
- **Trilha de auditoria** de quem exportou o quê (o Core já tem audit log).

### Pendências legais (recomendado validar com jurídico)
- Texto de consentimento específico para uso secundário/analítico.
- Política de retenção e anonimização irreversível.
- Se houver venda de dados: contrato + base legal documentada.

---

## 7. Status do que falta

Resolvido pelo schema do Growth:
- [x] Schema do banco (recebido — migrations 0001–0016)
- [x] Estrutura do lead (`public.leads`) e campos de handoff (`synced_to_health`, `axiel_health_patient_id`, `score`, `stage`, `consent*`)
- [x] Como o Growth identifica cada cliente (`tenants` + `tenants.axiel_health_org_id`)

Ainda preciso confirmar com você / com o lado Growth:
- [x] **Nome confirmado**: AXIEL Health = AXIEL Core (§0)
- [ ] **Gatilho do handoff**: o Growth dispara o envio quando `stage` vira `hot`? `scheduled`? Ou quando `inbox_messages.escalate = true`? (define o "quando")
- [ ] **Código de saída do Growth**: existe já uma função no Growth que chama um endpoint externo quando o lead esquenta, ou isso precisa ser criado no lado Growth? (o schema tem o campo `synced_to_health`, mas a *chamada* é código de app, não está no SQL)
- [ ] **Endereço/infra**: Growth e Core são projetos Supabase separados? (sim, pelo que parece — dois bancos distintos)

---

## 8. Roadmap de implementação (Core)

1. Migration (tabela `clinic_integration_keys` + campos em `leads`).
2. Geração/gestão de Integration Key + UI em Settings → Integrações.
3. Endpoint `/api/integrations/growth/lead` (auth + dedup + upsert + consent).
4. Feature gate (add-on/Pro+).
5. (Fase 2) Callback de desfecho Core → Growth.
6. (Paralelo) Camada des-identificada + exportação agregada (§6).
