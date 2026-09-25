import { BusinessProfile } from '@core/data/business.service';
import { parseLocal } from '@shared/utils/date-utils';
import { escapeHtml as esc, printHtml } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { SALE_TYPES, Sale, SaleType, methodLabel } from './sales.models';

/**
 * 80 mm thermal receipt — port of Flutter `ReceiptScreen` (store name + phone,
 * receipt no., lines, totals, payments, balance, thank-you footer). Printed
 * through the browser, so "Save as PDF" also works.
 */
export function printReceipt(sale: Sale, business: BusinessProfile | null, sw: boolean): void {
  const t = (en: string, s: string) => (sw ? s : en);
  const m = (v: number) => Money.format(v, { symbol: false });
  const d = parseLocal(sale.saleDate);
  const when = d ? d.toLocaleString(sw ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const lines = sale.lines
    .map((l) => {
      const type = SALE_TYPES[l.saleType as SaleType];
      const qty = l.saleType === 'PIECES' || !type ? `${l.pieces} × ${m(l.unitPrice)}` : `${l.packages} ${sw ? type.sw : type.en} × ${m(l.unitPrice)}`;
      return `<tr><td colspan="2" class="p">${esc(l.productName)}</td></tr><tr><td class="q">${esc(qty)}</td><td class="n">${m(l.subTotal)}</td></tr>`;
    })
    .join('');
  const payments = sale.payments
    .map((p) => `<tr><td>${esc(methodLabel(p.method, sw))}</td><td class="n">${m(p.amountPaid)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.receiptNumber)}</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { width: 72mm; margin: 0 auto; font: 12px/1.35 ui-monospace, 'Courier New', monospace; color: #000; }
    h1 { font-size: 15px; text-align: center; margin: 0 0 2px; text-transform: uppercase; }
    .c { text-align: center; } .s { font-size: 11px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
    .p { font-weight: 700; padding-top: 4px; } .q { padding-left: 6px; } .n { text-align: right; white-space: nowrap; }
    .tot td { font-size: 14px; font-weight: 800; padding-top: 3px; } .bal td { font-weight: 800; }
  </style></head><body>
    <h1>${esc(business?.name ?? 'LSMS')}</h1>
    ${business?.receiptHeader ? `<div class="c s">${esc(business.receiptHeader)}</div>` : ''}
    ${business?.address ? `<div class="c s">${esc(business.address)}</div>` : ''}
    ${business?.phone ? `<div class="c s">${t('Phone', 'Simu')}: ${esc(business.phone)}</div>` : ''}
    ${business?.taxId ? `<div class="c s">TIN: ${esc(business.taxId)}</div>` : ''}
    <hr>
    <table class="s">
      <tr><td>${t('Receipt', 'Risiti')}</td><td class="n">${esc(sale.receiptNumber)}</td></tr>
      <tr><td>${t('Date', 'Tarehe')}</td><td class="n">${esc(when)}</td></tr>
      ${sale.customerName ? `<tr><td>${t('Customer', 'Mteja')}</td><td class="n">${esc(sale.customerName)}</td></tr>` : ''}
      ${sale.seller ? `<tr><td>${t('Served by', 'Aliyehudumia')}</td><td class="n">${esc(sale.seller)}</td></tr>` : ''}
    </table>
    <hr>
    <table>${lines}</table>
    <hr>
    <table>
      ${sale.discount > 0 ? `<tr><td>${t('Subtotal', 'Jumla ndogo')}</td><td class="n">${m(sale.subtotal)}</td></tr><tr><td>${t('Discount', 'Punguzo')}</td><td class="n">-${m(sale.discount)}</td></tr>` : ''}
      <tr class="tot"><td>${t('TOTAL', 'JUMLA')}</td><td class="n">TSh ${m(sale.total)}</td></tr>
      ${payments}
      ${sale.balance > 0 ? `<tr class="bal"><td>${t('Balance due', 'Deni')}</td><td class="n">${m(sale.balance)}</td></tr>` : ''}
    </table>
    <hr>
    <div class="c s">${esc(business?.receiptFooter ?? t('Thank you for shopping with us!', 'Asante kwa kununua nasi!'))}</div>
  </body></html>`;
  printHtml(html);
}
