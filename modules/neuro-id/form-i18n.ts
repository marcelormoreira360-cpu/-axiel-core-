/**
 * form-i18n.ts — Camada de idioma do FORMULÁRIO UNIFICADO Neuro ID.
 *
 * O template (unified-form-template.ts) é a FONTE ÚNICA em português (pt-BR) e
 * também a fonte dos VALORES canônicos guardados (ex.: "Sim", "Olhos"). O motor
 * de pontuação, o import e as perguntas condicionais dependem desses valores em
 * PT. Por isso a tradução NUNCA troca o valor guardado: só troca o que o paciente
 * VÊ (label/opção/âncora/escala) e o texto de UI (chrome).
 *
 *  - localizeForm(locale): devolve o template com os textos no idioma pedido,
 *    mantendo `options` (= valor canônico) e adicionando `optionLabels` (= exibição).
 *  - formChrome(locale): textos da página e da UI do formulário.
 *
 * pt-PT cai em pt-BR até termos revisão dedicada. EN das perguntas de SEGURANÇA
 * (bloco A, item de crise, disclaimer) passa por Salvo/Aval antes de paciente real.
 */

import { UNIFIED_FORM, type UnifiedQuestion, type UnifiedBlock } from "./unified-form-template";

export type FormLocale = "pt-BR" | "pt-PT" | "en";

/** Normaliza o message_language do paciente para um idioma suportado do formulário. */
export function normFormLocale(l?: string | null): FormLocale {
  if (!l) return "pt-BR";
  if (l.toLowerCase().startsWith("en")) return "en";
  if (l === "pt-PT") return "pt-PT";
  return "pt-BR";
}

/** Pergunta localizada: superset da canônica com o rótulo de exibição das opções. */
export type LocalizedQuestion = UnifiedQuestion & { optionLabels?: string[] };
export type LocalizedBlock = Omit<UnifiedBlock, "questions"> & { questions: LocalizedQuestion[] };
export type LocalizedForm = { name: string; recall: string; disclaimer: string; blocks: LocalizedBlock[] };

// ── Chrome (textos de UI, fora das perguntas) ──────────────────────────────────
export type FormChrome = {
  headerTitle: string;
  greetingNamed: string; // usa {name}
  greetingAnon: string;
  footerPrivacy: string;
  status: {
    completedTitle: string; completedDesc: string;
    expiredTitle: string; expiredDesc: string;
    invalidTitle: string; invalidDesc: string;
  };
  done: { title: string; desc: string };
  contact: {
    title: string; desc: string;
    fullName: string; email: string; phone: string; birth: string;
    consent: string; submit: string; sending: string;
  };
  continueLabel: string;
  submitAnswersLabel: string;
  sendError: string;
  sendFailed: string;
  freqHeader: string;
  impHeader: string;
  writeHere: string;
  yesNo: [string, string]; // exibição de ["Não","Sim"] (o valor guardado continua PT)
  crisis: { title: string; body: string; us: string; br: string; emergency: string; note: string };
  aside: { live: string; index: string; safety: string; cardioOk: string; cardioWarn: string; crisisOk: string; crisisWarn: string };
  freq: string[];
  imp: string[];
  freq3: string[];
};

const CHROME_PT: FormChrome = {
  headerTitle: "Perfil Clínico Integrado de 30 Dias",
  greetingNamed: "Olá, {name}. Responda pensando nos últimos 30 dias.",
  greetingAnon: "Responda pensando nos últimos 30 dias. Leva alguns minutos.",
  footerPrivacy: "Seus dados são tratados com segurança. Este questionário não é um serviço de emergência.",
  status: {
    completedTitle: "Você já respondeu", completedDesc: "Este questionário já foi enviado. Obrigado.",
    expiredTitle: "Link expirado", expiredDesc: "Peça um novo link à clínica para responder.",
    invalidTitle: "Link inválido", invalidDesc: "Verifique o endereço ou peça um novo link à clínica.",
  },
  done: { title: "Respostas enviadas", desc: "Obrigado. Suas respostas foram registradas com segurança. A equipe vai revisar antes da sua consulta." },
  contact: {
    title: "Quase lá", desc: "Deixe seus dados para a equipe entrar em contato.",
    fullName: "Nome completo *", email: "E-mail *", phone: "Telefone", birth: "Nascimento",
    consent: "Autorizo o contato e o tratamento dos meus dados para fins de avaliação de bem-estar.",
    submit: "Enviar", sending: "Enviando...",
  },
  continueLabel: "Continuar",
  submitAnswersLabel: "Enviar respostas",
  sendError: "Não foi possível enviar. Tente novamente.",
  sendFailed: "Falha ao enviar.",
  freqHeader: "Com que frequência",
  impHeader: "O quanto atrapalha",
  writeHere: "Escreva aqui…",
  yesNo: ["Não", "Sim"],
  crisis: {
    title: "Você não está sozinho.",
    body: "O que você sente importa. Se estiver pensando em se machucar, fale com alguém agora.",
    us: "EUA · 988", br: "Brasil · 188 (CVV)", emergency: "Emergência · 911 / 192",
    note: "Este item não gera nota. Encaminhamento para apoio, sem avaliação de risco pela clínica.",
  },
  aside: {
    live: "Mapa Bio³ ao vivo", index: "Índice geral", safety: "Segurança (fora do score)",
    cardioOk: "Sem sinal cardiorrespiratório", cardioWarn: "Precaução cardiorrespiratória",
    crisisOk: "Sem sinal de encaminhamento", crisisWarn: "Encaminhamento de apoio ativado (988/188)",
  },
  freq: ["Nunca", "Poucos dias", "Mais da metade dos dias", "Quase todos os dias"],
  imp: ["Não atrapalha", "Atrapalha um pouco", "Atrapalha bastante", "Atrapalha muito"],
  freq3: ["Nunca", "Poucos dias", "Mais da metade dos dias", "Quase todos os dias"],
};

const CHROME_EN: FormChrome = {
  headerTitle: "30-Day Integrated Clinical Profile",
  greetingNamed: "Hi {name}. As you answer, think about how the last 30 days have been.",
  greetingAnon: "As you answer, think about the last 30 days. It only takes a few minutes.",
  footerPrivacy: "Your data is handled securely. This questionnaire is not an emergency service.",
  status: {
    completedTitle: "You've already responded", completedDesc: "This questionnaire has already been submitted. Thank you.",
    expiredTitle: "Link expired", expiredDesc: "Ask the clinic for a new link to respond.",
    invalidTitle: "Invalid link", invalidDesc: "Check the address or ask the clinic for a new link.",
  },
  done: { title: "Answers submitted", desc: "Thank you. Your answers were recorded securely. The team will review them before your visit." },
  contact: {
    title: "Almost there", desc: "Leave your details so the team can reach out.",
    fullName: "Full name *", email: "Email *", phone: "Phone", birth: "Date of birth",
    consent: "I authorize contact and the processing of my data for wellbeing assessment purposes.",
    submit: "Submit", sending: "Submitting...",
  },
  continueLabel: "Continue",
  submitAnswersLabel: "Submit answers",
  sendError: "Couldn't submit. Please try again.",
  sendFailed: "Failed to submit.",
  freqHeader: "How often",
  impHeader: "How much it interferes",
  writeHere: "Write here…",
  yesNo: ["No", "Yes"],
  crisis: {
    title: "You are not alone.",
    body: "What you feel matters. If you are thinking about hurting yourself, talk to someone now.",
    us: "US · 988", br: "Brazil · 188 (CVV)", emergency: "Emergency · 911 / 192",
    note: "This item is not scored. It's a referral to support, without risk assessment by the clinic.",
  },
  aside: {
    live: "Live Bio³ Map", index: "Overall index", safety: "Safety (outside the score)",
    cardioOk: "No cardiorespiratory signal", cardioWarn: "Cardiorespiratory caution",
    crisisOk: "No referral signal", crisisWarn: "Support referral activated (988/188)",
  },
  freq: ["Never", "A few days", "More than half the days", "Nearly every day"],
  imp: ["Doesn't interfere", "Interferes a little", "Interferes quite a bit", "Interferes a lot"],
  freq3: ["Never", "A few days", "More than half the days", "Nearly every day"],
};

export function formChrome(locale: FormLocale): FormChrome {
  return locale === "en" ? CHROME_EN : CHROME_PT;
}

// ── Overlay EN das perguntas (por código) ──────────────────────────────────────
// label = pergunta; optionLabels = exibição das opções na MESMA ordem do canônico;
// anchors = âncoras por nível; note = observação. Falta -> cai no PT do template.
type QEN = { label?: string; optionLabels?: string[]; anchors?: Record<number, string>; note?: string };

const EN_BLOCK: Record<string, { title: string; intro?: string }> = {
  A: { title: "Profile and safety", intro: "These questions help our team get to know you and prepare your care." },
  B: { title: "Body and movement" },
  C: { title: "Heart, breathing and regulation" },
  D: { title: "Digestion, metabolism and whole-body" },
  E: { title: "Sleep, energy and cognition" },
  F: { title: "How you've been feeling in the last 30 days" },
  G: { title: "To complete your picture (optional)" },
  H: { title: "Medications", intro: "Therapeutic complexity index (for professional use, separate from the score)." },
};

const EN_Q: Record<string, QEN> = {
  // Bloco A — Perfil e segurança
  a_idioma: { label: "Which language would you prefer to continue in?", optionLabels: ["Portuguese", "English"] },
  a_data_nascimento: { label: "What is your date of birth?" },
  a_objetivo_principal: { label: "What made you reach out to us now?" },
  a_gravidez: { label: "Are you pregnant or breastfeeding?", optionLabels: ["No", "Pregnant", "Breastfeeding", "Prefer not to say"] },
  a_implantes: { label: "Do you have a pacemaker, an electronic implant, or epilepsy?", optionLabels: ["Pacemaker/implant", "Epilepsy/seizures", "None"] },
  a_condicao_ativa: { label: "Any important health condition you're currently being treated for?" },
  a_flag_peso: { label: "In the last 30 days, have you had unexplained weight loss?" },

  // Bloco B — Corpo e movimento
  bm_dor: { label: "Body pain" },
  bm_dor_regioes: { label: "Where do you feel pain the most?", optionLabels: ["Neck", "Shoulders", "Upper back", "Lower back", "Hips", "Knees", "Head", "Widespread", "No pain"] },
  bm_rigidez: { label: "Stiffness or locking when you move" },
  bm_limitacao: { label: "Difficulty or limitation with everyday movements" },
  bm_equilibrio: { label: "Imbalance or unsteadiness when walking/standing up" },
  bm_fraqueza_muscular: { label: "Weakness or tiredness in the muscles" },

  // Bloco C — Regulação e cardiorrespiratório
  bf_palpitacoes: { label: "Racing, pounding or irregular heartbeat at rest" },
  bf_tontura_levantar: { label: "Dizziness or blurred vision when standing up quickly" },
  bf_termorregulacao: { label: "Sensitivity to heat/cold, hot flashes or sweating" },
  bf_desconforto_toracico: { label: "Tightness or discomfort in the chest with no known cause" },
  bf_falta_ar: { label: "Shortness of breath without exertion" },
  bf_respiracao_estresse: { label: "Short or held breathing during tense moments" },
  bf_pressao_instavel: { label: "Blood pressure swinging (measured or by symptoms)" },

  // Bloco D — Digestivo, metabólico e sistêmico
  bf_refluxo: { label: "Heartburn, reflux or nausea" },
  bf_intestino: { label: "Constipation or diarrhea with no clear cause" },
  bf_inchaco: { label: "Bloating, gas or excessive burping" },
  bf_dor_abdominal_estresse: { label: "Knot in the stomach or belly pain along with stressful moments" },
  bf_apetite: { label: "Appetite changes not explained by diet" },
  bf_peso: { label: "Weight swings that are hard to explain" },
  bf_pele_cabelo: { label: "Hair loss, dry skin or brittle nails" },
  bf_infeccoes: { label: "You get sick easily or take a long time to recover" },
  bf_hormonal: { label: "Menstrual, menopausal or hormonal changes" },
  bf_sistemas_extra: { label: "Have you had significant discomfort in any of these areas?", optionLabels: ["Eyes", "Ears", "Nose/sinuses", "Mouth/throat", "Bladder/urinary", "Genital/intimate", "None"] },
  bf_olhos: { label: "Eye discomfort (burning, itching, blurred vision)" },
  bf_ouvidos: { label: "Ear discomfort (ringing, pain, itching)" },
  bf_nariz: { label: "Nasal congestion, sinusitis or frequent sneezing" },
  bf_garganta: { label: "Mouth/throat discomfort (cough, throat clearing, hoarseness, canker sores)" },
  bf_urinario: { label: "Urgency or discomfort when urinating" },
  bf_genital: { label: "Itching, discharge or intimate discomfort" },

  // Bloco E — Sono, energia e cognição
  bf_sono_iniciar: { label: "Difficulty falling asleep" },
  bf_sono_manter: { label: "Waking up several times during the night" },
  bf_sono_reparador: { label: "Waking up tired even after enough sleep" },
  bf_sonolencia_dia: { label: "Very sleepy during the day" },
  bf_fadiga: { label: "Tiredness or lack of energy out of proportion to the effort" },
  bf_recuperacao: { label: "Slow to recover after effort or stress" },
  bf_concentracao: { label: "Difficulty concentrating on simple tasks" },
  bf_memoria: { label: "Forgetting things more often than usual" },
  bf_brain_fog: { label: "Foggy mind or feeling stuck when thinking/deciding" },
  bf_apneia: { label: "Has anyone said you snore loudly or stop breathing while asleep?" },

  // Bloco F — Como você tem se sentido (humor / ansiedade / regulação)
  be_mood_humor: { label: "How have your mood and spirits been?", anchors: { 0: "Fine, as usual", 2: "A bit down at times", 4: "Down most days", 6: "Heavy sadness almost all the time" } },
  be_mood_tensao: { label: "Have you felt tense or on edge, hard to unwind?", anchors: { 0: "Calm", 2: "Mild restlessness at times", 4: "Tension most days", 6: "Almost unbearable tension" } },
  be_mood_sono: { label: "How has your sleep been?", anchors: { 0: "I sleep well", 2: "Slightly worse", 4: "Much worse", 6: "I sleep very little" } },
  be_mood_apetite: { label: "And your appetite?", anchors: { 0: "Normal", 2: "A bit lower", 4: "Much reduced", 6: "Almost no appetite" } },
  be_mood_concentracao: { label: "Can you concentrate and gather your thoughts?", anchors: { 0: "No difficulty", 2: "Takes some effort", 4: "Hard most of the time", 6: "Almost impossible" } },
  be_mood_iniciativa: { label: "How is your energy to get things started?", anchors: { 0: "I do everything normally", 2: "Hard to get going", 4: "I have to force myself", 6: "I can barely take the first step" } },
  be_mood_envolvimento: { label: "How is your interest and enjoyment in the things you usually like?", anchors: { 0: "Yes, as always", 2: "A little less", 4: "Much less", 6: "I've lost interest in almost everything" } },
  be_mood_pessimismo: { label: "How have you been seeing the future and yourself?", anchors: { 0: "With hope", 2: "Sometimes I'm hard on myself", 4: "A sense of failure or guilt", 6: "A future with no way out, constant guilt" } },
  be_crisis_gosto_vida: { label: "How is your will to live and to keep going?", anchors: { 0: "I enjoy life", 2: "Sometimes it feels dull", 3: "I think it would be better not to be here", 4: "I think I'd rather not wake up", 6: "I've been thinking about hurting myself" }, note: "Referral item (not scored)." },
  be_anx_intro: { label: "How often, in the last 30 days, have you felt:" },
  be_anx_nervosismo: { label: "Nervousness, anxiety or feeling on edge" },
  be_anx_preocupacao_control: { label: "Difficulty stopping or controlling worries" },
  be_anx_preocupacao_demais: { label: "Worrying too much about different things" },
  be_anx_relaxar: { label: "Difficulty relaxing" },
  be_anx_inquietacao: { label: "Restlessness, hard to sit still" },
  be_anx_medo_ruim: { label: "Fear that something bad might happen" },
  be_anx_sobressalto: { label: "Feeling jumpy or easily startled" },
  be_reg_irritabilidade: { label: "Losing patience or getting irritated easily" },
  be_reg_hipervigilancia: { label: "Feeling constantly on alert, never letting your guard down" },
  be_reg_culpa: { label: "Guilt or self-blame over everyday things" },
  be_reg_recuperar_estresse: { label: "Difficulty returning to normal after stress" },

  // Bloco G — Para completar o quadro (opcional)
  ev_exames_sangue: { label: "Do you have recent blood tests? You can attach them." },
  ev_exame_cabelo: { label: "Have you done a hair test (mineral analysis)?" },
  ev_autoimune: { label: "Do you have a confirmed autoimmune diagnosis? Which one?" },
  ev_diagnosticos_previos: { label: "Other important diagnoses or surgeries?" },

  // Bloco H — Medicamentos
  med_usa: { label: "Do you take any ongoing medication?" },
  med_lista: { label: "List each medication, dose and frequency." },
  med_suplementos: { label: "Do you take supplements, vitamins or herbal products? Which ones?" },
  med_efeitos_adversos_freq: { label: "Do you feel side effects from your medications?" },
  med_adesao_dificuldade_freq: { label: "Do you have trouble taking them exactly right (forget, delay, stop)?" },
  med_mudanca_recente: { label: "Did you change any medication in the last 30 days?" },
};

const DISCLAIMER_EN =
  "This questionnaire is not an emergency service and may not be reviewed in real time. If you or someone else is in immediate danger, call 911 (US) or 192 (Brazil). For crisis support, call or text 988 (US), or in Brazil call 188 (CVV) or chat at cvv.org.br.";

/**
 * Devolve o formulário no idioma pedido, PRESERVANDO os valores canônicos.
 * pt-BR / pt-PT: retorna o template original (optionLabels ausente => exibe o canônico).
 * en: aplica o overlay; `options` continua canônico e `optionLabels` traz a exibição.
 */
export function localizeForm(locale: FormLocale): LocalizedForm {
  const chrome = formChrome(locale);
  if (locale !== "en") {
    return {
      name: UNIFIED_FORM.name,
      recall: UNIFIED_FORM.recall,
      disclaimer: UNIFIED_FORM.disclaimer,
      blocks: UNIFIED_FORM.blocks as LocalizedBlock[],
    };
  }
  const blocks: LocalizedBlock[] = UNIFIED_FORM.blocks.map((b) => {
    const bt = EN_BLOCK[b.key];
    return {
      ...b,
      title: bt?.title ?? b.title,
      intro: bt?.intro ?? b.intro,
      questions: b.questions.map((q): LocalizedQuestion => {
        const en = EN_Q[q.code];
        return {
          ...q,
          label: en?.label ?? q.label,
          optionLabels: q.options ? en?.optionLabels ?? q.options : undefined,
          anchors: q.anchors ? en?.anchors ?? q.anchors : q.anchors,
          scaleLabels: q.scaleLabels ? chrome.freq3 : q.scaleLabels,
          note: en?.note ?? q.note,
        };
      }),
    };
  });
  return { name: CHROME_EN.headerTitle, recall: chrome.greetingAnon, disclaimer: DISCLAIMER_EN, blocks };
}
