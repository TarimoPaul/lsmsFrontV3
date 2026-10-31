import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, SegmentOption, SegmentedFilterBar, Skeleton, ToastService } from '@shared/ui';
import { addDays, toIsoDate } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { SaleChange, SaleChangeSummary, SaleChangesService } from './sale-changes.service';

type Tab = 'pending' | 'history';

/**
 * Backend 2.4.0 A6: every deleted / edited sale with who, when, why and the day's reconciliation state.
 * "Waiting" = allowed changes nobody has marked "Nimeona" yet (the banner); "History" = the last 30 days with a
 * summary, refusals included. CEO only (SALE_DELETE_REVIEW).
 */
@Component({
  selector: 'app-sale-changes-dialog',
  imports: [DialogShell, Button, Icon, Skeleton, SegmentedFilterBar, MoneyPipe, DatePipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Deleted and edited sales', 'Mauzo yaliyofutwa na kubadilishwa')" icon="manage_search">
      <lsms-segmented-filter-bar [options]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)" />
      @if (loading()) {
        <lsms-skeleton variant="list" [rows]="4" />
      } @else if (error()) {
        <p class="err"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
      } @else if (tab() === 'pending') {
        @if (!svc.pending().items.length) {
          <p class="muted">{{ i18n.t('Nothing waiting — every change has been seen.', 'Hakuna kinachosubiri — kila badiliko limeonekana.') }}</p>
        } @else {
          <ul>
            @for (c of svc.pending().items; track c.id) {
              <li>
                <ng-container *ngTemplateOutlet="row; context: { $implicit: c }" />
              </li>
            }
          </ul>
          <label class="note">
            <span>{{ i18n.t('Note (required)', 'Maelezo (lazima)') }}</span>
            <textarea rows="2" maxlength="1000" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
          </label>
        }
      } @else {
        @if (summary(); as s) {
          <div class="kpis">
            <div><b>{{ s.deleted }}</b><small>{{ i18n.t('deleted', 'yamefutwa') }} · {{ s.deletedAmount | money }}</small></div>
            <div><b>{{ s.changed }}</b><small>{{ i18n.t('edited', 'yamebadilishwa') }}</small></div>
            <div><b>{{ s.refused }}</b><small>{{ i18n.t('refused', 'yamekataliwa') }}</small></div>
          </div>
          @if (s.byUser.length) {
            <p class="small"><b>{{ i18n.t('Who', 'Nani') }}:</b> @for (u of s.byUser; track u.name) { {{ u.name }} ({{ u.count }}){{ $last ? '' : ', ' }} }</p>
          }
          @if (s.byReason.length) {
            <p class="small"><b>{{ i18n.t('Why', 'Kwa nini') }}:</b> @for (r of s.byReason.slice(0, 5); track r.reason) { “{{ r.reason }}” ({{ r.count }}){{ $last ? '' : ', ' }} }</p>
          }
        }
        @if (!history().length) {
          <p class="muted">{{ i18n.t('No changes in the last 30 days.', 'Hakuna mabadiliko siku 30 zilizopita.') }}</p>
        } @else {
          <ul>
            @for (c of history(); track c.id) {
              <li [class.refused]="c.result === 'REFUSED'">
                <ng-container *ngTemplateOutlet="row; context: { $implicit: c }" />
              </li>
            }
          </ul>
        }
      }

      <ng-template #row let-c>
        <span class="l">
          <b>{{ actionLabel(c) }} · {{ c.receiptNumber }}</b>
          <small>{{ date(c.at) | date: 'dd MMM yyyy, HH:mm' }} · {{ c.byName || c.byEmail }}@if (c.byIsCeo) { (CEO) } · {{ i18n.t('sale of', 'mauzo ya') }} {{ c.saleDate }}@if (c.recoStatus) { · reco {{ c.recoStatus }} }</small>
          @if (c.reason) { <small class="why">“{{ c.reason }}”</small> }
          @if (c.detail) { <small>{{ c.detail }}</small> }
          @if (c.result === 'REFUSED') { <small class="no">{{ i18n.t('Refused', 'Imekataliwa') }}: {{ c.refuseCode }}</small> }
          @if (c.ackAt) { <small class="ok">{{ i18n.t('Seen by', 'Imeonwa na') }} {{ c.ackByName }}: {{ c.ackNote }}</small> }
        </span>
        <b class="amt">{{ c.amountBefore | money }}@if (c.action !== 'DELETE' && c.amountAfter !== null) { → {{ c.amountAfter | money }} }</b>
      </ng-template>

      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (tab() === 'pending' && svc.pending().items.length) {
          <button lsmsButton="primary" icon="done_all" [loading]="busy()" [disabled]="note().trim().length < 3" (click)="ackAll()">
            {{ i18n.t('Seen (' + svc.pending().items.length + ')', 'Nimeona (' + svc.pending().items.length + ')') }}
          </button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    lsms-segmented-filter-bar { display: block; margin-bottom: 12px; }
    ul { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li { display: flex; align-items: flex-start; gap: 8px 12px; padding: 8px 10px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    li.refused { opacity: 0.75; border-style: dashed; }
    .l { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .l b { font-size: 0.82rem; }
    .l small { font-size: 0.72rem; color: var(--c-text-2); }
    .l .why { color: var(--c-text); font-style: italic; }
    .l .no { color: var(--c-error); }
    .l .ok { color: var(--c-success); }
    .amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
    .kpis div { display: flex; flex-direction: column; padding: 8px 10px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .kpis b { font-size: 1.1rem; }
    .kpis small, .small { font-size: 0.74rem; color: var(--c-text-2); }
    .note { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    textarea { padding: 9px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); resize: vertical; }
    .err { display: flex; align-items: center; gap: 6px; color: var(--c-error); }
    .muted { color: var(--c-text-2); font-size: 0.86rem; }
  `,
})
export class SaleChangesDialog {
  protected readonly i18n = inject(LanguageService);
  protected readonly svc = inject(SaleChangesService);
  private readonly toast = inject(ToastService);
  private readonly ref = inject<DialogRef<void>>(DialogRef);

  protected readonly tab = signal<Tab>('pending');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly history = signal<SaleChange[]>([]);
  protected readonly summary = signal<SaleChangeSummary | null>(null);

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => [
    { value: 'pending', label: this.i18n.t('Waiting', 'Zinasubiri'), icon: 'notification_important', count: this.svc.pending().count },
    { value: 'history', label: this.i18n.t('Last 30 days', 'Siku 30'), icon: 'history' },
  ]);

  constructor() {
    void this.load();
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.tab() === 'pending') {
        await this.svc.loadPending();
      } else {
        const from = toIsoDate(addDays(new Date(), -30));
        const [s, l] = await Promise.all([this.svc.summary({ from }), this.svc.list({ from, size: 200 })]);
        this.summary.set(s);
        this.history.set(l.items);
      }
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async ackAll(): Promise<void> {
    this.busy.set(true);
    try {
      const n = await this.svc.ack(this.svc.pending().items.map((c) => c.id), this.note().trim());
      this.note.set('');
      this.toast.success(this.i18n.t(`${n} marked as seen`, `${n} zimewekwa “Nimeona”`));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected actionLabel(c: SaleChange): string {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    switch (c.action) {
      case 'DELETE': return t('Deleted', 'Imefutwa');
      case 'UPDATE': return t('Edited', 'Imebadilishwa');
      case 'DETAIL_UPDATE': return t('Line edited', 'Mstari umebadilishwa');
      case 'DETAIL_REMOVE': return t('Line removed', 'Mstari umeondolewa');
      default: return t('Restore', 'Kurudisha');
    }
  }

  protected date(v: string | null): Date | null {
    return v ? new Date(v) : null;
  }

  protected close(): void {
    this.ref.close();
  }
}
