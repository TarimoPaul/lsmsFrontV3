import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import {
  Button,
  DataTable,
  DateRangeSelector,
  DialogService,
  EmptyState,
  Icon,
  SegmentOption,
  SegmentedFilterBar,
  TableColumn,
  ToastService,
} from '@shared/ui';
import { DateRange, addDays, toIsoDate } from '@shared/utils/date-utils';
import { downloadBlob } from '@shared/utils/export';
import { ReasonDialog, ReasonDialogData } from '../reconciliation/reason-dialog';
import { KnownNetwork, LoginAuditService, LoginFilter, LoginRow } from './login-audit.service';

type Tab = 'logins' | 'alerts' | 'networks';

const ALERT_LABEL: Record<string, { en: string; sw: string; tone: 'bad' | 'warn' | 'info' }> = {
  ROOT_LOGIN: { en: 'Root login', sw: 'Login ya root', tone: 'bad' },
  NEW_DEVICE: { en: 'New device', sw: 'Kifaa kipya', tone: 'warn' },
  VPN: { en: 'VPN', sw: 'VPN', tone: 'warn' },
  DATACENTER: { en: 'Datacenter / VPN', sw: 'Datacenter / VPN', tone: 'warn' },
  DIRECT: { en: 'Not via Cloudflare', sw: 'Bila Cloudflare', tone: 'bad' },
  FAILED_BURST: { en: '5+ failures', sw: 'Makosa 5+', tone: 'bad' },
  KNOWN_VPN: { en: 'Known network', sw: 'Mtandao unaojulikana', tone: 'info' },
  FIRST_LOGIN: { en: 'First login', sw: 'Login ya kwanza', tone: 'info' },
};

/**
 * Usalama → Login (backend 2.4.0 A3, design MUUNDO-LOGIN-AUDIT.md §6): every login attempt, logout and password
 * change with the real IP, country/network, device and alerts. LOGIN_AUDIT_VIEW (CEO + root); read-only apart from
 * "Seen" and "Known network"; CSV for LOGIN_AUDIT_EXPORT (the server audits each export).
 */
@Component({
  selector: 'app-login-audit-page',
  imports: [DataTable, TableColumn, SegmentedFilterBar, DateRangeSelector, EmptyState, Icon, Button, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="bar">
        <lsms-segmented-filter-bar [options]="tabs()" [selected]="tab()" (selectedChange)="setTab($event)" />
        <span class="grow"></span>
        @if (tab() !== 'networks') {
          <lsms-date-range-selector [range]="range()" [max]="today" (rangeChange)="range.set($event)" />
          @if (svc.canExport) {
            <button lsmsButton="secondary" size="sm" icon="download" [loading]="exporting()" (click)="exportCsv()">CSV</button>
          }
        }
      </div>

      @if (tab() !== 'networks') {
        <div class="filters">
          <input type="search" [placeholder]="i18n.t('Email…', 'Barua pepe…')" [value]="email()" (change)="email.set($any($event.target).value)" />
          <select [value]="result()" (change)="result.set($any($event.target).value)" [attr.aria-label]="i18n.t('Result', 'Matokeo')">
            <option value="">{{ i18n.t('All results', 'Matokeo yote') }}</option>
            @for (r of results; track r) { <option [value]="r">{{ r }}</option> }
          </select>
          <select [value]="flag()" (change)="flag.set($any($event.target).value)" [attr.aria-label]="i18n.t('Network', 'Mtandao')">
            <option value="">{{ i18n.t('All networks', 'Mitandao yote') }}</option>
            @for (f of flags; track f) { <option [value]="f">{{ f }}</option> }
          </select>
          <label><input type="checkbox" [checked]="newDevice()" (change)="newDevice.set($any($event.target).checked)" />{{ i18n.t('New device', 'Kifaa kipya') }}</label>
          <label><input type="checkbox" [checked]="rootOnly()" (change)="rootOnly.set($any($event.target).checked)" />{{ i18n.t('Root only', 'Root tu') }}</label>
        </div>

        @if (error()) {
          <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
        } @else {
          <div class="table-card">
            <lsms-data-table
              [title]="tab() === 'alerts' ? i18n.t('Logins to look at', 'Login za kuangalia') : i18n.t('Logins', 'Login')"
              [items]="rows()"
              [loading]="loading()"
              [pageSize]="25"
              [mobileTitle]="whoLabel"
              [mobileColumns]="['when', 'result', 'ip', 'net', 'device', 'alert']"
              [emptyTitle]="tab() === 'alerts' ? i18n.t('Nothing to look at', 'Hakuna cha kuangalia') : i18n.t('No logins in this period', 'Hakuna login kipindi hiki')"
              emptyIcon="verified_user"
            >
              <ng-template lsmsColumn="when" [label]="i18n.t('When (EAT)', 'Lini (EAT)')" [locked]="true" let-row>
                <span class="stack"><strong>{{ row.at | date: 'dd MMM, HH:mm:ss' : '+0300' }}</strong><small>{{ eventLabel(row) }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="who" [label]="i18n.t('User', 'Mtumiaji')" let-row>
                <span class="stack"><strong>{{ row.userName || row.email }}@if (row.isRoot) { <span class="tag bad">ROOT</span> }</strong><small>{{ row.email }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="result" [label]="i18n.t('Result', 'Matokeo')" let-row>
                <span class="tag" [class.ok]="row.result === 'SUCCESS'" [class.bad]="row.result !== 'SUCCESS'">{{ row.result }}</span>
                @if (row.failureReason) { <small class="muted"> {{ row.failureReason }}</small> }
              </ng-template>
              <ng-template lsmsColumn="ip" label="IP" let-row>
                <span class="stack"><code>{{ row.ip || '—' }}</code><small>{{ row.country || '—' }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="net" [label]="i18n.t('Network', 'Mtandao')" let-row>
                <span class="stack"><span class="tag" [class.warn]="row.networkFlag === 'VPN' || row.networkFlag === 'DATACENTER'" [class.bad]="row.networkFlag === 'DIRECT'">{{ row.networkFlag }}</span>
                  <small>@if (row.asn) { AS{{ row.asn }} } {{ row.asnOrg }}</small></span>
              </ng-template>
              <ng-template lsmsColumn="device" [label]="i18n.t('Device', 'Kifaa')" let-row>
                <span class="stack"><span [title]="row.userAgent || ''">{{ row.browser || '—' }} {{ row.browserVersion }} · {{ row.os }}</span><small>{{ row.deviceType }}@if (row.newDevice) { · <b class="warn-t">{{ i18n.t('new', 'kipya') }}</b> }</small></span>
              </ng-template>
              <ng-template lsmsColumn="alert" [label]="i18n.t('Alerts', 'Tahadhari')" let-row>
                <span class="alerts">
                  @for (a of alerts(row); track a) {
                    <span class="tag" [class.bad]="tone(a) === 'bad'" [class.warn]="tone(a) === 'warn'">{{ alertLabel(a) }}</span>
                  }
                  @if (row.alerting) {
                    <button lsmsButton="text" size="sm" icon="done" (click)="seen(row)">{{ i18n.t('Seen', 'Nimeona') }}</button>
                  } @else if (row.seen) {
                    <small class="ok-t">{{ i18n.t('seen', 'imeonwa') }}</small>
                  }
                  @if ((row.networkFlag === 'VPN' || row.networkFlag === 'DATACENTER') && row.userUid && row.asn && !hasKnown(row)) {
                    <button lsmsButton="text" size="sm" icon="vpn_lock" (click)="markKnown(row)">{{ i18n.t('Known network', 'VPN inayojulikana') }}</button>
                  }
                </span>
              </ng-template>
            </lsms-data-table>
          </div>
          <p class="attr">{{ attribution() }} · {{ i18n.t('Showing', 'Zinaonyeshwa') }} {{ rows().length }} / {{ total() }}</p>
        }
      } @else {
        @if (!networks().length) {
          <lsms-empty-state icon="vpn_lock" [title]="i18n.t('No known networks', 'Hakuna mitandao inayojulikana')" [message]="i18n.t('Mark a VPN / datacenter login as a known network for that user to stop its alert.', 'Weka login ya VPN / datacenter kama mtandao unaojulikana kwa mtumiaji huyo ili tahadhari yake isijirudie.')" />
        } @else {
          <ul class="nets">
            @for (n of networks(); track n.userUid + n.asn) {
              <li>
                <span class="stack"><strong>{{ n.userName || n.email }} · AS{{ n.asn }} {{ n.asnOrg }}</strong>
                  <small>{{ n.byName }} · {{ n.at | date: 'dd MMM yyyy, HH:mm' : '+0300' }} · “{{ n.note }}”</small></span>
                <button lsmsButton="secondary" size="sm" icon="remove_moderator" (click)="revoke(n)">{{ i18n.t('Revoke', 'Ondoa') }}</button>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: `
    .page { padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .grow { flex: 1; }
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 0.82rem; }
    .filters input[type='search'], .filters select { padding: 7px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); color: var(--c-text); font: inherit; }
    .filters label { display: inline-flex; align-items: center; gap: 6px; color: var(--c-text-2); }
    .stack { display: flex; flex-direction: column; gap: 1px; }
    .stack small, .muted { font-size: 0.72rem; color: var(--c-text-2); }
    code { font-size: 0.78rem; }
    .tag { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 0.7rem; font-weight: 600; background: var(--c-hover); color: var(--c-text-2); }
    .tag.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .tag.bad { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 12%, transparent); }
    .tag.warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 14%, transparent); }
    .warn-t { color: var(--c-warning); }
    .ok-t { color: var(--c-success); font-size: 0.72rem; }
    .alerts { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .attr { margin: 0; font-size: 0.72rem; color: var(--c-text-2); }
    .nets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .nets li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-surface); }
    .nets .stack { flex: 1; min-width: 0; }
    @media (max-width: 600px) { .page { padding: 12px; } }
  `,
})
export class LoginAuditPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly svc = inject(LoginAuditService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly today = new Date();
  protected readonly results = ['SUCCESS', 'FAILED', 'BLOCKED', 'DENIED', 'ERROR'];
  protected readonly flags = ['NORMAL', 'VPN', 'DATACENTER', 'DIRECT', 'PRIVATE', 'UNKNOWN'];

  protected readonly tab = signal<Tab>('logins');
  protected readonly range = signal<DateRange>({ start: addDays(new Date(), -6), end: new Date() });
  protected readonly email = signal('');
  protected readonly result = signal('');
  protected readonly flag = signal('');
  protected readonly newDevice = signal(false);
  protected readonly rootOnly = signal(false);

  protected readonly rows = signal<LoginRow[]>([]);
  protected readonly total = signal(0);
  protected readonly attribution = signal('');
  protected readonly networks = signal<KnownNetwork[]>([]);
  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly openAlerts = signal(0);

  protected readonly tabs = computed<SegmentOption<Tab>[]>(() => [
    { value: 'logins', label: this.i18n.t('Logins', 'Login'), icon: 'login' },
    { value: 'alerts', label: this.i18n.t('To look at', 'Za kuangalia'), icon: 'notification_important', count: this.openAlerts() },
    { value: 'networks', label: this.i18n.t('Known networks', 'Mitandao inayojulikana'), icon: 'vpn_lock', count: this.networks().length },
  ]);

  protected readonly whoLabel = (r: LoginRow) => r.userName || r.email || '—';

  constructor() {
    // the dashboard card opens ?tab=alerts
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    if (t === 'alerts' || t === 'networks') this.tab.set(t);
    // reload whenever a filter changes
    effect(() => {
      this.tab();
      this.range();
      this.email();
      this.result();
      this.flag();
      this.newDevice();
      this.rootOnly();
      untracked(() => void this.load());
    });
  }

  private filter(): LoginFilter {
    const r = this.range();
    return {
      from: toIsoDate(r.start),
      to: toIsoDate(r.end),
      email: this.email().trim() || undefined,
      result: this.result() || undefined,
      flag: this.flag() || undefined,
      newDevice: this.newDevice() || undefined,
      rootOnly: this.rootOnly() || undefined,
      alertsOnly: this.tab() === 'alerts' || undefined,
    };
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [nets, al] = await Promise.all([this.svc.knownNetworks(), this.svc.alerts(1)]);
      this.networks.set(nets);
      this.openAlerts.set(al.open);
      if (this.tab() !== 'networks') {
        const res = await this.svc.list(this.filter());
        this.rows.set(res.items);
        this.total.set(res.total);
        this.attribution.set(res.attribution);
      }
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected alerts(r: LoginRow): string[] {
    return (r.alert ?? '').split(',').filter(Boolean);
  }

  protected alertLabel(a: string): string {
    const l = ALERT_LABEL[a];
    return l ? (this.i18n.isSwahili() ? l.sw : l.en) : a;
  }

  protected tone(a: string): string {
    return ALERT_LABEL[a]?.tone ?? 'info';
  }

  protected hasKnown(r: LoginRow): boolean {
    return this.networks().some((n) => n.userUid === r.userUid && n.asn === r.asn);
  }

  protected eventLabel(r: LoginRow): string {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    switch (r.event) {
      case 'LOGIN_SUCCESS': return t('Login', 'Login');
      case 'LOGIN_FAILED': return t('Login failed', 'Login imeshindwa');
      case 'LOGOUT': return t('Logout', 'Kutoka');
      default: return t('Password change', 'Nenosiri limebadilishwa');
    }
  }

  protected async seen(r: LoginRow): Promise<void> {
    try {
      await this.svc.ack(r.id, 'SEEN');
      this.toast.success(this.i18n.t('Marked as seen', 'Imewekwa “Nimeona”'));
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async markKnown(r: LoginRow): Promise<void> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const note = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: t(`Known network for ${r.userName || r.email}?`, `Mtandao unaojulikana kwa ${r.userName || r.email}?`),
        message: t(
          `Logins of this user from AS${r.asn} ${r.asnOrg ?? ''} stay flagged ${r.networkFlag} but stop alerting. Other users from the same network still alert, and root logins always do.`,
          `Login za mtumiaji huyu kutoka AS${r.asn} ${r.asnOrg ?? ''} zitabaki na alama ${r.networkFlag} lakini hazitapiga tahadhari. Watumiaji wengine wa mtandao huo bado watapigiwa, na login za root daima.`,
        ),
        label: t('Why (at least 10 characters)', 'Kwa nini (angalau herufi 10)'),
        confirm: t('Mark as known', 'Weka kama unaojulikana'),
        min: 10,
      },
    });
    if (!note) return;
    try {
      await this.svc.ack(r.id, 'KNOWN_NETWORK', note);
      this.toast.success(t('Known network saved', 'Mtandao unaojulikana umehifadhiwa'));
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async revoke(n: KnownNetwork): Promise<void> {
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const note = await this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, {
      size: 'sm',
      data: {
        title: t(`Revoke AS${n.asn} for ${n.userName || n.email}?`, `Ondoa AS${n.asn} kwa ${n.userName || n.email}?`),
        message: t('Its logins will alert again.', 'Login zake zitapiga tahadhari tena.'),
        label: t('Why (at least 10 characters)', 'Kwa nini (angalau herufi 10)'),
        confirm: t('Revoke', 'Ondoa'),
        danger: true,
        min: 10,
      },
    });
    if (!note) return;
    try {
      await this.svc.revoke(n.userUid, n.asn, note);
      this.toast.success(t('Revoked', 'Imeondolewa'));
      await this.load();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async exportCsv(): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await this.svc.exportCsv({ ...this.filter() });
      downloadBlob(blob, `login-audit-${toIsoDate(new Date())}.csv`);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.exporting.set(false);
    }
  }
}
