import type { Category } from '@/lib/api/types';
import { translatedCategoryMatches } from '@/lib/transaction-search';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const tree: Category[] = [
  {
    id: 'food',
    name: 'Food',
    type: 'expense',
    is_system: true,
    children: [{ id: 'dining', parent_id: 'food', name: 'Dining Out', type: 'expense', is_system: true }],
  },
  { id: 'household', name: 'Household', type: 'expense', is_system: true },
  { id: 'groceries', name: 'Groceries', type: 'expense', is_system: true },
  // A user's own category is shown as typed; the API matches its name.
  { id: 'mine', name: 'Food', type: 'expense', is_system: false },
];

describe('translatedCategoryMatches', () => {
  it('finds system categories by their Thai name, subcategories included', () => {
    expect(translatedCategoryMatches('อาหาร', tree)).toEqual(['food']);
    expect(translatedCategoryMatches(' กินข้าว ', tree)).toEqual(['dining']);
    expect(translatedCategoryMatches('ของใช้', tree)).toEqual(['household', 'groceries']);
  });

  it('leaves English names and empty queries to the API', () => {
    expect(translatedCategoryMatches('food', tree)).toEqual([]);
    expect(translatedCategoryMatches('  ', tree)).toEqual([]);
  });
});
