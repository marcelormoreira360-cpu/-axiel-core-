# Auditoria de Cobertura i18n — OXIEL Core (COMPLETA)

**Data:** 2026-08-18 · **Método:** análise estática (script Python) de **352 componentes `.tsx`** em `app/` `components/` `modules/` (excl. testes/.next/node_modules/worktrees). Sinais detectados: texto natural entre tags, literais em atributos (`placeholder/title/aria-label/alt/label`), `toast(...)`, `throw new Error(...)`. Falsos-positivos de tipo TS (`Promise<…>` etc.) filtrados.

> **Nota de integridade:** a 1ª versão desta auditoria (mesma data) reportou "~97% pronto / 0 texto cravado". **Estava errada** — filtrei linhas com `className`, escondendo a maior parte do texto inline. Esta versão corrige e substitui aquela conclusão.

## Veredito
De 352 componentes, **53 têm string cravada** (não passam pelo `t()`):
- **33 sem i18n nenhum** — provavelmente cravados por inteiro (prioridade alta).
- **20 com i18n, mas com resíduo** — 1–2 strings soltas (prioridade baixa).
- Ocorrências: **texto-JSX ~215 · atributos ~59 · toasts 3 · throw Error 14**.

**Isto é um mini-projeto real (~1–2 dias), não um polimento.** O pior problema não é volume, é **qualidade**: 5 componentes de tela clínica/paciente estão **inteiros em inglês**, o que quebra a experiência de quem usa em PT.

---

## TIER 1 — Inglês cravado em telas de paciente/clínica (CRÍTICO)
Quebram a promessa trilíngue: aparecem em inglês mesmo com a clínica em PT.
| Arquivo | Sinal |
|---|---|
| components/form-builder.tsx | componente inteiro |
| components/session-insight-generator.tsx | 13 |
| components/patient-snapshot.tsx | 13 |
| components/patient-offer-form.tsx | 11 |
| components/form-question-card.tsx | 7 |

## TIER 2 — PT cravado, alta exposição (paciente/público/onboarding/billing)
Funcionam em PT-BR, mas quebram em EN e pt-PT.
| Arquivo | Sinal |
|---|---|
| app/products/new/page.tsx | 14 |
| app/patients/[id]/products/page.tsx | 13 |
| app/communications/compose-modal.tsx | 10 |
| components/pwa-register.tsx | 6 |
| app/onboarding/ready/page.tsx · app/onboarding/page.tsx | 5 · 2 |
| components/booking-link-card.tsx | 5 |
| components/clinic-edit-form.tsx | 5 |
| components/form-invitation-panel.tsx · form-patient-picker.tsx | 5 · 3 |
| app/billing/success/page.tsx | 4 |
| components/communication-template-card.tsx | 4 |
| components/patient-intake-form.tsx | 3 |
| components/subscription-status-card.tsx | 3 |
| components/voice-dictation.tsx | 3 |

## TIER 3 — PT cravado, páginas de sistema/borda (menor exposição)
| Arquivo | Obs |
|---|---|
| **app/privacy/page.tsx (88)** | Página legal estática, enorme — tratar à parte (documento traduzido, não chaves inline) |
| app/offline/page.tsx · app/global-error.tsx | telas de erro/offline |
| app/profissionais/[id]/page.tsx | relatório de produtividade |
| app/products/orders/{new,page,order-charge-buttons} | módulo de pedidos |
| components/analytics/nps-trend-chart.tsx | gráfico |
| send-message-box · sign-out-button · copy-portal-link-card · results-export-button · results-chart | 1 string cada |

## TIER 4 — Resíduo (20 arquivos, 1–2 strings) — varredura rápida
whatsapp/conversation-client, app/page, patient-neuro-id-panel, prontuario/{page,print}, upgrade/page, portal/page, hotmart/page, financeiro/nfse, links-hub, pricing-client, mfa-settings, session-recording-panel, public-assessment-form, evolution-charts, patient-exams-panel, patient-treatment-followup-panel, session-type-list, dashboard-realtime-kpis, patient-portal/upcoming-appointments-section.

## Categoria transversal — `throw new Error("…")` em PT (14, prioridade BAIXA)
Guard-rails de Server Actions ("Clínica obrigatória", "Sem permissão." etc.). Traduzir só os que chegam à tela do usuário; o resto pode ficar como código interno.

---

## Plano de remediação sugerido (faseado)
- **Fase 1 (CRÍTICA) — Tier 1:** 5 componentes, matar o inglês nas telas clínicas/paciente. ~½ dia. **É o que eu faria primeiro.**
- **Fase 2 — Tier 2:** ~15 componentes de alta exposição. ~1 dia.
- **Fase 3 — Tier 3 + Tier 4 + throws:** limpeza final. ~½ dia. (Privacy tratada à parte.)

Cada componente deve ser internacionalizado **por inteiro** (texto + atributos + toasts juntos), reaproveitando namespaces existentes (`forms`, `products`, `patients`, `emails`, `whatsapp`, `common`…) e adicionando chaves nos 3 locales (en, pt-BR, pt-PT com localização real). Rodar `npm run typecheck` a cada fase.

## Método / limites
Detecção estática com heurística — pode ter falso-positivo pontual (revisar ao abrir cada arquivo) e não pega string montada dinamicamente por concatenação. Os números de "sinal" subestimam componentes totalmente cravados (só contam frases de 2+ palavras entre tags puras). Script: `scratchpad/i18n_audit.py`.
