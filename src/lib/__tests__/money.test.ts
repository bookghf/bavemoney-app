import { fromCents, parseAmountInput, parsePositiveAmount, sumAmounts, toCents } from '@/lib/money';

describe('parseAmountInput', () => {
  it.each([
    ['12', '12'],
    ['12.5', '12.5'],
    ['0.01', '0.01'],
    ['1,000', '1000'],
    ['1,234.56', '1234.56'],
    ['12,50', '12.50'],
    [' ฿ 90 ', '90'],
    ['007', '7'],
    ['9999999999999999.99', '9999999999999999.99'],
  ])('accepts %p as %p', (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(['', 'abc', '12abc', '1e5', '1.234', '1,23,4', '12,345,6', '-5', '99999999999999999', '.5', '1..2'])(
    'rejects %p',
    (input) => {
      expect(parseAmountInput(input)).toBeNull();
    },
  );

  it('allows negatives only when asked', () => {
    expect(parseAmountInput('-1,500.50', { allowNegative: true })).toBe('-1500.50');
    expect(parseAmountInput('-0', { allowNegative: true })).toBe('0');
  });
});

describe('parsePositiveAmount', () => {
  it('rejects zero', () => {
    expect(parsePositiveAmount('0')).toBeNull();
    expect(parsePositiveAmount('0.00')).toBeNull();
    expect(parsePositiveAmount('0.01')).toBe('0.01');
  });
});

describe('cents arithmetic', () => {
  it('round-trips', () => {
    expect(toCents('1234.5')).toBe(123450n);
    expect(toCents('-0.05')).toBe(-5n);
    expect(fromCents(-5n)).toBe('-0.05');
    expect(fromCents(123450n)).toBe('1234.50');
  });

  it('sums exactly where floats would drift', () => {
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts(['9999999999999999.99', '0.01'])).toBe('10000000000000000.00');
    expect(sumAmounts(['-12190.25', '116000', '3000', '3000'])).toBe('109809.75');
  });
});
