# Plano Técnico — Internacionalização (i18n) PT/EN do AXIEL Core

> Status: **proposta para aprovação** · Criado em 01/06/2026
> Objetivo: app **bilíngue PT-BR + EN**, com troca de idioma pelo usuário, mantendo o português existente.

---

## 1. Diagnóstico atual

| Item | Estado |
|------|--------|
| Biblioteca i18n | ❌ Nenhuma instalada |
| Arquivos `.tsx` com texto PT hardcoded | ~206 de 399 |
| Rotas | Nomeadas em PT (`/assinaturas`, `/financeiro`, `/automacoes`…), **sem** segmento `[locale]` |
| `<html lang>` | Fixo em `pt-BR` (`app/layout.tsx`) |
| Middleware | Trata auth Supabase + MFA + admin; **não** trata idioma |
| Preferência de idioma do usuário | ❌ Não existe coluna na tabela `users` |
| Bot WhatsApp | ✅ Já bilíngue PT/EN com auto-detecção (referência de tom de tradução) |

---

## 2. Decisão arquitetural central

### next-intl **sem locale na URL** (cookie + preferência no banco)

O padrão mais comum do next-intl usa segmento de rota `[locale]` (`/pt/dashboard`, `/en/dashboard`), o que exigiria **mover todas as ~50 pastas de rota para dentro de `app/[locale]/`** e reescrever todos os `<Link>`, `redirect()` e o middleware. Para um SaaS logado (não um site de marketing que precisa de SEO por idioma), isso é custo alto sem benefício real.

**Recomendação:** usar o modo do next-intl **sem roteamento por locale**. O idioma é resolvido por:

1. Preferência salva no usuário (`users.preferred_locale`) — fonte da verdade para usuário logado
2. Cookie `AXIEL_LOCALE` — para áreas públicas (booking, portal, landing) e antes do login
3. Fallback: header `Accept-Language` → `pt-BR` como padrão final

**Benefícios:** zero reestruturação de rotas, compõe com o middleware atual, funciona em Server Components (RSC) e Client Components, base pronta para um 3º idioma no futuro (ex.: ES).

**Trade-off aceito:** as URLs não carregam o idioma. As páginas públicas (landing/booking) não terão URL única por idioma para SEO. Se isso virar requisito comercial depois, dá para adicionar `[locale]` só na árvore pública — fora do escopo deste plano.

---

## 3. Estrutura de pastas proposta

```
i18n/
  request.ts            # getRequestConfig do next-intl (resolve locale + carrega mensagens)
  locales.ts            # const locales = ["pt-BR","en"]; defaultLocale
  get-locale.ts         # resolve locale: user.preferred_locale > cookie > Accept-Language > default
messages/
  pt-BR/
    common.json         # botões, ações, status genéricos
    nav.json            # sidebar + mobile nav
    auth.json           # login, signup, MFA
    dashboard.json
    patients.json
    schedule.json
    forms.json
    billing.json
    results.json
    settings.json
    ... (1 namespace por módulo)
  en/
    (mesma estrutura, espelhada)
components/
  locale-provider.tsx   # espelha o padrão do ThemeProvider (client context + cookie)
  language-switcher.tsx  # dropdown PT/EN; salva no banco + cookie
```

Mensagens em **namespaces por módulo** (não um JSON gigante) para reduzir conflito de merge e permitir migração incremental módulo a módulo.

---

## 4. Banco de dados

**Migration nova `049_user_preferred_locale.sql`:**

```sql
alter table public.users
  add column if not exists preferred_locale text not null default 'pt-BR'
  check (preferred_locale in ('pt-BR','en'));
```

- Default `pt-BR` → nenhum usuário existente muda de idioma na entrada (zero regressão).
- Atualizada pelo `LanguageSwitcher` via Server Action.
- Segue padrão de migrations do projeto (última aplicada = 047; 048_waitlist pendente — **confirmar ordem antes de aplicar**).

---

## 5. Mudanças de infraestrutura (núcleo)

1. **Instalar** `next-intl` (compatível com Next 16 / React 19).
2. **`i18n/request.ts`** — `getRequestConfig` que chama `get-locale.ts` e carrega os JSONs do locale resolvido.
3. **`next.config.ts`** — adicionar o plugin `createNextIntlPlugin('./i18n/request.ts')` envolvendo o config atual (preservando Sentry + headers/CSP).
4. **`app/layout.tsx`** — `lang` dinâmico via `getLocale()`; envolver children em `<NextIntlClientProvider>` ao lado do `ThemeProvider`.
5. **`middleware.ts`** — **não** trocar pelo middleware do next-intl (quebraria auth). Apenas: ler/definir o cookie `AXIEL_LOCALE` quando ausente, preservando 100% da lógica de auth/MFA/admin atual.
6. **`LanguageSwitcher`** — Server Action que grava `users.preferred_locale` + seta cookie + `revalidatePath`.

---

## 6. Padrão de uso (a documentar no CONTEXT.md)

**Server Component:**
```tsx
import { getTranslations } from "next-intl/server";
const t = await getTranslations("dashboard");
return <h1>{t("greeting", { name })}</h1>;
```

**Client Component:**
```tsx
"use client";
import { useTranslations } from "next-intl";
const t = useTranslations("patients");
return <button>{t("save")}</button>;
```

Datas/números via `date-fns` (já no projeto) com locale por idioma; valores monetários via `Intl.NumberFormat`.

---

## 7. Estratégia de migração das ~206 telas (faseada)

A infra (fases 1–2) é o que destrava tudo. A tradução de strings é volume e será **incremental, módulo a módulo**, cada um testável e commitável isoladamente.

| Fase | Escopo | Entregável |
|------|--------|-----------|
| **1. Fundação** | next-intl + i18n/*, layout, middleware cookie, migration 049, LocaleProvider, LanguageSwitcher | Troca de idioma funciona; 1 tela piloto (Dashboard) 100% traduzida |
| **2. Navegação + base** | `sidebar-nav`, `mobile-bottom-nav`, `common.json`, auth (login/MFA) | App "esqueleto" bilíngue |
| **3. Módulos núcleo** | Pacientes, Agenda, Sessões | Fluxo clínico principal bilíngue |
| **4. Módulos secundários** | Formulários, Financeiro, Results, Settings, Automações | Cobertura quase total |
| **5. Áreas públicas** | Landing, Booking, Portal do paciente (usa cookie/Accept-Language) | Externo bilíngue |
| **6. E-mails/PDF** | React Email templates, prontuário PDF, notificações | Comunicações no idioma do destinatário |

**Método por arquivo:** extrair strings PT → `messages/pt-BR/<modulo>.json` → traduzir para `messages/en/<modulo>.json` → substituir literais por `t("chave")`. Tradução EN revisada (tom clínico/profissional, alinhado ao bot bilíngue existente).

---

## 8. Riscos e mitigações

- **Hidratação (React #418/#425):** locale resolvido no servidor e passado ao client provider — nunca derivar de `localStorage` no primeiro render. Segue o cuidado já adotado no `DashboardGreeting`.
- **Middleware:** risco de quebrar auth se trocado pelo do next-intl. Mitigação: manter o middleware atual, só anexar cookie de locale.
- **CSP / Sentry no `next.config`:** o plugin do next-intl deve **envolver** o config, mantendo `withSentryConfig` por fora e os headers intactos.
- **Volume (206 arquivos):** faseamento + namespaces evitam um PR gigante; cada módulo é um commit testável.
- **Strings dinâmicas vindas do banco** (nomes de planos, status): decidir caso a caso se traduz na UI (mapa de chaves) ou se permanece como dado.

---

## 9. Verificação por fase

- `npm run build` + `tsc` sem erros após cada fase.
- Teste manual: alternar PT↔EN e validar persistência (reload + novo login).
- Checagem de strings órfãs: script `grep` por texto acentuado remanescente no módulo migrado.
- Smoke test das telas críticas (login, dashboard, agenda, criar paciente) nos dois idiomas.

---

## 10. O que **não** está neste escopo

- URLs por idioma (`/en/...`) e SEO multilíngue.
- Tradução de conteúdo gerado por IA (Health Agent) — fica no idioma do paciente, tratado à parte.
- Terceiro idioma (ES) — a arquitetura suporta, mas não será implementado agora.

---

## Próximo passo

Aprovar este plano → começo pela **Fase 1 (Fundação)** e entrego a troca de idioma funcionando com o Dashboard como piloto, para validação antes de seguir para os demais módulos.
