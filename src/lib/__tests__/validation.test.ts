import { charCount, displayNameProblem, passwordProblem, utf8Length } from '@/lib/validation';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

describe('passwordProblem', () => {
  it('accepts normal and Thai passwords', () => {
    expect(passwordProblem('correct horse')).toBeNull();
    expect(passwordProblem('รหัสผ่านยาวมาก')).toBeNull();
  });

  it.each([
    ['only spaces', '        '],
    ['too short', '1234567'],
    ['over 72 bytes', 'a'.repeat(73)],
    ['25 Thai characters = 75 bytes', 'ก'.repeat(25)],
    ['NUL', 'abc\u0000defgh'],
  ])('rejects %s', (_, password) => {
    expect(passwordProblem(password)).not.toBeNull();
  });
});

describe('displayNameProblem', () => {
  it('counts emoji as one character', () => {
    expect(charCount('😀'.repeat(60))).toBe(60);
    expect(displayNameProblem('😀'.repeat(60))).toBeNull();
    expect(displayNameProblem('😀'.repeat(61))).not.toBeNull();
  });

  it('rejects control characters', () => {
    expect(displayNameProblem('a\u0000b')).not.toBeNull();
    expect(displayNameProblem('line\nbreak')).not.toBeNull();
  });
});

it('measures UTF-8 bytes', () => {
  expect(utf8Length('abc')).toBe(3);
  expect(utf8Length('ก')).toBe(3);
  expect(utf8Length('😀')).toBe(4);
});
