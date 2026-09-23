import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
const CHECK_EVERY_MS = 30_000;
const ACTIVITY_KEY = 'lsms_last_activity';

/**
 * Logs the user out after N minutes without interaction (Flutter
 * `SessionManager`, 30 min). Activity is shared across tabs via
 * localStorage so working in one tab keeps the others alive.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private readonly doc = inject(DOCUMENT);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastWrite = 0;
  private readonly timeoutMs = environment.inactivityTimeoutMinutes * 60_000;
  private readonly onActivity = () => this.touch();

  constructor() {
    effect(() => (this.auth.isAuthenticated() ? this.start() : this.stop()));
  }

  private start(): void {
    if (this.timer) return;
    this.touch(true);
    EVENTS.forEach((e) => this.doc.addEventListener(e, this.onActivity, { passive: true, capture: true }));
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  private stop(): void {
    EVENTS.forEach((e) => this.doc.removeEventListener(e, this.onActivity, { capture: true }));
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private touch(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastWrite < 5_000) return; // throttle writes
    this.lastWrite = now;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(now));
    } catch {
      // ignore
    }
  }

  private check(): void {
    let last = this.lastWrite;
    try {
      last = Math.max(last, Number(localStorage.getItem(ACTIVITY_KEY)) || 0);
    } catch {
      // ignore
    }
    if (Date.now() - last > this.timeoutMs) void this.auth.logout('inactivity');
  }
}
