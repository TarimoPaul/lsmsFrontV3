import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, MetricCard, MetricsGrid, SegmentOption, SegmentedFilterBar, Skeleton, Spinner, ToastService } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import type { Expenditure } from '../../capital/capital.models';
import { ReasonDialog, ReasonDialogData } from '../../reconciliation/reason-dialog';
import { QtyInput } from '../qty-input';
import { ASSET_STATUS, AssetItem, assetIsPending } from './asset.models';
import { AssetService } from './asset.service';

type Filter = 'all' | 'pending' | 'new' | 'confirmed';
const key = (i: AssetItem) => i.uid ?? 'cap:' + i.capitalExpenditureUid;

/**
 * The asset register. Rows = what is already registered + Capital fixed assets
 * waiting for their first quantity. ASSET_COUNT_MANAGE types the quantity on
 * the row (a proposal); the CEO (ASSET_COUNT_APPROVE) confirms or rejects it.
 * A changed quantity on a confirmed asset is a new proposal — the confirmed one
 * stays official until the CEO agrees.
 *
 * An asset added here that is not in Capital asks once whether it should be:
 * "yes" opens Capital's own new-asset form with the name filled in.
 */
@Component({
  selector: 'app-asset-register',
  imports: [QtyInput, Button, Icon, EmptyState, Skeleton, Spinner, MetricCard, MetricsGrid, SegmentedFilterBar, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !rows().length) {
      <lsms-skeleton variant="list" [rows]="6" />
    } @else if (error() && !rows().length) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="load()" />
    } @else {
      <lsms-metrics-grid [gap]="12">
        <lsms-metric-card [title]="i18n.t('Confirmed by the CEO', 'Zimethibitishwa na CEO')" [value]="'' + stats().confirmed" icon="verified" color="var(--c-success)" [subtitle]="i18n.t(stats().units + ' unit(s) in total', 'Jumla vitu ' + stats().units)" />
        <lsms-metric-card [title]="i18n.t('Awaiting the CEO', 'Zinasubiri CEO')" [value]="'' + stats().pending" icon="hourglass_top" color="var(--c-warning)" />
        <lsms-metric-card [title]="i18n.t('Quantity not filled', 'Hazijajazwa idadi')" [value]="'' + stats().fresh" icon="edit_note" color="var(--c-info)" [subtitle]="i18n.t('Capital assets', 'Mali za Capital')" />
      </lsms-metrics-grid>

      <div class="bar">
        <input class="search" type="search" [value]="query()" (input)="query.set($any($event.target).value)" [placeholder]="i18n.t('Search asset…', 'Tafuta mali…')" [attr.aria-label]="i18n.t('Search asset', 'Tafuta mali')" />
        @if (canApprove() && stats().pending) {
          <button lsmsButton="success" icon="done_all" [loading]="busy() === 'all'" [disabled]="!!busy()" (click)="approveAll()">{{ i18n.t('Confirm all', 'Thibitisha zote') }} ({{ stats().pending }})</button>
        }
        @if (canManage()) {
          <button lsmsButton="primary" icon="add" (click)="add()">{{ i18n.t('Add asset', 'Ongeza mali') }}</button>
        }
      </div>
      <lsms-segmented-filter-bar [options]="filters()" [selected]="filter()" (selectedChange)="filter.set($event)" />

      @if (!shown().length) {
        <lsms-empty-state icon="chair" [title]="i18n.t('No assets here', 'Hakuna mali hapa')" [message]="rows().length ? i18n.t('Nothing matches this filter.', 'Hakuna kinacholingana na kichujio hiki.') : i18n.t('Add the shop assets and how many there are — the CEO then confirms them.', 'Ongeza mali za duka na idadi yake — kisha CEO anathibitisha.')" />
      } @else {
        <div class="list">
          @for (r of shown(); track id(r)) {
            @let st = status(r);
            <div class="row" [class.off]="r.status === 'RETIRED'">
              <div class="what">
                <b>{{ r.name }}</b>
                <small>
                  @if (r.location) { <span>{{ r.location }}</span> }
                  @if (r.capitalExpenditureUid) {
                    <span class="chip cap" [class.gone]="r.capitalStatus === 'DISPOSED'"><lsms-icon name="account_balance" [size]="12" />Capital@if (r.capitalCost !== null) { · {{ r.capitalCost | money: { decimals: 0 } }} }@if (r.capitalStatus === 'DISPOSED') { · {{ i18n.t('disposed', 'imeondolewa') }} }</span>
                  } @else if (r.uid && r.status !== 'RETIRED') {
                    <span class="chip">{{ i18n.t('Not in Capital', 'Haipo Capital') }}</span>
                  }
                </small>
                @if (r.rejectReason) { <small class="why"><lsms-icon name="block" [size]="13" />{{ i18n.t('CEO', 'CEO') }}: {{ r.rejectReason }}</small> }
                @if (r.status === 'RETIRED' && r.notes) { <small class="why muted">{{ r.notes }}</small> }
              </div>

              <div class="qty">
                <span class="official">
                  <small>{{ i18n.t('Confirmed', 'Iliyothibitishwa') }}</small>
                  <b>{{ r.approvedQty ?? '—' }}</b>
                </span>
                @if (r.status !== 'RETIRED') {
                  @if (canManage()) {
                    <span class="edit">
                      <small>{{ r.approvedQty === null ? i18n.t('Quantity', 'Idadi') : i18n.t('New quantity', 'Idadi mpya') }}</small>
                      <app-qty-input [value]="r.proposedQty ?? r.approvedQty" [tone]="r.proposedQty !== null ? 'changed' : ''" [disabled]="saving().has(id(r))" (commit)="setQty(r, $event)" />
                    </span>
                  } @else if (r.proposedQty !== null) {
                    <span class="official prop"><small>{{ i18n.t('Proposed', 'Inayopendekezwa') }}</small><b>{{ r.proposedQty }}</b></span>
                  }
                }
              </div>

              <span class="pill" [style.--pc]="st.color">
                @if (saving().has(id(r))) { <lsms-spinner [size]="12" /> } @else { <lsms-icon [name]="st.icon" [size]="13" /> }
                {{ i18n.isSwahili() ? st.sw : st.en }}
              </span>

              <div class="acts">
                @if (canApprove() && r.uid && r.proposedQty !== null && r.status !== 'RETIRED') {
                  <button lsmsButton="success" size="sm" icon="check" [loading]="busy() === r.uid" [disabled]="!!busy()" (click)="approve(r)">{{ i18n.t('Confirm', 'Thibitisha') }}</button>
                  @if (r.status !== 'REJECTED') {
                    <button lsmsButton="text" size="sm" icon="close" [disabled]="!!busy()" (click)="reject(r)">{{ i18n.t('Reject', 'Kataa') }}</button>
                  }
                }
                @if (r.uid && r.status !== 'RETIRED') {
                  @if (canManage()) {
                    <button class="ib" type="button" (click)="edit(r)" [title]="i18n.t('Edit', 'Hariri')" [attr.aria-label]="i18n.t('Edit', 'Hariri') + ' ' + r.name"><lsms-icon name="edit" [size]="17" /></button>
                    @if (!r.capitalExpenditureUid && canCapital()) {
                      <button class="ib" type="button" (click)="addToCapital(r)" [title]="i18n.t('Add to Capital', 'Ongeza kwenye Capital')" [attr.aria-label]="i18n.t('Add to Capital', 'Ongeza kwenye Capital') + ' ' + r.name"><lsms-icon name="account_balance" [size]="17" /></button>
                    }
                    @if (r.approvedQty === null) {
                      <button class="ib bad" type="button" (click)="remove(r)" [title]="i18n.t('Delete', 'Futa')" [attr.aria-label]="i18n.t('Delete', 'Futa') + ' ' + r.name"><lsms-icon name="delete" [size]="17" /></button>
                    }
                  }
                  @if (canApprove() && r.approvedQty !== null) {
                    <button class="ib bad" type="button" (click)="retire(r)" [title]="i18n.t('Remove from the list', 'Ondoa kwenye orodha')" [attr.aria-label]="i18n.t('Remove from the list', 'Ondoa kwenye orodha') + ' ' + r.name"><lsms-icon name="delete_sweep" [size]="17" /></button>
                  }
                }
              </div>
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .search { flex: 1 1 220px; height: 40px; padding: 0 12px; border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: 0; }
    .search:focus { border-color: var(--c-primary); }
    .list { border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto 150px auto; align-items: center; gap: 12px 16px; padding: 12px 14px; border-bottom: 1px solid var(--c-border); }
    .row:last-child { border-bottom: 0; }
    .row.off { opacity: 0.6; }
    .what { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .what b { font-size: 0.9rem; font-weight: 600; color: var(--c-text); overflow-wrap: anywhere; }
    .what small { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.74rem; color: var(--c-text-2); }
    .chip { display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; border-radius: 100px; font-size: 0.68rem; font-weight: 600; color: var(--c-text-2); background: color-mix(in srgb, var(--c-text-2) 12%, transparent); }
    .chip.cap { color: var(--c-secondary); background: color-mix(in srgb, var(--c-secondary) 11%, transparent); }
    .chip.gone { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 10%, transparent); }
    .why { color: var(--c-error) !important; }
    .why.muted { color: var(--c-text-2) !important; }
    .qty { display: flex; align-items: flex-end; gap: 14px; }
    .qty span { display: flex; flex-direction: column; gap: 3px; }
    .qty small { font-size: 0.68rem; color: var(--c-text-2); }
    .official { min-width: 74px; }
    .official b { height: 40px; display: inline-flex; align-items: center; font-size: 1.05rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .official.prop b { color: var(--c-warning); }
    .pill { justify-self: start; display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, transparent); }
    .acts { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; min-width: 76px; }
    .ib { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: var(--c-text-2); cursor: pointer; }
    .ib:hover { color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 9%, transparent); }
    .ib.bad:hover { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 9%, transparent); }
    @media (max-width: 900px) {
      .row { grid-template-columns: minmax(0, 1fr) auto; }
      .qty { grid-column: 1 / -1; grid-row: 2; }
      .pill { grid-column: 2; grid-row: 1; justify-self: end; }
      .acts { grid-column: 1 / -1; justify-content: flex-start; flex-wrap: wrap; }
    }
  `,
})
export class AssetRegister {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  /** Something the status strip counts has changed. */
  readonly changed = output<void>();

  protected readonly rows = signal<AssetItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  /** Row uid being confirmed / rejected, or 'all'. */
  protected readonly busy = signal<string | null>(null);

  protected readonly canManage = computed(() => this.auth.hasPermission('ASSET_COUNT_MANAGE'));
  protected readonly canApprove = computed(() => this.auth.hasPermission('ASSET_COUNT_APPROVE'));
  protected readonly canCapital = computed(() => this.auth.hasPermission('CAPITAL_WRITE') || this.auth.hasPermission('CAPITAL_ASSET_WRITE'));

  protected readonly stats = computed(() => {
    const live = this.rows().filter((r) => r.status !== 'RETIRED');
    const confirmed = live.filter((r) => r.approvedQty !== null);
    return {
      confirmed: confirmed.length,
      units: confirmed.reduce((s, r) => s + (r.approvedQty ?? 0), 0),
      pending: live.filter(assetIsPending).length,
      fresh: live.filter((r) => r.status === 'NEW').length,
    };
  });

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const s = this.stats();
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { value: 'all', label: t('All', 'Zote'), count: this.rows().length },
      { value: 'pending', label: t('Awaiting the CEO', 'Zinasubiri CEO'), count: s.pending || undefined },
      { value: 'new', label: t('Not filled', 'Hazijajazwa'), count: s.fresh || undefined },
      { value: 'confirmed', label: t('Confirmed', 'Zimethibitishwa'), count: s.confirmed || undefined },
    ];
  });

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.rows().filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.location ?? '').toLowerCase().includes(q)) return false;
      if (f === 'pending') return assetIsPending(r);
      if (f === 'new') return r.status === 'NEW';
      if (f === 'confirmed') return r.approvedQty !== null && r.status !== 'RETIRED';
      return true;
    });
  });

  protected readonly id = key;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.api.register());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** A confirmed asset with a pending change reads "awaiting", not "confirmed". */
  protected status(r: AssetItem) {
    return ASSET_STATUS[r.status === 'APPROVED' && r.proposedQty !== null ? 'PENDING' : r.status] ?? ASSET_STATUS.PENDING;
  }

  /** Typing a quantity on the row: registers a Capital asset, or proposes a change. */
  protected async setQty(r: AssetItem, qty: number | null): Promise<void> {
    if (qty == null || qty === (r.proposedQty ?? r.approvedQty)) return;
    const k = key(r);
    if (this.saving().has(k)) return;
    this.saving.update((x) => new Set(x).add(k));
    try {
      const saved = r.uid
        ? await this.api.update(r.uid, { qty })
        : await this.api.create({ name: r.name, qty, capitalExpenditureUid: r.capitalExpenditureUid ?? undefined });
      this.replace(k, saved);
      this.changed.emit();
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not save', 'Imeshindwa kuhifadhi'));
      // Put the field back to what the server has.
      this.rows.update((list) => list.map((x) => (key(x) === k ? { ...x } : x)));
    } finally {
      this.saving.update((x) => {
        const n = new Set(x);
        n.delete(k);
        return n;
      });
    }
  }

  protected async add(): Promise<void> {
    const { AssetItemDialog } = await import('./asset-dialogs');
    const created = await this.dialogs.openAsync<AssetItem, AssetItem | null>(AssetItemDialog, { size: 'sm', data: null, disableClose: true });
    if (!created) return;
    this.rows.update((list) => [created, ...list]);
    this.changed.emit();
    this.toast.success(this.i18n.t('Asset saved — waiting for the CEO', 'Mali imehifadhiwa — inasubiri CEO'));
    if (!created.capitalExpenditureUid) await this.askCapital(created);
  }

  protected async edit(r: AssetItem): Promise<void> {
    const { AssetItemDialog } = await import('./asset-dialogs');
    const saved = await this.dialogs.openAsync<AssetItem, AssetItem | null>(AssetItemDialog, { size: 'sm', data: r });
    if (saved) this.replace(key(r), saved);
  }

  /** Asked once, right after adding an asset that Capital does not know. */
  private async askCapital(r: AssetItem): Promise<void> {
    if (!this.canCapital() || !r.uid) return;
    const yes = await this.dialogs.confirm({
      title: this.i18n.t('Add to Capital too?', 'Iongezwe kwenye Capital pia?'),
      message: this.i18n.t(
        `"${r.name}" is not among the fixed assets in Capital. Should it be added there (cost, depreciation, balance sheet)?`,
        `"${r.name}" haipo kwenye mali za kudumu za Capital. Iongezwe huko (gharama, uchakavu, mizania)?`,
      ),
      confirmText: this.i18n.t('Yes, add to Capital', 'Ndiyo, ongeza Capital'),
      cancelText: this.i18n.t('No, counting only', 'Hapana, kuhesabu tu'),
    });
    if (yes) await this.addToCapital(r);
    else await this.api.update(r.uid, { capitalDecision: 'DECLINED' }).then((s) => this.replace(key(r), s), () => undefined);
  }

  /** Opens Capital's own new-asset form with the name filled in, then links the two. */
  protected async addToCapital(r: AssetItem): Promise<void> {
    if (!r.uid) return;
    const { AssetDialog } = await import('../../capital/capital-dialogs');
    const created = await this.dialogs.openAsync<Expenditure, { description: string }>(AssetDialog, { size: 'md', disableClose: true, data: { description: r.name } });
    if (!created) return;
    try {
      this.replace(key(r), await this.api.update(r.uid, { capitalExpenditureUid: created.uid }));
      this.toast.success(this.i18n.t('Added to Capital — waiting for approval there', 'Imeongezwa Capital — inasubiri idhini huko'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async approve(r: AssetItem): Promise<void> {
    if (!r.uid) return;
    await this.confirmItems([r.uid], r.uid);
  }

  protected async approveAll(): Promise<void> {
    const pending = this.rows().filter((r) => r.uid && assetIsPending(r));
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Confirm quantities', 'Thibitisha idadi'),
      message: this.i18n.t(
        `Confirm ${pending.length} asset(s)? These quantities become the official ones every verification is checked against.`,
        `Thibitisha mali ${pending.length}? Idadi hizi zinakuwa rasmi — kila uhakiki utalinganishwa nazo.`,
      ),
      confirmText: this.i18n.t('Confirm all', 'Thibitisha zote'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (ok) await this.confirmItems(pending.map((r) => r.uid!), 'all');
  }

  private async confirmItems(uids: string[], busy: string): Promise<void> {
    this.busy.set(busy);
    try {
      this.rows.set(await this.api.approveItems(uids));
      this.changed.emit();
      this.toast.success(this.i18n.t('Quantity confirmed', 'Idadi imethibitishwa'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }

  protected async reject(r: AssetItem): Promise<void> {
    const reason = await this.reason({
      title: this.i18n.t('Reject quantity', 'Kataa idadi'),
      message: `${r.name} · ${this.i18n.t('proposed', 'inayopendekezwa')} ${r.proposedQty}`,
      label: this.i18n.t('Why?', 'Kwa nini?'),
      confirm: this.i18n.t('Reject', 'Kataa'),
      danger: true,
    });
    if (!reason || !r.uid) return;
    await this.act(r, () => this.api.rejectItem(r.uid!, reason));
  }

  protected async retire(r: AssetItem): Promise<void> {
    const reason = await this.reason({
      title: this.i18n.t('Remove from the asset list', 'Ondoa kwenye orodha ya mali'),
      message: this.i18n.t(`"${r.name}" will no longer be verified. Its history stays.`, `"${r.name}" haitahakikiwa tena. Historia yake inabaki.`),
      label: this.i18n.t('Reason (sold, scrapped …)', 'Sababu (imeuzwa, imetupwa …)'),
      confirm: this.i18n.t('Remove', 'Ondoa'),
      danger: true,
    });
    if (!reason || !r.uid) return;
    await this.act(r, () => this.api.retireItem(r.uid!, reason));
  }

  protected async remove(r: AssetItem): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Delete asset', 'Futa mali'),
      message: this.i18n.t(`Delete "${r.name}" from the list?`, `Futa "${r.name}" kwenye orodha?`),
      confirmText: this.i18n.t('Delete', 'Futa'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok || !r.uid) return;
    try {
      await this.api.remove(r.uid);
      // A registered Capital asset goes back to "not filled" → reload the merged list.
      await this.load();
      this.changed.emit();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  private async act(r: AssetItem, call: () => Promise<AssetItem>): Promise<void> {
    this.busy.set(r.uid);
    try {
      this.replace(key(r), await call());
      this.changed.emit();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }

  private reason(data: ReasonDialogData): Promise<string | undefined> {
    return this.dialogs.openAsync<string, ReasonDialogData>(ReasonDialog, { size: 'sm', data });
  }

  private replace(k: string, saved: AssetItem): void {
    this.rows.update((list) => list.map((x) => (key(x) === k ? saved : x)));
  }
}
