import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../icon/icon';

export type CardVariant = 'standard' | 'info' | 'success' | 'error' | 'warning' | 'outlined' | 'elevated';

/**
 * Port of Flutter `CustomCards` (standard / info / success / error / warning /
 * infoBox / outlined / elevated) as one component.
 *
 *   <lsms-card>…</lsms-card>
 *   <lsms-card variant="warning" title="Stock low">…</lsms-card>
 *   <lsms-card variant="info" icon="receipt_long" title="Details">…</lsms-card>
 *
 * Status variants (success/error/warning/info) get a tinted background,
 * coloured border and a status icon next to the title.
 */
@Component({
  selector: 'lsms-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (title()) {
      <div class="head">
        @if (effectiveIcon()) {
          <lsms-icon [name]="effectiveIcon()!" [size]="22" [filled]="isStatus()" class="head-icon" />
        }
        <span class="title">{{ title() }}</span>
        <ng-content select="[cardActions]" />
      </div>
    }
    <ng-content />
  `,
  host: {
    class: 'lsms-card',
    '[attr.data-variant]': 'variant()',
    '[class.clickable]': 'clickable()',
    '[style.padding.px]': 'padding()',
  },
  styles: `
    :host {
      --card-accent: var(--c-primary);
      display: block;
      padding: 16px;
      border-radius: 8px;
      background: var(--c-card);
      border: 0.5px solid color-mix(in srgb, var(--c-border) 50%, transparent);
      box-shadow: var(--shadow-card);
      color: var(--c-text);
    }
    :host(.clickable) { cursor: pointer; transition: box-shadow 0.15s ease; }
    :host(.clickable:hover) { box-shadow: var(--shadow-md); }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .head-icon { color: var(--card-accent); }
    .title { flex: 1; min-width: 0; font-size: 1rem; font-weight: 600; }

    :host([data-variant='success']) { --card-accent: var(--c-success); }
    :host([data-variant='error']) { --card-accent: var(--c-error); }
    :host([data-variant='warning']) { --card-accent: var(--c-warning); }
    :host([data-variant='info']) { --card-accent: var(--c-info); }
    :host([data-variant='success']), :host([data-variant='error']), :host([data-variant='warning']), :host([data-variant='info']) {
      background: color-mix(in srgb, var(--card-accent) 5%, var(--c-card));
      border: 1.5px solid color-mix(in srgb, var(--card-accent) 30%, transparent);
      box-shadow: var(--shadow-sm);
    }
    :host([data-variant='success']) .title, :host([data-variant='error']) .title,
    :host([data-variant='warning']) .title, :host([data-variant='info']) .title { color: var(--card-accent); }

    :host([data-variant='outlined']) {
      background: transparent;
      box-shadow: none;
      border: 1px solid color-mix(in srgb, var(--c-primary) 30%, transparent);
    }
    :host([data-variant='elevated']) {
      box-shadow: var(--shadow-lg);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--c-primary) 5%, var(--c-card)),
        color-mix(in srgb, var(--c-primary) 2%, var(--c-card))
      );
    }
  `,
})
export class Card {
  readonly variant = input<CardVariant>('standard');
  readonly title = input<string | undefined>(undefined);
  /** Overrides the default status icon (or adds one to non-status cards). */
  readonly icon = input<string | undefined>(undefined);
  readonly padding = input(16);
  /** Adds hover elevation + pointer cursor (bind `(click)` yourself). */
  readonly clickable = input(false);

  protected readonly isStatus = computed(() =>
    ['success', 'error', 'warning', 'info'].includes(this.variant()),
  );
  protected readonly effectiveIcon = computed(() => {
    if (this.icon()) return this.icon();
    return (
      { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' } as Record<string, string>
    )[this.variant()];
  });
}
