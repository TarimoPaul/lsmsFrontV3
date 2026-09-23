import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { AppLanguage } from '../../core/i18n/language.service';
import { Money } from '../utils/money';
import { validationMessage } from './validation-messages';

/**
 * Port of Flutter `FormValidators` as Angular ValidatorFns.
 *
 * Each validator returns `{ key: params }` so the error can be rendered in the
 * active language at display time via `formErrorMessage()` (the text-field
 * component does this automatically).
 */

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

const TZ_PHONE = /^(0|255|\+255)\d{9}$/;
const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const LsmsValidators = {
  required(field = 'Field'): ValidatorFn {
    return (c) => (isEmpty(c.value) ? { required: { field } } : null);
  },

  email(): ValidatorFn {
    return (c) => (isEmpty(c.value) || EMAIL.test(String(c.value).trim()) ? null : { email: {} });
  },

  /** Tanzanian numbers: 0xxxxxxxxx, 255xxxxxxxxx, +255xxxxxxxxx. */
  phone(): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      const phone = String(c.value).replaceAll(' ', '').trim();
      return TZ_PHONE.test(phone) ? null : { phone: {} };
    };
  },

  numeric(field = 'Field', min?: number, max?: number): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      const n = Number(String(c.value).replaceAll(',', ''));
      if (!Number.isFinite(n)) return { numeric: { field } };
      if (min !== undefined && n < min) return { minValue: { field, min } };
      if (max !== undefined && n > max) return { maxValue: { field, max } };
      return null;
    };
  },

  positive(field = 'Field'): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      const n = Number(String(c.value).replaceAll(',', ''));
      if (!Number.isFinite(n)) return { numeric: { field } };
      return n > 0 ? null : { positive: { field } };
    };
  },

  currency(field = 'Amount', min?: number, max?: number): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      const n = typeof c.value === 'number' ? c.value : Money.parse(String(c.value));
      if (n === null || !Number.isFinite(n)) return { currency: { field } };
      if (min !== undefined && n < min) return { minValue: { field, min } };
      if (max !== undefined && n > max) return { maxValue: { field, max } };
      return null;
    };
  },

  minLength(length: number, field = 'Field'): ValidatorFn {
    return (c) =>
      isEmpty(c.value) || String(c.value).trim().length >= length ? null : { minLength: { field, length } };
  },

  maxLength(length: number, field = 'Field'): ValidatorFn {
    return (c) =>
      isEmpty(c.value) || String(c.value).length <= length ? null : { maxLength: { field, length } };
  },

  /** Letters and spaces only, 2–50 chars (Flutter AuthValidationUtils.validateName). */
  personName(): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      const v = String(c.value).trim();
      return v.length >= 2 && v.length <= 50 && /^[a-zA-Z\s]+$/.test(v) ? null : { personName: {} };
    };
  },

  /** First AND last name, each ≥2 letters (backend UserDto requires both). */
  fullName(): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      const parts = String(c.value).trim().split(/\s+/);
      return parts.length >= 2 && parts[0].length >= 2 && parts.slice(1).join(' ').length >= 2 ? null : { fullName: {} };
    };
  },

  /** 8–50 chars with upper, lower, digit and special character (backend policy). */
  strongPassword(): ValidatorFn {
    return (c) => {
      if (isEmpty(c.value)) return null;
      return passwordRules(String(c.value)).every((r) => r.ok) ? null : { passwordStrength: {} };
    };
  },

  /** Confirm-password: must equal the sibling `otherControlName`. */
  passwordMatch(otherControlName = 'password'): ValidatorFn {
    return (c: AbstractControl) => {
      const other = c.parent?.get(otherControlName);
      if (!other || isEmpty(c.value)) return null;
      return c.value === other.value ? null : { passwordMismatch: {} };
    };
  },

  /** Control must equal another control in the same group (e.g. confirm password). */
  match(otherControlName: string, field = 'Field', matchLabel = otherControlName): ValidatorFn {
    return (c: AbstractControl) => {
      const other = c.parent?.get(otherControlName);
      if (!other || isEmpty(c.value)) return null;
      return c.value === other.value ? null : { match: { field, match: matchLabel } };
    };
  },
};

export interface PasswordRule {
  key: 'length' | 'case' | 'number' | 'special';
  ok: boolean;
  en: string;
  sw: string;
}

/** Live checklist shown under the register / reset password fields. */
export function passwordRules(pw: string): PasswordRule[] {
  return [
    { key: 'length', ok: pw.length >= 8 && pw.length <= 50, en: 'At least 8 characters', sw: 'Angalau herufi 8' },
    {
      key: 'case',
      ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw),
      en: 'Upper & lower case letters',
      sw: 'Herufi kubwa na ndogo',
    },
    { key: 'number', ok: /[0-9]/.test(pw), en: 'At least one number', sw: 'Angalau namba moja' },
    { key: 'special', ok: /[!@#$%^&*(),.?":{}|<>]/.test(pw), en: 'One special character', sw: 'Alama maalum moja' },
  ];
}

/** Angular built-in error keys mapped onto our message templates. */
const BUILTIN_KEYS: Record<string, string> = {
  minlength: 'minLength',
  maxlength: 'maxLength',
  min: 'minValue',
  max: 'maxValue',
};

/** First error on a control rendered as a human message in [lang]. */
export function formErrorMessage(errors: ValidationErrors | null, lang: AppLanguage, field = 'Field'): string | null {
  if (!errors) return null;
  const [rawKey, raw] = Object.entries(errors)[0];
  if (typeof raw === 'string') return raw; // custom validators may return a ready message
  const key = BUILTIN_KEYS[rawKey] ?? rawKey;
  const params = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return validationMessage(key, lang, {
    field: (params['field'] as string) ?? field,
    min: (params['min'] as number) ?? (params['requiredLength'] as number),
    max: (params['max'] as number) ?? (params['requiredLength'] as number),
    length: (params['length'] as number) ?? (params['requiredLength'] as number),
    match: params['match'] as string,
  });
}
