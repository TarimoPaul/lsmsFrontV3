import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogService, EmptyState, Icon, Skeleton, Spinner, ToastService } from '@shared/ui';
import { QtyInput } from '../qty-input';
import { ASSET_REASONS, AssetLine, AssetSession, assetHasVariance } from './asset.models';
import { AssetService } from './asset.service';

/**
 * Periodic asset verification: start → count every confirmed asset WITHOUT
 * seeing the confirmed quantity → complete. If everything matches the count is
 * closed on the spot; otherwise the counter explains each difference and the
 * CEO decides. Sales are never paused.
 */
@Component({
  selector: 'app-asset-count',
  imports: [QtyInput, Button, Icon, EmptyState, Skeleton, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resuming()) {
      <lsms-skeleton variant="list" [rows]="5" />
    } @else if (error() && !session()) {
      <lsms-empty-state icon="error" iconColor="var(--c-error)" [title]="i18n.t('Could not load', 'Imeshindikana kupakia')" [message]="error()!" [secondaryActionLabel]="i18n.t('Retry', 'Jaribu tena')" (secondaryAction)="resume()" />
    } @else if (!session()) {
      <section class="hero">
        <span class="badge"><lsms-icon name="chair" [size]="34" /></span>
        <h2>{{ i18n.t('Verify assets', 'Hakiki mali za duka') }}</h2>
        @if (ready()) {
          <p>{{ i18n.t('Count each asset as you see it. You will not see the confirmed quantity while counting.', 'Hesabu kila mali kama unavyoiona. Hutaona idadi iliyothibitishwa wakati unahesabu.') }}</p>
          <ul class="facts">
            <li><lsms-icon name="inventory_2" [size]="17" />{{ i18n.t(status()!.approvedItems + ' confirmed asset(s) to verify', 'Mali ' + status()!.approvedItems + ' zilizothibitishwa za kuhakiki') }}</li>
            <li><lsms-icon name="point_of_sale" [size]="17" />{{ i18n.t('Sales continue as usual', 'Mauzo yanaendelea kama kawaida') }}</li>
            <li><lsms-icon name="fact_check" [size]="17" />{{ i18n.t('The CEO decides any difference', 'CEO anaamua tofauti yoyote') }}</li>
          </ul>
          <button lsmsButton="primary" size="lg" icon="play_arrow" [loading]="starting()" (click)="start()">{{ i18n.t('Start verification', 'Anza uhakiki') }}</button>
        } @else {
          <p>{{ i18n.t('No asset has been confirmed by the CEO yet. The asset list must be filled and confirmed first.', 'Hakuna mali iliyothibitishwa na CEO bado. Orodha ya mali ijazwe na kuthibitishwa kwanza.') }}</p>
          @if (canOpenRegister()) {
            <button lsmsButton="primary" icon="chair" (click)="openRegister.emit()">{{ i18n.t('Open the asset list', 'Fungua orodha ya mali') }}</button>
          }
        }
      </section>
    } @else {
      @let s = session()!;
      @switch (s.status) {
        @case ('IN_PROGRESS') {
          <section class="progress" [class.all]="progress().all">
            <div class="p-top">
              <div>
                <b>{{ i18n.t(progress().done + '/' + progress().total + ' counted', progress().done + '/' + progress().total + ' zimehesabiwa') }}</b>
                <small>{{ i18n.t('Blind count · sales are not paused', 'Blind count · mauzo hayasimami') }}</small>
              </div>
              <button lsmsButton="success" [icon]="progress().all ? 'check' : undefined" [disabled]="!progress().all" [loading]="completing()" (click)="complete()">
                {{ progress().all ? i18n.t('Complete verification', 'Kamilisha uhakiki') : i18n.t((progress().total - progress().done) + ' still to count', 'Bado mali ' + (progress().total - progress().done)) }}
              </button>
            </div>
            <div class="bar" role="progressbar" [attr.aria-valuenow]="progress().pct" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="progress().pct"></span></div>
          </section>
          @if (s.lines.length > 8) {
            <input class="search" type="search" [value]="query()" (input)="query.set($any($event.target).value)" [placeholder]="i18n.t('Search asset…', 'Tafuta mali…')" [attr.aria-label]="i18n.t('Search asset', 'Tafuta mali')" />
          }
          <div class="list">
            @for (l of shown(); track l.uid; let i = $index) {
              <div class="row" [class.done]="l.countedQty !== null">
                <span class="no">{{ i + 1 }}</span>
                <span class="st">
                  @if (saving().has(l.uid)) { <lsms-spinner [size]="16" /> } @else { <lsms-icon [name]="l.countedQty !== null ? 'check' : 'chair'" [size]="17" /> }
                </span>
                <span class="name"><b>{{ l.assetName }}</b>@if (l.location) { <small>{{ l.location }}</small> }</span>
                <app-qty-input [value]="l.countedQty" [tone]="l.countedQty !== null ? 'done' : ''" (commit)="commit(l, $event)" />
              </div>
            } @empty {
              <p class="none">{{ i18n.t('No asset matches this search.', 'Hakuna mali inayolingana na utafutaji huu.') }}</p>
            }
          </div>
        }
        @case ('PENDING_APPROVAL') {
          <section class="hero warn">
            <span class="badge"><lsms-icon name="rule" [size]="34" /></span>
            <h2>{{ i18n.t('Verification completed', 'Uhakiki umekamilika') }}</h2>
            <p>{{ i18n.t(differing().length + ' asset(s) differ from the confirmed quantity. Explain each one — the CEO will decide.', 'Mali ' + differing().length + ' zina tofauti na idadi iliyothibitishwa. Eleza kila moja — CEO ataamua.') }}</p>
          </section>
          <div class="explain">
            @for (l of differing(); track l.uid) {
              @let d = draft()[l.uid];
              <article [class.ok]="!!l.explainedAt">
                <header>
                  <b>{{ l.assetName }}</b>
                  @if (l.explainedAt) { <span class="pill"><lsms-icon name="check" [size]="13" />{{ i18n.t('Explained', 'Imeelezwa') }}</span> }
                </header>
                <div class="nums">
                  <span><small>{{ i18n.t('Confirmed', 'Iliyothibitishwa') }}</small><b>{{ l.expectedQty }}</b></span>
                  <span><small>{{ i18n.t('Counted', 'Uliyohesabu') }}</small><b>{{ l.countedQty }}</b></span>
                  <span><small>{{ i18n.t('Difference', 'Tofauti') }}</small><b [class.neg]="l.varianceQty! < 0" [class.pos]="l.varianceQty! > 0">{{ l.varianceQty! > 0 ? '+' : '' }}{{ l.varianceQty }}</b></span>
                </div>
                <div class="reasons" role="radiogroup" [attr.aria-label]="i18n.t('Reason for the difference', 'Sababu ya tofauti')">
                  @for (r of reasons; track r.key) {
                    <button type="button" role="radio" [attr.aria-checked]="(d?.reason ?? l.reason) === r.key" [class.on]="(d?.reason ?? l.reason) === r.key" (click)="setDraft(l, { reason: r.key })">{{ i18n.isSwahili() ? r.sw : r.en }}</button>
                  }
                </div>
                <div class="note">
                  <input type="text" maxlength="300" [value]="d?.note ?? l.note ?? ''" (input)="setDraft(l, { note: $any($event.target).value })" [placeholder]="i18n.t('Note', 'Maelezo')" [attr.aria-label]="i18n.t('Note', 'Maelezo')" />
                  <button lsmsButton="primary" size="sm" [loading]="saving().has(l.uid)" [disabled]="!canSend(l)" (click)="explain(l)">{{ l.explainedAt ? i18n.t('Update', 'Sasisha') : i18n.t('Send', 'Tuma') }}</button>
                </div>
              </article>
            }
          </div>
        }
        @default {
          <section class="hero ok">
            <span class="badge"><lsms-icon name="task_alt" [size]="34" /></span>
            <h2>{{ i18n.t('Everything matches', 'Mali zote zimelingana') }}</h2>
            <p>{{ i18n.t(s.totalItems + ' asset(s) verified — every one equals the confirmed quantity.', 'Mali ' + s.totalItems + ' zimehakikiwa — zote zinalingana na idadi iliyothibitishwa.') }}</p>
            <button lsmsButton="secondary" (click)="session.set(null)">{{ i18n.t('Done', 'Sawa') }}</button>
          </section>
        }
      }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 34px 20px; text-align: center; border-radius: 18px; border: 1px solid var(--c-border); background: var(--c-surface); --hc: var(--c-primary); }
    .hero.ok { --hc: var(--c-success); }
    .hero.warn { --hc: var(--c-warning); padding: 22px 20px; }
    .hero .badge { display: inline-flex; padding: 16px; border-radius: 20px; color: var(--hc); background: color-mix(in srgb, var(--hc) 11%, transparent); }
    .hero h2 { margin: 4px 0 0; font-size: 1.2rem; font-weight: 700; color: var(--c-text); }
    .hero p { max-width: 560px; margin: 0; font-size: 0.88rem; color: var(--c-text-2); }
    .facts { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 12px; padding: 0; list-style: none; text-align: left; }
    .facts li { display: flex; align-items: center; gap: 10px; font-size: 0.84rem; color: var(--c-text); }
    .facts lsms-icon { color: var(--c-primary); }
    .progress { position: sticky; top: 0; z-index: 3; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-float); box-shadow: 0 4px 14px rgb(16 24 40 / 0.06); }
    .p-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .p-top b { display: block; font-size: 1rem; font-weight: 700; color: var(--c-text); }
    .p-top small { font-size: 0.74rem; color: var(--c-text-2); }
    .bar { height: 8px; border-radius: 8px; background: color-mix(in srgb, var(--c-text-2) 14%, transparent); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 8px; background: var(--c-primary); transition: width 0.3s ease; }
    .progress.all .bar span { background: var(--c-success); }
    .search { height: 40px; padding: 0 12px; border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-input-fill); font: inherit; font-size: 0.88rem; color: var(--c-text); outline: 0; }
    .search:focus { border-color: var(--c-primary); }
    .list { border-radius: 16px; border: 1px solid var(--c-border); background: var(--c-surface); overflow: hidden; }
    .row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--c-border); }
    .row:last-child { border-bottom: 0; }
    .no { width: 22px; font-size: 0.72rem; color: var(--c-text-2); text-align: right; }
    .st { display: inline-flex; color: var(--c-text-2); }
    .row.done .st { color: var(--c-success); }
    .name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .name b { font-size: 0.9rem; font-weight: 500; color: var(--c-text); overflow-wrap: anywhere; }
    .name small { font-size: 0.74rem; color: var(--c-text-2); }
    .none { margin: 0; padding: 18px; text-align: center; font-size: 0.84rem; color: var(--c-text-2); }
    .explain { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr)); gap: 12px; }
    article { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--c-border); border-radius: 14px; background: var(--c-surface); }
    article.ok { border-color: color-mix(in srgb, var(--c-success) 45%, transparent); }
    article header { display: flex; align-items: center; gap: 8px; }
    article header b { flex: 1; font-size: 0.9rem; font-weight: 600; color: var(--c-text); }
    .pill { display: inline-flex; align-items: center; gap: 3px; padding: 2px 9px; border-radius: 100px; font-size: 0.7rem; font-weight: 600; color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .nums { display: flex; gap: 22px; }
    .nums span { display: flex; flex-direction: column; }
    .nums small { font-size: 0.7rem; color: var(--c-text-2); }
    .nums b { font-size: 1rem; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .neg { color: var(--c-error) !important; }
    .pos { color: var(--c-success) !important; }
    .reasons { display: flex; flex-wrap: wrap; gap: 6px; }
    .reasons button { padding: 6px 12px; border-radius: 100px; border: 1px solid var(--c-border); background: var(--c-surface); font: inherit; font-size: 0.78rem; font-weight: 500; color: var(--c-text); cursor: pointer; }
    .reasons button.on { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 12%, var(--c-surface)); color: var(--c-primary); font-weight: 600; }
    .note { display: flex; gap: 8px; }
    .note input { flex: 1; min-width: 0; height: 36px; padding: 0 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input-fill); font: inherit; font-size: 0.84rem; color: var(--c-text); outline: 0; }
    .note input:focus { border-color: var(--c-primary); }
    @media (max-width: 520px) { .row { flex-wrap: wrap; } .name { flex-basis: calc(100% - 70px); } app-qty-input { margin-left: auto; } }
  `,
})
export class AssetCount {
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(AssetService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly canOpenRegister = input(false);
  /** A count started / completed → the tab refreshes its status strip. */
  readonly changed = output<void>();
  readonly openRegister = output<void>();

  protected readonly status = this.api.status;
  protected readonly session = signal<AssetSession | null>(null);
  protected readonly resuming = signal(true);
  protected readonly starting = signal(false);
  protected readonly completing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly query = signal('');
  /** Unsent explanation edits, by line uid. */
  protected readonly draft = signal<Record<string, { reason?: string; note?: string }>>({});

  /** Latest value typed while a save of the same line is in flight. */
  private readonly queued = new Map<string, number>();

  protected readonly reasons = Object.entries(ASSET_REASONS).map(([key, l]) => ({ key, ...l }));
  protected readonly ready = computed(() => (this.status()?.approvedItems ?? 0) > 0);

  protected readonly progress = computed(() => {
    const lines = this.session()?.lines ?? [];
    const done = lines.filter((l) => l.countedQty != null).length;
    return { done, total: lines.length, pct: lines.length ? Math.round((done / lines.length) * 100) : 0, all: lines.length > 0 && done >= lines.length };
  });
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const lines = this.session()?.lines ?? [];
    return q ? lines.filter((l) => l.assetName.toLowerCase().includes(q) || (l.location ?? '').toLowerCase().includes(q)) : lines;
  });
  protected readonly differing = computed(() => (this.session()?.lines ?? []).filter(assetHasVariance));

  constructor() {
    void this.resume();
  }

  async resume(): Promise<void> {
    this.error.set(null);
    try {
      const active = await this.api.active();
      // Keep a just-completed "everything matches" screen until the user dismisses it.
      if (active || this.session()?.status !== 'MATCHED') this.session.set(active);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.resuming.set(false);
    }
  }

  protected async start(): Promise<void> {
    this.starting.set(true);
    try {
      this.session.set(await this.api.start());
      this.changed.emit();
    } catch (e) {
      await this.dialogs.error(ApiError.from(e).message, this.i18n.t('Could not start', 'Imeshindwa kuanza uhakiki'));
    } finally {
      this.starting.set(false);
    }
  }

  /** Saves when the row is left / Enter / a step. Untouched rows are never sent (empty ≠ 0). */
  protected async commit(line: AssetLine, qty: number | null): Promise<void> {
    const s = this.session();
    if (!s || qty == null || qty === line.countedQty) return;
    if (this.saving().has(line.uid)) {
      this.queued.set(line.uid, qty);
      return;
    }
    this.saving.update((x) => new Set(x).add(line.uid));
    try {
      let next: number | undefined = qty;
      while (next !== undefined) {
        this.patch(await this.api.submitLine(s.uid, line.uid, next));
        const queued = this.queued.get(line.uid);
        this.queued.delete(line.uid);
        next = queued !== undefined && queued !== next ? queued : undefined;
      }
    } catch (e) {
      this.queued.delete(line.uid);
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not save', 'Imeshindwa kuhifadhi'));
    } finally {
      this.unsave(line.uid);
    }
  }

  protected async complete(): Promise<void> {
    const s = this.session();
    if (!s) return;
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Complete verification', 'Kamilisha uhakiki'),
      message: this.i18n.t('All assets are counted. After completing you cannot change the counts.', 'Mali zote zimehesabiwa. Ukikamilisha hutaweza kubadilisha idadi.'),
      confirmText: this.i18n.t('Complete', 'Kamilisha'),
      cancelText: this.i18n.t('Cancel', 'Ghairi'),
    });
    if (!ok) return;
    this.completing.set(true);
    try {
      this.session.set(await this.api.complete(s.uid));
      this.changed.emit();
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not complete', 'Imeshindwa kukamilisha'));
    } finally {
      this.completing.set(false);
    }
  }

  protected setDraft(line: AssetLine, part: { reason?: string; note?: string }): void {
    this.draft.update((d) => ({ ...d, [line.uid]: { ...d[line.uid], ...part } }));
  }

  /** A reason is chosen, "Other" has a note, and something differs from what is saved. */
  protected canSend(line: AssetLine): boolean {
    const d = this.draft()[line.uid];
    const reason = d?.reason ?? line.reason;
    const note = (d?.note ?? line.note ?? '').trim();
    if (!reason || (reason === 'NYINGINE' && !note)) return false;
    return !line.explainedAt || reason !== line.reason || note !== (line.note ?? '');
  }

  protected async explain(line: AssetLine): Promise<void> {
    const s = this.session();
    const d = this.draft()[line.uid];
    const reason = d?.reason ?? line.reason;
    if (!s || !reason) return;
    this.saving.update((x) => new Set(x).add(line.uid));
    try {
      this.patch(await this.api.explain(s.uid, line.uid, reason, d?.note ?? line.note));
      this.draft.update(({ [line.uid]: _, ...rest }) => rest);
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not save the explanation', 'Imeshindwa kuhifadhi maelezo'));
    } finally {
      this.unsave(line.uid);
    }
  }

  private patch(updated: AssetLine): void {
    this.session.update((s) => (s ? { ...s, lines: s.lines.map((l) => (l.uid === updated.uid ? { ...l, ...updated } : l)) } : s));
  }

  private unsave(uid: string): void {
    this.saving.update((x) => {
      const n = new Set(x);
      n.delete(uid);
      return n;
    });
  }
}
