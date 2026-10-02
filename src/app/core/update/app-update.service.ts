import { Injectable, signal } from '@angular/core';

interface BuildInfo {
  version: string;
  buildTime: string;
}

const POLL_MS = 5 * 60_000;

/**
 * Tells the user when a newer build has been deployed (Flutter `AppUpdateProvider`).
 *
 * The first /version.json read after the page loads is the build this tab runs;
 * later reads (every 5 min while visible, and whenever the tab becomes visible) are
 * compared to it by buildTime. No version.json (dev server) → silently off.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private current: BuildInfo | null = null;
  private dismissedBuild: string | null = null;
  private started = false;

  /** The newer build waiting, or null. */
  readonly available = signal<BuildInfo | null>(null);

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.check();
    setInterval(() => document.visibilityState === 'visible' && void this.check(), POLL_MS);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void this.check());
  }

  async check(): Promise<void> {
    try {
      // Relative: resolves against <base href> (/v3/ in production) — an absolute
      // /version.json would read the Flutter build's file on the shared domain.
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const info = (await res.json()) as BuildInfo;
      if (!info?.buildTime) return;
      if (!this.current) {
        this.current = info;
        return;
      }
      if (info.buildTime !== this.current.buildTime && info.buildTime !== this.dismissedBuild) this.available.set(info);
    } catch {
      // offline or no version.json — try again next time
    }
  }

  /** "Later": hide until an even newer build appears. */
  dismiss(): void {
    this.dismissedBuild = this.available()?.buildTime ?? null;
    this.available.set(null);
  }

  reload(): void {
    location.reload();
  }
}
