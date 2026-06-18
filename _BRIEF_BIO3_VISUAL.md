# BRIEF — Bio³ visual: cores solto/tenso/bloqueado (Nucleo) + linguagem de conteúdo (Verbo)

> Transforma a escala solto/tenso/bloqueado num sistema de cor (semáforo) usado no app, no relatório e no marketing. Mesma cor em todo lugar = coesão de marca.

## Regra-mãe (semáforo)
Banda por valor de DISFUNÇÃO. Cor = banda. (Display ao paciente é equilíbrio = 100 − disfunção; a banda já reflete isso.)
| Banda | Item 0–10 | Eixo/Índice 0–100 (disfunção) | Equilíbrio | Cor | Ícone |
|---|---|---|---|---|---|
| **Solto** | 0–3 | ≤ 35 | ≥ 65 | verde-sálvia | ti-circle-check |
| **Tenso** | 4–6 | 36–65 | 35–64 | âmbar | ti-alert-triangle |
| **Bloqueado** | 7–10 | ≥ 66 | < 35 | terracota | ti-ban |

Rótulo por tipo de item (a banda/cor é a mesma; muda só a palavra):
- mobilidade/palpação → **solto / tenso / bloqueado**
- dor → leve / moderada / intensa
- QRM/Q-SNA/sintomas → baixo / moderado / alto
- **eixo inteiro** (assinatura da marca) → sempre **solto / tenso / bloqueado** ("seu eixo Bioemocional está *bloqueado*").

---

## A) NUCLEO — produto (AXIEL Core)
**Util compartilhado** (`modules/neuro-id/bands.ts`):
```
bandFor(dysfunction0to100) -> { key:'solto'|'tenso'|'bloqueado', color, icon }
// item 0–10: usa ×10 (≤3 solto, 4–6 tenso, ≥7 bloqueado)
// labelFor(key, itemType) resolve a palavra (solto/leve/baixo…)
```
**Onde a cor aparece:**
1. **Pirâmide:** cada tier colorido pela banda do eixo (não mais por rank). Mantém um tag pequeno "prioridade" no eixo de menor equilíbrio.
2. **Índice geral:** badge colorido pela banda do índice.
3. **Visão detalhada:** cada item de avaliação vira um chip com cor + label + ícone.
4. **PDF herói + evolução:** mesmas cores; na evolução, seta verde se a banda melhorou (ex.: bloqueado→tenso).

**Acessibilidade (obrigatório):** nunca só cor — sempre cor **+ rótulo de texto + ícone** (segurança p/ daltônico e impressão P&B).

**Cores (CSS vars / tokens; light → dark):**
- Solto: fill `#DCEBE0`/`#243A2B`, traço `#5E8C6A`/`#6FA77E`, texto `#3E6B4E`/`#C7E0CF`
- Tenso: fill `#F4E4C8`/`#5A4520`, traço `#C98A3C`, texto `#8A5A14`/`#EAC68A`
- Bloqueado: fill `#EFD7CC`/`#5A2E1C`, traço `#C2643C`, texto `#8A3216`/`#E9B79F`
(Alinhado à identidade: terracota é cor de marca; âmbar e verde-sálvia complementam.)

**Legenda:** uma linha discreta "solto · tenso · bloqueado" com as 3 cores, na tela e no PDF.

---

## B) VERBO — conteúdo/marketing
A escala **solto/tenso/bloqueado** é um presente viral: é semáforo, todo mundo entende em 1 segundo. Usar a MESMA cor do app (coesão).
- **EN (principal):** **Free · Tense · Blocked**. PT story: solto/tenso/bloqueado.
- **Gancho viral:** "Is your body free, tense, or blocked?" → autochecagem → Mapa Bio³.
- **Reformatar o carrossel "Which Bio is yours?":** cada Bio com seu semáforo (free/tense/blocked) → "your blocked Bio is where we start".
- **Reel-conceito:** mostrar os 3 estados (solto→tenso→bloqueado) num movimento/imagem; CTA pra avaliação.
- **Carrossel educativo:** "3 estados do seu corpo" — o que cada um significa e o que fazer.
- **Coerência:** mesma paleta (verde/âmbar/terracota) e mesmos ícones do app em todas as peças (Canva, identidade oficial).
- Ética: sem promessa de cura; "blocked" descreve estado funcional, não doença.

> Nucleo implementa A na sessão do repo (entra junto com o ajuste do `_BRIEF_BIO3_AJUSTE_PILARES.md`). Verbo usa B na série Bio³ (peças prontas em [[plano-anual-conteudo]]).
