import { Injectable, effect, inject, signal } from '@angular/core';

import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';

const POLL_MS = 60_000;

/**
 * Unread notification count for the toolbar bell
 * (GET /api/v1/notifications/unread-count). Polls every minute while signed in
 * and the tab is visible.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCountService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setInterval> | undefined;

  readonly unread = signal(0);

  constructor() {
    effect(() => {
      clearInterval(this.timer);
      if (!this.auth.isAuthenticated()) {
        this.unread.set(0);
        return;
      }
      void this.refresh();
      this.timer = setInterval(() => {
        if (document.visibilityState === 'visible') void this.refresh();
      }, POLL_MS);
    });
  }

  async refresh(): Promise<void> {
    try {
      const n = await this.api.get<number>('/api/v1/notifications/unread-count');
      this.unread.set(Number(n) || 0);
    } catch {
      // keep the last known value
    }
  }
}
