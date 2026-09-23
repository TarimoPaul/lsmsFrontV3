import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '@core/api/api.service';
import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators, passwordRules } from '@shared/forms/validators';
import { Button, Card, Icon, TextField, ToastService } from '@shared/ui';

/** Change password (PUT /api/user/change-password) + session info. */
@Component({
  selector: 'app-security-page',
  imports: [ReactiveFormsModule, Card, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <lsms-card [title]="i18n.t('Change password', 'Badili nenosiri')" icon="password">
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form">
          <lsms-text-field formControlName="currentPassword" type="password" [label]="i18n.t('Current password', 'Nenosiri la sasa')" autocomplete="current-password" />
          <lsms-text-field formControlName="newPassword" type="password" [label]="i18n.t('New password', 'Nenosiri jipya')" autocomplete="new-password" />
          <ul class="checklist">
            @for (r of rules(); track r.key) {
              <li [class.ok]="r.ok"><lsms-icon [name]="r.ok ? 'check_circle' : 'radio_button_unchecked'" [size]="14" [filled]="r.ok" />{{ i18n.isSwahili() ? r.sw : r.en }}</li>
            }
          </ul>
          <lsms-text-field formControlName="confirmPassword" type="password" [label]="i18n.t('Confirm new password', 'Thibitisha nenosiri jipya')" autocomplete="new-password" />
          <div class="actions">
            <button lsmsButton type="submit" icon="lock_reset" [loading]="busy()">{{ i18n.t('Update password', 'Sasisha nenosiri') }}</button>
          </div>
        </form>
      </lsms-card>

      <lsms-card [title]="i18n.t('Session', 'Kipindi')" icon="schedule">
        <dl class="info">
          <dt>{{ i18n.t('Signed in as', 'Umeingia kama') }}</dt><dd>{{ auth.user()?.email }}</dd>
          <dt>{{ i18n.t('Session expires', 'Kipindi kinaisha') }}</dt><dd>{{ expires() }}</dd>
          <dt>{{ i18n.t('Auto sign-out', 'Kutoka otomatiki') }}</dt><dd>{{ i18n.t('After 30 minutes of inactivity', 'Baada ya dakika 30 bila shughuli') }}</dd>
        </dl>
        <button lsmsButton="danger" icon="logout" size="sm" (click)="auth.logout('user')">{{ i18n.t('Sign out now', 'Toka sasa') }}</button>
      </lsms-card>
    </div>
  `,
  styles: `
    .wrap { max-width: 720px; margin: 0 auto; padding: 28px 24px; display: flex; flex-direction: column; gap: 20px; }
    .form { display: flex; flex-direction: column; }
    .actions { display: flex; justify-content: flex-end; margin-top: 8px; }
    .checklist { list-style: none; margin: -4px 0 10px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .checklist li { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--c-text-2); }
    .checklist li.ok { color: var(--c-success); }
    .info { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0 0 16px; font-size: 0.875rem; }
    dt { color: var(--c-text-2); }
    dd { margin: 0; font-weight: 600; }
  `,
})
export class SecurityPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly busy = signal(false);
  protected readonly form = this.fb.group({
    currentPassword: ['', [LsmsValidators.required('Current password')]],
    newPassword: ['', [LsmsValidators.required('New password'), LsmsValidators.strongPassword()]],
    confirmPassword: ['', [LsmsValidators.required('Confirm password'), LsmsValidators.passwordMatch('newPassword')]],
  });
  private readonly pw = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });
  protected readonly rules = computed(() => passwordRules(this.pw() ?? ''));
  protected readonly expires = computed(() => {
    const exp = this.auth.session()?.expiresAt;
    return exp ? new Date(exp).toLocaleString() : '—';
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await this.api.put('/api/user/change-password', { currentPassword, newPassword });
      this.toast.success(this.i18n.t('Password updated', 'Nenosiri limesasishwa'));
      this.form.reset();
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
