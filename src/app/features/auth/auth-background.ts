import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';

import { ThemeService } from '../../core/theme/theme.service';

/**
 * Full-screen auth background — port of Flutter `CircuitBackground`:
 * a soft brand gradient with an ultra-subtle, slowly scrolling circuit-board
 * pattern (PCB traces, pads, vias) and light pulses travelling along a few
 * traces. Honors `prefers-reduced-motion` (renders a static frame).
 */
@Component({
  selector: 'app-auth-background',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      background: linear-gradient(135deg, #f8fafd 0%, #fcfdff 50%, #f1f5fa 100%);
    }
    :host-context([data-theme='dark']) {
      background: linear-gradient(135deg, #0f1419 0%, #161b22 50%, #0f1419 100%);
    }
    canvas { width: 100%; height: 100%; display: block; }
  `,
})
export class AuthBackground {
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemeService);
  private frame = 0;
  private start = performance.now();
  private dark = false;

  constructor() {
    effect(() => {
      this.dark = this.theme.isDarkMode();
      this.drawOnce();
    });

    afterNextRender(() => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const resize = () => this.resize();
      resize();
      addEventListener('resize', resize);
      const loop = (t: number) => {
        this.draw(t);
        this.frame = requestAnimationFrame(loop);
      };
      if (reduce) this.draw(0);
      else this.frame = requestAnimationFrame(loop);
      this.cleanup = () => {
        cancelAnimationFrame(this.frame);
        removeEventListener('resize', resize);
      };
    });
    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

  private cleanup: () => void = () => {};

  private resize(): void {
    const c = this.canvas()?.nativeElement;
    if (!c) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOnce();
  }

  private drawOnce(): void {
    if (this.canvas()) this.draw(performance.now());
  }

  /** Stable pseudo-random in [0,1) from absolute cell coords + salt (no flicker while scrolling). */
  private rand(x: number, y: number, salt: number): number {
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(salt, 83492791)) & 0x7fffffff;
    h ^= h >> 13;
    h &= 0x7fffffff;
    return (h % 100000) / 100000;
  }

  private draw(now: number): void {
    const c = this.canvas()?.nativeElement;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const elapsed = now - this.start;
    const progress = (elapsed / 40_000) % 1; // one drift cycle / 40s
    const pulse = (elapsed / 7_000) % 1; // light pulses / 7s
    const g = 46;
    const scroll = progress * g;
    const dy = -(scroll % g);
    const baseRow = Math.floor(scroll / g);
    const dark = this.dark;
    const rgb = dark ? '150, 212, 212' : '59, 117, 151';

    const traceColor = `rgba(${rgb}, ${dark ? 0.12 : 0.09})`;
    const padColor = `rgba(${rgb}, ${dark ? 0.2 : 0.15})`;
    const viaColor = `rgba(${rgb}, ${dark ? 0.18 : 0.13})`;
    const glow = dark ? '127, 212, 255' : '74, 138, 168';

    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cols = Math.ceil(w / g) + 2;
    const rows = Math.ceil(h / g) + 2;

    const glowAt = (x: number, y: number) => {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 7);
      grad.addColorStop(0, `rgba(${glow}, ${dark ? 0.55 : 0.4})`);
      grad.addColorStop(1, `rgba(${glow}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let rj = -1; rj <= rows; rj++) {
      const aj = baseRow + rj;
      const y = rj * g + dy;
      for (let ci = -1; ci <= cols; ci++) {
        const x = ci * g;
        ctx.strokeStyle = traceColor;

        // Trace heading right, optionally with a 45° jog.
        if (this.rand(ci, aj, 1) > 0.42) {
          if (this.rand(ci, aj, 5) > 0.62) {
            const step = g * 0.16 * (this.rand(ci, aj, 7) > 0.5 ? -1 : 1);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + g * 0.34, y);
            ctx.lineTo(x + g * 0.5, y + step);
            ctx.lineTo(x + g * 0.66, y + step);
            ctx.lineTo(x + g * 0.82, y);
            ctx.lineTo(x + g, y);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + g, y);
            ctx.stroke();
            if (this.rand(ci, aj, 8) > 0.9) {
              const t = (pulse * (this.rand(ci, aj, 9) > 0.5 ? 1 : 2) + this.rand(ci, aj, 10)) % 1;
              glowAt(x + g * t, y);
            }
          }
        }
        // Trace heading down.
        if (this.rand(ci, aj, 2) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + g);
          ctx.stroke();
          if (this.rand(ci, aj, 11) > 0.91) {
            const t = (pulse * (this.rand(ci, aj, 12) > 0.5 ? 1 : 2) + this.rand(ci, aj, 13)) % 1;
            glowAt(x, y + g * t);
          }
        }
        // Occasional diagonal link.
        if (this.rand(ci, aj, 3) > 0.85) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + g, y + g);
          ctx.stroke();
        }
        // Pads / vias at junctions.
        const p = this.rand(ci, aj, 4);
        if (p > 0.8) {
          ctx.strokeStyle = viaColor;
          ctx.beginPath();
          ctx.arc(x, y, 3.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = padColor;
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p > 0.62) {
          ctx.fillStyle = padColor;
          ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        }
      }
    }
  }
}
