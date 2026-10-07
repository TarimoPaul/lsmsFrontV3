import { LanguageService } from './language.service';

/** "Good morning / afternoon / evening" for the current hour. */
export function greeting(i18n: LanguageService, hour = new Date().getHours()): string {
  if (hour < 12) return i18n.t('Good morning', 'Habari za asubuhi');
  if (hour < 17) return i18n.t('Good afternoon', 'Habari za mchana');
  return i18n.t('Good evening', 'Habari za jioni');
}
