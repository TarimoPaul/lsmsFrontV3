import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ApiService } from '@core/api/api.service';
import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';

/** A day where the reco's drawer purchases and the purchases paid from the drawer (X±1) differ. */
export interface PurchaseGap {
  day: string;
  reco: number;
  recorded: number;
}

/**
 * 6e (owner 12/11 ga) - a warning only for the CEO / buyer: "Reco ya [tarehe] inaonyesha manunuzi ya droo [kiasi];
 * yaliyoandikwa [kiasi]". The reco's purchase section writes no GL; the purchase module does (once). Server side from
 * 02/12; shows nothing when everything agrees or the list cannot be read.
 */
@Component({
  selector: 'app-purchase-check',
  imports: [Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gaps().length) {
      <div class="pc" data-test="linganisha-manunuzi" role="status">
        <div class="h"><lsms-icon name="compare_arrows" [size]="18" />{{ i18n.t('Compare purchases', 'Linganisha manunuzi') }}</div>
        <ul>
          @for (g of gaps(); track g.day) {
            <li>
              {{ i18n.t('The reco of ' + g.day + ' shows drawer purchases of ', 'Reco ya ' + g.day + ' inaonyesha manunuzi ya droo ') }}<b>{{ g.reco | money: { decimals: 0 } }}</b>;
              {{ i18n.t('recorded from the drawer ', 'yaliyoandikwa ') }}<b>{{ g.recorded | money: { decimals: 0 } }}</b>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    .pc { margin: 0 0 12px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--c-warning); background: color-mix(in srgb, var(--c-warning) 10%, transparent); color: var(--c-text); font-size: 0.85rem; }
    .h { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 4px; color: var(--c-warning); }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 2px 0; }
  `],
})
export class PurchaseCheck implements OnInit {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  protected readonly gaps = signal<PurchaseGap[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.gaps.set((await this.api.get<PurchaseGap[] | null>('/api/v1/reconciliation/purchase-check')) ?? []);
    } catch {
      this.gaps.set([]);
    }
  }
}
