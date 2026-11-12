import { LanguageService } from '@core/i18n/language.service';
import { DialogService } from '@shared/ui';

import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';

/** Same minimum the server enforces (SaleChangeGuard.MIN_REASON). */
export const SALE_REASON_MIN = 10;

/**
 * 2.4.0 A6: deleting or changing a sale needs a reason; the server records it with the user and tells the CEO.
 * A sale of a day whose reconciliation is approved cannot be changed; reopened — CEO only. Resolves to the
 * trimmed reason, or undefined when cancelled.
 */
export function askSaleReason(
  dialogs: DialogService,
  i18n: LanguageService,
  o: { title: string; message: string; confirm: string; danger?: boolean },
): Promise<string | undefined> {
  const rule = i18n.t(
    'The reason is recorded with your name and the CEO is told. A sale of a day whose reconciliation is approved cannot be changed.',
    'Sababu inarekodiwa pamoja na jina lako na CEO anaarifiwa. Mauzo ya siku ambayo upatanisho umeidhinishwa hayabadilishwi.',
  );
  return dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
    size: 'sm',
    data: {
      title: o.title,
      message: `${o.message}\n\n${rule}`,
      label: i18n.t(`Reason (at least ${SALE_REASON_MIN} characters)`, `Sababu (angalau herufi ${SALE_REASON_MIN})`),
      confirm: o.confirm,
      danger: o.danger ?? true,
      min: SALE_REASON_MIN,
      quality: true,
    },
  });
}

/** Server errorCode when a sale is below its cost and no reason was sent (backend BelowCostGuard, 422). */
export const BELOW_COST_CODE = 'BELOW_COST_REASON';

/**
 * Kazi 3 (owner ec = b): a sale below cost is allowed, but only with a reason; it goes to the CEO's review until
 * "Nimeona". `serverMessage` already says the cost, the total and by how much. Resolves to the reason or undefined.
 */
export function askBelowCostReason(dialogs: DialogService, i18n: LanguageService, serverMessage: string): Promise<string | undefined> {
  return dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
    size: 'sm',
    data: {
      title: i18n.t('Sale below cost', 'Mauzo chini ya gharama'),
      message: `${serverMessage}

${i18n.t(
        'You may continue with a reason. It is recorded with your name and the CEO reviews it.',
        'Unaweza kuendelea kwa kutoa sababu. Inarekodiwa pamoja na jina lako na CEO ataikagua.',
      )}`,
      label: i18n.t(`Reason (at least ${SALE_REASON_MIN} characters)`, `Sababu (angalau herufi ${SALE_REASON_MIN})`),
      confirm: i18n.t('Sell with this reason', 'Uza kwa sababu hii'),
      danger: true,
      min: SALE_REASON_MIN,
      quality: true,
    },
  });
}

/** "Sale deleted — recorded #123 (the CEO sees it)" from the server's answer (A6 puts the audit number in it). */
export function recordedMessage(i18n: LanguageService, serverMessage: string | null): string {
  const id = /#(\d+)/.exec(serverMessage ?? '')?.[1];
  return id
    ? i18n.t(`Sale deleted — recorded #${id}, the CEO sees it`, `Mauzo yamefutwa — yamerekodiwa #${id}, CEO atayaona`)
    : i18n.t('Sale deleted', 'Mauzo yamefutwa');
}
