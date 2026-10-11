import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface TrendPoint {
  /** Short x-axis label, e.g. "Mon 9". */
  label: string;
  /** Full name shown in the hover card, e.g. "Monday, 9 October". */
  title: string;
  value: number;
  /** Second line of the hover card, e.g. "12 sales". */
  note?: string;
}

/** Monotone cubic through the points (never dips below a value it did not reach). */
function smooth(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return '';
  const m = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const t = xs.map((_, i) => {
    if (i === 0) return m[0];
    if (i === n - 1) return m[n - 2];
    return m[i - 1] * m[i] <= 0 ? 0 : (2 * m[i - 1] * m[i]) / (m[i - 1] + m[i]);
  });
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3;
    d += ` C${xs[i] + dx},${ys[i] + t[i] * dx} ${xs[i + 1] - dx},${ys[i + 1] - t[i + 1] * dx} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

/** A round axis top and step for `max` (about four steps). */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * One series over time: a thin line on a faint wash, quiet grid, and a hover
 * card (pointer, touch or arrow keys). The curve is drawn in a stretched SVG;
 * labels, dots and the card are HTML placed by percentage, so text stays crisp
 * at any width without measuring.
 */
@Component({
  selector: 'lsms-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="y" aria-hidden="true">
      @for (t of ticks(); track t.value) {
        <span [style.bottom.%]="t.pct">{{ t.label }}</span>
      }
    </div>
    <div
      class="plot"
      tabindex="0"
      role="img"
      [attr.aria-label]="summary()"
      (pointermove)="move($event)"
      (pointerdown)="move($event)"
      (pointerleave)="active.set(null)"
      (blur)="active.set(null)"
      (keydown)="key($event)"
    >
      @for (t of ticks(); track t.value) {
        <i class="grid" [class.base]="!t.value" [style.bottom.%]="t.pct"></i>
      }
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="area" [attr.d]="area()" />
        <path class="line" [attr.d]="line()" />
      </svg>
      @if (last(); as p) {
        <i class="dot" [style.left.%]="p.x" [style.top.%]="p.y"></i>
      }
      @if (hover(); as h) {
        <i class="cross" [style.left.%]="h.x"></i>
        <i class="dot on" [style.left.%]="h.x" [style.top.%]="h.y"></i>
        <div class="tip" [class.flip]="h.x > 55" [style.left.%]="h.x">
          <small>{{ h.point.title }}</small>
          <strong>{{ format()(h.point.value) }}</strong>
          @if (h.point.note) {
            <span>{{ h.point.note }}</span>
          }
        </div>
      }
    </div>
    <div class="x" aria-hidden="true">
      @for (l of labels(); track l.x) {
        <span [style.left.%]="l.x" [class.first]="l.x === 0" [class.last]="l.x === 100">{{ l.text }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      flex: 1; min-height: 0; min-width: 0;
      display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) 22px;
      column-gap: 10px; padding-top: 8px;
    }
    .y { position: relative; min-width: 34px; }
    .y span {
      position: absolute; right: 0; transform: translateY(50%); white-space: nowrap;
      font-size: 0.7rem; color: var(--c-text-2); font-variant-numeric: tabular-nums;
    }
    .plot { position: relative; min-height: 0; outline: none; cursor: crosshair; touch-action: pan-y; }
    .plot:focus-visible { outline: 2px solid var(--c-primary); outline-offset: 6px; border-radius: 4px; }
    .grid {
      position: absolute; left: 0; right: 0; height: 0;
      border-top: 1px dashed color-mix(in srgb, var(--c-border) 70%, transparent);
    }
    .grid.base { border-top-style: solid; border-top-color: var(--c-border); }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .line {
      fill: none; stroke: var(--c-primary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .area { fill: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .dot {
      position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%;
      background: var(--c-primary); box-shadow: 0 0 0 2px var(--c-surface); pointer-events: none;
    }
    .dot.on { width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; }
    .cross {
      position: absolute; top: 0; bottom: 0; width: 0; pointer-events: none;
      border-left: 1px solid color-mix(in srgb, var(--c-primary) 45%, transparent);
    }
    .tip {
      position: absolute; top: 0; z-index: 2; transform: translateX(12px); pointer-events: none;
      display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 10px; white-space: nowrap;
      background: var(--c-elevated); border: 1px solid var(--c-border); box-shadow: var(--shadow-md);
    }
    .tip.flip { transform: translateX(calc(-100% - 12px)); }
    .tip small { font-size: 0.7rem; color: var(--c-text-2); }
    .tip strong { font-size: 0.92rem; font-weight: 500; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .tip span { font-size: 0.72rem; color: var(--c-text-2); }
    .x { grid-column: 2; position: relative; }
    .x span {
      position: absolute; bottom: 0; transform: translateX(-50%); white-space: nowrap;
      font-size: 0.7rem; color: var(--c-text-2);
    }
    .x span.first { transform: none; }
    .x span.last { transform: translateX(-100%); }
  `,
})
export class TrendChart {
  readonly points = input.required<TrendPoint[]>();
  /** Value text in the hover card. */
  readonly format = input<(v: number) => string>((v) => String(v));
  /** Short value text on the y-axis. */
  readonly axisFormat = input<(v: number) => string>((v) => String(v));
  /** Read out by screen readers in place of the picture. */
  readonly summary = input('');

  protected readonly active = signal<number | null>(null);

  private readonly scale = computed(() => niceScale(Math.max(0, ...this.points().map((p) => p.value))));

  /** Each point in plot percentages (x from the left, y from the top). */
  private readonly coords = computed(() => {
    const pts = this.points();
    const top = this.scale().top;
    return pts.map((p, i) => ({
      x: pts.length > 1 ? (i / (pts.length - 1)) * 100 : 50,
      y: 100 - (Math.max(0, p.value) / top) * 100,
      point: p,
    }));
  });

  protected readonly ticks = computed(() => {
    const { top, step } = this.scale();
    const out: { value: number; pct: number; label: string }[] = [];
    for (let v = 0; v <= top + step / 2; v += step) out.push({ value: v, pct: (v / top) * 100, label: this.axisFormat()(v) });
    return out;
  });

  protected readonly line = computed(() => {
    const c = this.coords();
    return smooth(c.map((p) => p.x), c.map((p) => p.y));
  });
  protected readonly area = computed(() => {
    const c = this.coords();
    const d = this.line();
    return d ? `${d} L${c[c.length - 1].x},100 L${c[0].x},100 Z` : '';
  });

  /** About seven labels, counted back from the newest point so it is always named. */
  protected readonly labels = computed(() => {
    const c = this.coords();
    const every = Math.max(1, Math.ceil(c.length / 7));
    return c.filter((_, i) => (c.length - 1 - i) % every === 0).map((p) => ({ x: p.x, text: p.point.label }));
  });

  protected readonly last = computed(() => this.coords().at(-1) ?? null);
  protected readonly hover = computed(() => {
    const i = this.active();
    return i === null ? null : (this.coords()[i] ?? null);
  });

  protected move(e: PointerEvent): void {
    const n = this.points().length;
    if (!n) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = box.width ? (e.clientX - box.left) / box.width : 0;
    this.active.set(Math.min(n - 1, Math.max(0, Math.round(f * (n - 1)))));
  }

  protected key(e: KeyboardEvent): void {
    const n = this.points().length;
    if (!n || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const from = this.active() ?? n - 1;
    this.active.set(Math.min(n - 1, Math.max(0, from + (e.key === 'ArrowLeft' ? -1 : 1))));
  }
}
