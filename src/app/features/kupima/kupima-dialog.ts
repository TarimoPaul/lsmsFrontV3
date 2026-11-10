import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, DialogShell, Icon, ToastService } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { SalesService } from '../sales/sales.service';
import { PourContainerRow, PourHistory, PourProduct, KupimaService, barFraction } from './kupima.service';

interface MeasureRow {
  ml: string;
  price: string;
}

/**
 * KUPIMA (owner ef): the drinks sold by measure - their open container (bar), "chombo kimeisha", the weekly level,
 * the settings (KUPIMA_SETTINGS only: container, ml, parent, measures {ml, price}; a price under its cost is warned),
 * the containers with what was sold and lost, and the history of every settings change.
 */
@Component({
  selector: 'app-kupima-dialog',
  imports: [DialogShell, Button, Icon, MoneyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="i18n.t('Sold by measure', 'Kupima')" icon="local_bar">
      <div class="tabs" role="tablist">
        <button type="button" [class.on]="tab() === 'list'" (click)="tab.set('list')">{{ i18n.t('Drinks', 'Vinywaji') }}</button>
        <button type="button" [class.on]="tab() === 'containers'" (click)="showContainers()">{{ i18n.t('Containers & loss', 'Vyombo na upotevu') }}</button>
        @if (canSet()) {
          <button type="button" [class.on]="tab() === 'edit'" data-test="new" (click)="edit(null)">{{ i18n.t('+ Measure settings', '+ Mipangilio') }}</button>
        }
      </div>

      @if (tab() === 'list') {
        @if (!list().length) { <p class="muted">{{ i18n.t('No drink is sold by measure yet.', 'Hakuna kinywaji kinachouzwa kwa kupima bado.') }}</p> }
        @for (p of list(); track p.productUid) {
          <div class="drink" [attr.data-product]="p.productName">
            <div class="top">
              <strong>{{ p.productName }}</strong>
              <small>{{ p.containerName }} {{ p.containerMl }}ml · {{ i18n.t('parent', 'mzazi') }}: {{ p.parentName }} ({{ p.parentStock ?? 0 }})</small>
            </div>
            <div class="bar" [title]="(p.open?.mlLeft ?? 0) + ' / ' + p.containerMl + ' ml'"><i [style.width.%]="frac(p) * 100"></i></div>
            <small class="left">@if (p.open) { {{ p.open.mlLeft }} / {{ p.open.containerMl }} ml · {{ p.open.referenceNumber }} } @else { {{ i18n.t('No open container', 'Hakuna chombo wazi') }} }</small>
            <div class="ms">
              @for (m of p.measures; track m.uid) {
                <span class="m" [class.below]="m.cost !== null && m.price < m.cost">{{ m.ml }}ml · {{ m.price | money: { decimals: 0 } }}@if (m.cost !== null) { <small>({{ i18n.t('cost', 'gharama') }} {{ m.cost | money: { decimals: 0 } }})</small> }</span>
              }
            </div>
            <div class="acts">
              @if (p.open) {
                <button lsmsButton="text" size="sm" icon="delete_sweep" data-test="finish" [loading]="busy() === p.productUid" (click)="finish(p)">{{ i18n.t('Container finished', 'Chombo kimeisha') }}</button>
                <span class="lvl">
                  @for (l of levels; track l) { <button type="button" [attr.data-level]="l" (click)="check(p, l)">{{ l }}</button> }
                </span>
              } @else {
                <button lsmsButton="secondary" size="sm" icon="liquor" data-test="open" [loading]="busy() === p.productUid" (click)="open(p)">{{ i18n.t('Open a container', 'Fungua chombo') }}</button>
              }
              @if (canSet()) {
                <button lsmsButton="text" size="sm" icon="tune" data-test="edit" (click)="edit(p)">{{ i18n.t('Settings', 'Mipangilio') }}</button>
                <button lsmsButton="text" size="sm" icon="history" (click)="showHistory(p)">{{ i18n.t('History', 'Historia') }}</button>
              }
            </div>
            @if (historyOf() === p.productUid) {
              <div class="hist">
                @for (h of history(); track $index) {
                  <small>{{ h.at | date: 'dd/MM/yy HH:mm' }} · {{ h.byName }} · <b>{{ h.field }}</b>: {{ h.oldValue ?? '—' }} → {{ h.newValue ?? '—' }}</small>
                } @empty { <small>{{ i18n.t('No changes', 'Hakuna mabadiliko') }}</small> }
              </div>
            }
          </div>
        }
      }

      @if (tab() === 'containers') {
        @for (c of containers(); track c.uid) {
          <div class="cont" [class.loss]="c.mlLost > 0">
            <div>
              <strong>{{ c.productName }} · {{ c.referenceNumber }}</strong>
              <small>{{ c.openedAt | date: 'dd/MM/yy' }} {{ c.openedBy }}@if (c.closedAt) { → {{ c.closedAt | date: 'dd/MM/yy' }} {{ c.closedBy }} ({{ c.closeKind === 'FINISHED' ? i18n.t('finished', 'kimeisha') : i18n.t('emptied', 'kimetumika chote') }}) } @else { · {{ i18n.t('open', 'wazi') }} {{ c.mlLeft }}ml }</small>
              <small>{{ i18n.t('Sold', 'Imeuzwa') }} {{ c.mlSold }}ml = {{ c.revenue | money: { decimals: 0 } }}@if (c.parentPrice) { · {{ i18n.t('whole bottle', 'chupa nzima') }} {{ c.parentPrice | money: { decimals: 0 } }} }</small>
            </div>
            @if (c.mlLost > 0) {
              <b class="lost">{{ i18n.t('Lost', 'Upotevu') }} {{ c.mlLost }}ml · {{ c.lossCost | money: { decimals: 0 } }}@if (c.smallestMl) { <small>≈ {{ lostMeasures(c) }} × {{ c.smallestMl }}ml</small> }</b>
            }
          </div>
        } @empty { <p class="muted">{{ i18n.t('No containers yet', 'Hakuna vyombo bado') }}</p> }
      }

      @if (tab() === 'edit') {
        <label><span>{{ i18n.t('Drink sold by measure', 'Kinywaji cha kupima') }}</span>
          <select data-test="product" [value]="fProduct()" (change)="fProduct.set($any($event.target).value)" [disabled]="editing() !== null">
            <option value="">—</option>
            @for (o of productOptions(); track o.uid) { <option [value]="o.uid">{{ o.name }}</option> }
          </select></label>
        <div class="two">
          <label><span>{{ i18n.t('Container', 'Chombo') }}</span><input data-test="cname" type="text" maxlength="30" [value]="fName()" (input)="fName.set($any($event.target).value)" placeholder="chupa / dumu" /></label>
          <label><span>{{ i18n.t('Volume (ml)', 'Ujazo (ml)') }}</span><input data-test="cml" type="number" min="10" [value]="fMl()" (input)="fMl.set($any($event.target).value)" /></label>
        </div>
        <label><span>{{ i18n.t('Parent (whole bottle in store)', 'Mzazi (chupa nzima kwenye store)') }}</span>
          <select data-test="parent" [value]="fParent()" (change)="fParent.set($any($event.target).value)">
            <option value="">—</option>
            @for (o of productOptions(); track o.uid) { @if (o.uid !== fProduct()) { <option [value]="o.uid">{{ o.name }}</option> } }
          </select></label>
        <span class="lbl">{{ i18n.t('Measures', 'Vipimo') }}</span>
        @for (r of fMeasures(); track $index; let i = $index) {
          <div class="mrow">
            <input type="number" min="1" [attr.data-test]="'ml-' + i" [value]="r.ml" (input)="setRow(i, 'ml', $any($event.target).value)" placeholder="ml" />
            <input type="number" min="1" [attr.data-test]="'price-' + i" [value]="r.price" (input)="setRow(i, 'price', $any($event.target).value)" [placeholder]="i18n.t('price', 'bei')" />
            <button lsmsButton="text" size="sm" icon="close" (click)="removeRow(i)" [attr.aria-label]="i18n.t('Remove', 'Ondoa')"></button>
          </div>
        }
        <button lsmsButton="text" size="sm" icon="add" data-test="add-measure" (click)="fMeasures.update((m) => [...m, { ml: '', price: '' }])">{{ i18n.t('Add a measure', 'Ongeza kipimo') }}</button>
        <p class="info"><lsms-icon name="info" [size]="16" />{{ i18n.t('Changes apply to future sales only and are kept in the history.', 'Mabadiliko yanatumika kwa mauzo yajayo tu na yanahifadhiwa kwenye historia.') }}</p>
        @if (warnings().length) { @for (w of warnings(); track $index) { <p class="warn" data-test="warning">{{ w }}</p> } }
      }

      @if (error()) { <p class="err">{{ error() }}</p> }
      <ng-container dialogActions>
        <button lsmsButton="secondary" (click)="ref.close()">{{ i18n.t('Close', 'Funga') }}</button>
        @if (tab() === 'edit') {
          <button lsmsButton="primary" data-test="save" [disabled]="!valid()" [loading]="busy() === 'save'" (click)="save()">{{ i18n.t('Save', 'Hifadhi') }}</button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .tabs button { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.8rem; color: var(--c-text); cursor: pointer; }
    .tabs button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, var(--c-surface)); }
    .muted { color: var(--c-text-2); }
    .drink, .cont { border: 1px solid var(--c-border); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
    .cont { flex-direction: row; justify-content: space-between; gap: 10px; }
    .cont > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .top { display: flex; flex-direction: column; gap: 2px; }
    small { font-size: 0.74rem; color: var(--c-text-2); }
    .bar { height: 10px; border-radius: 999px; background: var(--c-bg); border: 1px solid var(--c-border); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--c-primary); border-radius: 999px; }
    .ms { display: flex; gap: 6px; flex-wrap: wrap; }
    .m { padding: 3px 8px; border-radius: 8px; background: var(--c-bg); font-size: 0.78rem; }
    .m.below { outline: 1px solid var(--c-warning, #c77700); }
    .acts { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .lvl { display: inline-flex; gap: 4px; }
    .lvl button { padding: 3px 8px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.74rem; cursor: pointer; color: var(--c-text); }
    .hist { display: flex; flex-direction: column; gap: 2px; padding-top: 4px; border-top: 1px dashed var(--c-border); }
    .lost { color: var(--c-error); font-size: 0.8rem; text-align: right; display: flex; flex-direction: column; }
    label { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 0; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    input, select { padding: 8px 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.86rem; color: var(--c-text); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .lbl { display: block; margin: 12px 0 6px; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2); }
    .mrow { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; margin-bottom: 6px; }
    .info { display: flex; gap: 8px; margin: 12px 0 0; padding: 8px 10px; border-radius: 10px; font-size: 0.78rem; background: color-mix(in srgb, var(--c-info) 8%, transparent); }
    .warn { margin: 8px 0 0; font-size: 0.8rem; color: var(--c-warning, #b26a00); }
    .err { margin: 8px 0 0; font-size: 0.82rem; color: var(--c-error); }
    @media (max-width: 599px) { .two { grid-template-columns: 1fr; } }
  `,
})
export class KupimaDialog {
  protected readonly ref = inject(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(KupimaService);
  private readonly sales = inject(SalesService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly levels = ['1', '3/4', '1/2', '1/4', '0'];
  protected readonly tab = signal<'list' | 'containers' | 'edit'>('list');
  protected readonly list = this.api.products;
  protected readonly containers = signal<PourContainerRow[]>([]);
  protected readonly history = signal<PourHistory[]>([]);
  protected readonly historyOf = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly warnings = signal<string[]>([]);
  protected readonly canSet = computed(() => this.auth.hasPermission('KUPIMA_SETTINGS'));
  protected readonly productOptions = computed(() =>
    [...(this.sales.posStock.value() ?? [])].map((p) => ({ uid: p.uid, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly editing = signal<string | null>(null);
  protected readonly fProduct = signal('');
  protected readonly fName = signal('chupa');
  protected readonly fMl = signal('750');
  protected readonly fParent = signal('');
  protected readonly fMeasures = signal<MeasureRow[]>([{ ml: '30', price: '' }]);
  protected readonly valid = computed(
    () =>
      !!this.fProduct() &&
      !!this.fParent() &&
      this.fParent() !== this.fProduct() &&
      this.fName().trim().length > 0 &&
      Number(this.fMl()) >= 10 &&
      this.fMeasures().length > 0 &&
      this.fMeasures().every((m) => Number(m.ml) > 0 && Number(m.ml) <= Number(this.fMl()) && Number(m.price) > 0),
  );

  constructor() {
    void this.reload();
    void this.sales.posStock.load(false).catch(() => undefined);
  }

  private async reload(): Promise<void> {
    try {
      await this.api.load();
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  protected frac(p: PourProduct): number {
    return barFraction(p);
  }

  protected lostMeasures(c: PourContainerRow): string {
    return c.smallestMl ? (c.mlLost / c.smallestMl).toFixed(1).replace(/\.0$/, '') : '';
  }

  protected async open(p: PourProduct): Promise<void> {
    await this.run(p.productUid, () => this.api.open(p.productUid));
  }

  protected async finish(p: PourProduct): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Container finished?', 'Chombo kimeisha?'),
      message: this.i18n.t(
        `${p.open?.mlLeft ?? 0}ml still on the bar will be written as a loss (no charge to anybody).`,
        `${p.open?.mlLeft ?? 0}ml zilizobaki kwenye bar zitaandikwa upotevu (hakuna tozo kwa mtu).`,
      ),
      confirmText: this.i18n.t('Yes, finished', 'Ndiyo, kimeisha'),
    });
    if (ok) await this.run(p.productUid, () => this.api.finish(p.productUid, null));
  }

  protected async check(p: PourProduct, level: string): Promise<void> {
    try {
      const r = await this.api.check(p.productUid, level);
      this.toast.success(this.i18n.t(`Counted ${r.countedMl}ml, bar ${r.barMl}ml (${r.differenceMl >= 0 ? '+' : ''}${r.differenceMl}ml)`, `Imehesabiwa ${r.countedMl}ml, bar ${r.barMl}ml (${r.differenceMl >= 0 ? '+' : ''}${r.differenceMl}ml)`));
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  private async run(key: string, fn: () => Promise<unknown>): Promise<void> {
    this.busy.set(key);
    this.error.set(null);
    try {
      await fn();
      await this.api.load();
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }

  protected async showContainers(): Promise<void> {
    this.tab.set('containers');
    try {
      this.containers.set(await this.api.containers());
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  protected async showHistory(p: PourProduct): Promise<void> {
    if (this.historyOf() === p.productUid) return this.historyOf.set(null);
    try {
      this.history.set(await this.api.history(p.productUid));
      this.historyOf.set(p.productUid);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    }
  }

  protected edit(p: PourProduct | null): void {
    this.warnings.set([]);
    this.error.set(null);
    this.editing.set(p?.productUid ?? null);
    this.fProduct.set(p?.productUid ?? '');
    this.fName.set(p?.containerName ?? 'chupa');
    this.fMl.set(String(p?.containerMl ?? 750));
    this.fParent.set(p?.parentProductUid ?? '');
    this.fMeasures.set(p ? p.measures.map((m) => ({ ml: String(m.ml), price: String(m.price) })) : [{ ml: '30', price: '' }]);
    this.tab.set('edit');
  }

  protected setRow(i: number, k: keyof MeasureRow, v: string): void {
    this.fMeasures.update((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  }

  protected removeRow(i: number): void {
    this.fMeasures.update((rows) => rows.filter((_, j) => j !== i));
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.busy.set('save');
    this.error.set(null);
    try {
      const r = await this.api.configure(this.fProduct(), {
        containerName: this.fName().trim(),
        containerMl: Number(this.fMl()),
        parentProductUid: this.fParent(),
        measures: this.fMeasures().map((m) => ({ ml: Number(m.ml), price: Number(m.price) })),
      });
      this.warnings.set(r.warnings);
      this.editing.set(r.product.productUid);
      await this.api.load();
      this.toast.success(this.i18n.t('Measure settings saved', 'Mipangilio ya kupima imehifadhiwa'));
      if (!r.warnings.length) this.tab.set('list');
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(null);
    }
  }
}
