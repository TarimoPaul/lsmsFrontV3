import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { Money } from '@shared/utils/money';
import { ORDER_EDIT, ORDER_VIEW, OrderSuggestion } from './order.models';
import { OrderService } from './order.service';

/**
 * Dashboard line for the order of the day: crates and total, which version it is, and —
 * when the last recompute failed — "Oda haikusasishwa" with "Hesabu upya". Shows nothing
 * to users without ORDER_SUGGESTION_VIEW or while there is no order yet.
 */
@Component({
  selector: 'app-order-banner',
  imports: [RouterLink, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (order(); as o) {
      @if (o.lastError) {
        <div class="ob err" role="alert">
          <lsms-icon name="error" [size]="20" />
          <a class="txt" routerLink="/purchases/suggestion">
            <b>{{ i18n.t('The order was not updated', 'Oda haikusasishwa') }}</b>
            <small>{{ i18n.t('Sales, counting and reconciliation are not affected.', 'Mauzo, counting na recon hazijaathirika.') }}</small>
          </a>
          @if (canEdit()) { <button lsmsButton="secondary" size="sm" icon="refresh" [loading]="busy()" (click)="recalculate()">{{ i18n.t('Recalculate', 'Hesabu upya') }}</button> }
        </div>
      } @else if (o.lines.length) {
        <a class="ob" [class.done]="o.status === 'PURCHASED'" routerLink="/purchases/suggestion">
          <lsms-icon [name]="o.status === 'PURCHASED' ? 'task_alt' : 'fact_check'" [size]="20" />
          <span class="txt">
            <b>{{ i18n.t("Today's order", 'Oda ya leo') }}: {{ i18n.t('crates', 'kreti') }} {{ packs() }} · {{ m(cost()) }}</b>
            <small>{{ version() }}</small>
          </span>
          <lsms-icon class="go" name="arrow_forward" [size]="18" />
        </a>
      }
    }
  `,
  styles: `
    :host { display: block; }
    :host:empty { display: none; }
    .ob { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; text-decoration: none; color: var(--c-text);
      background: color-mix(in srgb, var(--c-primary) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-primary) 30%, var(--c-border)); }
    .ob > lsms-icon:first-child { color: var(--c-primary); flex-shrink: 0; }
    .ob.done { background: color-mix(in srgb, var(--c-success) 7%, var(--c-surface)); border-color: color-mix(in srgb, var(--c-success) 30%, var(--c-border)); }
    .ob.done > lsms-icon:first-child { color: var(--c-success); }
    .ob.err { background: color-mix(in srgb, var(--c-error) 8%, var(--c-surface)); border-color: color-mix(in srgb, var(--c-error) 35%, transparent); }
    .ob.err > lsms-icon:first-child { color: var(--c-error); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: inherit; }
    .txt b { font-size: 0.92rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .txt small { font-size: 0.76rem; color: var(--c-text-2); }
    .go { color: var(--c-text-2); }
    a.ob:hover .go { color: var(--c-primary); }
  `,
})
export class OrderBanner {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(OrderService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly order = signal<OrderSuggestion | null>(null);
  protected readonly busy = signal(false);
  protected readonly canEdit = computed(() => this.auth.hasAnyPermission([ORDER_EDIT]));

  protected readonly packs = computed(() => {
    const o = this.order();
    return o ? o.lines.reduce((a, l) => a + (o.status === 'PURCHASED' ? (l.purchasedPacks ?? 0) : l.packs), 0) : 0;
  });
  protected readonly cost = computed(() => {
    const o = this.order();
    return o ? (o.status === 'PURCHASED' ? (o.totals.purchasedCost ?? 0) : o.totals.orderCost) : 0;
  });
  /** Which version of the order this is — the latest step of the flow. */
  protected readonly version = computed(() => {
    const o = this.order();
    if (!o) return '';
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    if (o.status === 'PURCHASED') return t(`Closed ${this.time(o.purchasedAt)}`, `Imefungwa ${this.time(o.purchasedAt)}`);
    if (o.countDate) return t(`Updated ${this.time(o.countUpdatedAt)} after counting`, `Imesasishwa ${this.time(o.countUpdatedAt)} baada ya counting`);
    if (o.salesUpdatedAt) return t(`Updated ${this.time(o.salesUpdatedAt)} after yesterday's sales — system stock`, `Imesasishwa ${this.time(o.salesUpdatedAt)} baada ya mauzo ya jana — stoki ya mfumo`);
    if (o.status === 'NIGHT') return t('Night version — system stock, estimated budget', 'Toleo la usiku — stoki ya mfumo, bajeti ya makadirio');
    return t(`Updated ${this.time(o.calculatedAt)}`, `Imesasishwa ${this.time(o.calculatedAt)}`);
  });

  constructor() {
    if (!this.auth.hasAnyPermission([ORDER_VIEW])) return;
    void this.load();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.busy()) void this.load();
    }, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(poll));
  }

  private async load(): Promise<void> {
    try {
      this.order.set(await this.api.today());
    } catch {
      // the dashboard never fails because of the order
    }
  }

  protected async recalculate(): Promise<void> {
    this.busy.set(true);
    try {
      this.order.set(await this.api.recalculate());
      this.toast.success(this.i18n.t('Order recalculated', 'Oda imehesabiwa upya'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  private time(v: string | null): string {
    const d = parseLocal(v);
    return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  }
}
