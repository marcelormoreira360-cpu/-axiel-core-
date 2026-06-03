# AXIEL Growth ⇄ AXIEL Core — Especificação de Integração (v0.1)

> Rascunho. Os pontos marcados **[TBD — depende dos arquivos do Growth]** serão
> preenchidos quando o schema/contrato do Growth for enviado.
> Atualizado em: 02/06/2026

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

## 3. Modelo de identidade

1. No Core, cada clínica gera uma **Integration Key** em `Settings → Integrações → Axiel Growth`.
2. A chave é guardada **hasheada** no Core (tabela `clinic_integration_keys`), mapeando `key_hash → clinic_id`.
3. No Growth, o cliente cola essa chave na config da conta dele.
4. Toda chamada do Growth para o Core envia a chave; o Core resolve a clínica a partir dela. Sem chave válida → 401, mensagem descartada.

**[TBD]** Como o Growth identifica internamente cada conta de cliente (para amarrar 1 conta Growth ↔ 1 Integration Key do Core).

---

## 4. Contrato do Webhook (Growth → Core)

### Endpoint
```
POST https://<core-domain>/api/integrations/growth/lead
Authorization: Bearer <INTEGRATION_KEY>
Content-Type: application/json
Idempotency-Key: <growth_lead_id>   # evita lead duplicado em retries
```

### Payload (proposta — ajustar ao que o Growth já produz)
```jsonc
{
  "growth_lead_id": "gr_abc123",        // id do lead no Growth (idempotência)
  "captured_at": "2026-06-02T14:30:00Z",
  "trigger": "messaged",                // "messaged" | "score_threshold"
  "score": 82,                          // 0-100 (temperatura)
  "contact": {
    "full_name": "Maria S.",
    "phone": "+5511999999999",          // chave de dedup (com email)
    "email": "maria@exemplo.com"
  },
  "channel": "instagram",               // origem do aquecimento
  "warming_context": {                  // o que o lead engajou
    "utm": { "source": "ig", "campaign": "detox-junho" },
    "engaged_content": ["post:123", "reel:456"],
    "last_message": "Quero saber sobre a avaliação"
  },
  "consent": {                          // LGPD — obrigatório
    "granted": true,
    "purpose": "contact_and_care",
    "timestamp": "2026-06-02T14:29:00Z",
    "text_version": "v1"
  }
}
```

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

### Fase 2 — feedback Core → Growth (bidirecional)
Callback do Core quando o lead muda de desfecho (`virou_paciente`, `esfriou`, `perdido`) para o Growth recalibrar o score. Mesmo modelo de chave, sentido inverso.

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

## 7. O que falta receber do Growth (checklist)

- [ ] Schema do banco do Growth (tabela de leads/contatos)
- [ ] Type/interface do objeto "lead" ou um JSON de exemplo
- [ ] Código do gatilho de "lead quente" (score/threshold)
- [ ] Como o Growth identifica cada conta de cliente
- [ ] Doc de API existente (se houver)

---

## 8. Roadmap de implementação (Core)

1. Migration (tabela `clinic_integration_keys` + campos em `leads`).
2. Geração/gestão de Integration Key + UI em Settings → Integrações.
3. Endpoint `/api/integrations/growth/lead` (auth + dedup + upsert + consent).
4. Feature gate (add-on/Pro+).
5. (Fase 2) Callback de desfecho Core → Growth.
6. (Paralelo) Camada des-identificada + exportação agregada (§6).
