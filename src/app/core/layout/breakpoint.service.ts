import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

/** Port of Flutter `AppBreakpoints`. */
export const Breakpoints = {
  xs: 320,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1440,
} as const;

/**
 * Reactive viewport info. `isMobileDevice` uses the SHORTEST side (like
 * Flutter's `isMobileDevice`) so a phone rotated to landscape stays "mobile"
 * and keeps touch-friendly card layouts.
 */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly win = inject(DOCUMENT).defaultView;

  readonly width = signal(this.win?.innerWidth ?? 1280);
  readonly height = signal(this.win?.innerHeight ?? 800);

  readonly isMobile = computed(() => this.width() < Breakpoints.md);
  readonly isTablet = computed(() => this.width() >= Breakpoints.md && this.width() < Breakpoints.xl);
  readonly isDesktop = computed(() => this.width() >= Breakpoints.xl);
  readonly isMobileDevice = computed(() => Math.min(this.width(), this.height()) < Breakpoints.md);

  constructor() {
    let frame = 0;
    this.win?.addEventListener('resize', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        this.width.set(this.win!.innerWidth);
        this.height.set(this.win!.innerHeight);
      });
    });
  }
}
