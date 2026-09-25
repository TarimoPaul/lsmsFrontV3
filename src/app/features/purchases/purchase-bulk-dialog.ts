import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { LanguageService } from '@core/i18n/language.service';
import { Button, DialogShell, Icon, TextField } from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { Purchase } from './purchases.models';
import { PurchasesService } from './purchases.service';

/** 'approve-receive' = approve, then receive the ones that were approved (goods already in hand). */
export type BulkStep = 'approve' | 'receive' | 'approve-receive' | 'cancel';

export interface PurchaseBulkData {
  step: BulkStep;
  /** Only purchases the step applies to (the page filters the selection). */
  purchases: Purchase[];
}

interface Outcome {
  done: number;
  failed: Array<{ name: string; reason: string }>;
}

const TEXT: Record<BulkStep, { title: [string, string]; icon: string; go: [string, string]; effect: [string, string] }> = {
  approve: {
    title: ['Approve purchases', 'Idhinisha manunuzi'],
    icon: 'verified',
    go: ['Approve', 'Idhinisha'],
    effect: ['Approving adds the pieces to stock and records the cost of each purchase.', 'Kuidhinisha kunaongeza vipande kwenye mzigo na kurekodi gharama ya kila manunuzi.'],
  },
  receive: {
    title: ['Mark purchases received', 'Pokea manunuzi'],
    icon: 'inventory',
    go: ['Mark received', 'Thibitisha kupokelewa'],
    effect: ['Confirm the goods have arrived. This closes each purchase.', 'Thibitisha mzigo umefika. Hii inafunga kila manunuzi.'],
  },
  'approve-receive': {
    title: ['Approve and receive', 'Idhinisha na pokea'],
    icon: 'done_all',
    go: ['Approve & receive', 'Idhinisha na pokea'],
    effect: ['Each purchase is approved (stock + cost recorded) and then marked received — use it when the goods are already in the shop.', 'Kila manunuzi yanaidhinishwa (mzigo + gharama vinarekodiwa) kisha yanapokelewa — tumia mzigo ukiwa tayari dukani.'],
  },
  cancel: {
    title: ['Cancel purchases', 'Futa manunuzi'],
    icon: 'block',
    go: ['Cancel purchases', 'Futa manunuzi'],
    effect: ['Pending purchases are cancelled; stock added by approved ones is removed again.', 'Manunuzi yanayosubiri yanafutwa; mzigo ulioongezwa na yaliyoidhinishwa unaondolewa.'],
  },
};

/**
 * Bulk approve / receive / cancel — port of Flutter's `PurchaseTable` bulk
 * bar dialogs (`_showBulkApprovalDialog` …), plus "approve & receive" in one
 * go. Shows what will happen, runs the server's bulk endpoint, then lists any
 * purchase it refused with the reason. Closes with 'changed' when anything moved.
 */
@Component({
  selector: 'app-purchase-bulk-dialog',
  imports: [DialogShell, Button, Icon, TextField, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-dialog [title]="t(text.title)" [icon]="text.icon">
      @if (outcome(); as o) {
        <div class="hero" [class.part]="o.failed.length">
          <span class="tick"><lsms-icon [name]="o.done ? 'check' : 'close'" [size]="28" /></span>
          <b>{{ i18n.t(o.done + ' of ' + data.purchases.length + ' done', o.done + ' kati ya ' + data.purchases.length + ' yamekamilika') }}</b>
        </div>
        @if (o.failed.length) {
          <div class="failed">
            <p><lsms-icon name="report" [size]="16" /><b>{{ i18n.t(o.failed.length + ' could not be processed', o.failed.length + ' hayakuweza kushughulikiwa') }}</b></p>
            @for (f of o.failed; track $index) {
              <small>• <b>{{ f.name }}</b>: {{ f.reason }}</small>
            }
          </div>
        }
      } @else {
        <div class="sum">
          <div><small>{{ i18n.t('Purchases', 'Manunuzi') }}</small><b>{{ data.purchases.length }}</b></div>
          <div><small>{{ i18n.t('Total cost', 'Gharama yote') }}</small><b>{{ total() | money }}</b></div>
          <div><small>{{ i18n.t('Pieces', 'Vipande') }}</small><b>{{ pieces() }}</b></div>
        </div>
        <ul class="list">
          @for (p of shown(); track p.uid) {
            <li><span>{{ p.productName }} <small>{{ p.quantityDisplay || p.quantity }}@if (p.supplierName) { · {{ p.supplierName }} }</small></span><b>{{ p.totalCost | money: { symbol: false } }}</b></li>
          }
          @if (data.purchases.length > shown().length) {
            <li class="more">{{ i18n.t('and ' + (data.purchases.length - shown().length) + ' more…', 'na mengine ' + (data.purchases.length - shown().length) + '…') }}</li>
          }
        </ul>
        <section class="confirm" [class.danger]="data.step === 'cancel'">
          <p><lsms-icon [name]="data.step === 'cancel' ? 'warning' : 'info'" [size]="18" />{{ t(text.effect) }}</p>
          <lsms-text-field
            type="textarea"
            [rows]="2"
            [maxLength]="500"
            [required]="data.step === 'cancel'"
            [label]="data.step === 'cancel' ? i18n.t('Reason for cancelling', 'Sababu ya kufuta') : i18n.t('Notes (optional)', 'Maelezo (hiari)')"
            (valueChange)="note.set($event)"
          />
        </section>
        @if (error()) {
          <p class="err"><lsms-icon name="error" [size]="16" />{{ error() }}</p>
        }
      }

      <ng-container dialogActions>
        @if (outcome()) {
          <button lsmsButton [autofocus]="true" (click)="ref.close(moved ? 'changed' : undefined)">{{ i18n.t('Done', 'Sawa') }}</button>
        } @else {
          <button lsmsButton="secondary" [disabled]="busy()" (click)="ref.close()">{{ i18n.t('Back', 'Rudi') }}</button>
          <button
            [lsmsButton]="data.step === 'cancel' ? 'danger' : 'primary'"
            [icon]="text.icon"
            [loading]="busy()"
            [disabled]="data.step === 'cancel' && !note().trim()"
            (click)="run()"
          >
            {{ t(text.go) }} ({{ data.purchases.length }})
          </button>
        }
      </ng-container>
    </lsms-dialog>
  `,
  styles: `
    .sum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
    .sum div { display: flex; flex-direction: column; padding: 8px 12px; border-radius: 12px; background: var(--c-bg); border: 1px solid var(--c-border); }
    .sum small { font-size: 0.72rem; color: var(--c-text-2); }
    .sum b { font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .list { list-style: none; margin: 0 0 12px; padding: 6px 12px; border-radius: 12px; border: 1px solid var(--c-border); max-height: 220px; overflow: auto; }
    .list li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 0.84rem; }
    .list li + li { border-top: 1px dashed var(--c-border); }
    .list li span { display: flex; flex-direction: column; min-width: 0; }
    .list small { color: var(--c-text-2); }
    .list b { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .list .more { justify-content: center; color: var(--c-text-2); font-size: 0.78rem; }
    .confirm { padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--c-info) 7%, var(--c-bg)); border: 1px solid color-mix(in srgb, var(--c-info) 25%, transparent); }
    .confirm.danger { background: color-mix(in srgb, var(--c-error) 6%, var(--c-bg)); border-color: color-mix(in srgb, var(--c-error) 25%, transparent); }
    .confirm p { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.84rem; font-weight: 600; }
    .err { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 0.82rem; color: var(--c-error); }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 14px; }
    .tick { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; color: #fff; background: var(--c-success); box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-success) 16%, transparent); }
    .hero.part .tick { background: var(--c-warning); box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-warning) 16%, transparent); }
    .hero b { font-size: 1.15rem; font-weight: 800; }
    .failed { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 12px; color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 9%, transparent); max-height: 260px; overflow: auto; }
    .failed p { display: flex; align-items: center; gap: 6px; font-size: 0.84rem; }
    .failed small { font-size: 0.76rem; color: var(--c-text); }
    @media (max-width: 480px) { .sum { grid-template-columns: 1fr 1fr; } }
  `,
})
export class PurchaseBulkDialog {
  protected readonly data = inject<PurchaseBulkData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'changed'>>(DialogRef);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(PurchasesService);

  protected readonly text = TEXT[this.data.step];
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly outcome = signal<Outcome | null>(null);

  protected readonly total = computed(() => this.data.purchases.reduce((n, p) => n + p.totalCost, 0));
  protected readonly pieces = computed(() => this.data.purchases.reduce((n, p) => n + (p.totalPieces ?? p.quantity), 0));
  protected readonly shown = computed(() => this.data.purchases.slice(0, 8));

  protected t(pair: [string, string]): string {
    return this.i18n.t(pair[0], pair[1]);
  }

  protected async run(): Promise<void> {
    const note = this.note().trim();
    const uids = this.data.purchases.map((p) => p.uid);
    const names = new Map(this.data.purchases.map((p) => [p.uid, p.productName]));
    this.busy.set(true);
    this.error.set(null);
    try {
      const failed = new Map<string, string>();
      let done: string[];
      if (this.data.step === 'approve-receive') {
        const a = await this.api.bulk('approve', uids, note);
        a.failed.forEach((reason, u) => failed.set(u, reason));
        this.moved = a.done.length > 0;
        const r = a.done.length ? await this.api.bulk('receive', a.done, note) : null;
        r?.failed.forEach((reason, u) => failed.set(u, this.i18n.t('Approved, but not received: ', 'Imeidhinishwa, haijapokelewa: ') + reason));
        done = r?.done ?? [];
      } else {
        const res = await this.api.bulk(this.data.step, uids, note);
        res.failed.forEach((reason, u) => failed.set(u, reason));
        done = res.done;
        this.moved = done.length > 0;
      }
      this.outcome.set({ done: done.length, failed: [...failed].map(([u, reason]) => ({ name: names.get(u) ?? u, reason })) });
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Something changed on the server (even if a later step failed) — the list must refresh. */
  protected moved = false;
}
