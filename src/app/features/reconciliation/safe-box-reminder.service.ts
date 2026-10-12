import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { SafeBoxCashierOutstanding, SafeBoxDeposit, SafeBoxOutstandingEntry } from './recon-extra.models';
import { SafeBoxService } from './safe-box.service';

/** How often the reminder re-checks while the tab is visible. */
const POLL_MS = 5 * 60_000;

/**
 * Safe-box money that outlives its day. A cashier may submit only part of what is in
 * the safe (the rest stays behind, e.g. as change) and the day is approved anyway —
 * so what is left must keep being shown until it is brought in: to the cashier (what
 * they still owe) and to a manager (deposits waiting, what cashiers still hold).
 * Feeds the shell banner and the Safe box tab; one copy of the lists for both.
 */
@Injectable({ providedIn: 'root' })
export class SafeBoxReminder {
  private readonly auth = inject(AuthService);
  private readonly safe = inject(SafeBoxService);
  private started = false;

  /** My own safe-box entries on approved days, not confirmed in full yet. */
  readonly mine = signal<SafeBoxOutstandingEntry[]>([]);
  /** Manager: deposits waiting for a confirm / reject. */
  readonly toConfirm = signal<SafeBoxDeposit[]>([]);
  /** Manager: what every cashier still holds from approved days. */
  readonly owed = signal<SafeBoxCashierOutstanding[]>([]);
  /** "Close" on the banner — it stays away until the next login. */
  readonly dismissed = signal(false);

  readonly isCashier = computed(() => this.auth.hasPermission('RECONCILIATION_CREATE'));
  readonly isManager = computed(() => this.auth.isRoot() || this.auth.hasAnyPermission(['SAFE_BOX_CONFIRM', 'RECONCILIATION_APPROVE']));

  /** What I have not submitted at all yet — the amount shown in red. */
  readonly myUnsubmitted = computed(() => this.mine().reduce((n, e) => n + e.unsubmitted, 0));
  /** What I submitted and a manager has not confirmed yet. */
  readonly myPending = computed(() => this.mine().reduce((n, e) => n + e.pending, 0));
  readonly toConfirmTotal = computed(() => this.toConfirm().reduce((n, d) => n + d.amount, 0));
  /** Held by cashiers and not even submitted (deposits waiting are counted in toConfirm). */
  readonly owedUnsubmitted = computed(() => this.owed().reduce((n, c) => n + c.entries.reduce((m, e) => m + e.unsubmitted, 0), 0));

  constructor() {
    // A new login (or another branch) starts clean: lists reloaded, banner back.
    effect(() => {
      const key = this.auth.isAuthenticated() ? `${this.auth.user()?.uid}|${this.auth.activeBranchUid()}` : null;
      untracked(() => {
        this.dismissed.set(false);
        this.mine.set([]);
        this.toConfirm.set([]);
        this.owed.set([]);
        if (key) void this.refresh();
      });
    });
  }

  /** Called once by the shell: keeps the lists fresh while the app is open. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const tick = () => document.visibilityState === 'visible' && void this.refresh();
    setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
  }

  /** A failed call keeps what is shown (an older backend has no /my-outstanding). */
  async refresh(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    const [mine, pending, owed] = await Promise.all([
      this.isCashier() ? this.safe.myOutstanding().catch(() => null) : null,
      this.isManager() ? this.safe.pendingForManager().catch(() => null) : null,
      this.isManager() ? this.safe.outstanding().catch(() => null) : null,
    ]);
    if (mine) this.mine.set(mine);
    if (pending) this.toConfirm.set(pending);
    if (owed) this.owed.set(owed);
  }
}
