import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, Icon, Skeleton, ToastService } from '@shared/ui';
import { addDays, parseLocal, toIsoDate } from '@shared/utils/date-utils';
import { Money, MoneyPipe } from '@shared/utils/money';
import { PURCHASE_STATUS, Purchase } from '../purchases/purchases.models';
import { PurchasesService } from '../purchases/purchases.service';
import { ReconStore } from './recon.store';
import { ReconPurchase } from './reconciliation.models';
import { ReconciliationService } from './reconciliation.service';

type Mode = 'manual' | 'existing' | 'repurchase';

/**
 * Purchases tab — port of Flutter `_PurchasesTab`: purchases paid from the
 * day's cash reduce the cash expected. Link one three ways — type it in,
 * pick a purchase already recorded (last 30 days, ones linked elsewhere are
 * hidden) or order stock through Repurchase and link what was created — then
 * list / remove them.
 */
@Component({
  selector: 'app-recon-purchases-tab',
  imports: [Button, Icon, Skeleton, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="totals">
      <div style="--tc: var(--c-warning)"><small>{{ i18n.t('Paid from today’s cash', 'Yamelipwa kwa taslimu ya leo') }}</small><b>{{ store.current()?.purchasesTotal ?? 0 | money }}</b></div>
      <div style="--tc: var(--c-text-2)"><small>{{ i18n.t('Purchases linked', 'Manunuzi yaliyounganishwa') }}</small><b>{{ store.current()?.purchases?.length ?? 0 }}</b></div>
    </div>

    @if (canEdit()) {
      <section class="add">
        <h4><lsms-icon name="add_link" [size]="16" />{{ i18n.t('Link a purchase paid with today’s cash', 'Unganisha manunuzi yaliyolipwa kwa taslimu ya leo') }}</h4>
        <div class="chips">
          <button type="button" [class.on]="mode() === 'manual'" (click)="setMode('manual')"><lsms-icon name="edit_note" [size]="14" />{{ i18n.t('Type it in', 'Andika mwenyewe') }}</button>
          <button type="button" [class.on]="mode() === 'existing'" (click)="setMode('existing')"><lsms-icon name="search" [size]="14" />{{ i18n.t('Pick a recorded purchase', 'Chagua manunuzi yaliyopo') }}</button>
          @if (canRepurchase()) {
            <button type="button" [class.on]="mode() === 'repurchase'" (click)="setMode('repurchase')"><lsms-icon name="replay" [size]="14" />{{ i18n.t('Buy stock (Repurchase)', 'Nunua mzigo (Repurchase)') }}</button>
          }
        </div>

        @switch (mode()) {
          @case ('manual') {
            <div class="grid">
              <label>
                <span>{{ i18n.t('Supplier', 'Msambazaji') }}</span>
                <input type="text" maxlength="100" [value]="supplier()" (input)="supplier.set($any($event.target).value)" />
              </label>
              <label>
                <span>{{ i18n.t('Amount', 'Kiasi') }} *</span>
                <input type="text" inputmode="numeric" [value]="amountText()" (input)="amountText.set($any($event.target).value)" placeholder="0" />
              </label>
              <label>
                <span>{{ i18n.t('What was bought', 'Kilichonunuliwa') }}</span>
                <input type="text" maxlength="200" [value]="desc()" (input)="desc.set($any($event.target).value)" />
              </label>
              <label>
                <span>{{ i18n.t('Invoice / receipt no.', 'Namba ya ankara / risiti') }}</span>
                <input type="text" maxlength="60" [value]="invoice()" (input)="invoice.set($any($event.target).value)" />
              </label>
            </div>
            <div class="actions">
              <button lsmsButton size="sm" icon="link" [loading]="store.saving()" [disabled]="!(amount() > 0)" (click)="addManual()">{{ i18n.t('Link', 'Unganisha') }}</button>
            </div>
          }
          @case ('existing') {
            <div class="grid">
              <label class="wide">
                <span>{{ i18n.t('Search product or supplier', 'Tafuta bidhaa au msambazaji') }}</span>
                <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" [placeholder]="i18n.t('Purchases of the last 30 days…', 'Manunuzi ya siku 30 zilizopita…')" />
              </label>
            </div>
            @if (loadingExisting()) {
              <lsms-skeleton variant="list" [rows]="3" />
            } @else if (!candidates().length) {
              <p class="empty">{{ i18n.t('No unlinked purchases found.', 'Hakuna manunuzi yasiyounganishwa.') }}</p>
            } @else {
              <ul class="items pick">
                @for (p of candidates().slice(0, 30); track p.uid) {
                  <li [class.on]="picked()?.uid === p.uid" (click)="picked.set(p)">
                    <span class="ic"><lsms-icon [name]="picked()?.uid === p.uid ? 'radio_button_checked' : 'radio_button_unchecked'" [size]="18" /></span>
                    <span class="t">
                      <b>{{ p.productName }}</b>
                      <small>{{ p.supplierName || '—' }} · {{ day(p.purchaseDate) | date: 'dd MMM, HH:mm' }} · {{ statusText(p) }}</small>
                    </span>
                    <b class="amt">{{ p.totalCost | money }}</b>
                  </li>
                }
              </ul>
              <div class="actions">
                <button lsmsButton size="sm" icon="link" [loading]="store.saving()" [disabled]="!picked()" (click)="addExisting()">{{ i18n.t('Link selected', 'Unganisha uliyochagua') }}</button>
              </div>
            }
          }
          @case ('repurchase') {
            <p class="note">
              <lsms-icon name="info" [size]="16" />
              <span>{{ i18n.t('Order the stock in Repurchase. When the order is sent you can link those purchases to this day’s cash in one step.', 'Agiza mzigo kwenye Repurchase. Ukituma agizo, utaweza kuunganisha manunuzi hayo na taslimu ya siku hii kwa hatua moja.') }}</span>
            </p>
            <div class="actions">
              <button lsmsButton size="sm" icon="open_in_new" (click)="openRepurchase()">{{ i18n.t('Open Repurchase', 'Fungua Repurchase') }}</button>
            </div>
          }
        }
      </section>
    } @else if (store.current() && !store.current()!.editable) {
      <p class="locked"><lsms-icon name="lock" [size]="15" />{{ i18n.t('This reconciliation is locked — reopen it to change entries.', 'Upatanisho huu umefungwa — ufungue tena kubadilisha.') }}</p>
    }

    @if (store.current()?.purchases?.length) {
      <ul class="items">
        @for (p of store.current()!.purchases; track p.uid) {
          <li>
            <span class="ic"><lsms-icon [name]="p.purchaseUid ? 'link' : 'shopping_cart'" [size]="17" /></span>
            <span class="t">
              <b>{{ p.supplier || p.description || '—' }}</b>
              <small>{{ [p.supplier ? p.description : null, p.invoice].filter(truthy).join(' · ') || '—' }}</small>
            </span>
            @if (p.purchaseUid) {
              <span class="tag" style="--tc: var(--c-info)">{{ i18n.t('LINKED', 'IMEUNGANISHWA') }}</span>
            }
            @if (p.verified) {
              <span class="ok" [title]="i18n.t('Verified by ', 'Imethibitishwa na ') + (p.verifiedByName || '—')"><lsms-icon name="verified" [size]="16" [filled]="true" /></span>
            }
            <b class="amt">{{ p.amount | money }}</b>
            @if (canEdit()) {
              <button type="button" class="rm" (click)="remove(p)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')"><lsms-icon name="delete" [size]="17" /></button>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="empty">{{ i18n.t('No purchases paid from this day’s cash.', 'Hakuna manunuzi yaliyolipwa kwa taslimu ya siku hii.') }}</p>
    }
  `,
  styleUrl: './recon-tab.scss',
  styles: `
    .pick li { cursor: pointer; }
    .pick li.on { background: color-mix(in srgb, var(--c-primary) 8%, var(--c-surface)); }
    .note { display: flex; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.84rem; color: var(--c-text-2); background: var(--c-bg); }
    .note lsms-icon { flex-shrink: 0; color: var(--c-info); }
  `,
})
export class ReconPurchasesTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(ReconStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReconciliationService);
  private readonly purchasesApi = inject(PurchasesService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly truthy = (v: unknown) => !!v;
  protected readonly mode = signal<Mode>('manual');
  protected readonly supplier = signal('');
  protected readonly amountText = signal('');
  protected readonly desc = signal('');
  protected readonly invoice = signal('');
  protected readonly query = signal('');
  protected readonly picked = signal<Purchase | null>(null);
  protected readonly existing = signal<Purchase[]>([]);
  private readonly linked = signal<Set<string>>(new Set());
  protected readonly loadingExisting = signal(false);

  protected readonly canEdit = computed(() => {
    const r = this.store.current();
    return this.store.canEdit() && (!r || r.editable);
  });
  protected readonly canRepurchase = computed(() => this.auth.hasPermission('PURCHASE_WRITE'));
  protected readonly amount = computed(() => Number(this.amountText().replace(/[^\d.]/g, '')) || 0);
  protected readonly candidates = computed(() => {
    const q = this.query().trim().toLowerCase();
    const mine = new Set((this.store.current()?.purchases ?? []).map((p) => p.purchaseUid).filter(Boolean));
    return this.existing().filter(
      (p) => p.status !== 'CANCELLED' && !this.linked().has(p.uid) && !mine.has(p.uid) && (!q || p.productName.toLowerCase().includes(q) || (p.supplierName ?? '').toLowerCase().includes(q)),
    );
  });

  protected setMode(m: Mode): void {
    this.mode.set(m);
    if (m === 'existing' && !this.existing().length) void this.loadExisting();
  }

  /** Purchases of the 30 days up to the reconciliation day; hides ones already linked to any reconciliation. */
  private async loadExisting(): Promise<void> {
    this.loadingExisting.set(true);
    try {
      const day = parseLocal(this.store.date()) ?? new Date();
      const list = await this.purchasesApi.byDateRange(`${toIsoDate(addDays(day, -30))}T00:00:00`, `${toIsoDate(day)}T23:59:59`);
      this.existing.set(list);
      this.linked.set(await this.api.purchaseLinkStatus(list.map((p) => p.uid)));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.loadingExisting.set(false);
    }
  }

  protected day(v: string | null): Date | null {
    return parseLocal(v);
  }

  protected statusText(p: Purchase): string {
    const s = PURCHASE_STATUS[p.status];
    return this.i18n.isSwahili() ? s.sw : s.en;
  }

  protected async addManual(): Promise<void> {
    const amount = this.amount();
    if (!(amount > 0)) return;
    const res = await this.store.act(
      (uid) => this.api.addPurchase(uid, { supplierName: this.supplier().trim() || null, description: this.desc().trim() || null, amount, invoiceReference: this.invoice().trim() || null }),
      this.i18n.t(`${Money.format(amount)} linked`, `${Money.format(amount)} imeunganishwa`),
    );
    if (res.error) return void this.toast.error(res.error);
    this.supplier.set('');
    this.amountText.set('');
    this.desc.set('');
    this.invoice.set('');
  }

  protected async addExisting(): Promise<void> {
    const p = this.picked();
    if (!p) return;
    const res = await this.store.act(
      (uid) => this.api.addPurchase(uid, { supplierName: p.supplierName, description: p.productName, amount: p.totalCost, purchaseUid: p.uid }),
      this.i18n.t(`${p.productName} linked`, `${p.productName} imeunganishwa`),
    );
    if (res.error) return void this.toast.error(res.error);
    this.picked.set(null);
    this.linked.update((s) => new Set(s).add(p.uid));
  }

  protected async remove(p: ReconPurchase): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Remove this purchase?', 'Ondoa manunuzi haya?'),
      message: `${p.supplier || p.description || '—'} · ${Money.format(p.amount)}`,
    });
    if (!ok) return;
    const res = await this.store.act((uid) => this.api.removePurchase(uid, p.uid), this.i18n.t('Removed', 'Imeondolewa'));
    if (res.error) this.toast.error(res.error);
    else if (p.purchaseUid) this.linked.update((s) => new Set([...s].filter((x) => x !== p.purchaseUid)));
  }

  /** Repurchase links what it created back to this reconciliation (see RepurchasePage `recon` query param). */
  protected async openRepurchase(): Promise<void> {
    let uid = this.store.current()?.uid;
    if (!uid) uid = (await this.store.startMine())?.uid;
    if (!uid) return;
    void this.router.navigate(['/purchases/repurchase'], { queryParams: { recon: uid, reconDate: this.store.date() } });
  }
}
