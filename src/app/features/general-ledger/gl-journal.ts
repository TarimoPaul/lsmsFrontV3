import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, EmptyState, Icon, SelectField, SelectOption, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { EVENT_TYPES, JournalEntry, eventLabel } from './gl.models';
import { GlService } from './gl.service';

const PAGE = 30;

/**
 * Journal: every posted entry in the period (newest first), filterable by
 * business event. An entry opens to its Dr / Cr lines. Reversals are shown as
 * such — nothing in the ledger is ever edited or deleted.
 */
@Component({
  selector: 'app-gl-journal',
  imports: [Button, Icon, EmptyState, Skeleton, SelectField, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <lsms-select-field class="type" [dense]="true" [options]="typeOptions()" [value]="type()" (valueChange)="setType($event)" [ariaLabel]="i18n.t('Event type', 'Aina ya tukio')" />
      <span class="count">{{ i18n.t(total() + ' entries', 'Maingizo ' + total()) }}</span>
      <span class="sp"></span>
      @if (canWrite()) {
        <button lsmsButton="secondary" size="sm" icon="swap_horiz" (click)="transfer.emit()">{{ i18n.t('Transfer', 'Uhamisho') }}</button>
        <button lsmsButton="primary" size="sm" icon="add" (click)="manual.emit()">{{ i18n.t('Manual journal', 'Journal ya mkono') }}</button>
      }
    </div>

    @if (loading() && !rows().length) {
      <lsms-skeleton variant="list" [rows]="8" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load the journal', 'Imeshindwa kupakia journal')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else if (!rows().length) {
      <lsms-empty-state icon="menu_book" [title]="i18n.t('No journal entries', 'Hakuna maingizo')" [message]="i18n.t('Nothing was posted in this period.', 'Hakuna kilichoandikwa kipindi hiki.')" />
    } @else {
      <ul class="list">
        @for (e of rows(); track e.uid) {
          <li [class.rev]="e.isReversal">
            <button type="button" class="head" (click)="toggle(e.uid)" [attr.aria-expanded]="open().has(e.uid)">
              <span class="date">{{ day(e.entryDate) | date: 'dd MMM yy' }}</span>
              <span class="what">
                <b>{{ label(e.referenceType) }}@if (e.isReversal) { <em class="tag">{{ i18n.t('Reversal', 'Reversal') }}</em> }</b>
                <small>{{ e.entryNumber }}@if (e.referenceNumber) { · {{ e.referenceNumber }} }@if (e.postedBy) { · {{ e.postedBy }} }</small>
              </span>
              <span class="amt">{{ e.totalDebit | money: { decimals: 0 } }}</span>
              <lsms-icon [name]="open().has(e.uid) ? 'expand_less' : 'expand_more'" [size]="20" />
            </button>
            @if (open().has(e.uid)) {
              <table class="lines">
                <thead><tr><th>{{ i18n.t('Account', 'Akaunti') }}</th><th>{{ i18n.t('Description', 'Maelezo') }}</th><th class="n">Dr</th><th class="n">Cr</th></tr></thead>
                <tbody>
                  @for (l of e.lines; track l.uid) {
                    <tr>
                      <td><button type="button" class="acct" (click)="openAccount.emit(l.accountCode)">{{ l.accountCode }} · {{ l.accountName }}</button></td>
                      <td class="desc">{{ l.description }}</td>
                      <td class="n">{{ l.debitAmount ? (l.debitAmount | money: { decimals: 0, symbol: false }) : '' }}</td>
                      <td class="n">{{ l.creditAmount ? (l.creditAmount | money: { decimals: 0, symbol: false }) : '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </li>
        }
      </ul>
      @if (pages() > 1) {
        <div class="pager">
          <button type="button" [disabled]="page() === 0" (click)="go(page() - 1)" [attr.aria-label]="i18n.t('Previous page', 'Ukurasa uliopita')"><lsms-icon name="chevron_left" [size]="20" /></button>
          <span>{{ i18n.t('Page ' + (page() + 1) + ' of ' + pages(), 'Ukurasa ' + (page() + 1) + ' kati ya ' + pages()) }}</span>
          <button type="button" [disabled]="page() + 1 >= pages()" (click)="go(page() + 1)" [attr.aria-label]="i18n.t('Next page', 'Ukurasa unaofuata')"><lsms-icon name="chevron_right" [size]="20" /></button>
        </div>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .bar .type { width: 260px; max-width: 100%; }
    .count { font-size: 0.8rem; color: var(--c-text-2); }
    .sp { flex: 1; }
    .list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .list > li { border-bottom: 1px solid var(--c-border); }
    .list > li:last-child { border-bottom: 0; }
    .list > li.rev { background: color-mix(in srgb, var(--c-warning) 5%, transparent); }
    .head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 16px; border: 0; background: transparent; font: inherit; text-align: left; color: var(--c-text); cursor: pointer; }
    .head:hover { background: color-mix(in srgb, var(--c-primary) 4%, transparent); }
    .date { width: 70px; font-size: 0.78rem; color: var(--c-text-2); font-variant-numeric: tabular-nums; }
    .what { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .what b { font-size: 0.86rem; font-weight: 500; }
    .what small { font-size: 0.7rem; color: var(--c-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag { margin-left: 6px; padding: 1px 7px; border-radius: 100px; font-style: normal; font-size: 0.68rem; font-weight: 600; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 14%, transparent); }
    .amt { font-size: 0.86rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .lines { width: calc(100% - 32px); margin: 0 16px 12px; border-collapse: collapse; font-size: 0.8rem; }
    .lines th { padding: 6px 8px; text-align: left; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--c-text-2); border-bottom: 1px solid var(--c-border); }
    .lines td { padding: 6px 8px; border-bottom: 1px solid color-mix(in srgb, var(--c-border) 50%, transparent); color: var(--c-text); }
    .lines .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .lines .desc { color: var(--c-text-2); }
    .acct { padding: 0; border: 0; background: transparent; font: inherit; color: var(--c-primary); cursor: pointer; text-align: left; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 0.82rem; color: var(--c-text-2); }
    .pager button { display: inline-flex; padding: 6px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
    .pager button:disabled { opacity: 0.4; cursor: default; }
    @media (max-width: 640px) { .lines .desc { display: none; } }
  `,
})
export class GlJournal {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);

  readonly start = input.required<string>();
  readonly end = input.required<string>();
  readonly openAccount = output<string>();
  readonly manual = output<void>();
  readonly transfer = output<void>();

  protected readonly rows = signal<JournalEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly pages = signal(1);
  protected readonly page = signal(0);
  protected readonly type = signal<string>('ALL');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly open = signal<ReadonlySet<string>>(new Set());

  protected readonly canWrite = computed(() => this.auth.hasPermission('FINANCE_WRITE'));
  protected readonly typeOptions = computed<SelectOption<string>[]>(() => [
    { value: 'ALL', label: this.i18n.t('All events', 'Matukio yote') },
    ...Object.keys(EVENT_TYPES).map((k) => ({ value: k, label: eventLabel(k, this.i18n.isSwahili()) })),
  ]);

  constructor() {
    effect(() => {
      this.start();
      this.end();
      this.gl.version();
      untracked(() => {
        this.page.set(0);
        void this.load();
      });
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.gl.journal({ startDate: this.start(), endDate: this.end(), referenceType: this.type(), page: this.page(), size: PAGE });
      this.rows.set(r.items);
      this.total.set(r.total);
      this.pages.set(r.pages);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected setType(t: string | null): void {
    this.type.set(t ?? 'ALL');
    this.page.set(0);
    void this.load();
  }

  protected go(p: number): void {
    this.page.set(p);
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

  protected label(t: string): string {
    return eventLabel(t, this.i18n.isSwahili());
  }

  protected day(v: string): Date | null {
    return parseLocal(v);
  }
}
