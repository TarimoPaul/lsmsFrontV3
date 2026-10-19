import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';
import { GlPeriodAudit, GlPeriodRow } from './gl.models';
import { GlService } from './gl.service';

/**
 * GL months (MPANGO-PAMOJA §1.9). A closed month takes no new journal on its dates:
 * a system event lands on the first open day (marked "late" in the journal), and a
 * manual journal is refused until the month is reopened with a reason. Every close
 * and reopen is kept in the audit list.
 */
@Component({
  selector: 'app-gl-periods',
  imports: [Button, Icon, EmptyState, Skeleton, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !rows().length) {
      <lsms-skeleton variant="list" [rows]="6" />
    } @else if (error()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindwa kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else {
      <p class="intro">
        <lsms-icon name="info" [size]="17" />
        {{ i18n.t(
          'A closed month is final: a late event is booked on the first open day with its real date, and manual journals need the month reopened (with a reason).',
          'Mwezi uliofungwa ni wa mwisho: tukio la kuchelewa linaandikwa siku ya kwanza iliyo wazi pamoja na tarehe yake halisi, na journal ya mkono inahitaji mwezi ufunguliwe upya (kwa sababu).') }}
      </p>
      <ul class="months">
        @for (r of rows(); track r.year * 100 + r.month) {
          <li [class.closed]="r.status !== 'OPEN'">
            <lsms-icon [name]="r.status === 'OPEN' ? 'lock_open' : 'lock'" [size]="18" />
            <span class="what">
              <b>{{ monthName(r) }}</b>
              <small>
                @if (r.status === 'OPEN') {
                  {{ r.current ? i18n.t('Current month', 'Mwezi huu') : i18n.t('Open', 'Uko wazi') }}
                } @else {
                  {{ i18n.t('Closed', 'Umefungwa') }} {{ day(r.closedAt) | date: 'd MMM yyyy HH:mm' }}@if (r.closedBy) { · {{ r.closedBy }} }
                }
              </small>
            </span>
            @if (canWrite()) {
              @if (r.status === 'OPEN' && !r.current) {
                <button lsmsButton="secondary" size="sm" icon="lock" [loading]="busy() === key(r)" [disabled]="!!busy()" (click)="close(r)">{{ i18n.t('Close', 'Funga') }}</button>
              } @else if (r.status !== 'OPEN') {
                <button lsmsButton="tonal" size="sm" icon="lock_open" [loading]="busy() === key(r)" [disabled]="!!busy()" (click)="reopen(r)">{{ i18n.t('Reopen', 'Fungua upya') }}</button>
              }
            }
          </li>
        }
      </ul>

      @if (audit().length) {
        <section class="audit">
          <h3><lsms-icon name="history" [size]="18" />{{ i18n.t('History', 'Historia') }}</h3>
          <ul>
            @for (a of audit(); track a.uid) {
              <li>
                <span class="act" [class.re]="a.action === 'REOPEN'">{{ a.action === 'CLOSE' ? i18n.t('Closed', 'Imefungwa') : i18n.t('Reopened', 'Imefunguliwa') }}</span>
                <b>{{ a.periodYear }}-{{ pad(a.periodMonth) }}</b>
                <small>{{ day(a.at) | date: 'd MMM yyyy HH:mm' }}@if (a.byName) { · {{ a.byName }} }@if (a.reason) { · {{ a.reason }} }</small>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .intro { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--c-text-2); background: color-mix(in srgb, var(--c-info) 7%, var(--c-surface)); }
    .intro lsms-icon { flex-shrink: 0; color: var(--c-info); }
    .months { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 8px; }
    .months li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .months li > lsms-icon { color: var(--c-success); }
    .months li.closed > lsms-icon { color: var(--c-text-2); }
    .months li.closed { background: color-mix(in srgb, var(--c-text-2) 5%, var(--c-surface)); }
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .what b { font-size: 0.86rem; font-weight: 500; color: var(--c-text); }
    .what small { font-size: 0.72rem; color: var(--c-text-2); }
    .audit h3 { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 0.92rem; font-weight: 600; color: var(--c-text); }
    .audit h3 lsms-icon { color: var(--c-primary); }
    .audit ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .audit li { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; padding: 6px 2px; border-bottom: 1px solid var(--c-border); font-size: 0.8rem; }
    .audit b { color: var(--c-text); font-weight: 500; }
    .audit small { color: var(--c-text-2); }
    .act { padding: 1px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 500; color: var(--c-text-2); background: color-mix(in srgb, var(--c-text-2) 12%, transparent); }
    .act.re { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 14%, transparent); }
  `,
})
export class GlPeriods {
  protected readonly i18n = inject(LanguageService);
  private readonly gl = inject(GlService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<GlPeriodRow[]>([]);
  protected readonly audit = signal<GlPeriodAudit[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly canWrite = computed(() => this.auth.hasPermission('FINANCE_WRITE'));

  constructor() {
    effect(() => {
      this.gl.version();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [rows, audit] = await Promise.all([this.gl.periods(), this.gl.periodAudit()]);
      this.rows.set(rows);
      this.audit.set(audit);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async close(r: GlPeriodRow): Promise<void> {
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Close ', 'Funga ') + this.monthName(r),
        message: this.i18n.t(
          'After closing, nothing new is booked on this month. Late events go to the first open day; manual journals need a reopen.',
          'Baada ya kufunga, hakuna kipya kinachoandikwa kwenye mwezi huu. Matukio ya kuchelewa yanaenda siku ya kwanza iliyo wazi; journal za mkono zinahitaji kufungua upya.',
        ),
        label: this.i18n.t('Note (e.g. "checks reviewed")', 'Maelezo (mf. "checks zimekaguliwa")'),
        confirm: this.i18n.t('Close month', 'Funga mwezi'),
        min: 3,
      },
    });
    if (!reason) return;
    await this.run(r, () => this.gl.closePeriod(r.year, r.month, reason), this.i18n.t('Month closed', 'Mwezi umefungwa'));
  }

  protected async reopen(r: GlPeriodRow): Promise<void> {
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Reopen ', 'Fungua upya ') + this.monthName(r),
        message: this.i18n.t('Reopening is recorded with your name and reason. Close it again when the correction is posted.',
          'Kufungua upya kunaandikwa pamoja na jina lako na sababu. Ufunge tena marekebisho yakishaandikwa.'),
        label: this.i18n.t('Reason (at least 10 characters)', 'Sababu (angalau herufi 10)'),
        confirm: this.i18n.t('Reopen', 'Fungua upya'),
        danger: true,
        min: 10,
      },
    });
    if (!reason) return;
    await this.run(r, () => this.gl.reopenPeriod(r.year, r.month, reason), this.i18n.t('Month reopened', 'Mwezi umefunguliwa upya'));
  }

  private async run(r: GlPeriodRow, op: () => Promise<void>, done: string): Promise<void> {
    this.busy.set(this.key(r));
    try {
      await op();
      this.toast.success(done);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }

  protected key(r: GlPeriodRow): string {
    return `${r.year}-${r.month}`;
  }

  protected monthName(r: GlPeriodRow): string {
    return new Date(r.year, r.month - 1, 1).toLocaleDateString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { month: 'long', year: 'numeric' });
  }

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
