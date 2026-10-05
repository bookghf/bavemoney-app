/**
 * CSV import parsing, done in the app so the user sees a preview before
 * anything is saved. Understands BaveMoney's own export and spreadsheet-style
 * files such as a Google Sheet ledger: Thai or English headers, dates only on
 * the first row of each day, amounts like "฿1,234.00".
 */
import type { Category } from '@/lib/api/types';
import { TH } from '@/lib/i18n-th';
import { parseAmountInput } from '@/lib/money';

/** RFC 4180 parsing: quoted fields, escaped quotes, newlines inside quotes. */
export function parseCSV(text: string): string[][] {
  const input = text.replace(/^﻿/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export type ColumnMap = {
  date: number;
  amount: number;
  time?: number;
  type?: number;
  note?: number;
  category?: number;
  subcategory?: number;
  account?: number;
};

const find = (headers: string[], pattern: RegExp, except?: RegExp) =>
  headers.findIndex((header) => pattern.test(header) && !(except && except.test(header)));

/**
 * Which column holds what, from the header row. Returns null when there is no
 * recognizable date and amount column.
 */
export function detectColumns(headerRow: string[]): ColumnMap | null {
  const headers = headerRow.map((h) => h.trim().toLowerCase());
  const date = find(headers, /^(date|วันที่|วัน)$/);
  // Prefer the line total ("ราคา", "amount") over a unit price ("ราคา/หน่วย").
  let amount = find(headers, /^(amount|ราคา|total|จำนวนเงิน|ยอด|price)$/);
  if (amount < 0) amount = find(headers, /(amount|ราคา|จำนวนเงิน|price)/, /(หน่วย|unit|รวมต่อ|per)/);
  if (date < 0 || amount < 0) return null;

  const optional = (index: number) => (index >= 0 ? index : undefined);
  return {
    date,
    amount,
    time: optional(find(headers, /^(time|เวลา)$/)),
    type: optional(find(headers, /^(type|ประเภท)$/)),
    note: optional(find(headers, /^(note|notes|รายการ|description|item|details?|memo|บันทึก)$/)),
    category: optional(find(headers, /(category|หมวด)/, /(sub|ย่อย)/)),
    subcategory: optional(find(headers, /(subcategory|หมวดย่อย)/)),
    account: optional(find(headers, /^(account|บัญชี)$/)),
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
  'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
};

/** Buddhist-era years (2500+) become Gregorian; two-digit years mean 20xx. */
function fullYear(year: number): number {
  if (year > 2400) return year - 543;
  if (year < 100) return 2000 + year;
  return year;
}

function valid(y: number, m: number, d: number): { y: number; m: number; d: number } | null {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? { y, m, d } : null;
}

/**
 * Calendar date from common spreadsheet formats: 2026-07-30,
 * "Thursday, July 30, 2026", "30 Jul 2026", "30 ก.ค. 2569", 30/07/2026
 * (day first, as in Thailand).
 */
export function parseDate(text: string): { y: number; m: number; d: number } | null {
  const s = text.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) return valid(fullYear(+match[1]), +match[2], +match[3]);

  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (match) return valid(fullYear(+match[3]), +match[2], +match[1]);

  // "July 30, 2026" with an optional weekday in front.
  match = /([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (match && MONTHS[match[1].slice(0, 3).toLowerCase()]) {
    return valid(fullYear(+match[3]), MONTHS[match[1].slice(0, 3).toLowerCase()], +match[2]);
  }
  // "30 July 2026", "30 ก.ค. 2569".
  match = /(\d{1,2})\s+([A-Za-z]{3,}|[ก-๙.]+)\.?\s+(\d{4})/.exec(s);
  if (match) {
    const key = /[A-Za-z]/.test(match[2]) ? match[2].slice(0, 3).toLowerCase() : match[2];
    if (MONTHS[key]) return valid(fullYear(+match[3]), MONTHS[key], +match[1]);
  }
  return null;
}

export type DraftRow = {
  /** 1-based line in the file, for error messages. */
  line: number;
  date: { y: number; m: number; d: number };
  minutes: number | null;
  type: 'income' | 'expense';
  amount: string;
  note: string;
  category: string;
  subcategory: string;
  account: string;
};

export type ParseResult = {
  rows: DraftRow[];
  problems: { line: number; message: string }[];
  /** Transfers can not be imported as single rows and are left out. */
  skippedTransfers: number;
};

function typeOf(raw: string): 'income' | 'expense' | 'transfer' | null {
  const value = raw.trim().toLowerCase();
  if (value === '' || /^(expense|รายจ่าย|จ่าย|out)$/.test(value)) return 'expense';
  if (/^(income|รายรับ|รับ|in)$/.test(value)) return 'income';
  if (/^(transfer|โอน)$/.test(value)) return 'transfer';
  return null;
}

/** Rows from a parsed file: blank and summary-only lines are ignored. */
export function toDraftRows(records: string[][], columns: ColumnMap): ParseResult {
  const result: ParseResult = { rows: [], problems: [], skippedTransfers: 0 };
  const cell = (record: string[], index?: number) => (index === undefined ? '' : (record[index] ?? '').trim());
  let currentDate: DraftRow['date'] | null = null;

  records.slice(1).forEach((record, i) => {
    const line = i + 2;
    const rawDate = cell(record, columns.date);
    if (rawDate) {
      const parsed = parseDate(rawDate);
      if (!parsed) {
        result.problems.push({ line, message: `Unreadable date "${rawDate}"` });
        return;
      }
      currentDate = parsed;
    }
    const rawAmount = cell(record, columns.amount);
    const note = cell(record, columns.note);
    // A line with no item and no real amount is a spacer, a totals row, or
    // an unused template row (spreadsheets often prefill "฿0.00").
    const zero = !rawAmount || /^[0.]+$/.test(parseAmountInput(rawAmount) ?? 'x');
    if (!note && zero) return;
    if (!currentDate) {
      result.problems.push({ line, message: 'No date above this row' });
      return;
    }
    const amount = parseAmountInput(rawAmount);
    if (!amount || /^[0.]+$/.test(amount)) {
      result.problems.push({ line, message: `Unreadable amount "${rawAmount}"` });
      return;
    }
    const type = typeOf(cell(record, columns.type));
    if (type === null) {
      result.problems.push({ line, message: `Unknown type "${cell(record, columns.type)}"` });
      return;
    }
    if (type === 'transfer') {
      result.skippedTransfers++;
      return;
    }
    const time = /^(\d{1,2}):(\d{2})/.exec(cell(record, columns.time));
    result.rows.push({
      line,
      date: currentDate,
      minutes: time ? +time[1] * 60 + +time[2] : null,
      type,
      amount,
      note,
      category: cell(record, columns.category),
      subcategory: cell(record, columns.subcategory),
      account: cell(record, columns.account),
    });
  });
  return result;
}

/**
 * RFC 3339 timestamp for a row in local time. Rows without a time are spread
 * from noon, one minute apart, so they keep the file's order within a day.
 */
export function occurredAt(row: DraftRow, indexInDay: number): string {
  const minutes = row.minutes ?? 12 * 60 + indexInDay;
  return new Date(row.date.y, row.date.m - 1, row.date.d, Math.floor(minutes / 60), minutes % 60).toISOString();
}

/** How a CSV category name resolves: an existing category or one to create. */
export type Resolution = { key: string; type: 'income' | 'expense'; top: string; sub: string; topId?: string; subId?: string };

/**
 * Case-insensitive match on the English name or its Thai translation, in
 * either app language: a sheet saying "อาหาร" matches Food even in English.
 */
function sameName(category: Category, name: string): boolean {
  const wanted = name.trim().toLowerCase();
  const thai = TH[`category:${category.name}`];
  return category.name.toLowerCase() === wanted || (!!thai && thai.toLowerCase() === wanted);
}

/** Tag on every imported row; also used to spot a second import of the same file. */
export const importTag = (fileName: string) => `import:${fileName}`.slice(0, 50);

export function resolveCategories(rows: DraftRow[], tree: Category[]): Resolution[] {
  const seen = new Map<string, Resolution>();
  for (const row of rows) {
    if (!row.category) continue;
    const key = `${row.type}|${row.category.toLowerCase()}|${row.subcategory.toLowerCase()}`;
    if (seen.has(key)) continue;
    const top = tree.find((c) => c.type === row.type && sameName(c, row.category));
    const sub = row.subcategory && top ? (top.children ?? []).find((c) => sameName(c, row.subcategory)) : undefined;
    seen.set(key, { key, type: row.type, top: row.category, sub: row.subcategory, topId: top?.id, subId: sub?.id });
  }
  return [...seen.values()];
}
