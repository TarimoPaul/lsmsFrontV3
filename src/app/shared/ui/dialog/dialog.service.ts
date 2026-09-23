import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LanguageService } from '../../../core/i18n/language.service';
import { ConfirmDialog, ConfirmDialogData, ConfirmKind } from './confirm-dialog';

/**
 * Dialog sizes — port of Flutter `FormDialogSizing`:
 *  - `sm`       compact notices / pickers (max 400px)
 *  - `md`       standard form: 90% phone, 80% (≤600px) tablet, 700px desktop
 *  - `lg`       expanded form (purchase-style), up to 90vh tall
 *  - `full`     near-fullscreen workspace
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'full';

export interface OpenDialogOptions<D> {
  data?: D;
  size?: DialogSize;
  /** Block closing with Escape / backdrop click (e.g. unsaved forms). */
  disableClose?: boolean;
  ariaLabel?: string;
}

const SIZES: Record<DialogSize, { width: string; maxWidth: string; maxHeight: string }> = {
  sm: { width: '92vw', maxWidth: '400px', maxHeight: '90vh' },
  md: { width: '90vw', maxWidth: '700px', maxHeight: '85vh' },
  lg: { width: '92vw', maxWidth: '960px', maxHeight: '90vh' },
  full: { width: '96vw', maxWidth: '1400px', maxHeight: '94vh' },
};

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly i18n = inject(LanguageService);

  open<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    opts: OpenDialogOptions<D> = {},
  ): DialogRef<R, C> {
    const size = SIZES[opts.size ?? 'md'];
    return this.dialog.open<R, D, C>(component, {
      data: opts.data,
      width: size.width,
      maxWidth: size.maxWidth,
      maxHeight: size.maxHeight,
      disableClose: opts.disableClose,
      ariaLabel: opts.ariaLabel,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      panelClass: 'lsms-dialog-panel',
      backdropClass: 'lsms-dialog-backdrop',
    });
  }

  /** Resolve with the dialog's close result (undefined when dismissed). */
  openAsync<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    opts: OpenDialogOptions<D> = {},
  ): Promise<R | undefined> {
    return firstValueFrom(this.open<R, D, C>(component, opts).closed);
  }

  confirm(opts: { title: string; message: string; confirmText?: string; cancelText?: string }): Promise<boolean> {
    return this.show('confirm', {
      ...opts,
      confirmText: opts.confirmText ?? this.i18n.t('Confirm', 'Thibitisha'),
      cancelText: opts.cancelText ?? this.i18n.t('Cancel', 'Ghairi'),
    });
  }

  /** Destructive confirmation (red icon + danger button). */
  confirmDelete(opts: { title: string; message: string; confirmText?: string; cancelText?: string }): Promise<boolean> {
    return this.show('delete', {
      ...opts,
      confirmText: opts.confirmText ?? this.i18n.t('Delete', 'Futa'),
      cancelText: opts.cancelText ?? this.i18n.t('Cancel', 'Ghairi'),
    });
  }

  async error(message: string, title = this.i18n.t('Error', 'Hitilafu')): Promise<void> {
    await this.show('error', { title, message, confirmText: 'OK' });
  }

  async success(message: string, title = this.i18n.t('Success', 'Imefanikiwa')): Promise<void> {
    await this.show('success', { title, message, confirmText: 'OK' });
  }

  closeAll(): void {
    this.dialog.closeAll();
  }

  private async show(kind: ConfirmKind, d: Omit<ConfirmDialogData, 'kind'>): Promise<boolean> {
    const result = await this.openAsync<boolean, ConfirmDialogData>(ConfirmDialog, {
      size: 'sm',
      data: { kind, ...d },
    });
    return result === true;
  }
}
