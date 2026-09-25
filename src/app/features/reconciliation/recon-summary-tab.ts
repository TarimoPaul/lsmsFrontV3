import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { ReconStatement } from './recon-statement';
import { ReconStore } from './recon.store';

/**
 * Summary tab — port of Flutter `_SummaryTab`: the day's POS sales (paid /
 * debts / returns), the statement, mobile money by provider and the
 * retail / wholesale split. With no record yet it offers "Start mine".
 */
@Component({
  selector: 'app-recon-summary-tab',
  imports: [ReconStatement, Button, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = store.current();
    @let s = store.summary();
    @if (r?.hasDrift) {
      <div class="drift">
        <lsms-icon name="warning" [size]="18" />
        <span><b>{{ i18n.t('Sales changed after approval', 'Mauzo yamebadilika baada ya kuidhinishwa') }}</b><small>{{ i18n.t('Difference', 'Tofauti') }} {{ abs(r!.postApprovalDrift ?? 0) | money }} — {{ i18n.t('reopen to correct it.', 'fungua tena kurekebisha.') }}</small></span>
        <button lsmsButton="secondary" size="sm" icon="lock_open" (click)="goApproval.emit()">{{ i18n.t('Go to approval', 'Nenda idhini') }}</button>
      </div>
    }

    @if (s || r) {
      <div class="hero">
        <div class="main">
          <small>{{ i18n.t('Sales on this day', 'Mauzo ya siku hii') }}@if (s) { · {{ s.saleCount }} {{ i18n.t('receipts', 'risiti') }} }</small>
          <b>{{ total() | money }}</b>
        </div>
        <div><small>{{ i18n.t('Paid', 'Imelipwa') }}</small><b class="info">{{ (r?.autoTotalPaid || s?.totalPaid || 0) | money }}</b></div>
        <div><small>{{ i18n.t('Debts (POS + walk-in)', 'Madeni (POS + mkono)') }}</small><b class="warn">{{ (r ? r.retailDebtsTotal : (s?.totalOutstanding ?? 0)) | money }}</b></div>
        @if ((r?.autoReturnDeductions || s?.returnDeductions || 0) > 0) {
          <div><small>{{ i18n.t('Returns', 'Marejesho') }}</small><b class="err">{{ (r?.autoReturnDeductions || s?.returnDeductions || 0) | money }}</b></div>
        }
      </div>
    }

    @if (r) {
      <app-recon-statement [recon]="r" [liveTotal]="s?.totalSales ?? null" />
    } @else if (!store.loading()) {
      <div class="start">
        <lsms-icon name="balance" [size]="40" />
        <b>{{ store.isManager() && !store.canSell() ? i18n.t('Pick a salesperson above', 'Chagua muuzaji juu') : i18n.t('No reconciliation for this day yet', 'Hakuna upatanisho kwa siku hii bado') }}</b>
        <small>{{ i18n.t('It starts when you record your first cash, deposit or expense.', 'Unaanza unaporekodi taslimu, depositi au matumizi ya kwanza.') }}</small>
        @if (store.canEdit()) {
          <button lsmsButton icon="play_arrow" [loading]="store.saving()" (click)="store.startMine()">{{ i18n.t('Start my reconciliation', 'Anza upatanisho wangu') }}</button>
        }
      </div>
    }

    @if (s && s.mobileByProvider.length) {
      <div class="card">
        <h4><lsms-icon name="phone_iphone" [size]="15" />{{ i18n.t('Mobile money sales by provider', 'Mauzo ya simu kwa mtandao') }}</h4>
        <div class="provs">
          @for (p of s.mobileByProvider; track p[0]) {
            <span><small>{{ p[0] }}</small><b>{{ p[1] | money }}</b></span>
          }
        </div>
      </div>
    }
    @if (s && (s.retailSales > 0 || s.wholesaleSales > 0)) {
      <div class="card split">
        <span><small>{{ i18n.t('Retail sales', 'Mauzo ya rejareja') }}</small><b class="ok">{{ s.retailSales | money }}</b></span>
        <span><small>{{ i18n.t('Wholesale sales', 'Mauzo ya jumla') }}</small><b>{{ s.wholesaleSales | money }}</b></span>
        @if (s.wholesaleOutstanding > 0) {
          <span><small>{{ i18n.t('Wholesale on credit', 'Jumla kwa mkopo') }}</small><b class="warn">{{ s.wholesaleOutstanding | money }}</b></span>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .drift { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 14px; border-radius: 14px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 10%, var(--c-surface)); border: 1.5px solid color-mix(in srgb, var(--c-warning) 40%, transparent); }
    .drift span { display: flex; flex-direction: column; flex: 1; min-width: 200px; }
    .drift small { color: var(--c-text-2); }
    .hero { display: grid; grid-template-columns: 1.6fr repeat(3, minmax(0, 1fr)); gap: 10px; }
    .hero > div { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 14px; background: var(--c-surface); border: 1px solid var(--c-border); }
    .hero .main { background: color-mix(in srgb, var(--c-success) 8%, var(--c-surface)); border-color: color-mix(in srgb, var(--c-success) 25%, transparent); }
    .hero small, .card small { font-size: 0.72rem; color: var(--c-text-2); }
    .hero b { font-size: 1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .hero .main b { font-size: 1.5rem; color: var(--c-success); }
    @media (max-width: 760px) { .hero { grid-template-columns: 1fr 1fr; } .hero .main { grid-column: 1 / -1; } }
    .info { color: var(--c-info); }
    .warn { color: var(--c-warning); }
    .err { color: var(--c-error); }
    .ok { color: var(--c-success); }
    .start { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 16px; text-align: center; border-radius: 16px; background: var(--c-surface); border: 1px dashed var(--c-border); }
    .start lsms-icon { color: color-mix(in srgb, var(--c-primary) 50%, transparent); }
    .start small { color: var(--c-text-2); margin-bottom: 8px; }
    .card { padding: 12px 14px; border-radius: 14px; background: var(--c-surface); border: 1px solid var(--c-border); }
    .card h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 0.8rem; font-weight: 800; }
    .card h4 lsms-icon { color: var(--c-info); }
    .provs { display: flex; flex-wrap: wrap; gap: 8px; }
    .provs span, .split span { display: flex; flex-direction: column; padding: 6px 10px; border-radius: 10px; background: var(--c-bg); }
    .provs b, .split b { font-variant-numeric: tabular-nums; }
    .split { display: flex; flex-wrap: wrap; gap: 10px; }
  `,
})
export class ReconSummaryTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  readonly goApproval = output<void>();

  protected readonly total = computed(() => {
    const r = this.store.current();
    return r && r.autoTotalSales > 0.01 ? r.autoTotalSales : (this.store.summary()?.totalSales ?? 0);
  });

  protected abs(v: number): number {
    return Math.abs(v);
  }
}
