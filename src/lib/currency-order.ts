/**
 * Order for currency chips: the user's main currency first, then THB (the
 * app's home market), then the rest alphabetically. Pass a stable `preferred`
 * (the saved setting, not the chip being picked) so chips don't jump around.
 */
export function orderCurrencies(codes: readonly string[], preferred?: string | null): string[] {
  const rank = (code: string) => (code === preferred ? 0 : code === 'THB' ? 1 : 2);
  return [...new Set(codes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
