import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'progress' | 'custom';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  icon?: string;
  /** CSS colour for `custom` toasts. */
  color?: string;
  /** 0–1 for `progress` toasts. */
  progress: number;
  dismissible: boolean;
  exiting: boolean;
  onTap?: () => void;
}

interface ShowOptions {
  duration?: number;
  onTap?: () => void;
  dismissible?: boolean;
}

const MAX_VISIBLE = 4;
const EXIT_MS = 160;

/**
 * Stacked toast notifications — port of Flutter `CustomSnackbars`.
 * Top-right on wide screens, top-centre on phones; at most 4 visible
 * (oldest retire first). Transient toasts auto-dismiss; `loading` /
 * `progress` stay until `dismiss()` (update them with `updateProgress` /
 * `updateLoadingMessage`). Render `<lsms-toast-host />` once in the app root.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;
  private latestProgressId = -1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, opts: ShowOptions = {}): number {
    return this.show('success', message, 'check_circle', { duration: 3000, ...opts });
  }

  error(message: string, opts: ShowOptions = {}): number {
    return this.show('error', message, 'error', { duration: 5000, ...opts });
  }

  info(message: string, opts: ShowOptions = {}): number {
    return this.show('info', message, 'info', { duration: 4000, ...opts });
  }

  warning(message: string, opts: ShowOptions = {}): number {
    return this.show('warning', message, 'warning', { duration: 4000, ...opts });
  }

  /** Several warnings in one toast (backend `warnings[]`). */
  warnings(messages: string[], opts: ShowOptions = {}): number | undefined {
    if (!messages.length) return undefined;
    return this.show('warning', messages.join('\n'), 'warning', { duration: 5000, ...opts });
  }

  loading(message: string): number {
    return this.show('loading', message, undefined, { dismissible: false });
  }

  progress(message: string, progress = 0): number {
    return this.show('progress', message, undefined, { dismissible: false }, progress);
  }

  custom(message: string, icon: string, color: string, opts: ShowOptions = {}): number {
    return this.show('custom', message, icon, { duration: 4000, ...opts }, 0, color);
  }

  /** Update the most recent loading/progress toast. */
  updateProgress(progress: number, message?: string): void {
    this.patch(this.latestProgressId, (t) => ({
      ...t,
      progress: Math.min(1, Math.max(0, progress)),
      message: message ?? t.message,
    }));
  }

  updateLoadingMessage(message: string): void {
    this.patch(this.latestProgressId, (t) => ({ ...t, message }));
  }

  /** Dismiss one toast, or all when `id` is omitted. */
  dismiss(id?: number): void {
    const ids = id === undefined ? this.toasts().map((t) => t.id) : [id];
    ids.forEach((i) => this.beginExit(i));
  }

  /** Called by the host when a toast is clicked. */
  tap(t: Toast): void {
    t.onTap?.();
    if (t.dismissible || t.onTap) this.beginExit(t.id);
  }

  private show(
    kind: ToastKind,
    message: string,
    icon: string | undefined,
    opts: ShowOptions,
    progress = 0,
    color?: string,
  ): number {
    const id = this.nextId++;
    const persistent = kind === 'loading' || kind === 'progress';
    const toast: Toast = {
      id,
      kind,
      message,
      icon,
      color,
      progress,
      dismissible: opts.dismissible ?? !persistent,
      exiting: false,
      onTap: opts.onTap,
    };
    if (persistent) this.latestProgressId = id;
    this.toasts.update((list) => [...list, toast]);

    const visible = this.toasts().filter((t) => !t.exiting);
    visible.slice(0, Math.max(0, visible.length - MAX_VISIBLE)).forEach((t) => this.beginExit(t.id));

    if (!persistent) {
      this.timers.set(
        id,
        setTimeout(() => this.beginExit(id), opts.duration ?? 3000),
      );
    }
    return id;
  }

  private beginExit(id: number): void {
    const t = this.toasts().find((x) => x.id === id);
    if (!t || t.exiting) return;
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.patch(id, (x) => ({ ...x, exiting: true }));
    setTimeout(() => {
      this.toasts.update((list) => list.filter((x) => x.id !== id));
      if (this.latestProgressId === id) this.latestProgressId = -1;
    }, EXIT_MS);
  }

  private patch(id: number, fn: (t: Toast) => Toast): void {
    this.toasts.update((list) => list.map((t) => (t.id === id ? fn(t) : t)));
  }
}
