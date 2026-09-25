import { BusinessProfile } from '@core/data/business.service';
import { parseLocal, toLocalDateTime } from '@shared/utils/date-utils';
import { escapeHtml as esc, printHtml } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { RepurchaseInvoice, RepurchaseLine, lineTotal } from '../purchases.models';

/** "INV-20260924-083015123" — time-based so numbers never repeat across reloads (Flutter `_generateNumber`). */
function invoiceNumber(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `INV-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}`;
}

/** Invoice snapshot of the lines the server accepted (Flutter `RepurchaseInvoice.fromCart`). */
export function buildInvoice(lines: RepurchaseLine[], buyerName: string, notes: string | null): RepurchaseInvoice {
  const items = lines.map((l) => {
    const total = lineTotal(l);
    return {
      productUid: l.productUid,
      productDisplayName: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalValue: total,
      discountAmount: 0,
      finalTotal: total,
      purchaseTypeLabel: l.purchaseType === 'WHOLE_PACKAGE' ? 'Jumla' : 'Rejareja',
      supplierName: l.supplierName?.trim() || null,
    };
  });
  return {
    invoiceNumber: invoiceNumber(),
    createdAt: toLocalDateTime(),
    buyerName,
    notes: notes?.trim() || null,
    grandTotal: items.reduce((n, i) => n + i.finalTotal, 0),
    totalDiscount: 0,
    items,
  };
}

export function typeLabel(label: string, sw: boolean): string {
  if (label === 'Jumla') return sw ? 'Jumla (paketi)' : 'Packages';
  if (label === 'Rejareja') return sw ? 'Rejareja (vipande)' : 'Pieces';
  return label;
}

/** A4 purchase order / invoice, printed through the browser ("Save as PDF" works too). */
export function printInvoice(inv: RepurchaseInvoice, business: BusinessProfile | null, sw: boolean): void {
  const t = (en: string, s: string) => (sw ? s : en);
  const m = (v: number) => Money.format(v, { symbol: false });
  const d = parseLocal(inv.createdAt);
  const when = d ? d.toLocaleString(sw ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const rows = inv.items
    .map(
      (i, n) => `<tr><td>${n + 1}</td><td><b>${esc(i.productDisplayName)}</b>${i.supplierName ? `<small>${esc(i.supplierName)}</small>` : ''}</td>
        <td>${esc(typeLabel(i.purchaseTypeLabel, sw))}</td><td class="n">${esc(i.quantity)}</td><td class="n">${m(i.unitPrice)}</td><td class="n">${m(i.finalTotal)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.invoiceNumber)}</title><style>
    @page { margin: 14mm; }
    body { font: 12px/1.45 'Plus Jakarta Sans', system-ui, sans-serif; color: #0f172a; margin: 0; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #3b7597; padding-bottom: 10px; margin-bottom: 14px; }
    h1 { font-size: 20px; margin: 0; color: #3b7597; } h2 { font-size: 15px; margin: 0 0 2px; text-align: right; }
    .muted, small { color: #64748b; } small { display: block; font-size: 11px; }
    .meta { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { text-align: left; background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
    th, td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tfoot td { border: 0; font-size: 15px; font-weight: 800; padding-top: 10px; }
    .note { margin-top: 16px; padding: 8px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .sign { display: flex; gap: 40px; margin-top: 48px; } .sign div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 4px; color: #64748b; }
  </style></head><body>
    <header>
      <div>
        <h1>${esc(business?.name ?? 'LSMS')}</h1>
        ${business?.address ? `<div class="muted">${esc(business.address)}</div>` : ''}
        ${business?.phone ? `<div class="muted">${t('Phone', 'Simu')}: ${esc(business.phone)}</div>` : ''}
        ${business?.taxId ? `<div class="muted">TIN: ${esc(business.taxId)}</div>` : ''}
      </div>
      <div class="meta">
        <h2>${t('PURCHASE ORDER', 'AGIZO LA MANUNUZI')}</h2>
        <div><b>${esc(inv.invoiceNumber)}</b></div>
        <div class="muted">${esc(when)}</div>
        <div class="muted">${t('Prepared by', 'Imeandaliwa na')}: ${esc(inv.buyerName)}</div>
      </div>
    </header>
    <table>
      <thead><tr><th>#</th><th>${t('Product / supplier', 'Bidhaa / msambazaji')}</th><th>${t('Unit', 'Kipimo')}</th><th class="n">${t('Qty', 'Idadi')}</th><th class="n">${t('Unit cost', 'Bei')}</th><th class="n">${t('Total', 'Jumla')}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5" class="n">${t('TOTAL', 'JUMLA')}</td><td class="n">TSh ${m(inv.grandTotal)}</td></tr></tfoot>
    </table>
    ${inv.notes ? `<div class="note"><b>${t('Notes', 'Maelezo')}:</b> ${esc(inv.notes)}</div>` : ''}
    <p class="muted">${t('These purchases are pending approval.', 'Manunuzi haya yanasubiri idhini.')}</p>
    <div class="sign"><div>${t('Prepared by', 'Imeandaliwa na')}</div><div>${t('Approved by', 'Imeidhinishwa na')}</div><div>${t('Received by', 'Imepokelewa na')}</div></div>
  </body></html>`;
  printHtml(html);
}
