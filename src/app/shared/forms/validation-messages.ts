import { AppLanguage } from '../../core/i18n/language.service';

/** Port of Flutter `ValidationMessages` — bilingual form error templates. */
const MESSAGES: Record<string, Record<AppLanguage, string>> = {
  required: { sw: '{field} ni lazima', en: '{field} is required' },
  email: { sw: 'Barua pepe si sahihi', en: 'Invalid email address' },
  phone: {
    sw: 'Nambari ya simu si sahihi (tumia 0xxx... au +255xxx...)',
    en: 'Invalid phone number (use 0xxx... or +255xxx...)',
  },
  numeric: { sw: '{field} lazima iwe namba', en: '{field} must be a number' },
  positive: { sw: '{field} lazima iwe chanya (> 0)', en: '{field} must be positive (> 0)' },
  minValue: { sw: '{field} lazima iwe angalau {min}', en: '{field} must be at least {min}' },
  maxValue: { sw: '{field} lazima isije zaidi ya {max}', en: '{field} cannot exceed {max}' },
  minLength: {
    sw: '{field} lazima iwe na angalau {length} herufi',
    en: '{field} must be at least {length} characters',
  },
  maxLength: {
    sw: '{field} inaweza kuwa na upeo wa {length} herufi',
    en: '{field} cannot exceed {length} characters',
  },
  range: { sw: '{field} lazima iwe kati ya {min} na {max}', en: '{field} must be between {min} and {max}' },
  currency: { sw: '{field} lazima iwe bei halali', en: '{field} must be a valid currency amount' },
  date: { sw: '{field} lazima iwe tarehe halali', en: '{field} must be a valid date' },
  match: { sw: '{field} lazima ilingane na {match}', en: '{field} must match {match}' },
  passwordMismatch: { sw: 'Manenosiri hayalingani', en: 'Passwords do not match' },
  personName: {
    sw: 'Jina liwe herufi 2-50 na liwe na herufi tu',
    en: 'Name must be 2-50 characters and contain only letters',
  },
  fullName: { sw: 'Weka jina la kwanza na la mwisho', en: 'Enter your first and last name' },
  passwordStrength: {
    sw: 'Nenosiri halikidhi masharti yaliyo hapa chini',
    en: 'Password does not meet the requirements below',
  },
};

export interface MessageParams {
  field?: string;
  min?: number;
  max?: number;
  length?: number;
  match?: string;
}

export function validationMessage(key: string, lang: AppLanguage, params: MessageParams = {}): string {
  let msg = MESSAGES[key]?.[lang] ?? MESSAGES[key]?.['en'] ?? key;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) msg = msg.replaceAll(`{${k}}`, String(v));
  }
  return msg;
}
