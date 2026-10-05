import { orderCurrencies } from '@/lib/currency-order';

describe('orderCurrencies', () => {
  it('puts THB first, then the rest alphabetically', () => {
    expect(orderCurrencies(['USD', 'EUR', 'THB'])).toEqual(['THB', 'EUR', 'USD']);
  });

  it("puts the user's main currency ahead of THB", () => {
    expect(orderCurrencies(['EUR', 'THB', 'USD'], 'USD')).toEqual(['USD', 'THB', 'EUR']);
    expect(orderCurrencies(['EUR', 'THB', 'USD'], 'THB')).toEqual(['THB', 'EUR', 'USD']);
  });

  it('copes with a preferred code that is not offered and with duplicates', () => {
    expect(orderCurrencies(['USD', 'EUR', 'USD'], 'JPY')).toEqual(['EUR', 'USD']);
    expect(orderCurrencies([])).toEqual([]);
  });
});
