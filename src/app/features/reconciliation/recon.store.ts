import { Injectable, computed, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/ui';
import { toIsoDate } from '@shared/utils/date-utils';
import { AutoSummary, Recon } from './reconciliation.models';
import { ReconResult, ReconciliationService } from './reconciliation.service';

/**
 * State of the reconciliation screen — port of Flutter `ReconciliationProvider`.
 * Provided by the page, shared by its tabs. Opening a day never creates a
 * record; the first entry (or "Start mine") does, like Flutter.
 */
@Injectable()
export class ReconStore {
  private readonly api = inject(ReconciliationService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);

  readonly date = signal(toIsoDate(new Date()));
  readonly current = signal<Recon | null>(null);
  readonly summary = signal<AutoSummary | null>(null);
  readonly team = signal<Recon[]>([]);
  readonly unclosed = signal<Array<{ uid: string; date: string; status: string }>>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly me = computed(() => this.auth.user()?.uid ?? null);
  /** Root / VIEW_ALL / APPROVE — sees everyone's records for the day. */
  readonly isManager = computed(() => this.auth.isRoot() || this.auth.hasAnyPermission(['RECONCILIATION_VIEW_ALL', 'RECONCILIATION_APPROVE']));
  readonly canSell = computed(() => this.auth.hasAnyPermission(['SALES_WRITE', 'SALES_CREATE', 'RECONCILIATION_CREATE']));
  readonly isMine = computed(() => {
    const c = this.current();
    return !c || c.userUid === this.me();
  });
  /** Entries can be added / removed (own editable record, RECONCILIATION_CREATE). */
  readonly canEdit = computed(() => {
    const c = this.current();
    if (!this.auth.hasPermission('RECONCILIATION_CREATE')) return false;
    return c ? c.editable && this.isMine() : this.canSell();
  });

  /** Load a day: own record (+ refresh when editable), live summary, team list for managers. */
  async load(date = this.date()): Promise<void> {
    this.date.set(date);
    this.loading.set(true);
    this.error.set(null);
    this.current.set(null);
    this.summary.set(null);
    const pureManager = this.isManager() && !this.canSell();
    try {
      const [summary, mine] = await Promise.all([this.api.autoSummary(date), pureManager ? Promise.resolve(null) : this.api.mine(date).catch(() => null)]);
      if (this.date() !== date) return;
      this.summary.set(summary);
      if (mine?.editable && mine.uid) this.current.set(await this.api.refresh(mine.uid).catch(() => mine));
      else this.current.set(mine);
      if (this.isManager()) this.team.set(await this.api.team(date).catch(() => []));
      else this.team.set([]);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      if (this.date() === date) this.loading.set(false);
    }
  }

  async open(uid: string): Promise<void> {
    this.loading.set(true);
    try {
      const r = await this.api.byUid(uid);
      this.current.set(r.editable ? await this.api.refresh(uid).catch(() => r) : r);
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadUnclosed(): Promise<void> {
    this.unclosed.set(await this.api.myUnclosed());
  }

  /** Create (or fetch) the caller's own record for the selected day. */
  async startMine(): Promise<Recon | null> {
    this.saving.set(true);
    try {
      const r = await this.api.create(this.date());
      this.current.set(r);
      if (this.isManager()) this.team.set(await this.api.team(this.date()).catch(() => this.team()));
      return r;
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Run a mutation against the current record (creating it first when there is
   * none yet). Returns the result so callers can react to error codes.
   */
  async act(call: (uid: string) => Promise<ReconResult>, success?: string): Promise<ReconResult> {
    let uid = this.current()?.uid;
    if (!uid) {
      const r = await this.startMine();
      if (!r?.uid) return { recon: null, error: this.i18n.t('Nothing to reconcile on this day.', 'Hakuna cha kupatanisha siku hii.'), code: null };
      uid = r.uid;
    }
    this.saving.set(true);
    try {
      const res = await call(uid);
      if (res.recon) {
        this.current.set(res.recon);
        this.team.update((t) => t.map((x) => (x.uid === res.recon!.uid ? res.recon! : x)));
        if (success) this.toast.success(success);
      }
      return res;
    } finally {
      this.saving.set(false);
    }
  }

  async refresh(): Promise<void> {
    const c = this.current();
    if (!c) return this.load();
    try {
      this.current.set(c.editable ? await this.api.refresh(c.uid) : await this.api.byUid(c.uid));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
