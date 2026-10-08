import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon, SegmentOption, SegmentedFilterBar, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { AssetCount } from './asset-count';
import { AssetHistory } from './asset-history';
import { AssetRegister } from './asset-register';
import { WEEK_DAYS } from './asset.models';
import { AssetService } from './asset.service';

type View = 'count' | 'register' | 'history';

/**
 * "Assets" tab of the Counting module. The register is filled once and confirmed
 * by the CEO; after that the confirmed assets are verified on a daily / weekly
 * schedule. Views appear only for what the user can act on: Verify
 * (COUNTING_PERFORM), Asset list (ASSET_COUNT_MANAGE / ASSET_COUNT_APPROVE),
 * History (COUNTING_PERFORM / ASSET_COUNT_APPROVE).
 */
@Component({
  selector: 'app-assets-tab',
  imports: [SegmentedFilterBar, Button, Icon, DatePipe, AssetCount, AssetRegister, AssetHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="strip" [class.due]="status()?.due">
      <lsms-icon [name]="status()?.due ? 'notification_important' : 'event_repeat'" [size]="20" />
      <div>
        <b>{{ scheduleLabel() }}</b>
        <small>
          @if (status()?.due) {
            {{ i18n.t('Asset verification is due', 'Uhakiki wa mali unatakiwa kufanyika') }}@if (status()!.dueSince !== today) { · {{ i18n.t('since', 'tangu') }} {{ day(status()!.dueSince) | date: 'EEE dd MMM' }} }
          } @else if (status()?.lastCountDate) {
            {{ i18n.t('Last verified', 'Mara ya mwisho kuhakikiwa') }}: {{ day(status()!.lastCountDate) | date: 'EEE, dd MMM yyyy' }}
          } @else {
            {{ i18n.t('Assets have not been verified yet', 'Mali hazijawahi kuhakikiwa') }}
          }
        </small>
      </div>
      @if (canApprove()) {
        <button lsmsButton="text" size="sm" icon="edit_calendar" (click)="editSchedule()">{{ i18n.t('Schedule', 'Ratiba') }}</button>
      }
    </section>

    @if (views().length > 1) {
      <lsms-segmented-filter-bar [options]="views()" [selected]="view()" (selectedChange)="view.set($event)" />
    }
    @switch (view()) {
      @case ('count') { <app-asset-count #count (changed)="reload()" (openRegister)="view.set('register')" [canOpenRegister]="canRegister()" /> }
      @case ('register') { <app-asset-register #register (changed)="reload()" /> }
      @case ('history') { <app-asset-history #history (changed)="reload()" /> }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .strip { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-primary); }
    .strip.due { color: var(--c-warning); border-color: color-mix(in srgb, var(--c-warning) 40%, transparent); background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface)); }
    .strip div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .strip b { font-size: 0.9rem; font-weight: 600; color: var(--c-text); }
    .strip small { font-size: 0.78rem; color: var(--c-text-2); }
  `,
})
export class AssetsTab {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  private readonly count = viewChild<AssetCount>('count');
  private readonly register = viewChild<AssetRegister>('register');
  private readonly history = viewChild<AssetHistory>('history');

  protected readonly status = this.api.status;
  protected readonly today = new Date().toLocaleDateString('en-CA');

  protected readonly canPerform = computed(() => this.auth.hasPermission('COUNTING_PERFORM'));
  protected readonly canApprove = computed(() => this.auth.hasPermission('ASSET_COUNT_APPROVE'));
  protected readonly canRegister = computed(() => this.canApprove() || this.auth.hasPermission('ASSET_COUNT_MANAGE'));

  protected readonly views = computed<SegmentOption<View>[]>(() => {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const s = this.status();
    return [
      ...(this.canPerform() ? [{ value: 'count' as View, label: t('Verify', 'Hakiki'), icon: 'fact_check', count: s?.due ? 1 : undefined }] : []),
      ...(this.canRegister() ? [{ value: 'register' as View, label: t('Asset list', 'Orodha ya mali'), icon: 'chair', count: (this.canApprove() && s?.pendingItems) || undefined }] : []),
      ...(this.canPerform() || this.canApprove()
        ? [{ value: 'history' as View, label: t('History', 'Historia'), icon: 'history', count: (this.canApprove() && s?.sessionsAwaitingApproval) || undefined }]
        : []),
    ];
  });

  protected readonly view = signal<View>('count');

  protected readonly scheduleLabel = computed(() => {
    const s = this.status();
    if (!s?.frequency) return this.i18n.t('No verification schedule', 'Hakuna ratiba ya uhakiki');
    if (s.frequency === 'DAILY') return this.i18n.t('Verified every day', 'Uhakiki kila siku');
    const d = WEEK_DAYS[(s.dayOfWeek ?? 1) - 1];
    return this.i18n.t('Verified every ' + d.en, 'Uhakiki kila ' + d.sw);
  });

  constructor() {
    const allowed = this.views().map((v) => v.value);
    this.view.set(allowed[0] ?? 'count');
    void this.reload().then(() => {
      // The CEO lands where a decision is waiting.
      const s = this.status();
      if (!this.canApprove() || !s) return;
      if (s.pendingItems) this.view.set('register');
      else if (s.sessionsAwaitingApproval) this.view.set('history');
    });
  }

  /** Page-level refresh. */
  load(): void {
    void this.reload();
    void this.count()?.resume();
    void this.register()?.load();
    void this.history()?.load();
  }

  protected async reload(): Promise<void> {
    await this.api.loadStatus().catch(() => undefined);
  }

  protected async editSchedule(): Promise<void> {
    const { AssetScheduleDialog } = await import('./asset-dialogs');
    const saved = await this.dialogs.openAsync<boolean>(AssetScheduleDialog, { size: 'sm' });
    if (saved) this.toast.success(this.i18n.t('Schedule saved', 'Ratiba imehifadhiwa'));
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }
}
