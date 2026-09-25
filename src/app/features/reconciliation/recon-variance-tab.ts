import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, Icon, Skeleton, ToastService } from '@shared/ui';
import { parseLocal, toIsoDate } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { VarianceReport, VarianceRow } from './recon-extra.models';
import { RECON_STATUS, SHORTAGE_REASONS } from './reconciliation.models';
import { ReconciliationService } from './reconciliation.service';

interface CashierGroup {
  uid: string;
  name: string;
  rows: VarianceRow[];
  shortage: number;
  surplus: number;
  material: number;
  reasons: Array<{ code: string; amount: number; days: number }>;
}

/**
 * Variance tracking — port of Flutter `VarianceTrackingTab` (approvers only):
 * a month's shortages / surpluses per salesperson-day from the server's
 * variance report, grouped by cashier (keyed on the user id, never the name),
 * with the material threshold (editable, stored on the business settings)
 * and the shortage reasons. A report only — tapping a day opens that
 * reconciliation.
 */
@Component({
  selector: 'app-recon-variance-tab',
  imports: [Button, Icon, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="top">
      <div class="month">
        <button type="button" (click)="shift(-1)" [attr.aria-label]="i18n.t('Previous month', 'Mwezi uliopita')"><lsms-icon name="chevron_left" [size]="20" /></button>
        <b>{{ month() | date: 'MMMM yyyy' }}</b>
        <button type="button" (click)="shift(1)" [disabled]="isCurrentMonth()" [attr.aria-label]="i18n.t('Next month', 'Mwezi ujao')"><lsms-icon name="chevron_right" [size]="20" /></button>
      </div>
      <label class="thr">
        <span>{{ i18n.t('Material above', 'Muhimu kuanzia') }}</span>
        <input type="text" inputmode="numeric" [value]="thresholdText()" (input)="thresholdText.set($any($event.target).value)" [disabled]="!canSetThreshold()" />
        @if (canSetThreshold()) {
          <button lsmsButton="secondary" size="sm" [loading]="savingThreshold()" [disabled]="!thresholdChanged()" (click)="saveThreshold()">{{ i18n.t('Save', 'Hifadhi') }}</button>
        }
      </label>
    </div>

    @if (loading() && !report()) {
      <lsms-skeleton variant="list" [rows]="5" />
    } @else if (error()) {
      <p class="empty">{{ error() }}</p>
    } @else if (report(); as r) {
      @if (r.startsBeforeCutoff) {
        <p class="note"><lsms-icon name="info" [size]="16" />{{ i18n.t('Days before ' + (r.cutoffDate ?? '') + ' are not tracked.', 'Siku kabla ya ' + (r.cutoffDate ?? '') + ' hazifuatiliwi.') }}</p>
      }
      <div class="totals">
        <div style="--tc: var(--c-error)"><small>{{ i18n.t('Total shortage', 'Jumla ya upungufu') }}</small><b>{{ r.totalShortage | money }}</b></div>
        <div style="--tc: var(--c-success)"><small>{{ i18n.t('Total surplus', 'Jumla ya ziada') }}</small><b>{{ r.totalSurplus | money }}</b></div>
        <div [style.--tc]="r.net > 0 ? 'var(--c-error)' : 'var(--c-success)'"><small>{{ i18n.t('Net', 'Tofauti halisi') }}</small><b>{{ r.net | money }}</b></div>
        <div style="--tc: var(--c-warning)"><small>{{ i18n.t('Material days', 'Siku muhimu') }} (&gt; {{ r.threshold | money: { symbol: false } }})</small><b>{{ r.materialDays }}</b></div>
        <div style="--tc: var(--c-text-2)"><small>{{ i18n.t('Minor days', 'Siku ndogo') }}</small><b>{{ r.minorDays }}</b></div>
      </div>

      @if (!groups().length) {
        <p class="empty">{{ i18n.t('No shortages or surpluses this month.', 'Hakuna upungufu wala ziada mwezi huu.') }}</p>
      } @else {
        @for (g of groups(); track g.uid) {
          <section class="cashier">
            <button type="button" class="head" (click)="toggle(g.uid)" [attr.aria-expanded]="open().has(g.uid)">
              <span class="av">{{ initials(g.name) }}</span>
              <span class="nm"><b>{{ g.name }}</b><small>{{ i18n.t(g.rows.length + ' day(s)', 'Siku ' + g.rows.length) }}@if (g.material) { · <em>{{ i18n.t(g.material + ' material', g.material + ' muhimu') }}</em> }</small></span>
              @if (g.shortage > 0) { <span class="neg">−{{ g.shortage | money }}</span> }
              @if (g.surplus > 0) { <span class="pos">+{{ g.surplus | money }}</span> }
              <lsms-icon [name]="open().has(g.uid) ? 'expand_less' : 'expand_more'" [size]="20" />
            </button>
            @if (open().has(g.uid)) {
              @if (g.reasons.length) {
                <div class="reasons">
                  <small>{{ i18n.t('Where shortages came from', 'Chanzo cha upungufu') }}</small>
                  @for (x of g.reasons; track x.code) {
                    <span>{{ reasonText(x.code) }} · <b>{{ x.amount | money: { symbol: false } }}</b> · {{ x.days }} {{ i18n.t('d', 's') }}</span>
                  }
                </div>
              }
              <ul class="items flat">
                @for (row of g.rows; track row.reconUid) {
                  <li class="clickable" (click)="openRecon.emit({ uid: row.reconUid, date: row.date })">
                    <span class="t">
                      <b>{{ day(row.date) | date: 'EEE dd MMM' }} <span class="st">{{ statusText(row.status) }}</span></b>
                      <small>{{ row.shortageReason ? reasonText(row.shortageReason) : '' }}{{ row.shortageReason && row.explanation ? ' · ' : '' }}{{ row.explanation || (row.shortageReason ? '' : i18n.t('No explanation', 'Hakuna maelezo')) }}</small>
                    </span>
                    @if (row.isMaterial) {
                      <span class="tag" style="--tc: var(--c-warning)">{{ i18n.t('MATERIAL', 'MUHIMU') }}</span>
                    }
                    <b class="amt" [class.neg]="row.isShortage" [class.pos]="!row.isShortage">{{ row.isShortage ? '−' : '+' }}{{ abs(row.variance) | money }}</b>
                    <lsms-icon name="chevron_right" [size]="18" />
                  </li>
                }
              </ul>
            }
          </section>
        }
      }
    }
  `,
  styleUrl: './recon-tab.scss',
  styles: `
    .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .month { display: inline-flex; align-items: center; gap: 8px; }
    .month b { min-width: 150px; text-align: center; font-size: 1rem; }
    .month button { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
    .month button:disabled { opacity: 0.4; cursor: default; }
    .thr { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--c-text-2); }
    .thr input { width: 110px; padding: 7px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); text-align: right; outline: none; }
    .note { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; color: var(--c-text-2); background: var(--c-bg); }
    .cashier { border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); overflow: hidden; }
    .head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; border: 0; background: transparent; font: inherit; color: var(--c-text); cursor: pointer; text-align: left; }
    .head:hover { background: var(--c-hover); }
    .av { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; font-size: 0.74rem; font-weight: 700; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 12%, transparent); }
    .nm { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .nm b { font-weight: 600; }
    .nm small { font-size: 0.74rem; color: var(--c-text-2); }
    .nm em { font-style: normal; font-weight: 600; color: var(--c-warning); }
    .neg { color: var(--c-error); font-weight: 700; font-variant-numeric: tabular-nums; }
    .pos { color: var(--c-success); font-weight: 700; font-variant-numeric: tabular-nums; }
    .reasons { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px 14px; border-top: 1px solid var(--c-border); font-size: 0.78rem; background: var(--c-bg); }
    .reasons small { color: var(--c-text-2); font-weight: 600; }
    .items.flat { border: 0; border-top: 1px solid var(--c-border); border-radius: 0; }
    .clickable { cursor: pointer; }
    .clickable:hover { background: var(--c-hover); }
    .st { margin-left: 6px; font-size: 0.7rem; font-weight: 500; color: var(--c-text-2); }
  `,
})
export class ReconVarianceTab {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReconciliationService);
  private readonly toast = inject(ToastService);

  readonly openRecon = output<{ uid: string; date: string }>();

  protected readonly month = signal(firstOfMonth(new Date()));
  protected readonly report = signal<VarianceReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly open = signal<Set<string>>(new Set());
  protected readonly thresholdText = signal('');
  protected readonly savingThreshold = signal(false);

  protected readonly canSetThreshold = computed(() => this.auth.isRoot() || this.auth.hasAnyPermission(['BUSINESS_SETTINGS_UPDATE', 'SETTINGS_UPDATE', 'RECONCILIATION_APPROVE']));
  protected readonly thresholdChanged = computed(() => {
    const v = Number(this.thresholdText().replace(/[^\d.]/g, ''));
    return this.thresholdText().trim() !== '' && v >= 0 && v !== this.report()?.threshold;
  });
  protected readonly isCurrentMonth = computed(() => toIsoDate(this.month()) === toIsoDate(firstOfMonth(new Date())));
  protected readonly groups = computed<CashierGroup[]>(() => {
    const by = new Map<string, CashierGroup>();
    for (const r of this.report()?.rows ?? []) {
      const g = by.get(r.userUid) ?? { uid: r.userUid, name: r.userName, rows: [], shortage: 0, surplus: 0, material: 0, reasons: [] };
      g.rows.push(r);
      if (r.isShortage) g.shortage += Math.abs(r.variance);
      else g.surplus += Math.abs(r.variance);
      if (r.isMaterial) g.material++;
      if (r.isShortage && r.shortageReason) {
        const x = g.reasons.find((y) => y.code === r.shortageReason);
        if (x) {
          x.amount += Math.abs(r.variance);
          x.days++;
        } else g.reasons.push({ code: r.shortageReason, amount: Math.abs(r.variance), days: 1 });
      }
      by.set(r.userUid, g);
    }
    const list = [...by.values()];
    for (const g of list) {
      g.rows.sort((a, b) => b.date.localeCompare(a.date));
      g.reasons.sort((a, b) => b.amount - a.amount);
    }
    return list.sort((a, b) => b.shortage - a.shortage || b.material - a.material);
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const m = this.month();
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.api.varianceReport(toIsoDate(m), toIsoDate(last));
      this.report.set(r);
      this.thresholdText.set(String(r.threshold));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected shift(d: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + d, 1));
    this.open.set(new Set());
    void this.load();
  }

  protected toggle(uid: string): void {
    this.open.update((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  }

  protected async saveThreshold(): Promise<void> {
    const v = Number(this.thresholdText().replace(/[^\d.]/g, ''));
    if (!(v >= 0)) return;
    this.savingThreshold.set(true);
    try {
      await this.api.setVarianceThreshold(v);
      this.toast.success(this.i18n.t('Threshold saved', 'Kiwango kimehifadhiwa'));
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.savingThreshold.set(false);
    }
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }

  protected abs(v: number): number {
    return Math.abs(v);
  }

  protected initials(n: string): string {
    return n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }

  protected reasonText(code: string): string {
    const r = SHORTAGE_REASONS[code];
    return r ? (this.i18n.isSwahili() ? r.sw : r.en) : code;
  }

  protected statusText(s: string): string {
    const x = RECON_STATUS[s as keyof typeof RECON_STATUS];
    return x ? (this.i18n.isSwahili() ? x.sw : x.en) : s;
  }
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
