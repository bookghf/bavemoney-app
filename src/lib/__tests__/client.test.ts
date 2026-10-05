import { redact } from '@/lib/api/client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

describe('redact', () => {
  it('masks every password and token field, nested too', () => {
    expect(
      redact({
        email: 'a@b.co',
        password: 'p',
        current_password: 'old',
        new_password: 'new',
        refresh_token: 'r',
        session: { access_token: 'a', fcm_token: 'f' },
        list: [{ token: 't', amount: '17.00' }],
      }),
    ).toEqual({
      email: 'a@b.co',
      password: '***',
      current_password: '***',
      new_password: '***',
      refresh_token: '***',
      session: { access_token: '***', fcm_token: '***' },
      list: [{ token: '***', amount: '17.00' }],
    });
  });

  it('leaves plain values alone', () => {
    expect(redact('text')).toBe('text');
    expect(redact(null)).toBeNull();
  });
});
