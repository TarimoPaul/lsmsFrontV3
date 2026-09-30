import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, SearchBar, SegmentOption, SegmentedFilterBar, Skeleton, ToastService } from '@shared/ui';
import { CountLineRow } from './count-line';
import { CountSort, CountStore } from './count.store';
import { ExplainLineRow } from './explain-line';
import { RecountLineRow } from './recount-line';

/**
 * "Count" tab — port of Flutter `CountingScreen`: start a blind count, count
 * every product (PKG + PCS), complete; then either the one blind recount
 * round or, once awaiting approval, the counter's variance explanations.
 */
@Component({
  selector: 'app-count-tab',
  imports: [CountLineRow, RecountLineRow, ExplainLineRow, Button, Icon, EmptyState, Skeleton, SearchBar, SegmentedFilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.resuming()) {
      <lsms-skeleton variant="list" [rows]="6" />
    } @else if (store.error() && !store.session()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load the count', 'Imeshindikana kupakia zoezi')" [message]="store.error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="store.resume()" />
    } @else if (!store.session()) {
      <section class="hero">
        <span class="badge"><lsms-icon name="checklist" [size]="34" /></span>
        <h2>{{ i18n.t('Stock count', 'Kuhesabu mali') }}</h2>
        <p>{{ i18n.t('Start a blind count — you will not see the system quantities while counting.', 'Anza zoezi la kuhesabu mali kwa mfumo wa "blind count" — hutaona idadi ya mfumo wakati unahesabu.') }}</p>
        <ul class="facts">
          <li><lsms-icon name="visibility_off" [size]="17" />{{ i18n.t('System stock stays hidden until you complete', 'Idadi ya mfumo imefichwa mpaka ukamilishe') }}</li>
          <li><lsms-icon name="point_of_sale" [size]="17" />{{ i18n.t('Sales and stock changes pause until the count is completed', 'Mauzo na mabadiliko ya stock yanasimama mpaka kuhesabu kukamilike') }}</li>
          <li><lsms-icon name="fact_check" [size]="17" />{{ i18n.t('A supervisor approves the differences', 'Msimamizi anathibitisha tofauti') }}</li>
        </ul>
        @if (canPerform()) {
          <button lsmsButton="primary" size="lg" icon="play_arrow" [loading]="store.starting()" (click)="start()">{{ i18n.t('Start counting', 'Anza kuhesabu') }}</button>
        } @else {
          <p class="lock"><lsms-icon name="lock" [size]="16" />{{ i18n.t('You cannot start a count (COUNTING_PERFORM).', 'Huna ruhusa ya kuanza kuhesabu mali (COUNTING_PERFORM).') }}</p>
        }
      </section>
    } @else {
      @let s = store.session()!;
      @switch (s.status) {
        @case ('PENDING_RECOUNT') {
          <section class="banner recount">
            <lsms-icon name="replay_circle_filled" [size]="22" />
            <div>
              <b>{{ i18n.t('Second count (blind)', 'Raundi ya pili ya kuhesabu (blind)') }}</b>
              <p>{{ i18n.t('Check these products again without seeing any difference or system quantity. Leave a product as it is if nothing changed, or enter the new quantity and a reason. This is ONE round only.', 'Hakikisha bidhaa hizi bila kuona tofauti wala idadi ya mfumo. Acha bidhaa kama ilivyo kama huna mabadiliko, au andika idadi mpya na sababu. Hii ni raundi MOJA tu — huwezi kurudia baada ya kuwasilisha.') }}</p>
            </div>
          </section>
          @if (store.loadingRecount() && !store.recountLines().length) {
            <lsms-skeleton variant="list" [rows]="5" />
          } @else if (!store.recountLines().length) {
            <lsms-empty-state icon="inventory_2" [title]="i18n.t('No products', 'Hakuna bidhaa')" [message]="i18n.t('The recount list was not found.', 'Orodha ya recount haijapatikana.')" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="store.loadRecount()" />
          } @else {
            <div class="list">
              @for (l of store.recountLines(); track l.uid; let i = $index) {
                <app-recount-line [line]="l" [index]="i + 1" />
              }
            </div>
            <div class="foot">
              <button lsmsButton="success" icon="check" [loading]="store.completingRecount()" (click)="completeRecount()">{{ i18n.t('Complete recount', 'Kamilisha recount') }}</button>
            </div>
          }
        }
        @case ('PENDING_APPROVAL') {
          <section class="hero done">
            <span class="badge"><lsms-icon name="task_alt" [size]="34" /></span>
            <h2>{{ i18n.t('Count completed', 'Kuhesabu kumekamilika') }}</h2>
            <p>{{ i18n.t(s.itemsCounted + '/' + s.totalItems + ' products counted. Sales are open again. This count is waiting for a supervisor’s approval.', 'Bidhaa ' + s.itemsCounted + '/' + s.totalItems + ' zimehesabiwa. Mauzo yamefunguliwa tena. Zoezi hili linasubiri uthibitisho wa msimamizi.') }}</p>
          </section>
          @if (store.isStarter() && store.varianceLines().length) {
            <p class="sub">
              <lsms-icon name="edit_note" [size]="18" />
              {{ i18n.t('Products with a difference (' + store.varianceLines().length + ') — explain each before the supervisor approves.', 'Bidhaa zenye tofauti (' + store.varianceLines().length + ') — eleza sababu ya kila moja kabla msimamizi hajathibitisha zoezi.') }}
              <em>{{ explainedCount() }}/{{ store.varianceLines().length }}</em>
            </p>
            <div class="explain">
              @for (l of store.varianceLines(); track l.uid; let i = $index) {
                <app-explain-line [line]="l" [index]="i + 1" />
              }
            </div>
          }
        }
        @default {
          <section class="progress" [class.all]="store.progress().all">
            <div class="p-top">
              <div>
                <b>{{ i18n.t(store.progress().done + '/' + store.progress().total + ' counted', store.progress().done + '/' + store.progress().total + ' zimehesabiwa') }}</b>
                <small>{{ s.countMode === 'SIGHTED' ? i18n.t('Sighted count', 'Kuhesabu kwa kuona') : i18n.t('Blind count · sales paused until you complete', 'Blind count · mauzo yamesimama mpaka ukamilishe') }}</small>
              </div>
              <button lsmsButton="success" [icon]="store.progress().all ? 'check' : undefined" [disabled]="!store.progress().all" [loading]="store.completing()" (click)="complete()">
                {{ store.progress().all ? i18n.t('Complete count', 'Kamilisha kuhesabu') : i18n.t((store.progress().total - store.progress().done) + ' still to count', 'Bado bidhaa ' + (store.progress().total - store.progress().done)) }}
              </button>
            </div>
            <div class="bar" role="progressbar" [attr.aria-valuenow]="store.progress().pct" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="store.progress().pct"></span></div>
          </section>

          <div class="filters">
            <lsms-search-bar [placeholder]="i18n.t('Search product…', 'Tafuta bidhaa...')" (search)="store.search.set($event)" (cleared)="store.search.set('')" />
            <lsms-segmented-filter-bar [options]="sorts()" [selected]="store.sort()" (selectedChange)="store.sort.set($event)" [scrollable]="false" />
            <label class="left"><input type="checkbox" [checked]="store.onlyLeft()" (change)="store.onlyLeft.set($any($event.target).checked)" />{{ i18n.t('Not counted only', 'Ambazo hazijahesabiwa tu') }}</label>
          </div>
          @if (categories().length > 1) {
            <lsms-segmented-filter-bar [options]="categories()" [selected]="store.category()" (selectedChange)="store.category.set($event)" />
          }

          @if (!store.lines().length) {
            <lsms-empty-state icon="search_off" [title]="i18n.t('No products', 'Hakuna bidhaa')" [message]="i18n.t('No products match this search.', 'Hakuna bidhaa zinazolingana na utafutaji huu.')" />
          } @else {
            <div class="list">
              @for (l of store.lines(); track l.uid; let i = $index) {
                <app-count-line [line]="l" [index]="i + 1" />
              }
            </div>
          }
        }
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 20px; text-align: center; border-radius: 18px; border: 1px solid var(--c-border); background: var(--c-surface); }
    .hero .badge { display: inline-flex; padding: 16px; border-radius: 20px; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 11%, transparent); }
    .hero.done .badge { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .hero h2 { margin: 4px 0 0; font-size: 1.25rem; font-weight: 700; color: var(--c-text); }
    .hero p { max-width: 560px; margin: 0; font-size: 0.88rem; color: var(--c-text-2); }
    .facts { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 12px; padding: 0; list-style: none; text-align: left; }
    .facts li { display: flex; align-items: center; gap: 10px; font-size: 0.84rem; color: var(--c-text); }
    .facts lsms-icon { color: var(--c-primary); }
    .lock { display: inline-flex; align-items: center; gap: 6px; color: var(--c-text-2); }
    .banner { display: flex; gap: 12px; padding: 14px 16px; border-radius: 14px; }
    .banner b { font-size: 0.92rem; color: var(--c-text); }
    .banner p { margin: 4px 0 0; font-size: 0.82rem; color: var(--c-text-2); }
    .banner.recount { color: var(--c-secondary); background: color-mix(in srgb, var(--c-secondary) 8%, var(--c-surface)); border: 1px solid color-mix(in srgb, var(--c-secondary) 30%, transparent); }
    .progress { position: sticky; top: 0; z-index: 3; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface); box-shadow: 0 4px 14px rgb(16 24 40 / 0.06); }
    .p-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .p-top b { display: block; font-size: 1rem; font-weight: 700; color: var(--c-text); }
    .p-top small { font-size: 0.74rem; color: var(--c-text-2); }
    .bar { height: 8px; border-radius: 8px; background: color-mix(in srgb, var(--c-text-2) 14%, transparent); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 8px; background: var(--c-primary); transition: width 0.3s ease; }
    .progress.all .bar span { background: var(--c-success); }
    .filters { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
    .filters lsms-search-bar { flex: 1 1 260px; }
    .left { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 500; color: var(--c-text); cursor: pointer; }
    .left input { width: 16px; height: 16px; accent-color: var(--c-primary); }
    .list { border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .list > :last-child { border-bottom: 0; }
    .foot { display: flex; justify-content: flex-end; }
    .sub { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.84rem; color: var(--c-text); }
    .sub lsms-icon { color: var(--c-warning); }
    .sub em { margin-left: auto; font-style: normal; font-weight: 600; color: var(--c-text-2); }
    .explain { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 12px; }
  `,
})
export class CountTab {
  protected readonly i18n = inject(LanguageService);
  protected readonly store = inject(CountStore);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly canPerform = computed(() => this.auth.hasPermission('COUNTING_PERFORM'));
  protected readonly explainedCount = computed(() => this.store.varianceLines().filter((l) => !!l.explainedAt).length);

  protected readonly sorts = computed<SegmentOption<CountSort>[]>(() => [
    { value: 'az', label: 'A–Z', icon: 'sort_by_alpha' },
    { value: 'stock', label: this.i18n.t('Low stock first', 'Stock ndogo kwanza'), icon: 'inventory' },
    { value: 'best', label: this.i18n.t('Best sellers', 'Zinazouzwa sana'), icon: 'local_fire_department' },
  ]);

  protected readonly categories = computed<SegmentOption<string>[]>(() => [
    { value: '', label: this.i18n.t('All', 'Zote'), count: this.store.progress().total - this.store.progress().done || undefined },
    ...this.store.categories().map((c) => ({ value: c.name, label: c.name, count: c.left || undefined })),
  ]);

  constructor() {
    void this.store.resume();
  }

  protected async start(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Start stock count', 'Anza kuhesabu mali'),
      message: this.i18n.t(
        'Have you entered all sales from the paper book? Sales cannot be entered until the count is completed.',
        'Umeshaingiza mauzo yote ya daftari? Mauzo hayataweza kuingizwa mpaka kuhesabu kukamilike.',
      ),
      confirmText: this.i18n.t('Yes, start', 'Ndiyo, anza'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    try {
      await this.store.start();
    } catch (e) {
      await this.dialogs.error(ApiError.from(e).message, this.i18n.t('Could not start counting', 'Imeshindwa kuanza kuhesabu'));
    }
  }

  protected async complete(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Complete count', 'Kamilisha kuhesabu'),
      message: this.i18n.t(
        'All products are counted. After completing you cannot change the counts, and sales open again.',
        'Bidhaa zote zimehesabiwa. Ukikamilisha hutaweza kubadilisha hesabu, na mauzo yatafunguliwa tena.',
      ),
      confirmText: this.i18n.t('Complete', 'Kamilisha'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    try {
      await this.store.complete();
      this.toast.success(this.i18n.t('Count completed', 'Kuhesabu kumekamilika'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not complete the count', 'Imeshindwa kukamilisha zoezi'));
    }
  }

  protected async completeRecount(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Complete recount', 'Kamilisha recount'),
      message: this.i18n.t(
        'This is ONE round only — you cannot repeat it after submitting. Products you left unchanged keep the first count. Continue?',
        'Hii ni raundi MOJA tu ya kuhesabu tena — hutaweza kurudia baada ya kuwasilisha. Bidhaa ulizoacha bila kubadilisha zitabaki na hesabu ya awali. Endelea?',
      ),
      confirmText: this.i18n.t('Yes, submit', 'Ndiyo, wasilisha'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    try {
      await this.store.completeRecount();
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not complete the recount', 'Imeshindwa kukamilisha recount'));
    }
  }
}
