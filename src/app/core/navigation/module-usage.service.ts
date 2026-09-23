import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { safeStorage } from '../utils/safe-storage';
import { APP_MODULES, AppModule } from './app-modules';

const KEY = 'lsms_module_usage';

/**
 * Remembers how often each module is opened (per browser, per user) so the
 * dashboard can surface "Frequently used" modules first.
 */
@Injectable({ providedIn: 'root' })
export class ModuleUsageService {
  private readonly auth = inject(AuthService);
  private readonly counts = signal<Record<string, Record<string, number>>>(this.read());

  /** Top modules for the current user (most opened first, accessible only). */
  readonly frequent = computed<AppModule[]>(() => {
    const uid = this.auth.user()?.uid ?? 'anon';
    const mine = this.counts()[uid] ?? {};
    return APP_MODULES.filter((m) => (mine[m.id] ?? 0) > 0 && this.auth.canAccessSection(m.id))
      .sort((a, b) => (mine[b.id] ?? 0) - (mine[a.id] ?? 0))
      .slice(0, 6);
  });

  track(moduleId: string): void {
    const uid = this.auth.user()?.uid ?? 'anon';
    this.counts.update((all) => {
      const mine = { ...(all[uid] ?? {}) };
      mine[moduleId] = (mine[moduleId] ?? 0) + 1;
      const next = { ...all, [uid]: mine };
      safeStorage.set(KEY, JSON.stringify(next));
      return next;
    });
  }

  private read(): Record<string, Record<string, number>> {
    try {
      return JSON.parse(safeStorage.get(KEY) ?? '{}');
    } catch {
      return {};
    }
  }
}
