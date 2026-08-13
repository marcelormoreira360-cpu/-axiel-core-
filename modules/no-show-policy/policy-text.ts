/**
 * Texto CANÔNICO e VERSIONADO da política de no-show / cancelamento tardio.
 *
 * Fonte: COMPLIANCE_Aceite_Politica_NoShow.md (Lex), seção 4.1. Este arquivo é o
 * ARQUIVO IMUTÁVEL do texto (seção 3.3): a `policy_version` gravada em
 * patient_consents recupera EXATAMENTE o texto que o paciente aceitou. Git dá a
 * imutabilidade e a data. Ao mudar o texto, criar uma NOVA versão (não editar a
 * antiga), para não invalidar a prova de aceites passados.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️ RASCUNHO — v1.0 pendente de aprovação.                                     │
 * │ Este texto é RASCUNHO. NÃO é cláusula contratual oficial e NÃO habilita       │
 * │ cobrança real. Antes de operar cobrança:                                      │
 * │   1. Marcelo aprova o texto v1.0.                                             │
 * │   2. Advogado humano licenciado (FL/FTC) valida a redação e a defensabilidade.│
 * │ Enquanto isso, o gate só CAPTURA e REGISTRA o aceite (não debita ninguém).    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * O texto usa o placeholder da janela de aviso: substituído pela janela real da
 * clínica (clinics.cancellation_window_hours, default 24) para não divergir do
 * sistema (risco MÉDIO sinalizado pelo Lex: texto x config divergentes).
 */

/** Versão vigente do texto. String estável; muda só quando o texto muda. */
export const NO_SHOW_POLICY_VERSION = "no_show_v1.0";

/** Status do texto. 'draft' até Marcelo + advogado humano aprovarem. */
export const NO_SHOW_POLICY_STATUS: "draft" | "approved" = "draft";

/** Idiomas para os quais existe texto arquivado. pt-BR e en são fallback. */
export type PolicyLang = "pt-BR" | "en" | "pt-PT" | "es";

type PolicyStrings = {
  /** Título curto (negrito no ponto de aceite). */
  title: string;
  /** Corpo curto exibido acima da caixa de aceite. `{hours}` = janela em horas. */
  body: string;
  /** Rótulo da caixa de aceite afirmativo (opt-in). */
  accept: string;
};

// Textos v1.0 — cópia fiel da seção 4.1 do documento do Lex. Sem travessão, sem
// claim de saúde, neutro e administrativo. Não editar sem versionar.
const V1_0: Record<PolicyLang, PolicyStrings> = {
  "pt-BR": {
    title: "Política de agendamento e cancelamento.",
    body:
      "Seu horário fica reservado só para você. Se precisar remarcar ou cancelar, pedimos aviso com pelo menos {hours} horas de antecedência. " +
      "Faltas sem aviso ou cancelamentos feitos com menos de {hours} horas podem incluir uma taxa, definida pela clínica (em geral um percentual do valor do serviço, com limite mínimo e máximo). " +
      "Na primeira vez, quando aplicável, é apenas um lembrete, sem cobrança. Cancelamentos dentro do prazo não têm nenhum custo. " +
      "Se surgir um imprevisto, fale com a gente, estamos aqui para ajudar.",
    accept: "Li e concordo com a política de agendamento e cancelamento.",
  },
  en: {
    title: "Scheduling and cancellation policy.",
    body:
      "Your appointment time is reserved just for you. If you need to reschedule or cancel, we ask for at least {hours} hours' notice. " +
      "Missed appointments with no notice, or cancellations made with less than {hours} hours' notice, may include a fee set by the clinic (usually a percentage of the service price, with a minimum and a maximum). " +
      "The first time, when it applies, is just a friendly reminder with no charge. Cancellations made within the window are always free. " +
      "If something comes up, reach out, we're happy to help.",
    accept: "I have read and agree to the scheduling and cancellation policy.",
  },
  "pt-PT": {
    title: "Política de marcação e cancelamento.",
    body:
      "O seu horário fica reservado apenas para si. Caso precise de remarcar ou cancelar, pedimos aviso com, no mínimo, {hours} horas de antecedência. " +
      "Faltas sem aviso, ou cancelamentos feitos com menos de {hours} horas, podem incluir uma taxa, definida pela clínica (habitualmente uma percentagem do valor do serviço, com um limite mínimo e máximo). " +
      "Da primeira vez, quando aplicável, é apenas um lembrete, sem qualquer cobrança. Cancelamentos dentro do prazo não têm qualquer custo. " +
      "Se surgir algum imprevisto, fale connosco, estamos aqui para ajudar.",
    accept: "Li e concordo com a política de marcação e cancelamento.",
  },
  es: {
    title: "Política de citas y cancelación.",
    body:
      "Su cita queda reservada solo para usted. Si necesita reprogramar o cancelar, le pedimos aviso con al menos {hours} horas de antelación. " +
      "Las ausencias sin aviso, o las cancelaciones hechas con menos de {hours} horas, pueden incluir un cargo definido por la clínica (por lo general un porcentaje del precio del servicio, con un mínimo y un máximo). " +
      "La primera vez, cuando corresponda, es solo un recordatorio, sin cobro. Las cancelaciones dentro del plazo no tienen ningún costo. " +
      "Si surge algún imprevisto, contáctenos, estamos aquí para ayudar.",
    accept: "He leído y acepto la política de citas y cancelación.",
  },
};

const VERSIONS: Record<string, Record<PolicyLang, PolicyStrings>> = {
  [NO_SHOW_POLICY_VERSION]: V1_0,
};

function normalizeLang(locale: string | null | undefined): PolicyLang {
  if (locale === "en") return "en";
  if (locale === "pt-PT") return "pt-PT";
  if (locale === "es") return "es";
  return "pt-BR";
}

/**
 * Texto da política para exibição, por idioma e janela de aviso da clínica.
 * `windowHours` substitui o placeholder {hours} (default 24). Retorna sempre a
 * versão VIGENTE (NO_SHOW_POLICY_VERSION) com a string de versão junto.
 */
export function getNoShowPolicyText(
  locale: string | null | undefined,
  windowHours = 24,
): { version: string; title: string; body: string; accept: string } {
  const lang = normalizeLang(locale);
  const strings = VERSIONS[NO_SHOW_POLICY_VERSION][lang];
  const hours = String(windowHours);
  return {
    version: NO_SHOW_POLICY_VERSION,
    title: strings.title,
    body: strings.body.replaceAll("{hours}", hours),
    accept: strings.accept,
  };
}
