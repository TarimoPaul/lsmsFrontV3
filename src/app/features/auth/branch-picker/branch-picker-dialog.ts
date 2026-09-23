import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ApiError } from '@core/api/api.types';
import { BranchInfo } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Icon, Spinner } from '@shared/ui';

export interface BranchPickerData {
  branches: BranchInfo[];
  /** Switching from inside the app (not during login): allows cancelling. */
  switching?: boolean;
}

/**
 * Multi-branch picker — shown when a user belongs to more than one branch
 * (login) or wants to switch branch from the toolbar. Selecting calls
 * `/api/auth/select-branch`, which re-issues the JWT scoped to that branch.
 * Closes with `true` on success.
 */
@Component({
  selector: 'app-branch-picker-dialog',
  imports: [Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selecting()) {
      <div class="busy">
        <lsms-spinner [size]="36" />
        <span>{{ i18n.t('Signing in…', 'Inaingia…') }}</span>
      </div>
    } @else {
      <header>
        <span class="icon"><lsms-icon name="account_tree" [size]="22" /></span>
        <div>
          <h2>{{ i18n.t('Select Branch', 'Chagua Tawi') }}</h2>
          <p>{{ i18n.t('Pick a branch to continue.', 'Chagua tawi la kuendelea nalo.') }}</p>
        </div>
      </header>
      @if (error()) {
        <p class="error"><lsms-icon name="error" [size]="16" />{{ error() }}</p>
      }
      <div class="list">
        @for (b of data.branches; track b.uid) {
          <button type="button" class="tile" [class.current]="b.uid === auth.activeBranchUid()" (click)="pick(b)">
            <lsms-icon [name]="b.isMainBranch ? 'star' : 'storefront'" [size]="22" [filled]="b.isMainBranch" [class.main]="b.isMainBranch" />
            <span class="name">
              {{ b.branchName }}
              @if (b.isMainBranch) {
                <small>{{ i18n.t('Main Branch', 'Tawi Kuu') }}</small>
              }
            </span>
            @if (b.uid === auth.activeBranchUid() && data.switching) {
              <lsms-icon name="check_circle" [size]="20" [filled]="true" class="check" />
            } @else {
              <lsms-icon name="chevron_right" [size]="20" class="chev" />
            }
          </button>
        }
      </div>
      <button type="button" class="cancel" (click)="ref.close(false)">
        {{ data.switching ? i18n.t('Cancel', 'Ghairi') : i18n.t('Cancel sign-in', 'Ghairi kuingia') }}
      </button>
    }
  `,
  styles: `
    :host { display: block; padding: 26px 24px 18px; }
    header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .icon {
      display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;
      border-radius: 13px; color: #fff; background: linear-gradient(135deg, var(--c-primary), var(--c-primary-light));
    }
    h2 { font-size: 1.125rem; font-weight: 700; }
    p { font-size: 0.8rem; color: var(--c-text-2); }
    .list { display: flex; flex-direction: column; gap: 10px; max-height: 50vh; overflow: auto; }
    .tile {
      display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px;
      border-radius: 14px; border: 1px solid var(--c-border); background: var(--c-surface-variant);
      cursor: pointer; text-align: left; color: var(--c-text);
      transition: border-color 0.15s ease, transform 0.15s ease;
    }
    .tile:hover { border-color: var(--c-primary); transform: translateY(-1px); }
    .tile.current { border-color: var(--c-primary); }
    .tile lsms-icon { color: var(--c-primary); }
    .tile lsms-icon.main { color: var(--c-warning); }
    .name { flex: 1; font-weight: 600; font-size: 0.94rem; display: flex; flex-direction: column; }
    .name small { font-size: 0.72rem; font-weight: 600; color: var(--c-warning); }
    .chev { color: var(--c-text-2) !important; }
    .check { color: var(--c-success) !important; }
    .cancel {
      display: block; margin: 16px auto 0; padding: 6px 12px; border: 0; background: none;
      color: var(--c-text-2); font-size: 0.8rem; font-weight: 600; cursor: pointer;
    }
    .cancel:hover { color: var(--c-error); }
    .busy { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 28px 0; color: var(--c-text-2); }
    .error { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; color: var(--c-error); }
  `,
})
export class BranchPickerDialog {
  protected readonly data = inject<BranchPickerData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  protected readonly selecting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async pick(b: BranchInfo): Promise<void> {
    if (this.data.switching && b.uid === this.auth.activeBranchUid()) {
      this.ref.close(false);
      return;
    }
    this.selecting.set(true);
    this.error.set(null);
    try {
      await this.auth.selectBranch(b.uid);
      this.ref.close(true);
    } catch (e) {
      this.error.set(ApiError.from(e).message);
      this.selecting.set(false);
    }
  }
}
