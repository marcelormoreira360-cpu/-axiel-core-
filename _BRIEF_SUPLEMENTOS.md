# BRIEF DE BUILD — Feature de Suplementos (AXIEL Core)

> Preparado pelo squad (Nucleo + Forja, via Axiel) para execução **nesta sessão do repo**.
> **Antes de começar:** ler `CONTEXT.md` na raiz. Respeitar padrões obrigatórios e RLS multi-tenant. Rodar `/code-review --fix` antes do commit.

## 1. Objetivo
Módulo **multi-tenant** onde cada clínica configura sua estratégia de suplemento e o sistema gera, por paciente, uma recomendação que sai como **fórmula manipulada (Brasil)** ou **link de compra (EUA — DFH/Pure Encapsulations)**. A IA sugere a partir da história + exames + medicação atual, **sempre passando por revisão humana** (gates Salvo/Aval refletidos como etapa de aprovação).

## 2. Princípio: REUSAR, não recriar
| Já existe no Core | Como a feature usa |
|---|---|
| `treatment_plans` (+steps) | vincula a recomendação ao plano de cuidado |
| `patient_offers` / `patient_payments` | cobrança do suplemento (attach rate) |
| Relatório **Neuro ID 360 (PDF)** | a recomendação vira a **seção "Doc 3 — Suplementação"** |
| Branding por clínica | timbre da fórmula BR / identidade no PDF |
| `action_suggestions` (Next Best Action) | "Sugerir suplemento" aparece como próxima ação |

## 3. Modelo de dados (novo — mínimo)
```sql
-- catálogo por clínica (o que aquela clínica oferece)
supplement_catalog (
  id uuid pk, clinic_id uuid fk not null,           -- RLS por clinic_id
  name text not null,
  source text not null,            -- 'manipulacao_br' | 'dfh' | 'pure_encapsulations' | 'fullscript' | 'outro'
  country text not null,           -- 'BR' | 'US'
  sku text, buy_url text,          -- US: link de compra; BR: null
  default_dosage text, form text,  -- ex.: "1 cápsula", "pó"
  notes text, active bool default true,
  created_at, updated_at
)

-- recomendação por paciente
patient_supplement_recommendations (
  id uuid pk, clinic_id uuid fk not null, patient_id uuid fk not null,
  report_id uuid fk null,          -- liga ao Neuro ID 360 se houver
  status text not null default 'draft',   -- draft -> reviewed -> approved -> sent
  output_type text not null,       -- 'br_formula' | 'us_link'
  source_of_suggestion text,       -- 'ai' | 'manual'
  rationale_summary text,          -- resumo clínico (linguagem prudente)
  created_by uuid, reviewed_by uuid, approved_at timestamptz,
  created_at, updated_at
)

patient_supplement_recommendation_items (
  id uuid pk, recommendation_id uuid fk not null,
  catalog_id uuid fk null,         -- pode ser item livre
  name text not null, dosage text, timing text, duration text,
  rationale text,                  -- por que este item p/ este paciente
  buy_url text, source_country text,
  sort_order int default 0
)
```
**RLS:** toda tabela filtra por `clinic_id` (padrão do projeto). Itens herdam via `recommendation_id`.

## 4. Fluxo (com os gates)
1. Na ficha do paciente → aba **Suplementos** → "Gerar sugestão (IA)".
2. IA lê história + exames + medicação atual → cria **rascunho** (`status=draft`, `source_of_suggestion='ai'`) com itens + `rationale`.
3. **Revisão humana obrigatória** (reflete Salvo = segurança/interação medicamento×suplemento, e Aval = linguagem prudente): editar/remover/aprovar. Sem aprovação não sai nada.
4. Marcelo aprova → `status=approved` → gera saída:
   - `br_formula`: documento timbrado da clínica (fórmula manipulada).
   - `us_link`: lista com links de compra (DFH/PE).
5. Saída entra no **relatório Neuro ID 360 (Doc 3)** e/ou no **portal do paciente**.

## 5. IA — guarda-corpos (NÃO negociáveis)
- A IA **nunca** auto-aprova nem dispara ao paciente; só gera `draft`.
- Prompt deve checar **medicação atual** e sinalizar possíveis interações/contraindicações (refletir lógica do Salvo) e usar **linguagem prudente** ("pode estar associado / sugere / merece acompanhamento" — refletir Aval).
- Sem claim de cura/tratamento/substituição de medicamento.

## 6. UI (pontos de toque)
- **Config da clínica** (settings): CRUD do `supplement_catalog` + escolha de fontes (BR fórmula / US DFH-PE / Fullscript-futuro).
- **Ficha do paciente → aba Suplementos:** gerar (IA) · editar itens · aprovar · gerar saída (fórmula BR / links US) · anexar ao relatório.
- **Relatório 360:** seção Doc 3 puxa a recomendação aprovada.

## 7. Compliance (Termo/Selo)
- Disclaimer: "Uso profissional. Não substitui avaliação/medicação. Não trata nem cura."
- HIPAA/RLS por `clinic_id`; sem dado clínico fora do tenant.

## 8. Corte de escopo
- **MVP:** migrations + CRUD catálogo + builder de recomendação (manual) + saída fórmula BR / links US + seção no relatório 360. RLS + disclaimer.
- **MVP+ (mesma feature):** sugestão por IA (passos 1-3) com revisão humana.
- **Depois:** integração **Fullscript API** (link+margem+entrega sem estoque), billing recorrente, dashboard de **attach rate** (Margo).

## 9. Critérios de aceite
- [ ] Migrations rodam com RLS por `clinic_id`; testes de isolamento entre clínicas passam.
- [ ] Clínica cadastra catálogo (BR e US).
- [ ] Recomendação manual → saída fórmula BR (timbrada) **e** lista de links US.
- [ ] Recomendação aparece no relatório Neuro ID 360 (Doc 3).
- [ ] IA gera só rascunho; nada vai ao paciente sem aprovação humana.
- [ ] `/code-review --fix` limpo antes do commit.

## 10. Kickoff (cole isto ao abrir a sessão do Core)
> "Leia `CONTEXT.md` e este `_BRIEF_SUPLEMENTOS.md`. Implemente o **MVP** (seções 3-8, corte MVP). Comece pelas migrations com RLS, depois CRUD do catálogo, depois o builder de recomendação e as saídas (fórmula BR / links US), e por fim a seção no relatório 360. Pergunte só se houver decisão de produto ambígua. Ao terminar, rode `/code-review --fix`."
