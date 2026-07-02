import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "modules"];
const prohibited = [
  { term: "report", replacement: 'getTerm("insight")' },
  { term: "reports", replacement: 'getTerm("insight", "plural")' },
  { term: "analysis", replacement: 'getTerm("insight")' },
  { term: "recommendation", replacement: 'getTerm("nextStep")' },
  { term: "recommendations", replacement: 'getTerm("nextStep", "plural")' },
];

const ignoredFiles = new Set([
  path.normalize("modules/ui/terminology.ts"),
  path.normalize("modules/insights/clinical-insight.ts"), // internal data shape retained for compatibility
]);

const ignoredPatterns = [
  /\/reports\//i,
  /clinical-insight/i,
  /action-suggestions/i,
  /ActionSuggestion/,
  /suggestion-service/i,
  /SuggestedAction/,
  /getSuggested/i,
  /ai-placeholder/i,
  /report-service/i,
  /insight-export-service/i,
  /include_in_report/i, // nome de coluna interno (clinic_assessment_fields), não é copy de UI
  /report_tagline/i, // nome de coluna interno (clinics), não é copy de UI
  /patientId e report/, // mensagem de erro de API cita o nome do parâmetro
  /"item_a"/, // schema JSON dentro de prompt de IA (health-agent)
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git", "__tests__"].includes(entry.name)) return [];
      return walk(full);
    }
    // Testes não são copy de UI
    if (/\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function lineLooksInternal(line) {
  return ignoredPatterns.some((pattern) => pattern.test(line));
}

// O check vale para COPY DE UI, não para identificadores/imports/comentários.
// Extrai só os trechos que podem chegar ao usuário: literais de string e texto JSX.
function userVisibleSegments(line) {
  const trimmed = line.trim();
  // Imports/exports de módulo e comentários nunca são copy de UI
  if (/^(import|export)\b.*from\s/.test(trimmed)) return [];
  if (/^(\/\/|\/\*|\*)/.test(trimmed)) return [];
  // Logs de console não são copy de UI
  if (/console\.(log|warn|error|info|debug)\(/.test(trimmed)) return [];

  // Chaves de i18n/terminologia (t("report"), getTerm("insight")) não são copy
  let cleaned = line.replace(
    /\b(t|getTerm|getTranslations|useTranslations)\(\s*(["'])[A-Za-z0-9_.\-]+\2/g,
    "$1(",
  );
  // Interpolações de template literal (`${report.total}%`) são código, não copy
  cleaned = cleaned.replace(/\$\{[^}]*\}/g, "");

  const segments = [];
  const stringLiteral = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  let match;
  while ((match = stringLiteral.exec(cleaned)) !== null) {
    segments.push(match[2]);
  }
  // Texto JSX entre tags: >Algum texto<
  const jsxText = />([^<>{}]+)</g;
  while ((match = jsxText.exec(cleaned)) !== null) {
    segments.push(match[1]);
  }

  // Tokens únicos sem espaço com cara de identificador/caminho/chave i18n
  // (advanced_reports, report.title, @/lib/pdf-report) não são copy de UI.
  return segments.filter((s) => {
    const v = s.trim();
    if (!v) return false;
    if (!v.includes(" ") && /[_./\-@]/.test(v)) return false;
    return true;
  });
}

const violations = [];
for (const scanRoot of scanRoots) {
  for (const file of walk(path.join(root, scanRoot))) {
    const rel = path.relative(root, file);
    if (ignoredFiles.has(path.normalize(rel))) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (lineLooksInternal(line)) return;
      const segments = userVisibleSegments(line);
      if (!segments.length) return;
      for (const { term, replacement } of prohibited) {
        const regex = new RegExp(`(^|[^A-Za-z])${term}([^A-Za-z]|$)`, "i");
        if (segments.some((segment) => regex.test(segment))) {
          violations.push({ file: rel, line: index + 1, term, replacement, text: line.trim() });
        }
      }
    });
  }
}

if (violations.length) {
  console.error("\nTerminology check failed. Use the central helper from /modules/ui/terminology.ts.\n");
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} contains '${violation.term}'. Use ${violation.replacement}.`);
    console.error(`  ${violation.text}`);
  }
  console.error("\nAllowed UI terms: Session, Insight, Next Step.\n");
  process.exit(1);
}

console.log("Terminology check passed.");
