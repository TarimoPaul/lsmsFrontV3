import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, IconButton, PageHeader, Skeleton } from '@shared/ui';
import { parseLocal } from '@shared/utils/date-utils';
import { MoneyPipe } from '@shared/utils/money';
import { BUSINESS_TYPES, DEFAULT_CREDIT_TERM_DAYS, DEFAULT_VARIANCE_THRESHOLD } from './business-settings.models';
import { SettingsApprovalsService } from '../settings-approvals/settings-approvals.service';
import { BusinessSettingsService } from './business-settings.service';
import type { OpeningCapitalData } from './opening-capital-dialog';
import type { SettingsFormData, SettingsSection } from './settings-form-dialog';

/**
 * Business Settings — the business profile printed on receipts, the rules
 * other modules read (credit term → AR aging, variance threshold →
 * reconciliation) and the opening-capital record. Flutter's "All settings",
 * "Public settings" and "Validate" views called endpoints that do not exist,
 * so they are not ported.
 */
@Component({
  selector: 'app-business-settings-page',
  imports: [PageHeader, Button, IconButton, Icon, EmptyState, Skeleton, MoneyPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Business Settings', 'Mipangilio ya Biashara')"
        [subtitle]="i18n.t('Business profile, receipts and business rules', 'Wasifu wa biashara, risiti na kanuni za biashara')"
        icon="settings_applications"
        [refreshable]="true"
        (refresh)="refresh()"
      >
        @if (canEdit() && s()) {
          <button lsmsButton [icon]="approvals.canRequest() ? 'approval' : 'edit'" (click)="edit()">
            {{ approvals.canRequest() ? i18n.t('Request a change', 'Omba badiliko') : i18n.t('Edit settings', 'Hariri mipangilio') }}
          </button>
        }
      </lsms-page-header>

      @if (myOpen().length) {
        <a class="pending" routerLink="/settings-approvals">
          <lsms-icon name="hourglass_top" [size]="18" />
          <span>
            <b>{{ i18n.t('Your change is waiting for approval', 'Badiliko lako linasubiri idhini') }}</b>
            <small>{{ myOpen()[0].description }}</small>
          </span>
          <lsms-icon name="arrow_forward" [size]="16" />
        </a>
      }
      @if (approvals.canApprove() && othersOpen() > 0) {
        <a class="pending" routerLink="/settings-approvals">
          <lsms-icon name="approval" [size]="18" />
          <span>
            <b>{{ othersOpen() }} {{ i18n.t('settings change(s) waiting for your approval', 'badiliko la mipangilio linasubiri idhini yako') }}</b>
          </span>
          <lsms-icon name="arrow_forward" [size]="16" />
        </a>
      }

      @if (api.main.initialLoading()) {
        <lsms-skeleton variant="list" [rows]="5" />
      } @else if (!s()) {
        <lsms-empty-state icon="cloud_off" [title]="i18n.t('Settings could not be loaded', 'Mipangilio haikupatikana')" [message]="error()" />
      } @else {
        @let b = s()!;
        <section class="hero">
          <div class="mark">{{ initials() }}</div>
          <div class="who">
            <h3>{{ b.businessName }}</h3>
            @if (b.businessTagline) { <p class="tag">{{ b.businessTagline }}</p> }
            <div class="chips">
              @if (b.businessPhone) { <span><lsms-icon name="call" [size]="14" />{{ b.businessPhone }}</span> }
              @if (b.businessEmail) { <span><lsms-icon name="mail" [size]="14" />{{ b.businessEmail }}</span> }
              @if (b.businessAddress) { <span><lsms-icon name="location_on" [size]="14" />{{ b.businessAddress }}</span> }
              @if (b.businessWebsite) { <span><lsms-icon name="language" [size]="14" />{{ b.businessWebsite }}</span> }
              @if (!b.businessPhone && !b.businessEmail && !b.businessAddress) { <span class="empty">{{ i18n.t('No contact details yet', 'Bado hakuna mawasiliano') }}</span> }
            </div>
          </div>
          <div class="complete" [class.full]="completeness().pct === 100">
            <div class="ring" [style.--p]="completeness().pct"><b>{{ completeness().pct }}%</b></div>
            <div class="ctext">
              <b>{{ i18n.t('Profile complete', 'Wasifu umekamilika') }}</b>
              @if (completeness().missing.length) {
                <small>{{ i18n.t('Missing', 'Kinakosekana') }}: {{ completeness().missing.join(', ') }}</small>
              } @else {
                <small>{{ i18n.t('Everything receipts need is filled in', 'Kila kitu kinachohitajika kwenye risiti kimejazwa') }}</small>
              }
            </div>
          </div>
        </section>

        <div class="grid">
          <section class="card">
            <header>
              <lsms-icon name="gavel" />
              <h4>{{ i18n.t('Tax & registration', 'Kodi na usajili') }}</h4>
              @if (canEdit()) { <button lsmsIconButton="edit" [attr.aria-label]="i18n.t('Edit', 'Hariri')" (click)="edit('tax')"></button> }
            </header>
            <dl>
              <div><dt>TIN</dt><dd [class.none]="!b.taxId">{{ b.taxId ?? i18n.t('Not set', 'Haijawekwa') }}</dd></div>
              <div><dt>{{ i18n.t('VAT number (VRN)', 'Namba ya VAT (VRN)') }}</dt><dd [class.none]="!b.vatNumber">{{ b.vatNumber ?? i18n.t('Not set', 'Haijawekwa') }}</dd></div>
              <div><dt>{{ i18n.t('Licence / reg. no.', 'Leseni / usajili') }}</dt><dd [class.none]="!b.registrationNumber">{{ b.registrationNumber ?? i18n.t('Not set', 'Haijawekwa') }}</dd></div>
            </dl>
          </section>

          <section class="card">
            <header>
              <lsms-icon name="tune" />
              <h4>{{ i18n.t('Business rules', 'Kanuni za biashara') }}</h4>
              @if (canEdit()) { <button lsmsIconButton="edit" [attr.aria-label]="i18n.t('Edit', 'Hariri')" (click)="edit('rules')"></button> }
            </header>
            <dl>
              <div>
                <dt>{{ i18n.t('Credit term', 'Muda wa mkopo') }}<small>{{ i18n.t('Credit sales become overdue after this', 'Mauzo ya deni huchelewa baada ya hapa') }}</small></dt>
                <dd>{{ creditDays() }} {{ i18n.t('days', 'siku') }}@if (b.defaultCreditTermDays === null) { <em>{{ i18n.t('default', 'chaguo-msingi') }}</em> }</dd>
              </div>
              <div>
                <dt>{{ i18n.t('Variance threshold', 'Kiwango cha tofauti') }}<small>{{ i18n.t('Reconciliation differences from this amount are flagged', 'Tofauti za ulinganisho kuanzia kiasi hiki huwekewa alama') }}</small></dt>
                <dd>{{ variance() | money: { decimals: 0 } }}@if (b.varianceThreshold === null) { <em>{{ i18n.t('default', 'chaguo-msingi') }}</em> }</dd>
              </div>
            </dl>
          </section>

          <section class="card">
            <header>
              <lsms-icon name="receipt_long" />
              <h4>{{ i18n.t('Receipt preview', 'Muonekano wa risiti') }}</h4>
              @if (canEdit()) { <button lsmsIconButton="edit" [attr.aria-label]="i18n.t('Edit', 'Hariri')" (click)="edit('receipt')"></button> }
            </header>
            <div class="paper" aria-hidden="true">
              <b class="nm">{{ b.businessName }}</b>
              @if (b.businessTagline) { <span>{{ b.businessTagline }}</span> }
              @if (b.receiptHeader) { <span>{{ b.receiptHeader }}</span> }
              @if (b.businessAddress) { <span>{{ b.businessAddress }}</span> }
              @if (b.businessPhone) { <span>{{ i18n.t('Phone', 'Simu') }}: {{ b.businessPhone }}</span> }
              @if (b.taxId) { <span>TIN: {{ b.taxId }}</span> }
              @if (b.vatNumber) { <span>VRN: {{ b.vatNumber }}</span> }
              <hr />
              <p><span>{{ i18n.t('Sample item', 'Bidhaa ya mfano') }} × 2</span><span>10,000</span></p>
              <p class="tot"><span>{{ i18n.t('TOTAL', 'JUMLA') }}</span><span>TSh 10,000</span></p>
              <hr />
              <span>{{ b.receiptFooter ?? i18n.t('Thank you for shopping with us!', 'Asante kwa kununua nasi!') }}</span>
            </div>
          </section>

          @if (canReadOpening()) {
            <section class="card">
              <header>
                <lsms-icon name="account_balance_wallet" />
                <h4>{{ i18n.t('Opening capital', 'Mtaji wa awali') }}</h4>
                @if (o() && canEditOpening()) { <button lsmsIconButton="edit" [attr.aria-label]="i18n.t('Edit', 'Hariri')" (click)="opening()"></button> }
              </header>
              @if (api.opening.initialLoading()) {
                <lsms-skeleton variant="list" [rows]="3" />
              } @else if (o(); as oc) {
                <div class="cap">
                  <div class="cap-total"><small>{{ i18n.t('Started', 'Ilianza') }} {{ day(oc.businessStartDate) | date: 'd MMM yyyy' }}@if (oc.businessType) { · {{ typeLabel(oc.businessType) }} }</small><b>{{ oc.totalInitialCapital | money: { decimals: 0 } }}</b></div>
                  <div class="bar">
                    @for (p of openingParts(); track p.key) { <i [style.width.%]="p.pct" [style.background]="p.color"></i> }
                  </div>
                  <dl class="tight">
                    @for (p of openingParts(); track p.key) {
                      <div><dt><i class="sw" [style.background]="p.color"></i>{{ p.label }}</dt><dd>{{ p.value | money: { decimals: 0 } }}</dd></div>
                    }
                  </dl>
                  <p class="src">
                    {{ i18n.t('Owner', 'Mmiliki') }} {{ oc.ownerEquity | money: { decimals: 0 } }}
                    @if (oc.partnerContributions) { · {{ i18n.t('Partners', 'Washirika') }} {{ oc.partnerContributions | money: { decimals: 0 } }} }
                    @if (oc.loanCapital) { · {{ i18n.t('Loan', 'Mkopo') }} {{ oc.loanCapital | money: { decimals: 0 } }} }
                  </p>
                  <a class="more" routerLink="/capital">{{ i18n.t('See today’s capital position', 'Angalia hali ya mtaji leo') }}<lsms-icon name="arrow_forward" [size]="15" /></a>
                </div>
              } @else {
                <div class="setup">
                  <p>{{ i18n.t('Record where your starting capital came from and how it was used. Capital reports compare against it.', 'Rekodi mtaji wa kuanzia ulitoka wapi na ulitumikaje. Ripoti za mtaji hulinganisha nao.') }}</p>
                  @if (canCreateOpening()) {
                    <button lsmsButton icon="rocket_launch" (click)="opening()">{{ i18n.t('Start setup', 'Anza usanidi') }}</button>
                  } @else {
                    <small class="muted">{{ i18n.t('Not set up yet', 'Bado haujawekwa') }}</small>
                  }
                </div>
              }
            </section>
          }
        </div>

        @if (b.lastModifiedAt) {
          <p class="stamp"><lsms-icon name="history" [size]="14" />{{ i18n.t('Last changed', 'Ilibadilishwa mwisho') }} {{ day(b.lastModifiedAt) | date: 'd MMM yyyy, HH:mm' }}</p>
        }
      }
    </div>
  `,
  styles: `
    @use 'list-page';
    @include list-page.base;
    .hero, .card { border-radius: 16px; background: var(--c-surface); border: 1px solid var(--c-border); box-shadow: 0 1px 2px rgb(16 24 40 / 0.04); }
    .hero { display: flex; align-items: center; flex-wrap: wrap; gap: 16px 20px; padding: 20px; }
    .mark { display: grid; place-items: center; flex-shrink: 0; width: 64px; height: 64px; border-radius: 18px; font-size: 1.4rem; font-weight: 700; letter-spacing: 1px; color: #fff; background: linear-gradient(135deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 60%, #0b1b2b)); }
    .who { flex: 1 1 320px; min-width: 0; }
    .who h3 { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--c-text); }
    .tag { margin: 2px 0 0; font-size: 0.85rem; color: var(--c-text-2); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .chips span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 100px; font-size: 0.76rem; color: var(--c-text); background: color-mix(in srgb, var(--c-primary) 7%, var(--c-bg)); lsms-icon { color: var(--c-primary); } }
    .chips .empty { color: var(--c-text-2); }
    .complete { display: flex; align-items: center; gap: 12px; flex: 0 1 300px; padding: 10px 14px; border-radius: 14px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .ring { --p: 0; display: grid; place-items: center; flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%;
      background: radial-gradient(closest-side, var(--c-bg) 76%, transparent 78%), conic-gradient(var(--c-warning) calc(var(--p) * 1%), color-mix(in srgb, var(--c-text-2) 14%, transparent) 0); }
    .complete.full .ring { background: radial-gradient(closest-side, var(--c-bg) 76%, transparent 78%), conic-gradient(var(--c-success) 100%, transparent 0); }
    .ring b { font-size: 0.78rem; font-weight: 700; color: var(--c-text); }
    .ctext { display: flex; flex-direction: column; min-width: 0; }
    .ctext b { font-size: 0.84rem; font-weight: 600; color: var(--c-text); }
    .ctext small { font-size: 0.72rem; color: var(--c-text-2); }

    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card { display: flex; flex-direction: column; padding: 4px 18px 16px; }
    .card header { display: flex; align-items: center; gap: 8px; min-height: 48px; border-bottom: 1px solid var(--c-border); margin-bottom: 6px; }
    .card header > lsms-icon { color: var(--c-primary); }
    .card h4 { flex: 1; margin: 0; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: var(--c-text-2); }
    dl { display: flex; flex-direction: column; margin: 0; }
    dl > div { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px dashed var(--c-border); }
    dl > div:last-child { border-bottom: 0; }
    dt { display: flex; flex-direction: column; font-size: 0.84rem; color: var(--c-text-2); }
    dt small { font-size: 0.72rem; opacity: 0.85; }
    dd { margin: 0; font-size: 0.88rem; font-weight: 600; color: var(--c-text); text-align: right; font-variant-numeric: tabular-nums; }
    dd.none { font-weight: 400; font-style: italic; color: var(--c-text-2); }
    dd em { margin-left: 6px; padding: 1px 7px; border-radius: 100px; font-style: normal; font-size: 0.7rem; font-weight: 600; color: var(--c-text-2); background: color-mix(in srgb, var(--c-text-2) 10%, transparent); }
    dl.tight > div { padding: 6px 0; }
    dl.tight dt { flex-direction: row; align-items: center; gap: 8px; }
    .sw { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }

    .paper { display: flex; flex-direction: column; align-items: center; gap: 1px; align-self: center; width: min(100%, 280px); margin: 8px 0 2px; padding: 14px 16px; border-radius: 4px;
      font: 0.74rem/1.4 ui-monospace, 'Courier New', monospace; color: #1f2933; background: #fffef8; box-shadow: 0 1px 3px rgb(16 24 40 / 0.12), 0 8px 20px -12px rgb(16 24 40 / 0.3); text-align: center; }
    .paper .nm { font-size: 0.86rem; text-transform: uppercase; }
    .paper hr { align-self: stretch; margin: 6px 0; border: 0; border-top: 1px dashed #1f2933; }
    .paper p { display: flex; justify-content: space-between; align-self: stretch; margin: 0; }
    .paper .tot { font-weight: 800; }

    .cap { display: flex; flex-direction: column; gap: 10px; padding-top: 6px; }
    .cap-total { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .cap-total small { font-size: 0.76rem; color: var(--c-text-2); }
    .cap-total b { font-size: 1.2rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .bar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--c-text-2) 12%, transparent); }
    .bar i { display: block; height: 100%; }
    .src { margin: 0; font-size: 0.76rem; color: var(--c-text-2); }
    .more { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; font-size: 0.8rem; font-weight: 600; color: var(--c-primary); text-decoration: none; }
    .setup { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 8px 0; }
    .setup p { margin: 0; font-size: 0.84rem; color: var(--c-text-2); }
    .stamp { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.74rem; color: var(--c-text-2); }
    .pending { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; text-decoration: none; color: var(--c-text);
      background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-warning) 28%, transparent); }
    .pending > lsms-icon:first-child { color: var(--c-warning); }
    .pending span { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pending b { font-size: 0.86rem; font-weight: 600; }
    .pending small { font-size: 0.74rem; color: var(--c-text-2); }
  `,
})
export class BusinessSettingsPage {
  protected readonly i18n = inject(LanguageService);
  protected readonly api = inject(BusinessSettingsService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);

  protected readonly s = this.api.main.value;
  protected readonly o = this.api.opening.value;
  protected readonly error = signal('');

  protected readonly approvals = inject(SettingsApprovalsService);
  /** Edit directly (MAIN_UPDATE) or send the change for approval (WRITE only). */
  protected readonly canEdit = computed(() => this.approvals.canEditDirect() || this.approvals.canRequest());
  protected readonly myOpen = computed(() => (this.approvals.mine.value() ?? []).filter((r) => r.status === 'PENDING'));
  protected readonly othersOpen = computed(() => (this.approvals.pending.value() ?? []).filter((r) => r.status === 'PENDING' && r.requesterUid !== this.auth.user()?.uid).length);
  protected readonly canReadOpening = computed(() => this.auth.hasPermission('BUSINESS_CONFIG_READ'));
  protected readonly canCreateOpening = computed(() => this.auth.hasPermission('BUSINESS_SETUP_INITIAL'));
  protected readonly canEditOpening = computed(() => this.auth.hasPermission('BUSINESS_CONFIG_UPDATE'));

  protected readonly initials = computed(() =>
    (this.s()?.businessName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || 'B',
  );
  protected readonly creditDays = computed(() => this.s()?.defaultCreditTermDays ?? DEFAULT_CREDIT_TERM_DAYS);
  protected readonly variance = computed(() => this.s()?.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD);

  /** What a printed receipt / invoice needs; the name alone does not count as complete. */
  protected readonly completeness = computed(() => {
    const b = this.s();
    if (!b) return { pct: 0, missing: [] as string[] };
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const checks: [boolean, string][] = [
      [!!b.businessName && b.businessName !== 'My Business', t('name', 'jina')],
      [!!b.businessPhone, t('phone', 'simu')],
      [!!b.businessEmail, t('email', 'barua pepe')],
      [!!b.businessAddress, t('address', 'anwani')],
      [!!b.taxId, 'TIN'],
      [!!b.receiptFooter, t('receipt footer', 'maandishi ya risiti')],
    ];
    const done = checks.filter(([ok]) => ok).length;
    return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, l]) => l) };
  });

  protected readonly openingParts = computed(() => {
    const oc = this.o();
    if (!oc) return [];
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    const base = Math.max(oc.totalInitialCapital, 1);
    return [
      { key: 'stock', label: t('Stock', 'Stoki'), value: oc.initialStockAllocation, color: 'var(--c-info)' },
      { key: 'assets', label: t('Fixed assets', 'Mali za kudumu'), value: oc.initialFixedAssets, color: 'var(--c-warning)' },
      { key: 'cash', label: t('Cash', 'Pesa taslimu'), value: oc.initialCash, color: 'var(--c-success)' },
      { key: 'working', label: t('Working capital', 'Mtaji wa uendeshaji'), value: Math.max(0, oc.initialWorkingCapital), color: 'color-mix(in srgb, var(--c-primary) 45%, transparent)' },
    ]
      .filter((p) => p.value > 0)
      .map((p) => ({ ...p, pct: (p.value / base) * 100 }));
  });

  constructor() {
    this.load(false);
  }

  protected refresh(): void {
    this.load(true);
  }

  private load(force: boolean): void {
    this.error.set('');
    this.api.main.load(force).catch((e) => this.error.set(ApiError.from(e).message));
    if (this.canReadOpening()) void this.api.opening.load(force).catch(() => undefined);
    // Open approval requests (small lists; cached 60 s, shared with Settings Approvals).
    void this.approvals.mine.load(force).catch(() => undefined);
    void this.approvals.pending.load(force).catch(() => undefined);
  }

  protected async edit(focus?: SettingsSection): Promise<void> {
    const settings = this.s();
    if (!settings) return;
    const { SettingsFormDialog } = await import('./settings-form-dialog');
    await this.dialogs.openAsync<boolean, SettingsFormData>(SettingsFormDialog, {
      size: 'md',
      data: { settings, focus, mode: this.approvals.canRequest() ? 'request' : 'direct' },
      disableClose: true,
    });
  }

  protected async opening(): Promise<void> {
    const b = this.s();
    const { OpeningCapitalDialog } = await import('./opening-capital-dialog');
    await this.dialogs.openAsync<boolean, OpeningCapitalData>(OpeningCapitalDialog, {
      size: 'md',
      data: { existing: this.o() ?? null, businessName: b?.businessName ?? '', taxId: b?.taxId ?? null },
      disableClose: true,
    });
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected typeLabel(v: string): string {
    const t = BUSINESS_TYPES.find((x) => x.value === v);
    return t ? (this.i18n.isSwahili() ? t.sw : t.en) : v;
  }
}
