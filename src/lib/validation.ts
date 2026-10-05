import { t } from '@/lib/i18n';

/**
 * Client-side copies of the API's input rules (money-api/internal/validate),
 * so forms catch problems before a round trip. The API still enforces them.
 */

export const MIN_PASSWORD_CHARS = 8;
/** bcrypt hashes at most 72 bytes; the API rejects longer passwords. */
export const MAX_PASSWORD_BYTES = 72;
export const MAX_DISPLAY_NAME = 60;

/** UTF-8 length in bytes (Thai characters are 3 bytes each). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Characters, counted the way people (and the API) count them: one per emoji. */
export function charCount(text: string): number {
  return Array.from(text).length;
}

// Control characters (NUL, line breaks, ...) are never valid in single-line input.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** Why a new password is not acceptable, or null when it is. */
export function passwordProblem(password: string): string | null {
  if (password.trim() === '') return t('Password can not be only spaces');
  if (charCount(password) < MIN_PASSWORD_CHARS) return t('Use at least 8 characters');
  if (utf8Length(password) > MAX_PASSWORD_BYTES) return t('Password is too long');
  if (CONTROL.test(password)) return t('Password contains invalid characters');
  return null;
}

/** Why a display name is not acceptable, or null when it is. */
export function displayNameProblem(name: string): string | null {
  if (charCount(name.trim()) > MAX_DISPLAY_NAME) return t('Keep the name under 60 characters');
  if (CONTROL.test(name)) return t('Name contains invalid characters');
  return null;
}
