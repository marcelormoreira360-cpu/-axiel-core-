// Export CSV simples, compatível com Excel pt-BR (delimitador ';' + BOM UTF-8).
// Usado pelo módulo Financeiro (ERP Fase 6) para exportar os dashboards.

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const s = value == null ? "" : String(value);
  // Aspas se o campo tem o delimitador, aspa ou quebra de linha.
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Monta uma string CSV (com BOM) a partir de cabeçalhos + linhas. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escapeCell).join(";")];
  for (const row of rows) lines.push(row.map(escapeCell).join(";"));
  return "﻿" + lines.join("\r\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
