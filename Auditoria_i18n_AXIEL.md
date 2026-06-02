# Auditoria de Internacionalização (i18n) — AXIEL Core

Data: 02/06/2026 · Escopo: implementação PT-BR/EN (next-intl)
Método: varredura estática do código (`app/`, `components/`, `modules/`, `services/`, `messages/`), checagem de paridade de chaves, compilação ICU, type-check confiável (`tsconfig.check.json`) e teste de formatação de mensagens em ambos os idiomas.

---

## 1. Sumário executivo

A base da i18n está **sólida e consistente**: 32 namespaces, 100% em paridade PT/EN, ICU compilando, 0 erros de tipo no código-fonte, e 82 renders de mensagens reais (com os mesmos parâmetros que o código passa) formatando corretamente em PT e EN.

A auditoria, porém, encontrou **um conjunto de áreas que nunca foram migradas** e que escaparam das fases anteriores — incluindo **3 rotas de PDF que estão em uso** e continuam gerando documentos em português mesmo para clínicas em inglês. Não são bugs que quebram o app, mas são **saídas visíveis ao usuário** que ficam fora do idioma escolhido.

Veredito: **infraestrutura aprovada; cobertura ~90%.** Faltam alguns módulos periféricos (admin, um seletor de formulário, e relatórios PDF legados) para chegar a 100%.

---

## 2. O que está sólido (verificado)

- **Cobertura central**: dashboard, pacientes, agenda, sessões, formulários, financeiro, results/relatórios/analytics, configurações, automações, portal do paciente, agendamento público, landing, pricing, jurídico, teleconsulta, e-mails transacionais, PDFs de relatório novos (pagamentos/pacientes/leads/sessões), exportações CSV/XLSX, Action Center (UI + conteúdo dinâmico via `content_key`).
- **Paridade**: 32 namespaces, 0 chave faltando em qualquer idioma.
- **ICU**: plurais, interpolação e markup compilam e renderizam corretos (validados PT+EN).
- **Tipos**: 0 erro com o type-check confiável (`npx tsc -p tsconfig.check.json --noEmit`).
- **Sem `ssr: false`** indevido em Server Components (regra do projeto respeitada).
- **Sem bugs de shadowing de tradutor** remanescentes: os padrões `.map((t)=>)` restantes ou não têm tradutor no escopo, ou só acessam propriedades do item (ex.: `track.stop()`), sem chamar `t()` dentro.

---

## 3. Achados (por severidade)

### 🟠 Média-alta — saídas visíveis fora do idioma

**3 rotas de PDF de relatório, EM USO, ainda em português:**

| Rota | Onde é chamada | Evidência |
|---|---|---|
| `app/api/reports/financeiro/route.ts` | `relatorios-client.tsx:16` (botão "Financeiro") | 9 literais PT + `toLocaleDateString("pt-BR")` + rodapé "Gerado em" |
| `app/api/reports/repasse/route.ts` | `relatorios-client.tsx:17` (botão "Repasse") | títulos/colunas PT + "Gerado em" |
| `app/api/reports/paciente/[id]/route.ts` | `app/patients/[id]/page.tsx:168` (baixar prontuário) | "Gerado em {data pt-BR}" + seções PT |

> Observação: existe sobreposição com a rota já migrada `app/api/finance/report/pdf` — vale conferir se `reports/financeiro` é duplicada/legada ou um relatório distinto. As três usam o mesmo `lib/pdf-report.ts` (que **já aceita `locale`**), então a migração é mecânica: resolver `locale` da clínica + trocar os literais por `t(...)` do namespace `pdf` (que já existe).

### 🟡 Média — telas inteiras não migradas

| Arquivo | Tipo | Evidência |
|---|---|---|
| `app/admin/audit/page.tsx` | Tela admin (log de auditoria) | 0 refs i18n; `toLocaleString("pt-BR")`, "Página X de Y · registros", "Nenhuma comunicação registrada" |
| `app/admin/plans/page.tsx` | Tela admin (planos) | 0 refs i18n |
| `app/patients/[id]/forms/new/page.tsx` | Seletor de template de formulário | 0 refs i18n; "Criar formulário", `t.name`/`t.description` do template em PT |

### 🟢 Baixa — datas pt-BR fixas fora de UI navegável

- `app/api/patients/export/route.ts` (CSV de pacientes — export, decisão semelhante à de CSV/XLSX).
- `app/api/automacoes/broadcast/route.ts` (título default de campanha — dado interno).
- `app/api/stripe/webhook/route.ts` (nota "Comprado online em…" — dado gravado, server).
- `app/schedule/[id]/session/actions.ts`, `app/api/health-agent/route.ts` (texto de **contexto para a IA** — intencional manter estável).

---

## 4. Exceções intencionais (não são gaps)

- **Glossário `getTerm`** (`modules/ui/terminology.ts`) — termos fixos EN (Session/Insight/Next Step) usados em `app/patients/[id]/page.tsx`, `clinical-insight.tsx`, `guided-ai-insights-panel.tsx` **e nos prompts de IA** (`modules/ai-insights/governance.ts`, `guardrails.ts`). Traduzir afeta a camada de IA + a regra de compliance `PROHIBITED_UI_TERMS`; manter EN é decisão de produto.
- **Conteúdo gerado por IA** (insights clínicos) — é dado, não UI.
- **Moeda BRL** — mantida por decisão (formatação via locale, símbolo R$).

---

## 5. Riscos de processo / operacional

1. **`npx tsc --noEmit` "puro" estava mascarado** por erro de parse no arquivo gerado `.next/dev/types/validator.ts` — ele reportava só esses erros e **não checava o código-fonte**. Use sempre `npx tsc -p tsconfig.check.json --noEmit` (criado nesta sessão) para validação confiável. **Recomendo manter no CI.**
2. **`next build` real ainda não rodou** neste ambiente (SWC linux indisponível no sandbox). É o selo final — rode localmente.
3. **Migration `050_action_suggestion_content.sql`** é dependência de deploy do Action Center dinâmico (já aplicada por você ✅).
4. **Teste de ponta a ponta no navegador** (seletor de idioma + cookie + render real) ainda recomendado.

---

## 6. Recomendações priorizadas

1. **(Média-alta)** Migrar as 3 rotas PDF (`reports/financeiro`, `reports/repasse`, `reports/paciente/[id]`) — mesmo padrão já aplicado nas outras rotas; ~1 sessão curta.
2. **(Média)** Migrar `app/admin/audit` e `app/admin/plans` (telas admin) + `app/patients/[id]/forms/new`.
3. **(Baixa)** Decidir CSV de export e datas internas (manter ou localizar).
4. **(Processo)** Adicionar ao CI: `tsc -p tsconfig.check.json` + o script de paridade/ICU; rodar `next build`.
5. Fechar a decisão sobre o glossário `getTerm` (manter EN é defensável).

---

## 7. Metodologia (o que foi checado)

- Inventário de namespaces × arquivos de mensagem (registro, par EN, órfãos).
- Paridade de chaves PT/EN e compilação ICU em todos os 32 namespaces.
- Type-check confiável (excluindo `.next`).
- Varredura de `toLocale*`/`Intl.*Format("pt-BR")` hardcoded em `app/` e `components/`.
- Varredura de shadowing `.map((t)=>)` / `.filter((t)` / `.forEach((t)`.
- Varredura de `ssr: false`.
- Rastreamento de `getTerm` (UI vs camada de IA).
- Teste de formatação de 82 mensagens reais (chave + params) em PT e EN.
