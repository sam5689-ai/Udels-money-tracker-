import ExcelJS from "exceljs";

export interface ParsedRow {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number; // positive = money in, negative = money out
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  warnings: string[];
}

const DATE_HEADERS = ["date", "transaction date", "posting date", "value date", "trans date"];
const DESC_HEADERS = [
  "description",
  "details",
  "narrative",
  "memo",
  "reference",
  "transaction description",
  "payee",
  "merchant",
];
const AMOUNT_HEADERS = ["amount", "value", "transaction amount"];
const DEBIT_HEADERS = ["debit", "paid out", "withdrawal", "money out", "out", "debit amount"];
const CREDIT_HEADERS = ["credit", "paid in", "deposit", "money in", "in", "credit amount"];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  // fallback: partial match
  for (let i = 0; i < normalized.length; i++) {
    for (const candidate of candidates) {
      if (normalized[i].includes(candidate)) return i;
    }
  }
  return -1;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const hasDate = findColumn(cells, DATE_HEADERS) !== -1;
  const hasAmount =
    findColumn(cells, AMOUNT_HEADERS) !== -1 ||
    (findColumn(cells, DEBIT_HEADERS) !== -1 && findColumn(cells, CREDIT_HEADERS) !== -1) ||
    findColumn(cells, DEBIT_HEADERS) !== -1 ||
    findColumn(cells, CREDIT_HEADERS) !== -1;
  const hasDesc = findColumn(cells, DESC_HEADERS) !== -1;
  return hasDate && hasAmount && hasDesc;
}

export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  const drMatch = /\b(DR|DEBIT)\b/i.test(s);
  const crMatch = /\b(CR|CREDIT)\b/i.test(s);
  s = s.replace(/[£$€,]/g, "").replace(/\b(DR|CR|DEBIT|CREDIT)\b/gi, "").trim();
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  const num = parseFloat(s);
  if (Number.isNaN(num)) return null;
  let result = negative ? -num : num;
  if (drMatch && result > 0) result = -result;
  if (crMatch && result < 0) result = -result;
  return result;
}

export function parseDateValue(raw: string | Date): string | null {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return toIso(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }
  const s = String(raw).trim();
  if (s === "") return null;

  // ISO: 2024-01-31
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  // DD/MM/YYYY or DD-MM-YYYY (UK bank statements default)
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    let year = +y;
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const day = +d;
    const month = +mo;
    if (month > 12 && day <= 12) return toIso(year, day, month); // swapped
    return toIso(year, month, day);
  }

  // "31 Jan 2024" or "Jan 31 2024"
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (m) {
    const mi = monthNames.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi !== -1) return toIso(+m[3], mi + 1, +m[1]);
  }
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const mi = monthNames.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi !== -1) return toIso(+m[3], mi + 1, +m[2]);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return null;
}

function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToParsed(grid: string[][]): ParseResult {
  const warnings: string[] = [];
  const nonEmptyGrid = grid.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

  let headerIdx = -1;
  for (let i = 0; i < Math.min(nonEmptyGrid.length, 15); i++) {
    if (looksLikeHeaderRow(nonEmptyGrid[i].map((c) => String(c ?? "")))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    warnings.push("Could not find a header row with recognizable date/description/amount columns.");
    return { rows: [], warnings };
  }

  const headers = nonEmptyGrid[headerIdx].map((c) => String(c ?? ""));
  const dateCol = findColumn(headers, DATE_HEADERS);
  const descCol = findColumn(headers, DESC_HEADERS);
  const amountCol = findColumn(headers, AMOUNT_HEADERS);
  const debitCol = findColumn(headers, DEBIT_HEADERS);
  const creditCol = findColumn(headers, CREDIT_HEADERS);

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < nonEmptyGrid.length; i++) {
    const r = nonEmptyGrid[i];
    const rawObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawObj[h || `col_${idx}`] = String(r[idx] ?? "");
    });

    const dateRaw = dateCol !== -1 ? r[dateCol] : "";
    const date = parseDateValue(dateRaw ?? "");
    const description = descCol !== -1 ? String(r[descCol] ?? "").trim() : "";

    let amount: number | null = null;
    if (amountCol !== -1) {
      amount = parseAmount(String(r[amountCol] ?? ""));
    } else if (debitCol !== -1 || creditCol !== -1) {
      const debit = debitCol !== -1 ? parseAmount(String(r[debitCol] ?? "")) : null;
      const credit = creditCol !== -1 ? parseAmount(String(r[creditCol] ?? "")) : null;
      if (debit != null && debit !== 0) amount = -Math.abs(debit);
      else if (credit != null && credit !== 0) amount = Math.abs(credit);
    }

    if (!date || !description || amount == null) {
      continue;
    }
    rows.push({ date, description, amount, raw: rawObj });
  }

  if (rows.length === 0) {
    warnings.push("Header row was found but no valid transaction rows could be parsed.");
  }

  return { rows, warnings };
}

export async function parseCsv(text: string): Promise<ParseResult> {
  const grid = parseCsvText(text);
  return rowsToParsed(grid);
}

export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParseResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseCsv(buffer.toString("utf-8"));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { rows: [], warnings: ["No worksheet found in the uploaded file."] };
  }

  const grid: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v == null) {
        cells.push("");
      } else if (v instanceof Date) {
        cells.push(v.toISOString());
      } else if (typeof v === "object" && "result" in (v as object)) {
        cells.push(String((v as { result: unknown }).result ?? ""));
      } else if (typeof v === "object" && "text" in (v as object)) {
        cells.push(String((v as { text: unknown }).text ?? ""));
      } else {
        cells.push(String(v));
      }
    });
    grid.push(cells);
  });

  return rowsToParsed(grid);
}
