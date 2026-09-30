import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Counts a number up to its value (dashboard intro, like a KPI "ticking in").
 * The element's text is the formatted number; the first value counts up from
 * 0, later changes count from the previous value. Skipped under
 * prefers-reduced-motion.
 *
 *   <strong [lsmsCountUp]="t.totalRevenue" [countFormat]="money"></strong>
 */
@Directive({ selector: '[lsmsCountUp]' })
export class CountUp {
  readonly value = input<number | null | undefined>(null, { alias: 'lsmsCountUp' });
  readonly countFormat = input<(n: number) => string>((n) => Math.round(n).toLocaleString('en-US'));
  /** Milliseconds. */
  readonly countDuration = input(900);
  readonly countDelay = input(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private shown = 0;
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    effect(() => {
      const target = Number(this.value() ?? 0) || 0;
      const fmt = this.countFormat();
      cancelAnimationFrame(this.frame);
      clearTimeout(this.timer);
      if (reduced || target === this.shown) {
        this.shown = target;
        this.el.textContent = fmt(target);
        return;
      }
      const from = this.shown;
      this.el.textContent = fmt(from);
      const run = () => {
        const start = performance.now();
        const dur = this.countDuration();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
          this.shown = from + (target - from) * eased;
          this.el.textContent = fmt(p === 1 ? target : this.shown);
          if (p < 1) this.frame = requestAnimationFrame(tick);
          else this.shown = target;
        };
        this.frame = requestAnimationFrame(tick);
      };
      const delay = this.countDelay();
      if (delay > 0) this.timer = setTimeout(run, delay);
      else run();
    });
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.frame);
      clearTimeout(this.timer);
    });
  }
}

/** "1,617,000 TZS" / "44" / "-9,249 TZS" → sign, digits, suffix. Anything else is not counted. */
const COUNTABLE = /^(-?)(\d{1,3}(?:,\d{3})*|\d+)(\s*TZS)?$/;
/** Only values that arrive this soon after the card appears count up (page intro, not later refreshes). */
const INTRO_WINDOW_MS = 2500;

/**
 * Count-up for an already formatted value ("1,617,000 TZS", "44"): used by the
 * shared KPI tiles so every module's cards tick in on page load. Only the
 * first value shown within the intro window animates; later changes (filters,
 * refresh) are written straight away. Text that is not a plain number
 * ("80 / 129", "—") is shown as is. One rAF loop per tile for <1 s — cheap.
 */
@Directive({ selector: '[lsmsCountUpText]' })
export class CountUpText {
  readonly text = input<string | null | undefined>('', { alias: 'lsmsCountUpText' });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly born = performance.now();
  private done = false;
  private frame = 0;

  constructor() {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    effect(() => {
      const value = this.text() ?? '';
      cancelAnimationFrame(this.frame);
      const m = COUNTABLE.exec(value.trim());
      const target = m ? Number(m[2].replaceAll(',', '')) : 0;
      if (this.done || reduced || !m || target === 0 || performance.now() - this.born > INTRO_WINDOW_MS) {
        this.done = this.done || !!value;
        this.el.textContent = value;
        return;
      }
      this.done = true;
      const [, sign, , suffix = ''] = m;
      const start = performance.now();
      const dur = 800;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const n = Math.round(target * (1 - Math.pow(1 - p, 3)));
        this.el.textContent = p === 1 ? value : `${sign}${n.toLocaleString('en-US')}${suffix}`;
        if (p < 1) this.frame = requestAnimationFrame(tick);
      };
      this.el.textContent = `${sign}0${suffix}`;
      this.frame = requestAnimationFrame(tick);
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }
}
