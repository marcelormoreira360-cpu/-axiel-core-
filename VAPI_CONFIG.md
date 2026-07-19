# Vapi — Agendamento por voz da Clara

Configuração pronta para colar na UI do Vapi. O webhook fica em `POST /api/vapi`
do AXIEL Core, protegido pelo header `x-vapi-secret` (valor = `VAPI_TOOL_SECRET`).

> Troque `https://SEU_DOMINIO/api/vapi` pelo domínio de PRODUÇÃO do Core
> (o mesmo domínio onde o site de booking já roda) antes de salvar os Tools.
>
> O valor de `x-vapi-secret` abaixo (`COLE_AQUI_O_VAPI_TOOL_SECRET`) deve ser o
> mesmo `VAPI_TOOL_SECRET` que você colar no Vercel (Environment Variables).

---

## Tool 1 — check_availability

```json
{
  "type": "function",
  "function": {
    "name": "check_availability",
    "description": "Consulta os horários livres da clínica em um dia específico. Sempre chame esta função antes de oferecer horários ao paciente. Nunca invente horários.",
    "parameters": {
      "type": "object",
      "properties": {
        "date": {
          "type": "string",
          "description": "Data desejada no formato YYYY-MM-DD (ex.: 2026-07-21). Resolva datas relativas como 'amanhã' para YYYY-MM-DD usando a data atual da ligação."
        }
      },
      "required": ["date"]
    }
  },
  "server": {
    "url": "https://SEU_DOMINIO/api/vapi",
    "headers": {
      "x-vapi-secret": "COLE_AQUI_O_VAPI_TOOL_SECRET"
    }
  }
}
```

## Tool 2 — book_appointment

```json
{
  "type": "function",
  "function": {
    "name": "book_appointment",
    "description": "Agenda a consulta depois de confirmar os dados com o paciente. Só chame após repetir nome, telefone, data e hora e o paciente confirmar. A data deve ser YYYY-MM-DD e a hora HH:MM em formato 24h (hora local da clínica).",
    "parameters": {
      "type": "object",
      "properties": {
        "full_name": {
          "type": "string",
          "description": "Nome completo do paciente."
        },
        "phone": {
          "type": "string",
          "description": "Telefone de contato do paciente (com DDD/código do país se houver)."
        },
        "email": {
          "type": "string",
          "description": "E-mail do paciente (opcional)."
        },
        "date": {
          "type": "string",
          "description": "Data da consulta no formato YYYY-MM-DD (ex.: 2026-07-21)."
        },
        "time": {
          "type": "string",
          "description": "Horário da consulta em HH:MM 24h, hora local da clínica (ex.: 14:00)."
        }
      },
      "required": ["full_name", "phone", "date", "time"]
    }
  },
  "server": {
    "url": "https://SEU_DOMINIO/api/vapi",
    "headers": {
      "x-vapi-secret": "COLE_AQUI_O_VAPI_TOOL_SECRET"
    }
  }
}
```

---

## Trecho de system prompt para a Clara

Cole (ou adapte) dentro do system prompt do assistant do Vapi:

```
Você é a Clara, atendente de agendamento da IFWC. Fale de forma calorosa, breve e clara, no idioma do paciente (português, inglês ou espanhol).

Regras de agendamento (obrigatórias):
- Sempre chame a função check_availability ANTES de oferecer qualquer horário. Nunca invente ou suponha horários: ofereça só o que a função retornar.
- Resolva datas relativas ("hoje", "amanhã", "sexta que vem") para o formato YYYY-MM-DD usando a data atual da ligação.
- Antes de marcar, repita para o paciente confirmar: nome completo, telefone, data e hora. Só chame book_appointment depois do "sim" dele.
- Passe a hora para book_appointment sempre em HH:MM no formato 24h (ex.: 2 da tarde = 14:00), no horário local da clínica.
- Depois de agendar com sucesso, confirme em voz que ficou agendado e diga que a confirmação chega por mensagem.
- Se o horário tiver acabado de ser reservado (conflito), avise o paciente e ofereça consultar outros horários com check_availability.
- Não faça diagnóstico nem promessa de tratamento. Seu papel é agendar e acolher.
```

---

## Checklist de teste

- [ ] Agendar um horário livre (check_availability → escolher → confirmar dados → book_appointment) e ver a confirmação chegar por mensagem.
- [ ] Tentar um dia sem horários e confirmar que a Clara pede outra data.
- [ ] Conflito / horário ocupado: agendar o mesmo horário duas vezes e verificar que a segunda tentativa devolve a mensagem de "horário acabou de ser reservado".
- [ ] Data em formato errado (ex.: "21/07"): a Clara deve pedir no formato certo.
- [ ] Antes de qualquer paciente real: ativar HIPAA / BAA no Vapi (assinar o BAA e habilitar o modo de compliance na conta).
