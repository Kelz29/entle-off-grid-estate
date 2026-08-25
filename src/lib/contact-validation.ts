/** Simple contact field checks for booking forms and APIs. */

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Digits only count toward length (SA mobiles are typically 9–11 after stripping). */
const PHONE_MIN_DIGITS = 9;
const PHONE_MAX_DIGITS = 15;
const PHONE_MAX_CHARS = 20;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (email.length < 5 || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export function phoneDigitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * Optional phone: empty is OK.
 * If provided, allow digits and common separators (+, spaces, dashes, parentheses).
 */
export function isValidPhone(value: string, { required = false } = {}): boolean {
  const raw = value.trim();
  if (!raw) return !required;
  if (raw.length > PHONE_MAX_CHARS) return false;
  if (!/^[+\d][\d\s()./-]*$/.test(raw)) return false;
  const digits = phoneDigitCount(raw);
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your email address.";
  if (!isValidEmail(trimmed)) return "Enter a valid email address.";
  return null;
}

export function phoneError(
  value: string,
  { required = false } = {}
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? "Enter your phone number." : null;
  }
  if (!isValidPhone(trimmed, { required: true })) {
    return "Enter a valid phone number (digits only, with optional + and spaces).";
  }
  return null;
}
