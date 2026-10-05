import fs from 'fs';
import path from 'path';

import { detectColumns, occurredAt, parseCSV, parseDate, resolveCategories, toDraftRows } from '@/lib/csv';

describe('parseCSV', () => {
  it('handles quotes, commas, newlines, and a BOM', () => {
    expect(parseCSV('﻿a,b\n"x, y","he said ""hi""\nthen left"\r\n\n1,2')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"\nthen left'],
      ['1', '2'],
    ]);
  });
});

describe('parseDate', () => {
  it.each([
    ['2026-07-30', { y: 2026, m: 7, d: 30 }],
    ['Thursday, July 30, 2026', { y: 2026, m: 7, d: 30 }],
    ['30 Jul 2026', { y: 2026, m: 7, d: 30 }],
    ['30 ก.ค. 2569', { y: 2026, m: 7, d: 30 }],
    ['30/07/2026', { y: 2026, m: 7, d: 30 }],
    ['30/07/2569', { y: 2026, m: 7, d: 30 }],
  ])('%p', (input, expected) => {
    expect(parseDate(input)).toEqual(expected);
  });

  it.each(['31/02/2026', 'yesterday', '2026-13-01'])('rejects %p', (input) => {
    expect(parseDate(input)).toBeNull();
  });
});

describe('the sample Google Sheet', () => {
  const file = path.join(__dirname, '..', '..', '..', '..', '..', 'example_data', 'spending.csv');
  const exists = fs.existsSync(file);
  (exists ? it : it.skip)('imports every expense with dates carried down', () => {
    const records = parseCSV(fs.readFileSync(file, 'utf8'));
    const columns = detectColumns(records[0]);
    expect(columns).not.toBeNull();
    // The line total, not the unit price, is the amount.
    expect(records[0][columns!.amount]).toBe('ราคา');

    const { rows, problems } = toDraftRows(records, columns!);
    expect(problems).toEqual([]);
    expect(rows.length).toBeGreaterThan(150);
    expect(rows[0]).toMatchObject({ date: { y: 2026, m: 7, d: 30 }, amount: '144.00', note: 'grab bike', category: 'เดินทาง' });
    // The second row has no date of its own and belongs to the same day.
    expect(rows[1]).toMatchObject({ date: { y: 2026, m: 7, d: 30 }, note: 'ข้าวเที่ยง', amount: '57.00' });
    expect(rows.every((row) => row.type === 'expense')).toBe(true);
  });
});

describe("BaveMoney's own export", () => {
  it('round-trips type, time, account, and categories', () => {
    const csv =
      'date,time,type,amount,currency,account,to_account,category,subcategory,note,tags\n' +
      '2026-07-30,12:30,expense,57.00,THB,Cash,,Food,Dining Out,"ข้าว, เที่ยง",\n' +
      '2026-07-31,09:00,income,30000.00,THB,KBank,,Salary,,,\n' +
      '2026-07-31,10:00,transfer,500.00,THB,KBank,Cash,,,top up,\n';
    const records = parseCSV(csv);
    const { rows, skippedTransfers } = toDraftRows(records, detectColumns(records[0])!);
    expect(skippedTransfers).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: 'expense', amount: '57.00', account: 'Cash', category: 'Food', subcategory: 'Dining Out', note: 'ข้าว, เที่ยง', minutes: 750 });
    expect(rows[1]).toMatchObject({ type: 'income', amount: '30000.00', category: 'Salary' });
    expect(new Date(occurredAt(rows[0], 0)).getHours()).toBe(12);
  });

  it('reports unreadable rows with their line numbers', () => {
    const records = parseCSV('date,amount\nsoon,5\n2026-07-30,abc\n2026-07-30,5');
    const { rows, problems } = toDraftRows(records, detectColumns(records[0])!);
    expect(rows).toHaveLength(1);
    expect(problems.map((p) => p.line)).toEqual([2, 3]);
  });
});

describe('resolveCategories', () => {
  const tree = [
    { id: 'food', name: 'Food', type: 'expense', is_system: true, children: [{ id: 'dining', name: 'Dining Out', type: 'expense', is_system: true }] },
    { id: 'transport', name: 'Transport', type: 'expense', is_system: true },
    { id: 'household', name: 'Household', type: 'expense', is_system: true },
    { id: 'other', name: 'Other', type: 'expense', is_system: true },
  ];
  const row = (category: string, subcategory = '') => ({
    line: 2, date: { y: 2026, m: 7, d: 30 }, minutes: null, type: 'expense' as const, amount: '1', note: '', category, subcategory, account: '',
  });

  it('matches Thai and English names in any app language, and flags the rest', () => {
    const resolved = resolveCategories(
      [row('อาหาร'), row('food', 'dining out'), row('เดินทาง'), row('ของใช้'), row('อื่นๆ'), row('หวย'), row('อาหาร')],
      tree,
    );
    expect(resolved.map((r) => [r.top, r.topId ?? null, r.subId ?? null])).toEqual([
      ['อาหาร', 'food', null],
      ['food', 'food', 'dining'],
      ['เดินทาง', 'transport', null],
      ['ของใช้', 'household', null],
      ['อื่นๆ', 'other', null],
      ['หวย', null, null], // not in this tree: will be created
    ]);
  });
});
