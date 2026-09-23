import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LanguageService } from '../../../core/i18n/language.service';
import { Icon } from '../icon/icon';
import { Spinner } from '../loading/spinner';
import { ToastService } from './toast.service';

/** Renders the ToastService stack. Place once in the root component. */
@Component({
  selector: 'lsms-toast-host',
  imports: [Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts.toasts(); track t.id) {
      <div
        class="toast"
        [attr.data-kind]="t.kind"
        [class.exiting]="t.exiting"
        [class.vertical]="t.kind === 'loading' || t.kind === 'progress'"
        [style.--toast-bg]="t.color"
        [attr.role]="t.kind === 'error' ? 'alert' : 'status'"
        (click)="toasts.tap(t)"
      >
        @if (t.kind === 'loading') {
          <div class="row">
            <lsms-spinner [size]="22" [stroke]="2.5" color="currentColor" />
            <span class="msg">{{ t.message }}</span>
          </div>
        } @else if (t.kind === 'progress') {
          <div class="row">
            <span class="msg">{{ t.message }}</span>
            <span class="pct">{{ (t.progress * 100).toFixed(0) }}%</span>
          </div>
          <div class="track"><div class="fill" [style.width.%]="t.progress * 100"></div></div>
        } @else {
          <div class="row">
            @if (t.icon) {
              <span class="icon"><lsms-icon [name]="t.icon" [size]="20" [filled]="true" /></span>
            }
            <span class="msg">{{ t.message }}</span>
            @if (t.dismissible) {
              <button
                type="button"
                class="close"
                [attr.aria-label]="i18n.t('Dismiss', 'Funga')"
                (click)="$event.stopPropagation(); toasts.dismiss(t.id)"
              >
                <lsms-icon name="close" [size]="18" />
              </button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    @use 'typography' as t;
    :host {
      position: fixed; top: 76px; right: 24px; z-index: 2000; /* below the 64px app bar so toasts never cover its controls */
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
      pointer-events: none;
    }
    @media (max-width: 599px) {
      :host { left: 16px; right: 16px; align-items: stretch; }
    }
    .toast {
      --toast-bg: var(--c-info);
      pointer-events: auto;
      min-width: 220px; max-width: 400px;
      padding: 8px 16px;
      border-radius: 16px;
      background: var(--toast-bg);
      color: var(--c-surface);
      box-shadow: 0 8px 16px rgb(26 26 26 / 0.18),
                  0 16px 32px -8px color-mix(in srgb, var(--toast-bg) 25%, transparent);
      cursor: pointer;
      animation: toast-in 0.22s cubic-bezier(0.215, 0.61, 0.355, 1);
    }
    @media (max-width: 599px) { .toast { max-width: none; } }
    :host-context([data-theme='dark']) .toast { color: var(--c-bg); }
    .toast.vertical { padding: 16px; cursor: default; }
    .toast.exiting { animation: toast-out 0.16s ease-in forwards; }
    .toast[data-kind='success'] { --toast-bg: var(--c-success); }
    .toast[data-kind='error'] { --toast-bg: var(--c-error); }
    .toast[data-kind='warning'] { --toast-bg: var(--c-warning); }
    .toast[data-kind='info'], .toast[data-kind='progress'] { --toast-bg: var(--c-info); }
    .toast[data-kind='loading'] { --toast-bg: var(--c-text-2); }
    :host-context([data-theme='dark']) .toast[data-kind='loading'] { --toast-bg: var(--c-elevated); color: var(--c-text); }
    .row { display: flex; align-items: center; gap: 8px; }
    .icon {
      display: inline-flex; padding: 6px; border-radius: 10px;
      background: color-mix(in srgb, currentColor 18%, transparent);
    }
    .msg { flex: 1; min-width: 0; @include t.body; font-weight: 600; line-height: 1.4; white-space: pre-line; }
    .pct { @include t.body-sm; font-weight: 700; }
    .close {
      display: inline-flex; padding: 4px; border: 0; border-radius: 12px;
      background: none; color: inherit; cursor: pointer; opacity: 0.85;
    }
    .close:hover { opacity: 1; background: color-mix(in srgb, currentColor 15%, transparent); }
    .track { height: 4px; margin-top: 10px; border-radius: 2px; overflow: hidden; background: color-mix(in srgb, currentColor 25%, transparent); }
    .fill { height: 100%; background: currentColor; transition: width 0.25s ease; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } }
    @keyframes toast-out { to { opacity: 0; transform: translateY(-8px); height: 0; padding: 0; margin: 0; } }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  protected readonly i18n = inject(LanguageService);
}
