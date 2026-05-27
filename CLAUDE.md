# AXIEL Core — Instruções para o Agente

## ⚠️ Leia isto PRIMEIRO em toda nova sessão

Antes de qualquer outra coisa, leia o arquivo de contexto do projeto:

```
CONTEXT.md
```

Ele contém: visão geral do sistema, estado atual, arquivos mais importantes, padrões obrigatórios de código, tabelas do banco e decisões técnicas já tomadas.

---

## Localização do projeto

- **Código**: `/Users/marcelorodriguesmoreira/Documents/JIFWC/AI-powered integrative clinic system/AXIEL_Core_Work/`
- **Obsidian vault**: `/Users/marcelorodriguesmoreira/Documents/JIFWC/AI-powered integrative clinic system/AXIEL_Obsidian/`
- **Contexto rápido**: `CONTEXT.md` (na raiz do projeto)

---

## Comportamento esperado

- Responda sempre em **português brasileiro**
- Siga os padrões obrigatórios documentados em `CONTEXT.md` sem questionar
- Ao finalizar uma sessão de trabalho significativa, atualize `CONTEXT.md` e o vault Obsidian em `../AXIEL_Obsidian/`
- Prefira editar arquivos existentes a criar novos
- Nunca use `ssr: false` em Server Components com `next/dynamic`
- Nunca reverta decisões listadas em `CONTEXT.md` sem motivo técnico justificado

---

## 🔁 Após qualquer implementação de feature

Sempre que terminar de implementar código (nova feature, fix, refactor), lembre o usuário:

> 💡 **Rode agora:** `/code-review --fix` para o review completo com IA antes do commit.

---

## ⚡ Tarefas longas — background automático

Antes de começar qualquer tarefa que envolva **2 ou mais arquivos novos**, **um módulo completo**, ou **integração com serviço externo**, avise o usuário e sugira background:

> 🔄 **Esta tarefa é longa. Para rodar em background enquanto você faz outra coisa, use:**
> ```bash
> claude "DESCRIÇÃO_EXATA_DA_TAREFA" &
> ```
> Ou continue aqui e eu foco só nisso agora.

Aguarde a resposta do usuário antes de começar.
