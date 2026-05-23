/**
 * excel-report.ts
 *
 * Thin helper around `exceljs` to generate formatted .xlsx files
 * for AXIEL reports. Keeps column widths, header styling, and response
 * handling in one place so each route just passes rows + column definitions.
 */
import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  /** key in each row object */
  key: string;
  /** column width in characters (default 20) */
  width?: number;
}

export interface ExcelSheetInput {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null | undefined>[];
}

/**
 * Build a single-sheet or multi-sheet Excel workbook and return it as a Buffer.
 * This function is async because exceljs uses Promises internally.
 */
export async function buildExcelBuffer(sheets: ExcelSheetInput[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31)); // Excel sheet name max 31 chars

    // Define columns (sets header row + column widths in one step)
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 20,
    }));

    // Style the header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.commit();

    // Add data rows
    for (const row of sheet.rows) {
      const values: Record<string, string | number> = {};
      for (const col of sheet.columns) {
        values[col.key] = row[col.key] ?? "";
      }
      ws.addRow(values).commit();
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
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
