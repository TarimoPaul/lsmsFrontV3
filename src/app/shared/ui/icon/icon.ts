import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Material Symbols (Rounded) icon — the same glyph set Flutter's `Icons.*`
 * uses. Pass the Flutter icon name without the `_rounded`/`_outlined` suffix,
 * e.g. `<lsms-icon name="trending_up" />`. Set `filled` for the solid variant
 * (Flutter's non-outlined icons such as `check_circle`).
 */
@Component({
  selector: 'lsms-icon',
  template: `{{ name() }}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'material-symbols-rounded lsms-icon',
    'aria-hidden': 'true',
    '[style.font-size.px]': 'size()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.color]': 'color()',
    '[style.font-variation-settings]': 'variation()',
  },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1;
      user-select: none;
    }
  `,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly color = input<string | undefined>(undefined);
  readonly filled = input(false);

  protected readonly variation = computed(
    () => `'FILL' ${this.filled() ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, this.size()))}`,
  );
}
