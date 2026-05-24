// Shared catalog — no "use client", safe to import from server or client components

export const TEMPLATE_CATALOG = [
  { key: "phq9-pt", name: "PHQ-9 — Questionário sobre a Saúde do Paciente", description: "Rastreio de depressão, 9 itens, escala 0–3 (PT-BR)", tag: "Depressão" },
  { key: "phq9-en", name: "PHQ-9 — Patient Health Questionnaire",            description: "Validated depression screening, 9 items, 0–3 scale (EN)", tag: "Depression" },
  { key: "gad7-pt", name: "GAD-7 — Transtorno de Ansiedade Generalizada (TAG)", description: "Rastreio de ansiedade, 7 itens, escala 0–3 (PT-BR)", tag: "Ansiedade" },
  { key: "gad7-en", name: "GAD-7 — Generalized Anxiety Disorder",            description: "Validated anxiety screening, 7 items, 0–3 scale (EN)", tag: "Anxiety" },
  { key: "hpa-pt",  name: "Eixo HPA — Questionário de Avaliação",            description: "Disfunção hipotálamo-hipófise-adrenal, 3 seções (PT-BR)", tag: "HPA" },
  { key: "hpa-en",  name: "HPA Axis — Assessment Questionnaire",             description: "Hypothalamus-pituitary-adrenal dysfunction, 3 sections (EN)", tag: "HPA" },
  { key: "msq-en",  name: "MSQ — Medical Symptoms Questionnaire",            description: "15 body systems, 0–4 scale per symptom (EN)", tag: "MSQ" },
] as const;

export type TemplateCatalogKey = typeof TEMPLATE_CATALOG[number]["key"];
