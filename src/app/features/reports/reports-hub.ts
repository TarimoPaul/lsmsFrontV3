import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { EmptyState, Icon, MetricCard, MetricsGrid, PageHeader, Skeleton } from '@shared/ui';
import { Money } from '@shared/utils/money';
import { FinancialPosition } from '../general-ledger/gl.models';
import { GlService } from '../general-ledger/gl.service';
import { REPORTS, ReportDef } from './reports.models';

/**
 * Reports hub: a live snapshot of the business straight from the General
 * Ledger (when the user may read it), then one card per report the user is
 * allowed to open.
 */
@Component({
  selector: 'app-reports-hub',
  imports: [PageHeader, RouterLink, Icon, MetricCard, MetricsGrid, Skeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Reports & Analytics', 'Ripoti na Uchambuzi')"
        [subtitle]="i18n.t('Every figure comes from the live books, stock and registers', 'Kila namba inatoka kwenye vitabu, stoki na rejista halisi')"
        icon="analytics"
        [refreshable]="canFinance()"
        (refresh)="loadPosition()"
      />

      @if (canFinance()) {
        <section class="snap">
          <h3><lsms-icon name="monitoring" [size]="18" />{{ i18n.t('Business today', 'Biashara leo') }}<small>{{ i18n.t('From the General Ledger', 'Kutoka Leja Kuu') }}</small></h3>
          @if (pos(); as p) {
            <lsms-metrics-grid [gap]="12">
              <lsms-metric-card [title]="i18n.t('Cash & bank', 'Pesa na benki')" [value]="m(p.cash)" icon="payments" color="var(--c-success)" [subtitle]="cashNote()" [urgent]="p.cash < 0" />
              <lsms-metric-card [title]="i18n.t('Stock (at cost)', 'Stoki (kwa gharama)')" [value]="m(p.inventory)" icon="inventory_2" color="var(--c-info)" />
              <lsms-metric-card [title]="i18n.t('Customers owe', 'Wateja wanadaiwa')" [value]="m(p.receivables)" icon="request_quote" color="var(--c-warning)" />
              <lsms-metric-card [title]="i18n.t('We owe suppliers', 'Tunadaiwa na wasambazaji')" [value]="m(p.payables + p.loans)" icon="local_shipping" color="var(--c-error)" [subtitle]="p.loans ? i18n.t('incl. loans ' + m(p.loans), 'pamoja na mikopo ' + m(p.loans)) : undefined" />
              <lsms-metric-card [title]="i18n.t('Net worth (equity)', 'Thamani halisi (mtaji)')" [value]="m(p.totalEquity)" icon="savings" color="var(--c-primary)" [subtitle]="i18n.t('Assets ' + m(p.totalAssets) + ' − liabilities ' + m(p.totalLiabilities), 'Mali ' + m(p.totalAssets) + ' − madeni ' + m(p.totalLiabilities))" />
              <lsms-metric-card [title]="i18n.t('Working capital', 'Mtaji wa uendeshaji')" [value]="m(p.workingCapital)" icon="autorenew" color="var(--c-secondary)" [subtitle]="p.isBalanced ? i18n.t('Books balance ✓', 'Vitabu vinalingana ✓') : i18n.t('Books do not balance', 'Vitabu havilingani')" [urgent]="!p.isBalanced" />
            </lsms-metrics-grid>
          } @else if (posError()) {
            <p class="err"><lsms-icon name="error" [size]="16" />{{ posError() }}</p>
          } @else {
            <lsms-skeleton variant="list" [rows]="2" />
          }
        </section>
      }

      @if (reports().length) {
        <div class="grid">
          @for (r of reports(); track r.id) {
            <a class="card" [routerLink]="['/reports', r.id]" [style.--c]="r.color">
              <div class="top">
                <span class="ic"><lsms-icon [name]="r.icon" [size]="24" /></span>
                <div class="t">
                  <b>{{ i18n.isSwahili() ? r.title.sw : r.title.en }}</b>
                  <small>{{ i18n.isSwahili() ? r.description.sw : r.description.en }}</small>
                </div>
                <lsms-icon class="go" name="arrow_forward" [size]="18" />
              </div>
              <div class="chips">
                @for (t of r.topics; track $index) { <span>{{ i18n.isSwahili() ? t.sw : t.en }}</span> }
              </div>
              <div class="src"><lsms-icon name="database" [size]="13" />{{ i18n.isSwahili() ? r.source.sw : r.source.en }}</div>
            </a>
          }
        </div>
      } @else {
        <lsms-empty-state icon="lock" [title]="i18n.t('No reports available', 'Hakuna ripoti')" [message]="i18n.t('Your role has no report permissions.', 'Jukumu lako halina ruhusa ya ripoti.')" />
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .snap { display: flex; flex-direction: column; gap: 10px; }
    .snap h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--c-text); lsms-icon { color: var(--c-primary); } }
    .snap h3 small { font-size: 0.72rem; font-weight: 500; color: var(--c-text-2); }
    .err { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.84rem; color: var(--c-error); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }
    .card { --c: var(--c-primary); display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; border-radius: 16px; text-decoration: none; color: inherit;
      background: var(--c-surface); border: 1px solid var(--c-border); box-shadow: 0 1px 2px rgb(16 24 40 / 0.04); transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
    .card:hover { border-color: color-mix(in srgb, var(--c) 55%, var(--c-border)); box-shadow: 0 8px 24px -14px color-mix(in srgb, var(--c) 60%, transparent); transform: translateY(-1px); }
    .top { display: flex; align-items: flex-start; gap: 12px; }
    .ic { display: inline-grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; border-radius: 12px; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
    .t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .t b { font-size: 0.95rem; font-weight: 600; color: var(--c-text); }
    .t small { font-size: 0.78rem; color: var(--c-text-2); }
    .go { color: var(--c-text-2); }
    .card:hover .go { color: var(--c); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips span { padding: 3px 9px; border-radius: 100px; font-size: 0.72rem; color: var(--c-text-2); background: var(--c-bg); border: 1px solid var(--c-border); }
    .src { display: flex; align-items: center; gap: 5px; margin-top: auto; font-size: 0.72rem; font-weight: 600; color: var(--c); }
  `,
})
export class ReportsHub {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly gl = inject(GlService);

  protected readonly canFinance = computed(() => this.auth.hasAnyPermission(['FINANCE_READ', 'CAPITAL_READ']));
  protected readonly reports = computed<ReportDef[]>(() => REPORTS.filter((r) => this.auth.hasAnyPermission(r.permissions)));
  protected readonly pos = signal<FinancialPosition | null>(null);
  protected readonly posError = signal('');
  protected readonly cashNote = computed(() => {
    const p = this.pos();
    if (!p || p.cashAccounts.length < 2) return undefined;
    return p.cashAccounts.map((a) => `${this.i18n.isSwahili() ? (a.nameSw ?? a.name) : a.name} ${this.m(a.amount)}`).join(' · ');
  });

  constructor() {
    if (this.canFinance()) this.loadPosition();
  }

  protected loadPosition(): void {
    this.posError.set('');
    this.gl
      .position()
      .then((p) => this.pos.set(p))
      .catch((e) => this.posError.set(ApiError.from(e).message));
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }
}
