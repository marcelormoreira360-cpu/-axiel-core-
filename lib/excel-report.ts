/**
 * excel-report.ts
 *
 * Thin helper around the `xlsx` package to generate formatted .xlsx files
 * for AXIEL reports. Keeps column widths, header styling, and BOM handling
 * in one place so each route just passes rows + column definitions.
 */
import * as XLSX from "xlsx";

export interface ExcelColumn {
  header: string;
  /** key in each row object */
  key: string;
  /** column width in characters (default 18) */
  width?: number;
}

export interface ExcelSheetInput {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null | undefined>[];
}

/**
 * Build a single-sheet or multi-sheet Excel workbook and return it as a Buffer.
 */
export function buildExcelBuffer(sheets: ExcelSheetInput[]): Buffer {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    // Build AOA (array of arrays): header row + data rows
    const headerRow = sheet.columns.map((c) => c.header);
    const dataRows  = sheet.rows.map((row) =>
      sheet.columns.map((c) => row[c.key] ?? "")
    );

    const aoa = [headerRow, ...dataRows];
    const ws  = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws["!cols"] = sheet.columns.map((c) => ({ wch: c.width ?? 20 }));

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Excel sheet name max 31 chars
  }

  // Write to buffer (type "buffer" returns Buffer in Node)
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf;
}

/**
 * Returns a Next.js Response with proper Excel headers.
 */
export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
