import { LanguageService } from '@core/i18n/language.service';
import { DialogService } from '@shared/ui';
import { Money } from '@shared/utils/money';

/** One line of the "crate or bottle?" confirm: product, cost per piece now, ×ratio, reference cost. */
export interface CostJumpRow {
  name: string;
  costPerPiece: number;
  ratio: number;
  reference: number;
}

/**
 * (owner bo/cf/cg) "Kreti au chupa?" before saving a purchase whose cost per piece jumped past ×3 / below ⅓ of the
 * reference. Same text on every way in (Repurchase, new purchase, edit). true = save anyway. Never refuses.
 */
export async function confirmCostJump(dialogs: DialogService, i18n: LanguageService, rows: CostJumpRow[]): Promise<boolean> {
  if (!rows.length) return true;
  const list = rows
    .map((r) => `• ${r.name}: ${Money.format(r.costPerPiece)}/${i18n.t('piece', 'kipande')} — ×${r.ratio} ${i18n.t('of the last', 'ya mwisho')} (${Money.format(r.reference)})`)
    .join('\n');
  return dialogs.confirm({
    title: i18n.t('Crate or bottle?', 'Kreti au chupa?'),
    message: i18n.t(
      `The cost per piece is far from the last purchase:\n${list}\n\nCheck the type (crate / piece) and the price before sending.`,
      `Bei kwa kipande iko mbali sana na manunuzi ya mwisho:\n${list}\n\nKagua aina (kreti / kipande) na bei kabla ya kutuma.`,
    ),
    confirmText: i18n.t('The price is right — send', 'Bei ni sahihi — tuma'),
    cancelText: i18n.t('Fix it', 'Rekebisha'),
  });
}
