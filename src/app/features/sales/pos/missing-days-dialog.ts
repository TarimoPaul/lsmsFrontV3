import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon } from '@shared/ui';
import { addDays, toIsoDate } from '@shared/utils/date-utils';

export interface MissingDaysData {
  /** ISO days (yyyy-mm-dd) before today with no recorded sale. */
  missing: string[];
  /** How many days back were checked (the window ends yesterday). */
  lookback: number;
  /** Earliest day this user may backdate to; null = no SALES_BACKDATE. */
  minDate: string | null;
  /** The cart's current sale date. */
  selected: string;
  /** 'checkout' asks "is this sale for today?"; 'review' only shows the calendar. */
  mode: 'checkout' | 'review';
}

/** 'today' = sell for today; an ISO day = switch the cart to that date. */
export type MissingDaysResult = 'today' | string;

interface Cell {
  iso: string;
  day: number;
  state: 'out' | 'miss' | 'ok' | 'today';
  pickable: boolean;
  selected: boolean;
  title: string;
}

/**
 * Port of Flutter `MissingSalesReminderDialog`, shown before a today-dated
 * sale when recent days have no sales. Flutter listed the days plus up to 5
 * quick-date buttons; here the checked window is drawn as a calendar (days
 * without sales stand out, days with sales get a tick) and a missing day is
 * picked right on it when the user may backdate.
 */
@Component({
  selector: 'app-missing-days-dialog',
  imports: [DialogShell, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Reminder: unrecorded sales', 'Kumbusho: Mauzo hayajarekodiwa')" icon="event_busy">
      <div class="sum">
        <b>{{ data.missing.length }}</b>
        <span>
          {{ i18n.t('of the last ' + data.lookback + ' days have no sales', 'kati ya siku ' + data.lookback + ' zilizopita hazina mauzo') }}
          <small>{{ rangeLabel() }}</small>
        </span>
      </div>

      <div class="cal" role="grid" [attr.aria-label]="i18n.t('Days without sales', 'Siku zisizo na mauzo')">
        <p class="month">{{ monthLabel() }}</p>
        <div class="wk" role="row">
          @for (w of weekdays(); track $index) {
            <span role="columnheader">{{ w }}</span>
          }
        </div>
        @for (week of weeks(); track $index) {
          <div class="wk" role="row">
            @for (c of week; track c.iso) {
              @if (c.pickable) {
                <button type="button" role="gridcell" class="d" [class]="c.state" [class.sel]="c.selected" [title]="c.title" (click)="ref.close(c.iso)">
                  <b>{{ c.day }}</b><i></i>
                </button>
              } @else {
                <span role="gridcell" class="d" [class]="c.state" [class.sel]="c.selected" [title]="c.title">
                  <b>{{ c.day }}</b>
                  @if (c.state === 'ok') {
                    <lsms-icon name="check" [size]="12" />
                  } @else if (c.state === 'today') {
                    <small>{{ i18n.t('Today', 'Leo') }}</small>
                  } @else {
                    <i></i>
                  }
                </span>
              }
            }
          </div>
        }
        <div class="legend">
          <span><i class="miss"></i>{{ i18n.t('No sales', 'Hakuna mauzo') }}</span>
          <span><i class="ok"></i>{{ i18n.t('Has sales', 'Yana mauzo') }}</span>
          <span><i class="today"></i>{{ i18n.t('Today', 'Leo') }}</span>
        </div>
      </div>

      @if (data.minDate) {
        <p class="note info">
          <lsms-icon name="touch_app" [size]="16" />
          {{ i18n.t('Tap a highlighted day to record its sales — the cart switches to that date.', 'Gusa siku iliyoangaziwa kurekodi mauzo yake — kapu litahamia tarehe hiyo.') }}
        </p>
        @if (outOfReach() > 0) {
          <p class="note">
            <lsms-icon name="lock_clock" [size]="16" />
            {{ i18n.t(outOfReach() + ' day(s) are older than you may backdate — talk to your supervisor.', 'Siku ' + outOfReach() + ' ziko nje ya ruhusa yako ya kurudi nyuma — wasiliana na msimamizi.') }}
          </p>
        }
      } @else {
        <p class="note">
          <lsms-icon name="info" [size]="16" />
          {{ i18n.t('Talk to your supervisor about these days.', 'Wasiliana na msimamizi wako kuhusu siku hizi.') }}
        </p>
      }

      @if (data.mode === 'checkout') {
        <p class="ask">{{ i18n.t('Is this sale for today (' + todayLabel + ')?', 'Je, mauzo haya ni ya leo (' + todayLabel + ')?') }}</p>
      }

      <ng-container dialogActions>
        @if (data.mode === 'checkout') {
          <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Cancel', 'Ghairi') }}</button>
          <button lsmsButton icon="check_circle" [autofocus]="true" (click)="ref.close('today')">{{ i18n.t('Yes, today', 'Ndiyo, ni ya leo') }}</button>
        } @else {
          <button lsmsButton="secondary" [autofocus]="true" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .sum { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); border: 1px solid color-mix(in srgb, var(--c-warning) 25%, transparent); }
    .sum > b { font-size: 1.6rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
    .sum span { display: flex; flex-direction: column; font-size: 0.84rem; font-weight: 600; }
    .sum small { font-size: 0.72rem; font-weight: 500; color: var(--c-text-2); }

    .cal { margin-top: 14px; padding: 12px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .month { margin: 0 0 8px; font-size: 0.84rem; font-weight: 700; text-align: center; }
    .wk { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .wk + .wk { margin-top: 4px; }
    .wk span[role='columnheader'] { padding-bottom: 4px; font-size: 0.7rem; font-weight: 700; text-align: center; text-transform: uppercase; color: var(--c-text-2); }
    .d { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 44px; padding: 2px; border-radius: 10px; border: 1px solid transparent; font: inherit; color: var(--c-text); background: transparent; }
    .d b { font-size: 0.86rem; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.1; }
    .d small { font-size: 0.7rem; font-weight: 700; line-height: 1; color: var(--c-primary); }
    .d i { width: 5px; height: 5px; border-radius: 50%; }
    .d.out { color: color-mix(in srgb, var(--c-text-2) 55%, transparent); }
    .d.out b { font-weight: 400; }
    .d.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 8%, transparent); }
    .d.miss { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); border-color: color-mix(in srgb, var(--c-warning) 35%, transparent); }
    .d.miss b { font-weight: 800; }
    .d.miss i { background: var(--c-warning); }
    .d.today { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, transparent); }
    .d.today b { color: var(--c-primary); font-weight: 800; }
    .d.sel { color: #fff; background: var(--c-primary); border-color: var(--c-primary); }
    .d.sel i { background: #fff; }
    button.d { cursor: pointer; transition: transform 0.08s ease, background 0.15s ease; }
    button.d:hover { background: color-mix(in srgb, var(--c-warning) 22%, transparent); border-color: var(--c-warning); }
    button.d.sel:hover { background: var(--c-primary); }
    button.d:active { transform: scale(0.94); }
    button.d:focus-visible { outline: 2px solid var(--c-warning); outline-offset: 1px; }

    .legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--c-border); font-size: 0.72rem; color: var(--c-text-2); }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { width: 10px; height: 10px; border-radius: 3px; }
    .legend i.miss { background: color-mix(in srgb, var(--c-warning) 45%, transparent); }
    .legend i.ok { background: color-mix(in srgb, var(--c-success) 35%, transparent); }
    .legend i.today { border: 1.5px solid var(--c-primary); }

    .note { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; padding: 8px 10px; border-radius: 10px; font-size: 0.78rem; color: var(--c-text-2); background: var(--c-bg); }
    .note lsms-icon { flex-shrink: 0; margin-top: 1px; }
    .note.info { color: var(--c-info); background: color-mix(in srgb, var(--c-info) 8%, transparent); }
    .ask { margin: 14px 0 0; font-size: 0.9rem; font-weight: 600; }
  `,
})
export class MissingDaysDialog {
  protected readonly data = inject<MissingDaysData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<MissingDaysResult>>(DialogRef);
  protected readonly i18n = inject(LanguageService);

  private readonly today = new Date();
  private readonly todayIso = toIsoDate(this.today);
  private readonly start = addDays(this.today, -this.data.lookback);
  private readonly locale = computed(() => (this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB'));
  protected readonly todayLabel = this.fmt(this.today, { day: 'numeric', month: 'short' });

  protected readonly weekdays = computed(() =>
    this.i18n.isSwahili() ? ['Jtt', 'Jnn', 'Jtn', 'Alh', 'Iju', 'Jmo', 'Jpi'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  );

  protected readonly rangeLabel = computed(() => {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${this.fmt(this.start, opts)} – ${this.fmt(addDays(this.today, -1), { ...opts, year: 'numeric' })}`;
  });

  protected readonly monthLabel = computed(() => {
    const a = this.fmt(this.start, { month: 'long' });
    const b = this.fmt(this.today, { month: 'long', year: 'numeric' });
    return this.start.getMonth() === this.today.getMonth() ? b : `${a} – ${b}`;
  });

  /** Missing days older than the user's backdate limit. */
  protected readonly outOfReach = computed(() => {
    const min = this.data.minDate;
    return min ? this.data.missing.filter((d) => d < min).length : 0;
  });

  /** Whole weeks (Mon–Sun) covering the checked window up to today. */
  protected readonly weeks = computed<Cell[][]>(() => {
    const missing = new Set(this.data.missing);
    const startIso = toIsoDate(this.start);
    const min = this.data.minDate;
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const first = addDays(this.start, -((this.start.getDay() + 6) % 7));
    const last = addDays(this.today, (7 - this.today.getDay()) % 7);
    const weeks: Cell[][] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const iso = toIsoDate(d);
      const long = this.fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
      let state: Cell['state'];
      let title: string;
      if (iso === this.todayIso) [state, title] = ['today', `${long} · ${t('today', 'leo')}`];
      else if (iso < startIso || iso > this.todayIso) [state, title] = ['out', long];
      else if (missing.has(iso)) [state, title] = ['miss', `${long} · ${t('no sales recorded', 'hakuna mauzo yaliyorekodiwa')}`];
      else [state, title] = ['ok', `${long} · ${t('has sales', 'yana mauzo')}`];
      const pickable = state === 'miss' && !!min && iso >= min;
      if (state === 'miss' && !pickable && min) title += ` · ${t('beyond your backdate limit', 'nje ya ruhusa yako')}`;
      if (!weeks.length || weeks[weeks.length - 1].length === 7) weeks.push([]);
      weeks[weeks.length - 1].push({ iso, day: d.getDate(), state, pickable, selected: iso === this.data.selected && iso !== this.todayIso, title });
    }
    return weeks;
  });

  private fmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
    return d.toLocaleDateString(this.locale(), opts);
  }
}
