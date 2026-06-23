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
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) return [];
      return walk(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function lineLooksInternal(line) {
  return ignoredPatterns.some((pattern) => pattern.test(line));
}

const violations = [];
for (const scanRoot of scanRoots) {
  for (const file of walk(path.join(root, scanRoot))) {
    const rel = path.relative(root, file);
    if (ignoredFiles.has(path.normalize(rel))) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (lineLooksInternal(line)) return;
      for (const { term, replacement } of prohibited) {
        const regex = new RegExp(`(^|[^A-Za-z])${term}([^A-Za-z]|$)`, "i");
        if (regex.test(line)) {
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
