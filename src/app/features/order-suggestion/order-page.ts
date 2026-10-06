import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, PageHeader, SegmentOption, SegmentedFilterBar, Skeleton, ToastService } from '@shared/ui';
import { addDays, parseLocal, toIsoDate } from '@shared/utils/date-utils';
import { printReport } from '@shared/utils/export';
import { Money } from '@shared/utils/money';
import { packSize, packUnit, productDetail } from '@shared/utils/product-label';
import { ORDER_EDIT, OrderLine, OrderSuggestion, PACK_WORDS } from './order.models';
import { OrderService } from './order.service';

type View = 'today' | 'history';
const HISTORY_DAYS = 14;

/**
 * "Pendekezo la oda" — the order of the day for the main (class A) products.
 *
 * The backend makes it at 00:00 and recomputes it by itself after yesterday's late
 * sales, the morning count and the reconciliation; this page shows where it stands,
 * lets the buyer set the packages (an edited line is never recomputed — the system's answer
 * shows beside it as "mfumo sasa"), share the list, and close it with "Imenunuliwa".
 * History keeps the four versions of every product: night / system / buyer / bought.
 */
@Component({
  selector: 'app-order-page',
  imports: [PageHeader, SegmentedFilterBar, Button, Icon, Skeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-page-header
        [title]="i18n.t('Order suggestion', 'Pendekezo la oda')"
        [subtitle]="i18n.t('What to buy today for the main products — worked out from sales, stock and yesterday\\'s cash', 'Cha kununua leo kwa bidhaa kuu — kutoka mauzo, stoki na pesa ya jana')"
        icon="fact_check"
        [refreshable]="true"
        (refresh)="reload()"
      >
        @if (view() === 'today' && order(); as o) {
          @if (o.lines.length) {
            <button lsmsButton="secondary" size="sm" icon="share" (click)="share(o)">{{ i18n.t('Share', 'Shiriki') }}</button>
            <button lsmsButton="secondary" size="sm" icon="print" (click)="print(o)">{{ i18n.t('Print', 'Chapisha') }}</button>
          }
          @if (canEdit() && o.status !== 'PURCHASED') {
            <button lsmsButton="secondary" size="sm" icon="refresh" [loading]="busy() === 'recalc'" (click)="recalculate()">{{ i18n.t('Recalculate', 'Hesabu upya') }}</button>
            @if (o.lines.length) {
              <button lsmsButton size="sm" icon="task_alt" [loading]="busy() === 'purchased'" (click)="purchased(o)">{{ i18n.t('Purchased', 'Imenunuliwa') }}</button>
            }
          }
        }
      </lsms-page-header>

      <lsms-segmented-filter-bar [options]="views()" [selected]="view()" (selectedChange)="setView($event)" />

      @if (view() === 'today') {
        @if (error()) {
          <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load the order', 'Oda haikupatikana')" [message]="error()" />
        } @else if (loading()) {
          <lsms-skeleton variant="list" [rows]="8" />
        } @else if (!order() || (!order()!.lines.length && !order()!.lastError)) {
          <lsms-empty-state icon="hourglass_empty" [title]="i18n.t('No order for today yet', 'Oda ya leo bado haijatengenezwa')"
            [message]="i18n.t('It is made at 00:00 every night. You can also work it out now.', 'Hutengenezwa saa 00:00 kila usiku. Unaweza pia kuihesabu sasa.')" />
          @if (canEdit()) {
            <div class="center"><button lsmsButton icon="calculate" [loading]="busy() === 'recalc'" (click)="recalculate()">{{ i18n.t('Work it out now', 'Hesabu sasa') }}</button></div>
          }
        } @else {
          @let o = order()!;

          @if (o.lastError) {
            <div class="banner err" role="alert">
              <lsms-icon name="error" [size]="20" />
              <div><b>{{ i18n.t('The order was not updated', 'Oda haikusasishwa') }}</b>
                <small>{{ i18n.t('What you see is the last good version', 'Unachokiona ni toleo la mwisho lililofanikiwa') }}@if (o.lastErrorAt) { · {{ time(o.lastErrorAt) }} }. {{ i18n.t('Sales, counting and reconciliation are not affected.', 'Mauzo, counting na recon hazijaathirika.') }}</small></div>
              @if (canEdit()) { <button lsmsButton="secondary" size="sm" icon="refresh" [loading]="busy() === 'recalc'" (click)="recalculate()">{{ i18n.t('Recalculate', 'Hesabu upya') }}</button> }
            </div>
          }

          <ul class="flow" [attr.aria-label]="i18n.t('Where the order stands', 'Hali ya oda')">
            @for (s of steps(); track s.key) {
              <li [class.on]="s.on" [class.warn]="s.warn" [class.done]="s.key === 'purchased' && s.on">
                <lsms-icon [name]="s.icon" [size]="16" /><span>{{ s.label }}</span>
              </li>
            }
          </ul>
          @if (notice(); as n) {
            <p class="xcheck bad"><lsms-icon name="info" [size]="17" />{{ n }}</p>
          }

          <div class="top">
            <section class="card total">
              <header><lsms-icon name="shopping_cart" [size]="18" /><span>{{ o.status === 'PURCHASED' ? i18n.t('Bought', 'Kilichonunuliwa') : i18n.t('Order now', 'Oda sasa') }}</span></header>
              <b>{{ m(o.status === 'PURCHASED' ? (o.totals.purchasedCost ?? 0) : o.totals.orderCost) }}</b>
              <p>{{ shownPacks() }} {{ w('packs') }} · {{ shownProducts() }} {{ i18n.t('products', 'bidhaa') }}@if (o.totals.editedLines) { · {{ o.totals.editedLines }} {{ i18n.t('edited by you', 'zimehaririwa') }} }</p>
              @if (o.totals.cutCost > 0) {
                <p class="cut"><lsms-icon name="content_cut" [size]="14" />{{ i18n.t('The budget cut', 'Bajeti imekata') }} {{ m(o.totals.cutCost) }} {{ i18n.t('of the', 'kati ya') }} {{ m(o.totals.wantedCost) }} {{ i18n.t('the formula wanted', 'zilizotakiwa na formula') }}</p>
              }
              @if (over() > 0) {
                <p class="over"><lsms-icon name="warning" [size]="14" />{{ i18n.t('Above the limit by', 'Imezidi kikomo kwa') }} {{ m(over()) }}</p>
              }
            </section>

            <section class="card budget">
              <header>
                <lsms-icon name="account_balance_wallet" [size]="18" /><span>{{ i18n.t('Budget for today', 'Bajeti ya leo') }}</span>
                <em class="src" [class.est]="o.budget.source === 'ESTIMATE'" [class.ok]="o.budget.source === 'RECON_APPROVED'">{{ budgetLabel() }}</em>
              </header>
              <table>
                <tbody>
                  <tr><td>{{ i18n.t('Money in from yesterday\\'s sales', 'Pesa iliyoingia ya mauzo ya jana') }}</td><td class="n">{{ m(o.budget.received) }}</td></tr>
                  @if (o.budget.collections) { <tr><td>+ {{ i18n.t('Debts collected', 'Makusanyo ya madeni') }}</td><td class="n">{{ m(o.budget.collections) }}</td></tr> }
                  @if (o.budget.expenses) { <tr><td>− {{ i18n.t('Expenses', 'Gharama') }}</td><td class="n">{{ m(o.budget.expenses) }}</td></tr> }
                  <tr><td>− {{ i18n.t('Monthly costs per day', 'Gharama za mwezi kwa siku') }}</td><td class="n">{{ m(o.budget.accrual) }}</td></tr>
                  @if (o.budget.otherPurchases) { <tr><td>− {{ i18n.t('Other purchases today', 'Manunuzi mengine ya leo') }}</td><td class="n">{{ m(o.budget.otherPurchases) }}</td></tr> }
                  <tr><td>+ {{ i18n.t('Carried from the day before', 'Salio la mfuko la jana') }}</td><td class="n">{{ m(o.budget.poolCarry) }}</td></tr>
                  <tr class="sum"><td>= {{ i18n.t('Limit for this order', 'Kikomo cha oda hii') }}</td><td class="n" [class.neg]="(o.budget.limit ?? 0) < 0">{{ m(o.budget.limit ?? 0) }}</td></tr>
                  <tr class="quiet"><td>{{ i18n.t('Left for tomorrow', 'Kitabaki kwa kesho') }} <small>({{ i18n.t('at most', 'kisizidi') }} {{ m(o.budget.poolCap) }})</small></td><td class="n">{{ m(o.budget.poolOut) }}</td></tr>
                </tbody>
              </table>
            </section>
          </div>

          <section class="card flush">
            <div class="scroll">
              <table class="lines">
                <thead>
                  <tr>
                    <th class="n" [title]="i18n.t('Served first when money is short', 'Hupewa kwanza pesa ikipungua')">#</th>
                    <th>{{ i18n.t('Product', 'Bidhaa') }}</th>
                    <th class="n">{{ i18n.t('Stock', 'Stoki') }}</th>
                    <th class="n">{{ i18n.t('Sold / day', 'Mauzo / siku') }}</th>
                    <th class="n">{{ i18n.t('Target', 'Lengo') }}</th>
                    <th class="c">{{ w('Packs') }}</th>
                    <th class="n">{{ i18n.t('Cost', 'Gharama') }}</th>
                    @if (o.status === 'PURCHASED') { <th class="n">{{ i18n.t('Bought', 'Imenunuliwa') }}</th> }
                  </tr>
                </thead>
                <tbody>
                  @for (l of o.lines; track l.uid) {
                    <tr [class.zero]="!l.packs && !l.cutPacks" [class.edited]="l.edited">
                      <td class="n pr">{{ l.priority }}</td>
                      <td class="nm">
                        <b>{{ l.displayName }}</b>
                        <small>{{ detail(l) }} · {{ m(l.packCost) }}/{{ unit(l) }}</small>
                        @if (l.cutPacks > 0) { <small class="tag cut"><lsms-icon name="content_cut" [size]="12" />{{ i18n.t('budget cut ' + l.cutPacks + ' of ' + l.wantedPacks, 'bajeti imekata ' + l.cutPacks + ' kati ya ' + l.wantedPacks) }}</small> }
                      </td>
                      <td class="n">
                        <span class="num">{{ q(l.stock) }}</span>
                        <small class="tag" [class.count]="l.stockSource === 'COUNT'">{{ l.stockSource === 'COUNT' ? i18n.t('counted', 'hesabu') : i18n.t('system', 'mfumo') }}</small>
                      </td>
                      <td class="n">
                        <span class="num">{{ q(l.velocity) }}</span>
                        @if (l.stockoutDays) { <small class="tag warn" [title]="i18n.t('Days the shelf was empty in the last 14 — sales adjusted upwards', 'Siku rafu ilikuwa tupu ndani ya siku 14 — mauzo yamerekebishwa juu')">{{ i18n.t(l.stockoutDays + ' d empty', 'siku ' + l.stockoutDays + ' tupu') }}</small> }
                      </td>
                      <td class="n"><span class="num">{{ q(l.target) }}</span></td>
                      <td class="c">
                        @if (canEdit() && o.status !== 'PURCHASED') {
                          <span class="step">
                            <button type="button" (click)="bump(l, -1)" [disabled]="!value(l)" [attr.aria-label]="i18n.t('Less', 'Punguza')">−</button>
                            <input type="number" min="0" max="999" inputmode="numeric" [value]="value(l)" (change)="set(l, $any($event.target).value)" [attr.aria-label]="l.productName" />
                            <button type="button" (click)="bump(l, 1)" [attr.aria-label]="i18n.t('More', 'Ongeza')">+</button>
                          </span>
                        } @else {
                          <b class="num big">{{ l.packs }}</b>
                        }
                        <small class="unit">{{ unit(l) }}</small>
                        @if (l.edited) {
                          <small class="sys">
                            {{ i18n.t('system now', 'mfumo sasa') }}: <b>{{ l.systemPacks }}</b>
                            @if (canEdit() && o.status !== 'PURCHASED') { <button type="button" class="link" (click)="reset(l)">{{ i18n.t('use it', 'tumia') }}</button> }
                          </small>
                        }
                      </td>
                      <td class="n"><span class="num strong">{{ value(l) ? m(value(l) * l.packCost) : '—' }}</span></td>
                      @if (o.status === 'PURCHASED') { <td class="n"><b class="num">{{ l.purchasedPacks ?? '—' }}</b></td> }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <p class="foot muted">
            {{ i18n.t('Target = sales per day × ' + o.seasonFactor.toFixed(2) + ' (season) × ' + o.coverDays + ' days + safety. Packages = (target − stock), rounded up to whole packages. Only the main products are here; sodas and slow products are not.',
                      'Lengo = mauzo kwa siku × ' + o.seasonFactor.toFixed(2) + ' (msimu) × siku ' + o.coverDays + ' + akiba. Vifurushi = (lengo − stoki), vikizungushwa juu. Hapa ni bidhaa kuu tu; soda na bidhaa za polepole hazimo.') }}
          </p>
        }
      } @else {
        @if (historyError()) {
          <lsms-empty-state icon="cloud_off" [title]="i18n.t('Could not load history', 'Historia haikupatikana')" [message]="historyError()" />
        } @else if (!history()) {
          <lsms-skeleton variant="list" [rows]="6" />
        } @else if (!history()!.length) {
          <lsms-empty-state icon="history" [title]="i18n.t('No orders yet', 'Bado hakuna oda')" [message]="i18n.t('Orders of the last ' + days + ' days will show here.', 'Oda za siku ' + days + ' zilizopita zitaonekana hapa.')" />
        } @else {
          @for (h of history(); track h.uid) {
            <details class="card day" [open]="$first">
              <summary>
                <b>{{ day(h.orderDate) }}</b>
                <em class="st" [class.done]="h.status === 'PURCHASED'">{{ statusLabel(h) }}</em>
                <span class="v"><small>{{ i18n.t('Night', 'Usiku') }}</small>{{ h.nightGeneratedAt ? m(cost(h, 'night')) : '—' }}</span>
                <span class="v"><small>{{ i18n.t('System', 'Mfumo') }}</small>{{ m(cost(h, 'system')) }}</span>
                <span class="v"><small>{{ i18n.t('Buyer', 'Mnunuzi') }}</small>{{ m(h.totals.orderCost) }}</span>
                <span class="v"><small>{{ i18n.t('Bought', 'Imenunuliwa') }}</small>{{ h.totals.purchasedCost === null ? '—' : m(h.totals.purchasedCost) }}</span>
              </summary>
              <div class="scroll">
                <table class="lines hist">
                  <thead><tr>
                    <th>{{ i18n.t('Product', 'Bidhaa') }}</th>
                    <th class="n">{{ i18n.t('Night', 'Usiku') }}</th><th class="n">{{ i18n.t('System', 'Mfumo') }}</th>
                    <th class="n">{{ i18n.t('Buyer', 'Mnunuzi') }}</th><th class="n">{{ i18n.t('Bought', 'Imenunuliwa') }}</th>
                  </tr></thead>
                  <tbody>
                    @for (l of h.lines; track l.uid) {
                      <tr [class.zero]="!l.nightPacks && !l.systemPacks && !l.packs && !l.purchasedPacks">
                        <td class="nm"><b>{{ l.displayName }}</b> <small>{{ unit(l) }}</small></td>
                        <td class="n num">{{ l.nightPacks ?? '—' }}</td>
                        <td class="n num">{{ l.systemPacks }}</td>
                        <td class="n num" [class.diff]="l.edited && l.userPacks !== l.systemPacks">{{ l.edited ? l.userPacks : '·' }}</td>
                        <td class="n num" [class.diff]="l.purchasedPacks !== null && l.purchasedPacks !== l.packs">{{ l.purchasedPacks ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </details>
          }
          <p class="foot muted">{{ i18n.t('Packages per product. "·" = the buyer left the system\\'s figure.', 'Vifurushi kwa kila bidhaa. "·" = mnunuzi aliacha namba ya mfumo.') }}</p>
        }
      }
    </div>
  `,
  styleUrl: '../reports/report.scss',
  styles: `
    @use 'list-page';
    @include list-page.base;
    .center { display: flex; justify-content: center; }
    .banner { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 12px; padding: 12px 14px; border-radius: 14px; }
    .banner.err { color: var(--c-text); background: color-mix(in srgb, var(--c-error) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-error) 35%, transparent); lsms-icon { color: var(--c-error); } }
    .banner div { flex: 1 1 220px; display: flex; flex-direction: column; gap: 2px; b { font-size: 0.9rem; } small { font-size: 0.76rem; color: var(--c-text-2); } }

    .flow { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .flow li { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 100px; font-size: 0.76rem; color: var(--c-text-2); background: var(--c-surface); border: 1px dashed var(--c-border); }
    .flow li.on { color: var(--c-text); border-style: solid; border-color: color-mix(in srgb, var(--c-primary) 40%, var(--c-border)); background: color-mix(in srgb, var(--c-primary) 7%, var(--c-surface)); lsms-icon { color: var(--c-primary); } }
    .flow li.warn { border-color: color-mix(in srgb, var(--c-warning) 45%, var(--c-border)); background: color-mix(in srgb, var(--c-warning) 9%, var(--c-surface)); lsms-icon { color: var(--c-warning); } }
    .flow li.done { border-color: color-mix(in srgb, var(--c-success) 45%, var(--c-border)); background: color-mix(in srgb, var(--c-success) 9%, var(--c-surface)); lsms-icon { color: var(--c-success); } }

    .top { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(0, 1.4fr); gap: 16px; }
    @media (max-width: 860px) { .top { grid-template-columns: 1fr; } }
    .card > header span { flex: 1; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: var(--c-text-2); }
    .card > header lsms-icon { color: var(--c-primary); }
    .total { gap: 6px; padding-bottom: 16px; }
    .total > b { font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--c-text); line-height: 1.15; }
    .total p { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin: 0; font-size: 0.8rem; color: var(--c-text-2); }
    .total p.cut { color: var(--c-warning); } .total p.over { color: var(--c-error); font-weight: 600; }
    .src { padding: 3px 10px; border-radius: 100px; font-size: 0.72rem; font-style: normal; font-weight: 600; color: var(--c-info); background: color-mix(in srgb, var(--c-info) 11%, transparent); }
    .src.est { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .src.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .budget table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .budget td { padding: 6px 0; border-bottom: 1px solid var(--c-border); color: var(--c-text); }
    .budget td.n, table.lines .n { text-align: right; font-variant-numeric: tabular-nums; }
    .budget tr.sum td { font-weight: 700; border-bottom: 0; padding-top: 9px; }
    .budget tr.quiet td { color: var(--c-text-2); border-bottom: 0; padding-top: 0; }

    table.lines { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    table.lines th { padding: 9px 12px; text-align: left; white-space: nowrap; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: color-mix(in srgb, var(--c-text) 72%, transparent); background: color-mix(in srgb, var(--c-primary) 7%, var(--c-surface)); }
    table.lines td { padding: 9px 12px; border-bottom: 1px solid var(--c-border); color: var(--c-text); vertical-align: middle; }
    table.lines .c { text-align: center; }
    table.lines tr.zero td { color: var(--c-text-2); } table.lines tr.zero .nm b { font-weight: 500; }
    table.lines tr.edited td { background: color-mix(in srgb, var(--c-info) 5%, transparent); }
    .pr { width: 34px; color: var(--c-text-2) !important; font-size: 0.76rem; }
    .nm { min-width: 170px; } .nm b { display: block; font-weight: 600; } .nm small { display: block; font-size: 0.72rem; color: var(--c-text-2); }
    .num { font-variant-numeric: tabular-nums; } .num.big { font-size: 1.05rem; } .strong { font-weight: 600; }
    td small.tag, .nm small.tag { display: inline-flex; align-items: center; gap: 3px; margin-top: 2px; padding: 1px 7px; border-radius: 100px; font-size: 0.68rem; color: var(--c-text-2); background: var(--c-bg); white-space: nowrap; }
    td.n small.tag { display: flex; width: fit-content; margin-left: auto; }
    small.tag.count { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 11%, transparent); }
    small.tag.warn, small.tag.cut { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .step { display: inline-flex; align-items: center; border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; background: var(--c-surface); }
    .step button { width: 32px; height: 34px; border: 0; background: transparent; font-size: 1.1rem; color: var(--c-text); cursor: pointer; }
    .step button:disabled { opacity: 0.4; cursor: default; }
    .step button:hover:not(:disabled) { background: var(--c-bg); }
    .step input { width: 46px; height: 34px; border: 0; border-inline: 1px solid var(--c-border); text-align: center; font: inherit; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--c-text); background: transparent; -moz-appearance: textfield; }
    .step input::-webkit-outer-spin-button, .step input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .sys { display: block; margin-top: 3px; font-size: 0.72rem; color: var(--c-info); white-space: nowrap; }
    .link { padding: 0 0 0 4px; border: 0; background: none; font: inherit; color: var(--c-primary); text-decoration: underline; cursor: pointer; }
    .foot { margin: 0; font-size: 0.76rem; }

    details.day { padding: 0; overflow: hidden; }
    details.day summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 12px 18px; cursor: pointer; list-style: none; }
    details.day summary::-webkit-details-marker { display: none; }
    details.day summary b { min-width: 130px; font-size: 0.9rem; color: var(--c-text); }
    .st { padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-style: normal; font-weight: 600; color: var(--c-info); background: color-mix(in srgb, var(--c-info) 11%, transparent); }
    .st.done { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .v { display: flex; flex-direction: column; margin-left: auto; text-align: right; font-size: 0.84rem; font-variant-numeric: tabular-nums; color: var(--c-text); small { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.4px; color: var(--c-text-2); } }
    .v + .v { margin-left: 0; }
    table.hist td.diff { color: var(--c-warning); font-weight: 700; }
  `,
})
export class OrderPage {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(OrderService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly days = HISTORY_DAYS;
  protected readonly view = signal<View>('today');
  protected readonly order = signal<OrderSuggestion | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busy = signal<'' | 'recalc' | 'purchased'>('');
  protected readonly history = signal<OrderSuggestion[] | null>(null);
  protected readonly historyError = signal('');
  /** Packages typed but not saved yet, per line uid. */
  private readonly draft = signal(new Map<string, number>());
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly canEdit = computed(() => this.auth.hasAnyPermission([ORDER_EDIT]));
  protected readonly views = computed<SegmentOption<View>[]>(() => [
    { value: 'today', label: this.i18n.t('Today', 'Leo') },
    { value: 'history', label: this.i18n.t('History', 'Historia') },
  ]);

  protected readonly shownPacks = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return o.lines.reduce((a, l) => a + (o.status === 'PURCHASED' ? (l.purchasedPacks ?? 0) : this.value(l)), 0);
  });
  protected readonly shownProducts = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return o.lines.filter((l) => (o.status === 'PURCHASED' ? (l.purchasedPacks ?? 0) : this.value(l)) > 0).length;
  });
  /** How far the order as it stands is above the limit (0 when within it). */
  protected readonly over = computed(() => {
    const o = this.order();
    if (!o || o.budget.limit === null || o.status === 'PURCHASED') return 0;
    return Math.max(0, o.totals.orderCost - Math.max(o.budget.limit, 0));
  });

  protected readonly budgetLabel = computed(() => {
    switch (this.order()?.budget.source) {
      case 'RECON_APPROVED': return this.i18n.t('reconciliation approved', 'recon imeidhinishwa');
      case 'RECON_SUBMITTED': return this.i18n.t('reconciliation submitted — not approved yet', 'recon imewasilishwa — haijaidhinishwa');
      default: return this.i18n.t('estimate — reconciliation not submitted', 'makadirio — recon haijawasilishwa');
    }
  });

  protected readonly steps = computed(() => {
    const o = this.order();
    if (!o) return [];
    const t = (en: string, sw: string) => this.i18n.t(en, sw);
    return [
      { key: 'night', on: !!o.nightGeneratedAt, warn: false, icon: 'dark_mode', label: o.nightGeneratedAt ? t(`Night version ${this.time(o.nightGeneratedAt)}`, `Toleo la usiku ${this.time(o.nightGeneratedAt)}`) : t('No night version', 'Hakuna toleo la usiku') },
      { key: 'sales', on: !!o.salesUpdatedAt, warn: false, icon: 'history', label: o.salesUpdatedAt ? t(`Updated ${this.time(o.salesUpdatedAt)} after yesterday's sales`, `Imesasishwa ${this.time(o.salesUpdatedAt)} baada ya mauzo ya jana`) : t("Yesterday's late sales: none yet", 'Mauzo ya jana ya kuchelewa: bado hakuna') },
      { key: 'count', on: !!o.countDate, warn: false, icon: 'checklist', label: o.countDate ? t(`Updated ${this.time(o.countUpdatedAt)} after counting`, `Imesasishwa ${this.time(o.countUpdatedAt)} baada ya counting`) : t('Counting: not yet — system stock', 'Counting: bado — stoki ya mfumo') },
      { key: 'budget', on: o.budget.source !== 'ESTIMATE', warn: o.budget.source === 'RECON_SUBMITTED', icon: 'account_balance_wallet', label: t('Budget: ', 'Bajeti: ') + this.budgetLabel() },
      { key: 'purchased', on: o.status === 'PURCHASED', warn: false, icon: 'task_alt', label: o.status === 'PURCHASED' ? t(`Closed ${this.time(o.purchasedAt)}`, `Imefungwa ${this.time(o.purchasedAt)}`) : t(`Leave ${o.departureTime} · goods ~${o.arrivalTime}`, `Kuondoka ${o.departureTime} · mzigo ~${o.arrivalTime}`) },
    ];
  });

  /** Past the time to leave and still no count: say plainly what the crates are based on. */
  protected readonly notice = computed(() => {
    const o = this.order();
    if (!o || o.status === 'PURCHASED' || o.countDate || !o.lines.length) return null;
    const [h, mi] = o.departureTime.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + mi - 30) return null;
    return this.i18n.t(
      `The count is not finished and it is nearly ${o.departureTime}: this order uses the SYSTEM stock (with yesterday's sales keyed in so far).`,
      `Counting haijakamilika na ni karibu ${o.departureTime}: oda hii inatumia stoki ya MFUMO (pamoja na mauzo ya jana yaliyoingizwa hadi sasa).`,
    );
  });

  constructor() {
    void this.load(true);
    // the order recomputes itself in the background (sales, count, reconciliation): keep the page in step
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && this.view() === 'today' && !this.busy() && !this.timers.size) void this.load(false);
    }, 45_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(poll);
      this.timers.forEach((t) => clearTimeout(t));
    });
  }

  protected reload(): void {
    if (this.view() === 'today') void this.load(true);
    else void this.loadHistory();
  }

  protected setView(v: View): void {
    this.view.set(v);
    if (v === 'history' && !this.history()) void this.loadHistory();
  }

  private async load(showSkeleton: boolean): Promise<void> {
    if (showSkeleton) this.loading.set(true);
    try {
      const o = await this.api.today();
      if (!this.timers.size) this.order.set(o);
      this.error.set('');
    } catch (e) {
      if (showSkeleton) this.error.set(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadHistory(): Promise<void> {
    this.history.set(null);
    this.historyError.set('');
    try {
      const today = new Date();
      this.history.set(await this.api.history(toIsoDate(addDays(today, -(HISTORY_DAYS - 1))), toIsoDate(today)));
    } catch (e) {
      this.historyError.set(ApiError.from(e).message);
    }
  }

  // ── Editing ───────────────────────────────────────────────────────────────

  // ── Labels ────────────────────────────────────────────────────────────────

  /** "packages" / "vifurushi" in the current language — never spelled in a template. */
  protected w(key: keyof typeof PACK_WORDS): string {
    const [en, sw] = PACK_WORDS[key];
    return this.i18n.t(en, sw);
  }

  /** What one package of this line's product is called: crt, ctn… ("pkg" without a measure). */
  protected unit(l: OrderLine): string {
    return packUnit(l.packageAbbreviation, this.w('pkg'));
  }

  /** "Beer · 20 pcs/crt" — the shared product label without the name. */
  protected detail(l: OrderLine): string {
    return productDetail({ category: l.category, piecesPerPackage: l.piecesPerPack, abbreviation: l.packageAbbreviation }, { pkg: this.w('pkg') });
  }

  /** Packages shown for a line: what is being typed, else the order as stored. */
  protected value(l: OrderLine): number {
    return this.draft().get(l.uid) ?? l.packs;
  }

  protected bump(l: OrderLine, by: number): void {
    this.set(l, String(this.value(l) + by));
  }

  protected set(l: OrderLine, raw: string): void {
    const n = Math.max(0, Math.min(999, Math.floor(Number(raw) || 0)));
    this.draft.update((d) => new Map(d).set(l.uid, n));
    clearTimeout(this.timers.get(l.uid));
    this.timers.set(l.uid, setTimeout(() => void this.save(l.uid, n), 450));
  }

  protected reset(l: OrderLine): void {
    clearTimeout(this.timers.get(l.uid));
    this.timers.delete(l.uid);
    void this.save(l.uid, null);
  }

  private async save(lineUid: string, packs: number | null): Promise<void> {
    const o = this.order();
    if (!o) return;
    try {
      const saved = await this.api.editLine(o.uid, lineUid, packs);
      this.timers.delete(lineUid);
      this.draft.update((d) => {
        const n = new Map(d);
        n.delete(lineUid);
        return n;
      });
      this.order.set(saved);
    } catch (e) {
      this.timers.delete(lineUid);
      this.draft.update((d) => {
        const n = new Map(d);
        n.delete(lineUid);
        return n;
      });
      this.toast.error(ApiError.from(e).message);
      void this.load(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected async recalculate(): Promise<void> {
    this.busy.set('recalc');
    try {
      this.order.set(await this.api.recalculate());
      this.error.set('');
      this.toast.success(this.i18n.t('Order recalculated', 'Oda imehesabiwa upya'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
      await this.load(false);
    } finally {
      this.busy.set('');
    }
  }

  protected async purchased(o: OrderSuggestion): Promise<void> {
    const { OrderPurchasedDialog } = await import('./order-purchased-dialog');
    const lines = await this.dialogs.openAsync<{ lineUid: string; packs: number }[]>(OrderPurchasedDialog, { size: 'md', data: { lines: o.lines } });
    if (!lines) return;
    this.busy.set('purchased');
    try {
      this.order.set(await this.api.purchased(o.uid, lines));
      this.history.set(null);
      this.toast.success(this.i18n.t('Order closed', 'Oda imefungwa'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
      await this.load(false);
    } finally {
      this.busy.set('');
    }
  }

  /** The list as plain text (WhatsApp / SMS): only the products to buy. */
  protected shareText(o: OrderSuggestion): string {
    const rows = o.lines
      .filter((l) => this.value(l) > 0)
      .map((l) => {
        const size = packSize(l.piecesPerPack, l.packageAbbreviation, { pkg: this.w('pkg') });
        return `• ${l.displayName} — ${this.value(l)} ${this.unit(l)}${size ? ` (${size})` : ''}`;
      });
    return [
      `${this.i18n.t('Order of', 'Oda ya')} ${this.day(o.orderDate)}`,
      ...rows,
      `${this.i18n.t('Total', 'Jumla')}: ${this.w('packs')} ${this.shownPacks()} · ${this.m(o.totals.orderCost)}`,
    ].join('\n');
  }

  protected async share(o: OrderSuggestion): Promise<void> {
    const text = this.shareText(o);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      this.toast.success(this.i18n.t('List copied — paste it in WhatsApp', 'Orodha imenakiliwa — ibandike WhatsApp'));
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') this.toast.error(this.i18n.t('Could not share the list', 'Orodha haikuweza kushirikiwa'));
    }
  }

  protected print(o: OrderSuggestion): void {
    const rows = o.lines.filter((l) => this.value(l) > 0);
    printReport({
      title: this.i18n.t('Order', 'Oda'),
      subtitle: this.day(o.orderDate),
      headers: [this.i18n.t('Product', 'Bidhaa'), this.i18n.t('Category', 'Kategoria'), this.i18n.t('Package', 'Kifurushi'), this.w('Packs'), this.i18n.t('Cost', 'Gharama')],
      rows: rows.map((l) => [
        l.displayName,
        l.category ?? '',
        packSize(l.piecesPerPack, l.packageAbbreviation, { pkg: this.w('pkg') }) || this.unit(l),
        `${this.value(l)} ${this.unit(l)}`,
        this.m(this.value(l) * l.packCost),
      ]),
      numeric: [3, 4],
      summary: [
        [this.w('Packs'), this.shownPacks()],
        [this.i18n.t('Total', 'Jumla'), this.m(o.totals.orderCost)],
      ],
    });
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  protected cost(o: OrderSuggestion, version: 'night' | 'system'): number {
    return o.lines.reduce((a, l) => a + (version === 'night' ? (l.nightPacks ?? 0) : l.systemPacks) * l.packCost, 0);
  }

  protected statusLabel(o: OrderSuggestion): string {
    switch (o.status) {
      case 'PURCHASED': return this.i18n.t('Purchased', 'Imenunuliwa');
      case 'NIGHT': return this.i18n.t('Night version', 'Toleo la usiku');
      default: return this.i18n.t('Updated', 'Imesasishwa');
    }
  }

  protected m(v: number): string {
    return Money.format(v, { decimals: 0 });
  }

  protected q(v: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v);
  }

  protected time(v: string | null): string {
    const d = parseLocal(v);
    return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  }

  protected day(v: string | null): string {
    const d = parseLocal(v);
    return d ? new Intl.DateTimeFormat(this.i18n.isSwahili() ? 'sw-TZ' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—';
  }
}
