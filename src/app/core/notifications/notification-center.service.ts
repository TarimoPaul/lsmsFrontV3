import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { PageResult } from '../api/api.types';
import { AuthService } from '../auth/auth.service';
import { AppNotification, CATEGORY_TYPES, NotificationCategory, toNotification } from './notification.models';

const BASE = '/api/v1/notifications';
/** Same cadence as Flutter — only while the tab is visible, plus a check the moment it becomes visible. */
const POLL_MS = 10_000;
const MAX_REMEMBERED = 300;

/**
 * Notifications for the signed-in user: the bell's unread count, the inbox API, and
 * the "deni limelipwa" banners.
 *
 * Banners are the user's UNREAD debt collections minus the ones they closed. Unlike
 * Flutter (which forgot closed banners on every reload and re-raised them), v3
 * remembers closed banners per user in localStorage and syncs them across the
 * user's tabs, so one close is one close. Closing does NOT mark the notification
 * read — the inbox keeps it unread until it is opened.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenter {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastUnread = -1;

  readonly unread = signal(0);
  /** Unread count per backend type (inbox tabs). */
  readonly unreadByType = signal<Record<string, number>>({});
  private readonly debtUnread = signal<AppNotification[]>([]);
  private readonly dismissed = signal<Set<string>>(new Set());

  /** Banners to show, newest first. */
  readonly debtBanners = computed(() => this.debtUnread().filter((n) => !this.dismissed().has(n.uid)));

  constructor() {
    effect(() => {
      clearInterval(this.timer);
      const uid = this.auth.user()?.uid;
      this.lastUnread = -1;
      if (!this.auth.isAuthenticated() || !uid) {
        this.unread.set(0);
        this.unreadByType.set({});
        this.debtUnread.set([]);
        return;
      }
      this.dismissed.set(this.readDismissed(uid));
      void this.refresh();
      this.timer = setInterval(() => document.visibilityState === 'visible' && void this.refresh(), POLL_MS);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.auth.isAuthenticated()) void this.refresh();
    });
    // A banner closed in another tab of the same user closes here too.
    window.addEventListener('storage', (e) => {
      const uid = this.auth.user()?.uid;
      if (uid && e.key === this.key(uid)) this.dismissed.set(this.readDismissed(uid));
    });
  }

  /** Cheap poll; the per-type counts and the banner list are only fetched when the count moved. */
  async refresh(): Promise<void> {
    try {
      const n = Number(await this.api.get<number>(`${BASE}/unread-count`)) || 0;
      this.unread.set(n);
      if (n === this.lastUnread) return;
      this.lastUnread = n;
      await Promise.all([this.loadCounts(), this.loadDebtBanners()]);
    } catch {
      // keep the last known values
    }
  }

  private async loadCounts(): Promise<void> {
    this.unreadByType.set((await this.api.get<Record<string, number> | null>(`${BASE}/unread-counts`)) ?? {});
  }

  private async loadDebtBanners(): Promise<void> {
    const page = await this.list(0, 50, 'DEBT', true);
    this.debtUnread.set(page.items);
  }

  unreadIn(c: NotificationCategory): number {
    const byType = this.unreadByType();
    const types = CATEGORY_TYPES[c];
    return types ? types.reduce((n, t) => n + (byType[t] ?? 0), 0) : this.unread();
  }

  /** 0-based page, newest first. */
  async list(page: number, size: number, category: NotificationCategory, unreadOnly: boolean): Promise<PageResult<AppNotification>> {
    const types = CATEGORY_TYPES[category];
    const res = await this.api.getPage<Record<string, unknown>>(BASE, {
      params: { page, size, unreadOnly, types: types ? types.join(',') : null },
    });
    return { ...res, items: res.items.map(toNotification) };
  }

  async markRead(n: AppNotification): Promise<void> {
    if (n.isRead) return;
    await this.api.patch(`${BASE}/${n.uid}/read`);
    this.lastUnread = -1;
    void this.refresh();
  }

  async markAllRead(category: NotificationCategory): Promise<void> {
    const types = CATEGORY_TYPES[category];
    await this.api.patch(`${BASE}/mark-all-read`, {}, { params: { types: types ? types.join(',') : null } });
    this.lastUnread = -1;
    await this.refresh();
  }

  dismissBanner(uid: string): void {
    this.remember([uid]);
  }

  dismissAllBanners(): void {
    this.remember(this.debtBanners().map((n) => n.uid));
  }

  private remember(uids: string[]): void {
    const user = this.auth.user()?.uid;
    if (!user || !uids.length) return;
    const next = new Set(this.dismissed());
    uids.forEach((u) => next.add(u));
    this.dismissed.set(next);
    try {
      localStorage.setItem(this.key(user), JSON.stringify([...next].slice(-MAX_REMEMBERED)));
    } catch {
      // private mode — banners are still closed for this session
    }
  }

  private key(userUid: string): string {
    return `lsms.debtBanners.closed.${userUid}`;
  }

  private readDismissed(userUid: string): Set<string> {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key(userUid)) ?? '[]');
      return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  }
}
