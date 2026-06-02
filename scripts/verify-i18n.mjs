#!/usr/bin/env node
// Verificação de i18n: paridade de chaves PT/EN + compilação ICU.
// Uso: node scripts/verify-i18n.mjs
// Sai com código 1 se houver qualquer divergência de chave ou erro de ICU.
//
// Dica: o `npx tsc --noEmit` "puro" pode ser mascarado por erros de parse em
// .next/dev/types — para type-check confiável use:
//   npx tsc -p tsconfig.check.json --noEmit

import fs from "fs";
import path from "path";
import { parse } from "@formatjs/icu-messageformat-parser";

const base = "messages";
const ptDir = path.join(base, "pt-BR");
const enDir = path.join(base, "en");
const files = fs.readdirSync(ptDir).filter((f) => f.endsWith(".json"));

function flat(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flat(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) flat(obj[k], prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = obj;
  }
  return out;
}

let parityErrors = 0;
let icuErrors = 0;
let nsCount = 0;

for (const file of files) {
  const pt = JSON.parse(fs.readFileSync(path.join(ptDir, file), "utf8"));
  const enPath = path.join(enDir, file);
  if (!fs.existsSync(enPath)) {
    console.log(`❌ EN ausente: ${file}`);
    parityErrors++;
    continue;
  }
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const fp = flat(pt);
  const fe = flat(en);
  const pk = new Set(Object.keys(fp));
  const ek = new Set(Object.keys(fe));
  for (const k of pk) if (!ek.has(k)) { console.log(`❌ ${file}: chave em PT mas não em EN -> ${k}`); parityErrors++; }
  for (const k of ek) if (!pk.has(k)) { console.log(`❌ ${file}: chave em EN mas não em PT -> ${k}`); parityErrors++; }
  for (const [dir, obj] of [["pt-BR", fp], ["en", fe]]) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "string") continue;
      try { parse(v); } catch (e) { console.log(`❌ ICU ${dir}/${file} :: ${k} -> ${e.message}`); icuErrors++; }
    }
  }
  nsCount++;
}

console.log(`\nNamespaces: ${nsCount} | Erros de paridade: ${parityErrors} | Erros ICU: ${icuErrors}`);
process.exit(parityErrors + icuErrors > 0 ? 1 : 0);
