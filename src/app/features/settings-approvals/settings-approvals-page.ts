import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, MetricCard, MetricsGrid, PageHeader, SegmentOption, SegmentedFilterBar, Skeleton, ToastService } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
import type { ReasonDialogData } from '../reconciliation/reason-dialog';
import { ChangeDiff } from './change-diff';
import { ApprovalStatus, SettingsApprovalsService, SettingsRequest } from './settings-approvals.service';

type Tab = 'queue' | 'mine';

const STATUS: Record<ApprovalStatus, { en: string; sw: string; color: string; icon: string }> = {
  PENDING: { en: 'Awaiting approval', sw: 'Inasubiri idhini', color: 'var(--c-warning)', icon: 'hourglass_top' },
  APPROVED: { en: 'Approved · applied', sw: 'Imeidhinishwa · imetekelezwa', color: 'var(--c-success)', icon: 'verified' },
  REJECTED: { en: 'Rejected', sw: 'Imekataliwa', color: 'var(--c-error)', icon: 'block' },
  CANCELLED: { en: 'Cancelled', sw: 'Imeghairiwa', color: 'var(--c-text-2)', icon: 'undo' },
  EXPIRED: { en: 'Expired', sw: 'Muda umeisha', color: 'var(--c-text-2)', icon: 'timer_off' },
};

/**
 * Settings approvals — maker-checker for the main business settings. People
 * who may not edit the settings directly send a request from Business
 * Settings; an approver (never the requester) approves it, which applies the
 * change at once, or rejects it with a reason. Requests expire after 7 days.
 */
@Component({
  selector: 'app-settings-approvals-page',
  imports: [PageHeader, SegmentedFilterBar, MetricCard, MetricsGrid, Skeleton, EmptyState, Icon, Button, ChangeDiff, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Settings Approvals', 'Idhini za Mipangilio')"
        [subtitle]="i18n.t('Changes to the business settings wait here for a second person', 'Mabadiliko ya mipangilio ya biashara yanasubiri hapa kwa mtu wa pili')"
        icon="approval"
        [refreshable]="true"
        (refresh)="load(true)"
      >
        @if (api.canRequest() || api.canEditDirect()) {
          <a lsmsButton="secondary" icon="settings_applications" routerLink="/business-settings">{{ api.canRequest() ? i18n.t('Request a change', 'Omba badiliko') : i18n.t('Business settings', 'Mipangilio ya biashara') }}</a>
        }
      </lsms-page-header>

      <lsms-metrics-grid [gap]="12">
        @if (api.canApprove()) {
          <lsms-metric-card [title]="i18n.t('Waiting for you', 'Zinakusubiri')" [value]="'' + queue().length" icon="pending_actions" color="var(--c-warning)" [urgent]="queue().length > 0" />
        }
        <lsms-metric-card [title]="i18n.t('My open requests', 'Maombi yangu yaliyo wazi')" [value]="'' + count('PENDING')" icon="hourglass_top" color="var(--c-info)" />
        <lsms-metric-card [title]="i18n.t('Approved', 'Zimeidhinishwa')" [value]="'' + count('APPROVED')" icon="verified" color="var(--c-success)" [subtitle]="i18n.t('of my requests', 'kati ya maombi yangu')" />
        <lsms-metric-card [title]="i18n.t('Rejected', 'Zimekataliwa')" [value]="'' + count('REJECTED')" icon="block" color="var(--c-error)" [subtitle]="i18n.t('of my requests', 'kati ya maombi yangu')" />
      </lsms-metrics-grid>

      <lsms-segmented-filter-bar [options]="tabs()" [selected]="tab()" (selectedChange)="tab.set($event)" />

      @if (error()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load requests', 'Maombi hayakupatikana')" [message]="error()" />
      } @else if (loading()) {
        <lsms-skeleton variant="list" [rows]="3" />
      } @else if (!list().length) {
        <lsms-empty-state
          [icon]="tab() === 'queue' ? 'task_alt' : 'inbox'"
          [title]="tab() === 'queue' ? i18n.t('Nothing waiting for approval', 'Hakuna kinachosubiri idhini') : i18n.t('You have not requested any change', 'Hujaomba badiliko lolote')"
          [message]="tab() === 'queue' ? i18n.t('Requests from other users appear here.', 'Maombi ya watumiaji wengine yataonekana hapa.') : (api.canRequest() ? i18n.t('Open Business Settings, edit and send the change for approval.', 'Fungua Mipangilio ya Biashara, hariri na utume badiliko kwa idhini.') : '')"
        />
      } @else {
        <div class="list">
          @for (r of list(); track r.uid) {
            @let st = status(r.status);
            <article class="req" [class.done]="r.status !== 'PENDING'">
              <header>
                <span class="ic" [style.--c]="st.color"><lsms-icon [name]="st.icon" [size]="20" /></span>
                <div class="who">
                  <b>{{ r.description || i18n.t('Business settings change', 'Badiliko la mipangilio ya biashara') }}</b>
                  <small>
                    {{ r.requesterName ?? '—' }} · {{ when(r.requestedAt) }}
                    @if (r.status === 'PENDING' && r.expiresAt) { · {{ i18n.t('expires', 'inaisha') }} {{ when(r.expiresAt) }} }
                  </small>
                </div>
                <span class="status" [style.--st]="st.color">{{ i18n.isSwahili() ? st.sw : st.en }}</span>
              </header>

              <app-change-diff [before]="r.before" [after]="r.after" [current]="r.status === 'PENDING' ? current() : null" />

              @if (r.reason) {
                <p class="note"><lsms-icon name="chat" [size]="15" /><span><b>{{ i18n.t('Reason', 'Sababu') }}:</b> {{ r.reason }}</span></p>
              }
              @if (r.status === 'REJECTED' && r.rejectionReason) {
                <p class="note bad"><lsms-icon name="block" [size]="15" /><span><b>{{ r.approverName ?? '' }}</b> {{ i18n.t('rejected', 'alikataa') }} {{ when(r.decidedAt) }}: {{ r.rejectionReason }}</span></p>
              }
              @if (r.status === 'APPROVED') {
                <p class="note good"><lsms-icon name="verified" [size]="15" /><span><b>{{ r.approverName ?? '' }}</b> {{ i18n.t('approved', 'aliidhinisha') }} {{ when(r.decidedAt) }}@if (r.approvalNote) { — {{ r.approvalNote }} }</span></p>
              }

              @if (r.status === 'PENDING') {
                <footer>
                  @if (isMine(r)) {
                    <span class="hint">{{ i18n.t('Another person must approve your request', 'Mtu mwingine lazima aidhinishe ombi lako') }}</span>
                    <button lsmsButton="secondary" size="sm" icon="undo" [loading]="busy() === r.uid" (click)="cancel(r)">{{ i18n.t('Cancel request', 'Ghairi ombi') }}</button>
                  } @else {
                    @if (api.canReject()) {
                      <button lsmsButton="secondary" size="sm" icon="block" [disabled]="!!busy()" (click)="reject(r)">{{ i18n.t('Reject', 'Kataa') }}</button>
                    }
                    @if (api.canApprove()) {
                      <button lsmsButton size="sm" icon="check" [loading]="busy() === r.uid" [disabled]="!!busy()" (click)="approve(r)">{{ i18n.t('Approve & apply', 'Idhinisha na tekeleza') }}</button>
                    }
                  }
                </footer>
              }
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .list { display: flex; flex-direction: column; gap: 12px; }
    .req { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); box-shadow: 0 1px 2px rgb(16 24 40 / 0.04); }
    .req.done { background: color-mix(in srgb, var(--c-bg) 60%, var(--c-surface)); }
    .req header { display: flex; align-items: center; gap: 12px; }
    .ic { --c: var(--c-primary); display: inline-grid; place-items: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 11px; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .who b { font-size: 0.92rem; font-weight: 600; color: var(--c-text); }
    .who small { font-size: 0.74rem; color: var(--c-text-2); }
    .note { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 8px 12px; border-radius: 10px; font-size: 0.8rem; color: var(--c-text); background: var(--c-bg); }
    .note lsms-icon { flex-shrink: 0; color: var(--c-text-2); margin-top: 1px; }
    .note.bad { background: color-mix(in srgb, var(--c-error) 7%, var(--c-bg)); } .note.bad lsms-icon { color: var(--c-error); }
    .note.good { background: color-mix(in srgb, var(--c-success) 7%, var(--c-bg)); } .note.good lsms-icon { color: var(--c-success); }
    .req footer { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px dashed var(--c-border); }
    .hint { margin-right: auto; font-size: 0.76rem; color: var(--c-text-2); }
  `,
})
export class SettingsApprovalsPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly api = inject(SettingsApprovalsService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(BusinessSettingsService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>(this.api.canApprove() ? 'queue' : 'mine');
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly current = this.settings.main.value;

  /** Open requests of OTHER people (mine can never be approved by me). */
  protected readonly queue = computed(() => (this.api.pending.value() ?? []).filter((r) => r.status === 'PENDING'));
  private readonly mine = computed(() => this.api.mine.value() ?? []);
  protected readonly list = computed(() => (this.tab() === 'queue' ? this.queue() : this.mine()));
  protected readonly loading = computed(() => (this.tab() === 'queue' ? this.api.pending.initialLoading() : this.api.mine.initialLoading()));

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => [
    ...(this.api.canApprove() ? [{ value: 'queue' as Tab, label: this.i18n.t('Waiting for approval', 'Zinasubiri idhini'), icon: 'pending_actions', count: this.queue().length }] : []),
    { value: 'mine', label: this.i18n.t('My requests', 'Maombi yangu'), icon: 'history', count: this.mine().length },
  ]);

  constructor() {
    this.load(false);
  }

  protected load(force: boolean): void {
    this.error.set('');
    const tasks: Promise<unknown>[] = [this.api.mine.load(force)];
    if (this.api.canApprove()) tasks.push(this.api.pending.load(force), this.settings.main.load(force));
    Promise.all(tasks).catch((e) => this.error.set(ApiError.from(e).message));
  }

  protected count(s: ApprovalStatus): number {
    return this.mine().filter((r) => r.status === s).length;
  }

  protected isMine(r: SettingsRequest): boolean {
    return !!r.requesterUid && r.requesterUid === this.auth.user()?.uid;
  }

  protected status(s: ApprovalStatus) {
    return STATUS[s] ?? STATUS.PENDING;
  }

  protected when(v: string | null): string {
    const d = parseLocal(v);
    return d ? d.toLocaleString(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  protected async approve(r: SettingsRequest): Promise<void> {
    const { ReasonDialog } = await import('../reconciliation/reason-dialog');
    const note = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Approve and apply?', 'Idhinisha na tekeleza?'),
        message: this.i18n.t('The new values take effect immediately (receipts, credit terms, reconciliation).', 'Thamani mpya zinaanza kutumika mara moja (risiti, muda wa mkopo, ulinganisho).'),
        label: this.i18n.t('Note (optional)', 'Maelezo (si lazima)'),
        confirm: this.i18n.t('Approve & apply', 'Idhinisha na tekeleza'),
        min: 0,
      },
    });
    if (note === undefined) return;
    await this.run(r, () => this.api.approve(r.uid, note), this.i18n.t('Approved — the change is in effect', 'Imeidhinishwa — badiliko linatumika sasa'));
  }

  protected async reject(r: SettingsRequest): Promise<void> {
    const { ReasonDialog } = await import('../reconciliation/reason-dialog');
    const reason = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: this.i18n.t('Reject request', 'Kataa ombi'),
        label: this.i18n.t('Reason (the requester sees it)', 'Sababu (aliyeomba ataiona)'),
        confirm: this.i18n.t('Reject', 'Kataa'),
        danger: true,
      },
    });
    if (!reason) return;
    await this.run(r, () => this.api.reject(r.uid, reason), this.i18n.t('Request rejected', 'Ombi limekataliwa'));
  }

  protected async cancel(r: SettingsRequest): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Cancel this request?', 'Ghairi ombi hili?'),
      message: this.i18n.t('Nothing will change in the settings.', 'Hakuna kitakachobadilika kwenye mipangilio.'),
      confirmText: this.i18n.t('Cancel request', 'Ghairi ombi'),
      cancelText: this.i18n.t('Keep', 'Acha'),
    });
    if (!ok) return;
    await this.run(r, () => this.api.cancel(r.uid), this.i18n.t('Request cancelled', 'Ombi limeghairiwa'));
  }

  private async run(r: SettingsRequest, action: () => Promise<void>, done: string): Promise<void> {
    this.busy.set(r.uid);
    try {
      await action();
      this.toast.success(done);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }
}
