/**
 * Texto CANONICO e VERSIONADO da politica de agendamento / cancelamento / no-show.
 *
 * Este arquivo e o ARQUIVO IMUTAVEL do texto: a `policy_version` gravada em
 * public.patient_consents recupera EXATAMENTE o texto que o paciente aceitou. O git
 * da a imutabilidade e a data. Ao mudar o texto, cria-se uma NOVA versao (nunca se
 * edita a antiga), para nao invalidar a prova de aceites passados.
 *
 * HISTORICO DE VERSOES
 *   no_show_v1.0  (superseded)  Texto enxuto, aprovado por Marcelo em 2026-08-13.
 *                               Arquivado abaixo (V1_0_ARCHIVED) so por rastreio; ainda
 *                               nao houve aceite em producao nessa versao.
 *   no_show_v3.0  (approved)    DOCUMENTO COMPLETO multi-secao. Vigente.
 *
 * APROVACAO DA v3.0 (registro honesto):
 *   Aprovado por Marcelo em 2026-08-13, com base em consultoria juridica online feita
 *   por ele proprio. O sign-off de um advogado licenciado (FL/FTC) foi DISPENSADO por
 *   decisao expressa de Marcelo, que assume o risco. Nao houve revisao por advogado
 *   humano licenciado. Mesmo assim, o gate apenas CAPTURA e REGISTRA o aceite; a
 *   cobranca ao paciente segue MANUAL (nenhum debito automatico).
 *
 * PLACEHOLDERS DINAMICOS (ligados a config da clinica, para o texto nunca divergir do
 * sistema; risco apontado pelo Lex): {window_hours} = cancellation_window_hours,
 * {late_pct} = late_cancel_fee_percent, {no_show_pct} = no_show_fee_percent,
 * {clinic_name} = razao social da clinica (clinics.legal_entity_name, com fallback em
 * clinics.name). Quando um tipo de taxa esta em modo 'none', a clausula daquele tipo e
 * OMITIDA do documento (ver `chargeable` na config do renderer), para nunca mostrar taxa
 * que a clinica nao cobra.
 *
 * TEMPLATIZACAO DO NOME DA ENTIDADE (decisao honesta de versionamento):
 *   A v3.0 nasceu com "{clinic_name}" fixo (clinica IFWC). Para o produto vender a
 *   OUTRAS clinicas, o nome legal virou o placeholder {clinic_name}. Mantivemos a versao
 *   como no_show_v3.0 (nao criamos v3.1) porque: (a) o nome da entidade e um DADO da
 *   clinica, ligado a config, exatamente como {window_hours}/{late_pct} ja eram, entao o
 *   que e versionado e o TEMPLATE, nao o valor injetado; (b) para a IFWC, com
 *   legal_entity_name = "{clinic_name}", o texto renderizado fica BYTE A BYTE
 *   igual ao anterior; (c) o gate de consentimento v3.0 ainda NAO foi para producao, logo
 *   nao existe nenhum aceite arquivado nessa versao a invalidar. Se um dia houver aceite
 *   em campo e o template mudar de forma substantiva, ai sim cria-se v3.1/v4.0.
 */

/** Status editorial do texto. */
export type PolicyStatus = "draft" | "approved" | "superseded";

/** Versao vigente do texto. String estavel; muda so quando o texto muda. */
export const NO_SHOW_POLICY_VERSION = "no_show_v3.0";

/** Status do texto vigente. 'approved' por decisao de Marcelo (sem advogado humano). */
export const NO_SHOW_POLICY_STATUS: PolicyStatus = "approved";

/** Idiomas para os quais existe texto arquivado. pt-BR e fallback. */
export type PolicyLang = "pt-BR" | "en" | "pt-PT" | "es";

// ── Modelo de dados do DOCUMENTO (com placeholders, antes de renderizar) ─────────

/** Clausula opcional a que um trecho pertence; se o modo estiver 'none', o trecho sai. */
type Clause = "late" | "no_show";

/** Uma linha de lista; pode ter sub-linhas (um nivel de aninhamento). */
type PolicyLine = { text: string; clause?: Clause; sub?: PolicyLine[] };

/** Bloco de conteudo de uma secao. */
type PolicyBlock =
  | { kind: "text"; text: string; clause?: Clause }
  | { kind: "label"; text: string; clause?: Clause }
  | { kind: "list"; items: PolicyLine[] };

/** Uma secao do documento (titulo + blocos). */
type PolicySection = { heading: string; blocks: PolicyBlock[] };

/** O documento inteiro, por idioma, ainda com placeholders. */
type PolicyDocument = {
  title: string;
  intro: string;
  sections: PolicySection[];
  /** Rotulo da caixa de aceite afirmativo (opt-in). */
  checkboxLabel: string;
  /** Linha explicativa logo abaixo da caixa. */
  checkboxNote: string;
};

// ── Modelo RENDERIZADO (placeholders resolvidos, clausulas filtradas) ────────────

export type RenderedPolicyLine = { text: string; sub?: RenderedPolicyLine[] };
export type RenderedPolicyBlock =
  | { kind: "text"; text: string }
  | { kind: "label"; text: string }
  | { kind: "list"; items: RenderedPolicyLine[] };
export type RenderedPolicySection = { heading: string; blocks: RenderedPolicyBlock[] };

export type RenderedNoShowPolicy = {
  version: string;
  status: PolicyStatus;
  title: string;
  intro: string;
  sections: RenderedPolicySection[];
  checkboxLabel: string;
  checkboxNote: string;
};

/** Config vinda da clinica para resolver placeholders e omitir clausulas 'none'. */
export type NoShowPolicyConfig = {
  /** cancellation_window_hours (default 24). */
  windowHours?: number;
  /** late_cancel_fee_percent (ex.: 50). */
  latePct?: number | null;
  /** no_show_fee_percent (ex.: 100). */
  noShowPct?: number | null;
  /** false quando late_cancel_fee_mode = 'none' -> omite a clausula de cancelamento tardio. */
  lateChargeable?: boolean;
  /** false quando no_show_fee_mode = 'none' -> omite a clausula de no-show. */
  noShowChargeable?: boolean;
  /**
   * Nome legal da clinica que preenche {clinic_name} (clinics.legal_entity_name, com
   * fallback em clinics.name). Quando ausente/vazio, cai num rotulo generico por idioma
   * (ver GENERIC_CLINIC_NAME) so para o texto nao ficar quebrado — na pratica os
   * call-sites sempre passam o nome real (clinics.name nunca e nulo).
   */
  clinicName?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────────
// v3.0 — DOCUMENTO COMPLETO. Texto EN canonico do .docx aprovado; pt-BR/pt-PT/es sao
// traducoes fieis (tom formal-cordial, sem travessao, sem claim clinico). Nao editar
// sem versionar (criar v4.0). O nome da entidade sai por {clinic_name} em todos os
// idiomas (era "{clinic_name}" fixo; ver nota de templatizacao no topo do arquivo).
// ─────────────────────────────────────────────────────────────────────────────────

const V3_0_EN: PolicyDocument = {
  title: "Appointment Scheduling & Cancellation Policy",
  intro:
    "At {clinic_name}, we reserve each appointment exclusively for you. The time scheduled for your visit is dedicated solely to your care and is generally unavailable to other patients once reserved. If you need to cancel or reschedule, we kindly ask that you provide advance notice so that we may offer the appointment to another patient.",
  sections: [
    {
      heading: "Cancellation and Rescheduling Policy",
      blocks: [
        { kind: "label", text: "Cancellation or Rescheduling:" },
        {
          kind: "list",
          items: [
            { text: "{window_hours} hours or more before the scheduled appointment: No fee." },
            {
              clause: "late",
              text:
                "Less than {window_hours} hours before the scheduled appointment: A Late Cancellation Fee equal to {late_pct}% of the scheduled service may be assessed.",
            },
          ],
        },
        { kind: "label", clause: "no_show", text: "No-Show:" },
        {
          kind: "text",
          clause: "no_show",
          text:
            "A No-Show occurs when a patient fails to attend a scheduled appointment without providing prior notice. A No-Show Fee equal to {no_show_pct}% of the scheduled service may be assessed.",
        },
        {
          kind: "text",
          text:
            "These fees are intended to compensate the Clinic for appointment time reserved exclusively for the patient that could not reasonably be offered to another patient.",
        },
      ],
    },
    {
      heading: "Exceptions",
      blocks: [
        {
          kind: "text",
          text: "We understand that unexpected situations and genuine emergencies may occur. Accordingly:",
        },
        {
          kind: "list",
          items: [
            { text: "The Clinic reviews each late cancellation and no-show individually." },
            {
              text:
                "The first late cancellation or no-show may be waived, at the sole discretion of the Clinic, when supported by a documented emergency or other exceptional circumstances.",
            },
            {
              text:
                "Any waiver is a courtesy only and shall not constitute a modification of this policy or create any expectation that future fees will be waived.",
            },
          ],
        },
      ],
    },
    {
      heading: "Review Before Assessment",
      blocks: [
        {
          kind: "text",
          text:
            "{clinic_name} does not automatically assess cancellation or no-show fees. Before any fee is assessed:",
        },
        {
          kind: "list",
          items: [
            { text: "each case is individually reviewed by an authorized member of the Clinic;" },
            { text: "the circumstances surrounding the missed appointment are considered;" },
            {
              text:
                "the Clinic determines, in its sole professional discretion, whether the fee will be assessed or waived.",
            },
          ],
        },
        { kind: "text", text: "No cancellation or no-show fee is generated solely through an automated process." },
      ],
    },
    {
      heading: "Acknowledgment and Agreement",
      blocks: [
        { kind: "text", text: "By scheduling an appointment, I acknowledge and agree that:" },
        {
          kind: "list",
          items: [
            { text: "I have received, read, and understand this Appointment Scheduling & Cancellation Policy." },
            { text: "I understand the Clinic's cancellation requirements." },
            {
              text: "I understand that:",
              sub: [
                {
                  text:
                    "cancellations or rescheduling made {window_hours} hours or more before the appointment are not subject to any fee;",
                },
                {
                  clause: "late",
                  text:
                    "cancellations or rescheduling made less than {window_hours} hours before the appointment may result in a fee equal to {late_pct}% of the scheduled service;",
                },
                {
                  clause: "no_show",
                  text:
                    "failure to attend a scheduled appointment without prior notice (No-Show) may result in a fee equal to {no_show_pct}% of the scheduled service.",
                },
              ],
            },
            { text: "I understand that every cancellation or no-show is reviewed individually by the Clinic before any fee is assessed." },
            { text: "I understand that the Clinic may waive any fee, in whole or in part, at its sole discretion." },
            {
              text:
                "I understand that this acknowledgment creates my contractual agreement to comply with this policy for this appointment and for future appointments unless I am notified of an updated policy.",
            },
            {
              text:
                "I understand that this acknowledgment does not authorize the Clinic to charge any specific payment method or payment card. Any future authorization to charge a payment card stored on file, if offered by the Clinic, will require a separate Card-on-File Authorization.",
            },
          ],
        },
      ],
    },
    {
      heading: "Electronic Consent",
      blocks: [
        {
          kind: "text",
          text:
            "For appointments scheduled electronically, the Clinic maintains an electronic audit record of the patient's acceptance, which may include: Patient identification; Appointment identification; Policy version accepted; Language presented to the patient; Date and time of acceptance (UTC); IP address; Browser and device information (User-Agent), when available; Confirmation e-mail and/or SMS transaction record, when available.",
        },
        {
          kind: "text",
          text:
            "These records are maintained as part of the Clinic's business records and may be used to demonstrate acceptance of this policy in connection with billing inquiries, payment disputes, contractual disputes, chargeback proceedings, or other legal or administrative matters.",
        },
      ],
    },
  ],
  checkboxLabel:
    "I acknowledge that I have read, understood, and agree to the Appointment Scheduling & Cancellation Policy.",
  checkboxNote:
    "By selecting this checkbox, I voluntarily acknowledge that I have had the opportunity to review this policy before scheduling my appointment and that I agree to be bound by its terms.",
};

const V3_0_PT_BR: PolicyDocument = {
  title: "Política de Agendamento e Cancelamento",
  intro:
    "Na {clinic_name}, reservamos cada atendimento exclusivamente para você. O horário marcado para a sua consulta é dedicado unicamente ao seu cuidado e, uma vez reservado, em geral fica indisponível para outros pacientes. Se precisar cancelar ou remarcar, pedimos gentilmente que avise com antecedência, para que possamos oferecer o horário a outro paciente.",
  sections: [
    {
      heading: "Política de Cancelamento e Remarcação",
      blocks: [
        { kind: "label", text: "Cancelamento ou Remarcação:" },
        {
          kind: "list",
          items: [
            { text: "{window_hours} horas ou mais antes do horário marcado: sem taxa." },
            {
              clause: "late",
              text:
                "Menos de {window_hours} horas antes do horário marcado: poderá ser aplicada uma Taxa de Cancelamento Tardio equivalente a {late_pct}% do serviço agendado.",
            },
          ],
        },
        { kind: "label", clause: "no_show", text: "Falta (No-Show):" },
        {
          kind: "text",
          clause: "no_show",
          text:
            "Considera-se falta quando o paciente não comparece a um atendimento marcado sem aviso prévio. Poderá ser aplicada uma Taxa de Falta equivalente a {no_show_pct}% do serviço agendado.",
        },
        {
          kind: "text",
          text:
            "Essas taxas destinam-se a compensar a Clínica pelo horário de atendimento reservado exclusivamente ao paciente que, razoavelmente, não pôde ser oferecido a outro paciente.",
        },
      ],
    },
    {
      heading: "Exceções",
      blocks: [
        {
          kind: "text",
          text: "Entendemos que situações inesperadas e emergências genuínas podem ocorrer. Assim sendo:",
        },
        {
          kind: "list",
          items: [
            { text: "A Clínica analisa individualmente cada cancelamento tardio e cada falta." },
            {
              text:
                "O primeiro cancelamento tardio ou a primeira falta poderá ser dispensado, a exclusivo critério da Clínica, quando amparado por emergência documentada ou outras circunstâncias excepcionais.",
            },
            {
              text:
                "Qualquer dispensa é apenas uma cortesia e não constitui alteração desta política nem cria qualquer expectativa de que taxas futuras serão dispensadas.",
            },
          ],
        },
      ],
    },
    {
      heading: "Análise Antes da Cobrança",
      blocks: [
        {
          kind: "text",
          text:
            "A {clinic_name} não aplica automaticamente taxas de cancelamento ou de falta. Antes de qualquer taxa ser aplicada:",
        },
        {
          kind: "list",
          items: [
            { text: "cada caso é analisado individualmente por um membro autorizado da Clínica;" },
            { text: "são consideradas as circunstâncias que envolveram o atendimento perdido;" },
            {
              text:
                "a Clínica decide, a seu exclusivo critério profissional, se a taxa será aplicada ou dispensada.",
            },
          ],
        },
        { kind: "text", text: "Nenhuma taxa de cancelamento ou de falta é gerada apenas por um processo automatizado." },
      ],
    },
    {
      heading: "Reconhecimento e Concordância",
      blocks: [
        { kind: "text", text: "Ao agendar um atendimento, eu reconheço e concordo que:" },
        {
          kind: "list",
          items: [
            { text: "Recebi, li e compreendi esta Política de Agendamento e Cancelamento." },
            { text: "Compreendo as exigências de cancelamento da Clínica." },
            {
              text: "Compreendo que:",
              sub: [
                {
                  text:
                    "cancelamentos ou remarcações feitos com {window_hours} horas ou mais de antecedência não estão sujeitos a qualquer taxa;",
                },
                {
                  clause: "late",
                  text:
                    "cancelamentos ou remarcações feitos com menos de {window_hours} horas de antecedência podem resultar em uma taxa equivalente a {late_pct}% do serviço agendado;",
                },
                {
                  clause: "no_show",
                  text:
                    "o não comparecimento a um atendimento marcado sem aviso prévio (Falta) pode resultar em uma taxa equivalente a {no_show_pct}% do serviço agendado.",
                },
              ],
            },
            { text: "Compreendo que todo cancelamento ou falta é analisado individualmente pela Clínica antes de qualquer taxa ser aplicada." },
            { text: "Compreendo que a Clínica pode dispensar qualquer taxa, no todo ou em parte, a seu exclusivo critério." },
            {
              text:
                "Compreendo que este reconhecimento cria minha concordância contratual em cumprir esta política para este atendimento e para atendimentos futuros, salvo se eu for notificado de uma política atualizada.",
            },
            {
              text:
                "Compreendo que este reconhecimento não autoriza a Clínica a cobrar qualquer meio de pagamento ou cartão específico. Qualquer autorização futura para cobrar um cartão de pagamento arquivado, caso oferecida pela Clínica, exigirá uma Autorização de Cartão em Arquivo separada.",
            },
          ],
        },
      ],
    },
    {
      heading: "Consentimento Eletrônico",
      blocks: [
        {
          kind: "text",
          text:
            "Para atendimentos agendados por meio eletrônico, a Clínica mantém um registro eletrônico de auditoria do aceite do paciente, que pode incluir: identificação do paciente; identificação do atendimento; versão da política aceita; idioma apresentado ao paciente; data e hora do aceite (UTC); endereço IP; informações de navegador e dispositivo (User-Agent), quando disponíveis; registro de transação do e-mail e/ou SMS de confirmação, quando disponível.",
        },
        {
          kind: "text",
          text:
            "Esses registros são mantidos como parte dos registros comerciais da Clínica e podem ser utilizados para comprovar o aceite desta política em relação a dúvidas de faturamento, disputas de pagamento, disputas contratuais, procedimentos de estorno (chargeback) ou outras questões legais ou administrativas.",
        },
      ],
    },
  ],
  checkboxLabel:
    "Reconheço que li, compreendi e concordo com a Política de Agendamento e Cancelamento.",
  checkboxNote:
    "Ao marcar esta caixa, reconheço voluntariamente que tive a oportunidade de revisar esta política antes de agendar meu atendimento e que concordo em me vincular aos seus termos.",
};

const V3_0_PT_PT: PolicyDocument = {
  title: "Política de Marcação e Cancelamento",
  intro:
    "Na {clinic_name}, reservamos cada consulta exclusivamente para si. O horário marcado para a sua consulta é dedicado unicamente ao seu acompanhamento e, uma vez reservado, fica geralmente indisponível para outros pacientes. Caso precise de cancelar ou remarcar, pedimos gentilmente que avise com antecedência, para que possamos oferecer o horário a outro paciente.",
  sections: [
    {
      heading: "Política de Cancelamento e Remarcação",
      blocks: [
        { kind: "label", text: "Cancelamento ou Remarcação:" },
        {
          kind: "list",
          items: [
            { text: "{window_hours} horas ou mais antes do horário marcado: sem qualquer taxa." },
            {
              clause: "late",
              text:
                "Menos de {window_hours} horas antes do horário marcado: poderá ser aplicada uma Taxa de Cancelamento Tardio equivalente a {late_pct}% do serviço marcado.",
            },
          ],
        },
        { kind: "label", clause: "no_show", text: "Falta (No-Show):" },
        {
          kind: "text",
          clause: "no_show",
          text:
            "Considera-se falta quando o paciente não comparece a uma consulta marcada sem aviso prévio. Poderá ser aplicada uma Taxa de Falta equivalente a {no_show_pct}% do serviço marcado.",
        },
        {
          kind: "text",
          text:
            "Estas taxas destinam-se a compensar a Clínica pelo tempo de consulta reservado exclusivamente ao paciente que, razoavelmente, não pôde ser oferecido a outro paciente.",
        },
      ],
    },
    {
      heading: "Exceções",
      blocks: [
        {
          kind: "text",
          text: "Compreendemos que podem ocorrer situações inesperadas e emergências genuínas. Deste modo:",
        },
        {
          kind: "list",
          items: [
            { text: "A Clínica analisa individualmente cada cancelamento tardio e cada falta." },
            {
              text:
                "O primeiro cancelamento tardio ou a primeira falta poderá ser dispensado, ao exclusivo critério da Clínica, quando fundamentado por emergência documentada ou outras circunstâncias excecionais.",
            },
            {
              text:
                "Qualquer dispensa é apenas uma cortesia e não constitui alteração desta política nem cria qualquer expectativa de que taxas futuras serão dispensadas.",
            },
          ],
        },
      ],
    },
    {
      heading: "Análise Antes da Cobrança",
      blocks: [
        {
          kind: "text",
          text:
            "A {clinic_name} não aplica automaticamente taxas de cancelamento ou de falta. Antes de qualquer taxa ser aplicada:",
        },
        {
          kind: "list",
          items: [
            { text: "cada caso é analisado individualmente por um membro autorizado da Clínica;" },
            { text: "são consideradas as circunstâncias que envolveram a consulta perdida;" },
            {
              text:
                "a Clínica decide, ao seu exclusivo critério profissional, se a taxa será aplicada ou dispensada.",
            },
          ],
        },
        { kind: "text", text: "Nenhuma taxa de cancelamento ou de falta é gerada apenas através de um processo automatizado." },
      ],
    },
    {
      heading: "Reconhecimento e Concordância",
      blocks: [
        { kind: "text", text: "Ao marcar uma consulta, reconheço e concordo que:" },
        {
          kind: "list",
          items: [
            { text: "Recebi, li e compreendi esta Política de Marcação e Cancelamento." },
            { text: "Compreendo as exigências de cancelamento da Clínica." },
            {
              text: "Compreendo que:",
              sub: [
                {
                  text:
                    "cancelamentos ou remarcações feitos com {window_hours} horas ou mais de antecedência não estão sujeitos a qualquer taxa;",
                },
                {
                  clause: "late",
                  text:
                    "cancelamentos ou remarcações feitos com menos de {window_hours} horas de antecedência podem resultar numa taxa equivalente a {late_pct}% do serviço marcado;",
                },
                {
                  clause: "no_show",
                  text:
                    "o não comparecimento a uma consulta marcada sem aviso prévio (Falta) pode resultar numa taxa equivalente a {no_show_pct}% do serviço marcado.",
                },
              ],
            },
            { text: "Compreendo que todo cancelamento ou falta é analisado individualmente pela Clínica antes de qualquer taxa ser aplicada." },
            { text: "Compreendo que a Clínica pode dispensar qualquer taxa, no todo ou em parte, ao seu exclusivo critério." },
            {
              text:
                "Compreendo que este reconhecimento cria a minha concordância contratual em cumprir esta política para esta consulta e para consultas futuras, salvo se eu for notificado de uma política atualizada.",
            },
            {
              text:
                "Compreendo que este reconhecimento não autoriza a Clínica a cobrar qualquer meio de pagamento ou cartão específico. Qualquer autorização futura para cobrar um cartão de pagamento em arquivo, caso oferecida pela Clínica, exigirá uma Autorização de Cartão em Arquivo separada.",
            },
          ],
        },
      ],
    },
    {
      heading: "Consentimento Eletrónico",
      blocks: [
        {
          kind: "text",
          text:
            "Para consultas marcadas por meio eletrónico, a Clínica mantém um registo eletrónico de auditoria do aceite do paciente, que pode incluir: identificação do paciente; identificação da consulta; versão da política aceite; idioma apresentado ao paciente; data e hora do aceite (UTC); endereço IP; informações de navegador e dispositivo (User-Agent), quando disponíveis; registo de transação do e-mail e/ou SMS de confirmação, quando disponível.",
        },
        {
          kind: "text",
          text:
            "Estes registos são mantidos como parte dos registos comerciais da Clínica e podem ser utilizados para comprovar o aceite desta política em relação a dúvidas de faturação, disputas de pagamento, disputas contratuais, procedimentos de estorno (chargeback) ou outras questões legais ou administrativas.",
        },
      ],
    },
  ],
  checkboxLabel:
    "Reconheço que li, compreendi e concordo com a Política de Marcação e Cancelamento.",
  checkboxNote:
    "Ao selecionar esta caixa, reconheço voluntariamente que tive a oportunidade de rever esta política antes de marcar a minha consulta e que concordo em vincular-me aos seus termos.",
};

const V3_0_ES: PolicyDocument = {
  title: "Política de Programación y Cancelación de Citas",
  intro:
    "En {clinic_name}, reservamos cada cita exclusivamente para usted. El horario programado para su visita se dedica únicamente a su cuidado y, una vez reservado, por lo general no está disponible para otros pacientes. Si necesita cancelar o reprogramar, le pedimos amablemente que avise con antelación, para que podamos ofrecer la cita a otro paciente.",
  sections: [
    {
      heading: "Política de Cancelación y Reprogramación",
      blocks: [
        { kind: "label", text: "Cancelación o Reprogramación:" },
        {
          kind: "list",
          items: [
            { text: "{window_hours} horas o más antes de la cita programada: sin cargo." },
            {
              clause: "late",
              text:
                "Menos de {window_hours} horas antes de la cita programada: podrá aplicarse un Cargo por Cancelación Tardía equivalente al {late_pct}% del servicio programado.",
            },
          ],
        },
        { kind: "label", clause: "no_show", text: "Ausencia (No-Show):" },
        {
          kind: "text",
          clause: "no_show",
          text:
            "Se considera ausencia cuando un paciente no acude a una cita programada sin aviso previo. Podrá aplicarse un Cargo por Ausencia equivalente al {no_show_pct}% del servicio programado.",
        },
        {
          kind: "text",
          text:
            "Estos cargos tienen por objeto compensar a la Clínica por el tiempo de cita reservado exclusivamente para el paciente que, razonablemente, no pudo ofrecerse a otro paciente.",
        },
      ],
    },
    {
      heading: "Excepciones",
      blocks: [
        {
          kind: "text",
          text: "Entendemos que pueden surgir situaciones inesperadas y emergencias genuinas. En consecuencia:",
        },
        {
          kind: "list",
          items: [
            { text: "La Clínica revisa individualmente cada cancelación tardía y cada ausencia." },
            {
              text:
                "La primera cancelación tardía o ausencia podrá ser dispensada, a exclusivo criterio de la Clínica, cuando esté respaldada por una emergencia documentada u otras circunstancias excepcionales.",
            },
            {
              text:
                "Cualquier dispensa es únicamente una cortesía y no constituye una modificación de esta política ni crea expectativa alguna de que se dispensarán cargos futuros.",
            },
          ],
        },
      ],
    },
    {
      heading: "Revisión Antes de la Aplicación del Cargo",
      blocks: [
        {
          kind: "text",
          text:
            "{clinic_name} no aplica automáticamente cargos por cancelación o ausencia. Antes de aplicar cualquier cargo:",
        },
        {
          kind: "list",
          items: [
            { text: "cada caso es revisado individualmente por un miembro autorizado de la Clínica;" },
            { text: "se consideran las circunstancias en torno a la cita perdida;" },
            {
              text:
                "la Clínica determina, a su exclusivo criterio profesional, si el cargo se aplicará o se dispensará.",
            },
          ],
        },
        { kind: "text", text: "Ningún cargo por cancelación o ausencia se genera únicamente mediante un proceso automatizado." },
      ],
    },
    {
      heading: "Reconocimiento y Acuerdo",
      blocks: [
        { kind: "text", text: "Al programar una cita, reconozco y acepto que:" },
        {
          kind: "list",
          items: [
            { text: "He recibido, leído y comprendido esta Política de Programación y Cancelación de Citas." },
            { text: "Comprendo los requisitos de cancelación de la Clínica." },
            {
              text: "Comprendo que:",
              sub: [
                {
                  text:
                    "las cancelaciones o reprogramaciones realizadas con {window_hours} horas o más de antelación no están sujetas a ningún cargo;",
                },
                {
                  clause: "late",
                  text:
                    "las cancelaciones o reprogramaciones realizadas con menos de {window_hours} horas de antelación pueden dar lugar a un cargo equivalente al {late_pct}% del servicio programado;",
                },
                {
                  clause: "no_show",
                  text:
                    "no acudir a una cita programada sin aviso previo (Ausencia) puede dar lugar a un cargo equivalente al {no_show_pct}% del servicio programado.",
                },
              ],
            },
            { text: "Comprendo que cada cancelación o ausencia es revisada individualmente por la Clínica antes de aplicar cualquier cargo." },
            { text: "Comprendo que la Clínica puede dispensar cualquier cargo, en su totalidad o en parte, a su exclusivo criterio." },
            {
              text:
                "Comprendo que este reconocimiento constituye mi acuerdo contractual de cumplir esta política para esta cita y para citas futuras, salvo que se me notifique una política actualizada.",
            },
            {
              text:
                "Comprendo que este reconocimiento no autoriza a la Clínica a cobrar ningún método de pago o tarjeta específica. Cualquier autorización futura para cobrar una tarjeta de pago guardada en archivo, si la Clínica la ofrece, requerirá una Autorización de Tarjeta en Archivo por separado.",
            },
          ],
        },
      ],
    },
    {
      heading: "Consentimiento Electrónico",
      blocks: [
        {
          kind: "text",
          text:
            "Para las citas programadas electrónicamente, la Clínica mantiene un registro electrónico de auditoría de la aceptación del paciente, que puede incluir: identificación del paciente; identificación de la cita; versión de la política aceptada; idioma presentado al paciente; fecha y hora de la aceptación (UTC); dirección IP; información del navegador y del dispositivo (User-Agent), cuando esté disponible; registro de transacción del correo electrónico y/o SMS de confirmación, cuando esté disponible.",
        },
        {
          kind: "text",
          text:
            "Estos registros se conservan como parte de los registros comerciales de la Clínica y pueden utilizarse para demostrar la aceptación de esta política en relación con consultas de facturación, disputas de pago, disputas contractuales, procedimientos de contracargo (chargeback) u otros asuntos legales o administrativos.",
        },
      ],
    },
  ],
  checkboxLabel:
    "Reconozco que he leído, comprendido y aceptado la Política de Programación y Cancelación de Citas.",
  checkboxNote:
    "Al seleccionar esta casilla, reconozco voluntariamente que he tenido la oportunidad de revisar esta política antes de programar mi cita y que acepto quedar obligado por sus términos.",
};

const V3_0: Record<PolicyLang, PolicyDocument> = {
  "pt-BR": V3_0_PT_BR,
  en: V3_0_EN,
  "pt-PT": V3_0_PT_PT,
  es: V3_0_ES,
};

// ─────────────────────────────────────────────────────────────────────────────────
// v1.0 — ARQUIVADO. Texto enxuto, aprovado por Marcelo em 2026-08-13, superado pela
// v3.0. Mantido apenas para rastreio; sem aceite em producao. NAO editar.
// ─────────────────────────────────────────────────────────────────────────────────

type LegacySimpleStrings = { title: string; body: string; accept: string };

const V1_0_ARCHIVED: Record<PolicyLang, LegacySimpleStrings> = {
  "pt-BR": {
    title: "Política de agendamento e cancelamento.",
    body:
      "Seu horário fica reservado só para você. Se precisar remarcar ou cancelar, pedimos aviso com pelo menos {hours} horas de antecedência. " +
      "Faltas sem aviso, ou cancelamentos feitos com menos de {hours} horas, podem incluir uma taxa, definida pela clínica. " +
      "Cancelamentos dentro do prazo não têm nenhum custo. " +
      "Se surgir um imprevisto, fale com a gente, estamos aqui para ajudar.",
    accept: "Li e concordo com a política de agendamento e cancelamento.",
  },
  en: {
    title: "Scheduling and cancellation policy.",
    body:
      "Your appointment time is reserved just for you. If you need to reschedule or cancel, we ask for at least {hours} hours' notice. " +
      "Missed appointments with no notice, or cancellations made with less than {hours} hours' notice, may include a fee set by the clinic. " +
      "Cancellations made within the window are always free. " +
      "If something comes up, reach out, we're happy to help.",
    accept: "I have read and agree to the scheduling and cancellation policy.",
  },
  "pt-PT": {
    title: "Política de marcação e cancelamento.",
    body:
      "O seu horário fica reservado apenas para si. Caso precise de remarcar ou cancelar, pedimos aviso com, no mínimo, {hours} horas de antecedência. " +
      "Faltas sem aviso, ou cancelamentos feitos com menos de {hours} horas, podem incluir uma taxa, definida pela clínica. " +
      "Cancelamentos dentro do prazo não têm qualquer custo. " +
      "Se surgir algum imprevisto, fale connosco, estamos aqui para ajudar.",
    accept: "Li e concordo com a política de marcação e cancelamento.",
  },
  es: {
    title: "Política de citas y cancelación.",
    body:
      "Su cita queda reservada solo para usted. Si necesita reprogramar o cancelar, le pedimos aviso con al menos {hours} horas de antelación. " +
      "Las ausencias sin aviso, o las cancelaciones hechas con menos de {hours} horas, pueden incluir un cargo definido por la clínica. " +
      "Las cancelaciones dentro del plazo no tienen ningún costo. " +
      "Si surge algún imprevisto, contáctenos, estamos aquí para ayudar.",
    accept: "He leído y acepto la política de citas y cancelación.",
  },
};

/**
 * Registro de todas as versoes ja existentes (auditoria). O reader serve sempre a
 * versao VIGENTE (v3.0); as anteriores ficam aqui como prova/rastreio.
 */
export const POLICY_VERSION_HISTORY: Record<
  string,
  { status: PolicyStatus; format: "simple" | "document"; approvedAt: string; note: string }
> = {
  "no_show_v1.0": {
    status: "superseded",
    format: "simple",
    approvedAt: "2026-08-13",
    note: "Texto enxuto aprovado por Marcelo; superado pela v3.0. Sem aceite em producao.",
  },
  "no_show_v3.0": {
    status: NO_SHOW_POLICY_STATUS,
    format: "document",
    approvedAt: "2026-08-13",
    note: "Documento completo. Aprovado por Marcelo via consultoria propria; sem sign-off de advogado licenciado (risco assumido por Marcelo). Cobranca segue manual.",
  },
};

// ── Leitura / renderizacao ──────────────────────────────────────────────────────

function normalizeLang(locale: string | null | undefined): PolicyLang {
  if (locale === "en") return "en";
  if (locale === "pt-PT") return "pt-PT";
  if (locale === "es") return "es";
  return "pt-BR";
}

/**
 * Rotulo generico por idioma para {clinic_name} quando nenhum nome e informado. So um
 * salvaguarda para o texto nao ficar quebrado ("At , we reserve..."). Na pratica os
 * call-sites sempre passam clinics.legal_entity_name ?? clinics.name (nunca nulo).
 */
const GENERIC_CLINIC_NAME: Record<PolicyLang, string> = {
  en: "our clinic",
  "pt-BR": "a clínica",
  "pt-PT": "a clínica",
  es: "la clínica",
};

function keepClause(clause: Clause | undefined, cfg: Required<NoShowPolicyConfig>): boolean {
  if (clause === "late") return cfg.lateChargeable;
  if (clause === "no_show") return cfg.noShowChargeable;
  return true;
}

function fill(text: string, cfg: Required<NoShowPolicyConfig>): string {
  return text
    .replaceAll("{clinic_name}", String(cfg.clinicName))
    .replaceAll("{window_hours}", String(cfg.windowHours))
    .replaceAll("{late_pct}", String(cfg.latePct))
    .replaceAll("{no_show_pct}", String(cfg.noShowPct));
}

function renderLines(lines: PolicyLine[], cfg: Required<NoShowPolicyConfig>): RenderedPolicyLine[] {
  const out: RenderedPolicyLine[] = [];
  for (const line of lines) {
    if (!keepClause(line.clause, cfg)) continue;
    const rendered: RenderedPolicyLine = { text: fill(line.text, cfg) };
    if (line.sub && line.sub.length > 0) {
      const sub = renderLines(line.sub, cfg);
      if (sub.length > 0) rendered.sub = sub;
    }
    out.push(rendered);
  }
  return out;
}

function renderBlocks(blocks: PolicyBlock[], cfg: Required<NoShowPolicyConfig>): RenderedPolicyBlock[] {
  const out: RenderedPolicyBlock[] = [];
  for (const block of blocks) {
    if (block.kind === "list") {
      const items = renderLines(block.items, cfg);
      if (items.length > 0) out.push({ kind: "list", items });
      continue;
    }
    if (!keepClause(block.clause, cfg)) continue;
    out.push({ kind: block.kind, text: fill(block.text, cfg) });
  }
  return out;
}

/**
 * Documento da politica de no-show para exibicao, por idioma e config da clinica.
 * Resolve placeholders ({window_hours}/{late_pct}/{no_show_pct}) e omite a clausula
 * de um tipo de taxa quando a clinica esta em modo 'none' naquele tipo. Retorna sempre
 * a versao VIGENTE (NO_SHOW_POLICY_VERSION) com a string de versao e o status junto.
 */
export function getNoShowPolicyText(
  locale: string | null | undefined,
  config: NoShowPolicyConfig = {},
): RenderedNoShowPolicy {
  const lang = normalizeLang(locale);
  const cfg: Required<NoShowPolicyConfig> = {
    windowHours: config.windowHours ?? 24,
    latePct: config.latePct ?? 0,
    noShowPct: config.noShowPct ?? 0,
    lateChargeable: config.lateChargeable ?? true,
    noShowChargeable: config.noShowChargeable ?? true,
    clinicName: config.clinicName?.trim() || GENERIC_CLINIC_NAME[lang],
  };
  const doc = V3_0[lang];
  return {
    version: NO_SHOW_POLICY_VERSION,
    status: NO_SHOW_POLICY_STATUS,
    title: doc.title,
    intro: fill(doc.intro, cfg),
    sections: doc.sections.map((s) => ({ heading: s.heading, blocks: renderBlocks(s.blocks, cfg) })),
    checkboxLabel: doc.checkboxLabel,
    checkboxNote: doc.checkboxNote,
  };
}

// Mantido para rastreio/testes: acesso ao texto v1.0 arquivado (nao usado na UI).
export function getArchivedV1Text(locale: string | null | undefined, windowHours = 24): LegacySimpleStrings {
  const s = V1_0_ARCHIVED[normalizeLang(locale)];
  return { title: s.title, body: s.body.replaceAll("{hours}", String(windowHours)), accept: s.accept };
}
