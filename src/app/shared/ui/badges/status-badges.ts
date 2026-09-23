import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../icon/icon';

// ─── Payment status ─────────────────────────────────────────────────────────

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

/**
 * Derive status + fraction paid from money values — the recommended entry
 * point (avoids the "fully paid row still shows 33%" bug). 1-cent tolerance.
 */
export function paymentStatusFromAmounts(paid: number, total: number): { status: PaymentStatus; percent: number } {
  let status: PaymentStatus;
  if (paid <= 0) status = 'unpaid';
  else if (total > 0 && paid >= total - 0.01) status = 'paid';
  else status = 'partial';
  const percent = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 0;
  return { status, percent };
}

const PAYMENT_LABELS: Record<PaymentStatus, { sw: string; en: string }> = {
  paid: { sw: 'Imelipiwa', en: 'Paid' },
  partial: { sw: 'Sehemu', en: 'Partial' },
  unpaid: { sw: 'Haijalipiwa', en: 'Unpaid' },
};

/**
 * Colour-coded payment badge — port of `PaymentStatusBadge`.
 * Paid → green check · Partial → amber clock + "% paid" + thin bar · Unpaid → red.
 *
 *   <lsms-payment-status-badge [paid]="sale.paid" [total]="sale.total" />
 *   <lsms-payment-status-badge status="unpaid" [compact]="true" />
 */
@Component({
  selector: 'lsms-payment-status-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="row">
      <lsms-icon [name]="icon()" [size]="compact() ? 11 : 13" [filled]="true" />
      <span>{{ label() }}</span>
      @if (resolved().status === 'partial') {
        <span class="pct">{{ pctText() }}</span>
      }
    </span>
    @if (resolved().status === 'partial' && showProgressBar()) {
      <span class="track"><span class="fill" [style.width.%]="resolved().percent * 100"></span></span>
    }
  `,
  host: {
    '[attr.data-status]': 'resolved().status',
    '[class.compact]': 'compact()',
  },
  styleUrl: './status-badges.scss',
})
export class PaymentStatusBadge {
  private readonly i18n = inject(LanguageService);

  /** Explicit status; ignored when `paid` + `total` are given. */
  readonly status = input<PaymentStatus>('unpaid');
  /** Fraction paid 0–1 when using explicit `status`. */
  readonly percentPaid = input(0);
  readonly paid = input<number | undefined>(undefined);
  readonly total = input<number | undefined>(undefined);
  readonly compact = input(false);
  readonly showProgressBar = input(true);
  readonly labels = input<Partial<Record<PaymentStatus, string>> | undefined>(undefined);

  protected readonly resolved = computed(() => {
    const paid = this.paid();
    const total = this.total();
    if (paid !== undefined && total !== undefined) return paymentStatusFromAmounts(paid, total);
    return { status: this.status(), percent: this.percentPaid() };
  });
  protected readonly label = computed(() => {
    const s = this.resolved().status;
    return this.labels()?.[s] ?? PAYMENT_LABELS[s][this.i18n.lang()];
  });
  protected readonly icon = computed(
    () => ({ paid: 'check_circle', partial: 'schedule', unpaid: 'cancel' })[this.resolved().status],
  );
  protected readonly pctText = computed(() => `${Math.round(this.resolved().percent * 100)}%`);
}

// ─── Return status ──────────────────────────────────────────────────────────

export type ReturnState = 'none' | 'pending' | 'approved' | 'rejected' | 'completed';

/** Map backend strings ("PENDING", …) to ReturnState. Unknown → pending. */
export function returnStateFromStatus(hasReturn: boolean, status?: string | null): ReturnState {
  if (!hasReturn) return 'none';
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'pending';
  }
}

const RETURN_CFG: Record<Exclude<ReturnState, 'none'>, { icon: string; color: string; sw: string; en: string }> = {
  pending: { icon: 'pending_actions', color: 'var(--c-warning)', sw: 'Inasubiri', en: 'Pending' },
  approved: { icon: 'check_circle', color: 'var(--c-success)', sw: 'Imekubaliwa', en: 'Approved' },
  rejected: { icon: 'cancel', color: 'var(--c-error)', sw: 'Imekataliwa', en: 'Rejected' },
  completed: { icon: 'done_all', color: 'var(--c-success)', sw: 'Imekamilika', en: 'Completed' },
};

/** Return-request lifecycle badge — port of `ReturnStatusBadge`. */
@Component({
  selector: 'lsms-return-status-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cfg(); as c) {
      <span class="row">
        <lsms-icon [name]="c.icon" [size]="compact() ? 11 : 13" [filled]="true" />
        <span>{{ i18n.isSwahili() ? c.sw : c.en }}</span>
      </span>
    } @else {
      <span class="placeholder">{{ emptyPlaceholder() }}</span>
    }
  `,
  host: {
    class: 'squared',
    '[class.empty]': '!cfg()',
    '[class.compact]': 'compact()',
    '[style.--badge]': 'cfg()?.color',
  },
  styleUrl: './status-badges.scss',
})
export class ReturnStatusBadge {
  protected readonly i18n = inject(LanguageService);
  readonly state = input<ReturnState>('none');
  readonly compact = input(false);
  readonly emptyPlaceholder = input('—');
  protected readonly cfg = computed(() => {
    const s = this.state();
    return s === 'none' ? null : RETURN_CFG[s];
  });
}

// ─── Staff liability status ─────────────────────────────────────────────────

const LIABILITY_CFG: Record<string, { icon: string; color: string; sw: string; en: string }> = {
  OPEN: { icon: 'schedule', color: 'var(--c-warning)', sw: 'Wazi', en: 'Open' },
  PARTIALLY_PAID: { icon: 'pending_actions', color: 'var(--c-warning)', sw: 'Sehemu Imelipwa', en: 'Partially Paid' },
  SETTLED: { icon: 'check_circle', color: 'var(--c-success)', sw: 'Imekamilika', en: 'Settled' },
  WAIVED: { icon: 'remove_circle', color: 'var(--c-text-2)', sw: 'Imesamehewa', en: 'Waived' },
};

/** Staff liability header state (OPEN / PARTIALLY_PAID / SETTLED / WAIVED). Unknown → OPEN. */
@Component({
  selector: 'lsms-liability-status-badge',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="row">
      <lsms-icon [name]="cfg().icon" [size]="compact() ? 11 : 13" [filled]="status() !== 'WAIVED'" />
      <span>{{ i18n.isSwahili() ? cfg().sw : cfg().en }}</span>
    </span>
  `,
  host: { class: 'squared', '[class.compact]': 'compact()', '[style.--badge]': 'cfg().color' },
  styleUrl: './status-badges.scss',
})
export class LiabilityStatusBadge {
  protected readonly i18n = inject(LanguageService);
  readonly status = input<string | null | undefined>('OPEN');
  readonly compact = input(false);
  protected readonly cfg = computed(() => LIABILITY_CFG[this.status() ?? 'OPEN'] ?? LIABILITY_CFG['OPEN']);
}

// ─── Generic status chip ────────────────────────────────────────────────────

export type ChipStatus =
  | 'paid'
  | 'pending'
  | 'due'
  | 'active'
  | 'inactive'
  | 'lowStock'
  | 'outOfStock'
  | 'returned'
  | 'partial';

const CHIP_CFG: Record<ChipStatus, { tone: string; en: string; sw: string; icon?: string }> = {
  paid: { tone: 'green', en: 'Paid', sw: 'Imelipwa', icon: 'check' },
  pending: { tone: 'amber', en: 'Pending', sw: 'Inasubiri' },
  due: { tone: 'red', en: 'Due', sw: 'Inadaiwa' },
  active: { tone: 'green', en: 'Active', sw: 'Hai' },
  inactive: { tone: 'grey', en: 'Inactive', sw: 'Haitumiki' },
  lowStock: { tone: 'amber', en: 'Low Stock', sw: 'Mzigo Mdogo' },
  outOfStock: { tone: 'red', en: 'Out of Stock', sw: 'Imeisha' },
  returned: { tone: 'blue', en: 'Returned', sw: 'Imerudishwa' },
  partial: { tone: 'amber', en: 'Partial', sw: 'Sehemu' },
};

/** Unified pill used across Sales, Products, Customers, Purchases (port of `StatusChip`). */
@Component({
  selector: 'lsms-status-chip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cfg().icon) {
      <lsms-icon [name]="cfg().icon!" [size]="10" />
    }
    {{ label() ?? (i18n.isSwahili() ? cfg().sw : cfg().en) }}
  `,
  host: { '[attr.data-tone]': 'cfg().tone' },
  styles: `
    :host {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 20px;
      font-size: 0.625rem; font-weight: 500; white-space: nowrap;
      color: var(--fg); background: var(--bg);
    }
    :host([data-tone='green']) { --bg: #eaf3de; --fg: #27500a; --fg-dark: var(--c-success); }
    :host([data-tone='amber']) { --bg: #faeeda; --fg: #633806; --fg-dark: var(--c-warning); }
    :host([data-tone='red']) { --bg: #fcebeb; --fg: #791f1f; --fg-dark: var(--c-error); }
    :host([data-tone='grey']) { --bg: #f1efe8; --fg: #5f5e5a; --fg-dark: var(--c-text-2); }
    :host([data-tone='blue']) { --bg: #e6f1fb; --fg: #0c447c; --fg-dark: var(--c-info); }
    :host-context([data-theme='dark']) {
      color: var(--fg-dark);
      background: color-mix(in srgb, var(--fg-dark) 18%, transparent);
    }
  `,
})
export class StatusChip {
  protected readonly i18n = inject(LanguageService);
  readonly status = input.required<ChipStatus>();
  /** Overrides the built-in label. */
  readonly label = input<string | undefined>(undefined);
  protected readonly cfg = computed(() => CHIP_CFG[this.status()]);
}
