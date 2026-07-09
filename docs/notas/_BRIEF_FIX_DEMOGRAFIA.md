# BRIEF — Fix: demografia do paciente (fonte única) + alinhar legenda Bio³

> Bug: relatórios (AI Insight Doc 1, e o bloco do paciente em geral) mostram Idade/Sexo/Peso/Altura/Local = "não informado". Causa: campos não existem/não são capturados. Princípio do fix: FONTE ÚNICA — demografia mora em `patients`, preenchida 1x, lida por todos os geradores.
> Times: Forja (dados/migration) + Nucleo (UI + geradores). Ler CONTEXT.md.

## 1. Diagnóstico (verificado)
`public.patients` tem: `full_name`, `email`, `phone`, `date_of_birth`, `city`, `status`, `notes`. **NÃO tem** `sex`, `weight`, `height`. A **idade não é derivada** de `date_of_birth`. Geradores (`services/ai-insight-service.ts`, `services/insight-pdf-service.ts`) imprimem "não informado" quando o dado não existe.
- Nome ("teste Day") está correto — vem de `full_name`. Não é bug.

## 2. Fix — fonte única (patients = verdade)
1. **Migration (Forja):** `alter table patients add column if not exists sex text, weight_kg numeric, height_cm numeric;` (date_of_birth e city já existem). RLS já vale.
2. **Idade derivada:** calcular idade a partir de `date_of_birth` em runtime (helper `ageFromDob`). Nunca armazenar idade fixa.
3. **UI de captura (Nucleo):** campos editáveis no **perfil do paciente** (no bloco de dados / "Editar"): data de nascimento, sexo, peso, altura, cidade. Um lugar só.
4. **Intake escreve de volta:** se o intake/anamnese coletar demografia, faz **upsert no `patients`** (não cria cópia paralela). Assim "preencheu no questionário → corrige no cadastro → vale em todo o sistema".
5. **Geradores leem do cadastro:** `ai-insight-service`, `insight-pdf-service` e o Bio³ puxam `full_name`, idade(dob), `sex`, `weight_kg`, `height_cm`, `city` de `patients`. "Não informado" só quando realmente vazio.
6. **Regenerar usa dado atual:** ao gerar/regerar relatório, reler o cadastro (não congelar valores antigos).

## 3. Alinhar legenda Bio³ (decisão Marcelo: ALINHAR)
Em `services/neuro-id-pdf-service.ts`:
- `band()` (linha ~55): trocar `"em grande disfunção e desequilíbrio (possíveis crises agudas)"` → `"em grande disfunção e desequilíbrio (pede cuidado prioritário)"`.
- Linha de legenda do PDF (~216): trocar `"70–100 grande disfunção (Bloqueado)"` mantém; remover qualquer "crises agudas" remanescente.
- Objetivo: legenda consistente com a narrativa suavizada do Beat 6 (sem prognóstico médico).

## 4. Aceite
- [ ] `patients` com `sex`, `weight_kg`, `height_cm`; perfil do paciente edita demografia num só lugar.
- [ ] Idade derivada de `date_of_birth`.
- [ ] Preencher 1x → aparece no Doc 1 (AI Insight), no Bio³ e em qualquer relatório.
- [ ] Intake faz upsert no `patients` (sem duplicar).
- [ ] Legenda Bio³ sem "crises agudas".
- [ ] Testes verdes.

## 5. Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md e _BRIEF_FIX_DEMOGRAFIA.md. (1) Migration: add em patients sex text, weight_kg numeric, height_cm numeric (RLS já vale). (2) Helper ageFromDob (idade derivada de date_of_birth). (3) UI: editar data de nascimento, sexo, peso, altura, cidade no perfil do paciente — fonte única. (4) Faça o intake/anamnese escrever esses campos de volta no patients (upsert), sem duplicar. (5) ai-insight-service, insight-pdf-service e o Bio³ devem LER full_name/idade/sexo/peso/altura/cidade do cadastro do paciente; 'não informado' só quando vazio; regenerar relê o cadastro. (6) Alinhe a legenda em neuro-id-pdf-service.ts: 'possíveis crises agudas' → 'pede cuidado prioritário'. Atualize testes e deixe verde. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."
