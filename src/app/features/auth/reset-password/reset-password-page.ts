import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators, passwordRules } from '@shared/forms/validators';
import { Button, Icon, Spinner, TextField } from '@shared/ui';
import { AuthBackground } from '../auth-background';

type State = 'validating' | 'invalid' | 'form' | 'done' | 'network';

/**
 * Reset password from the emailed link — port of Flutter
 * `PasswordResetScreen`. Validates the token first, then collects the new
 * password (same strength rules as registration).
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, AuthBackground, TextField, Button, Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-background />
    <main class="stage">
      <section class="card">
        <div class="brand">
          <span class="mark"><img src="/icons/Finallogo.png" alt="" width="24" height="24" /></span>
          <strong>ELIKOM</strong>
        </div>

        @switch (state()) {
          @case ('validating') {
            <lsms-spinner [centered]="true" [message]="i18n.t('Verifying reset link…', 'Inathibitisha kiungo…')" />
          }
          @case ('invalid') {
            <div class="status">
              <span class="badge err"><lsms-icon name="link_off" [size]="28" /></span>
              <h1>{{ i18n.t('Link expired or invalid', 'Kiungo kimeisha au si sahihi') }}</h1>
              <p>{{ i18n.t('Request a new password reset link and try again.', 'Omba kiungo kipya cha kuweka upya nenosiri kisha ujaribu tena.') }}</p>
              <a lsmsButton routerLink="/login" [queryParams]="{ view: 'forgot' }" [fullWidth]="true">{{ i18n.t('Request new link', 'Omba kiungo kipya') }}</a>
            </div>
          }
          @case ('network') {
            <div class="status">
              <span class="badge warn"><lsms-icon name="wifi_off" [size]="28" /></span>
              <h1>{{ i18n.t('Cannot reach the server', 'Imeshindikana kufikia seva') }}</h1>
              <p>{{ i18n.t('Check your internet connection and try again.', 'Angalia mtandao wako kisha ujaribu tena.') }}</p>
              <button lsmsButton icon="refresh" [fullWidth]="true" (click)="validate()">{{ i18n.t('Retry', 'Jaribu tena') }}</button>
            </div>
          }
          @case ('done') {
            <div class="status">
              <span class="badge ok"><lsms-icon name="check_circle" [size]="28" [filled]="true" /></span>
              <h1>{{ i18n.t('Password Reset Successful', 'Nenosiri limewekwa upya') }}</h1>
              <p>{{ i18n.t('You can now sign in with your new password.', 'Sasa unaweza kuingia kwa nenosiri jipya.') }}</p>
              <a lsmsButton routerLink="/login" trailingIcon="arrow_forward" [fullWidth]="true">{{ i18n.t('Go to sign in', 'Nenda kuingia') }}</a>
            </div>
          }
          @default {
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <h1>{{ i18n.t('Set a new password', 'Weka nenosiri jipya') }}</h1>
              <p class="sub">{{ i18n.t('Choose a strong password you have not used before.', 'Chagua nenosiri imara ambalo hujawahi kulitumia.') }}</p>
              @if (error()) {
                <p class="banner"><lsms-icon name="error" [size]="18" />{{ error() }}</p>
              }
              <lsms-text-field formControlName="password" type="password" [label]="i18n.t('New Password', 'Nenosiri Jipya')" autocomplete="new-password" [autofocus]="true" />
              <ul class="checklist">
                @for (r of rules(); track r.key) {
                  <li [class.ok]="r.ok">
                    <lsms-icon [name]="r.ok ? 'check_circle' : 'radio_button_unchecked'" [size]="14" [filled]="r.ok" />
                    {{ i18n.isSwahili() ? r.sw : r.en }}
                  </li>
                }
              </ul>
              <lsms-text-field formControlName="confirmPassword" type="password" [label]="i18n.t('Confirm Password', 'Thibitisha Nenosiri')" autocomplete="new-password" />
              <button lsmsButton type="submit" size="lg" icon="lock_reset" [fullWidth]="true" [loading]="busy()">
                {{ i18n.t('Reset Password', 'Weka Upya Nenosiri') }}
              </button>
              <a class="back" routerLink="/login">{{ i18n.t('Back to sign in', 'Rudi kuingia') }}</a>
            </form>
          }
        }
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      --field-height: 52px; --field-radius: 12px; --field-padding-x: 16px;
      --field-focus-ring: 3px; --field-focus-alpha: 18%;
    }
    .stage { position: relative; z-index: 1; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 32px 20px; }
    .card {
      width: 100%; max-width: 440px; padding: 32px 28px; border-radius: 24px;
      background: var(--c-card); border: 1px solid var(--c-border);
      box-shadow: 0 24px 50px -6px rgb(0 0 0 / 0.18);
      animation: in 0.4s ease-out both;
    }
    .brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 24px; }
    .brand strong { font-size: 1.125rem; font-weight: 800; letter-spacing: 2px; }
    .mark { display: inline-flex; padding: 9px; border-radius: 12px; background: linear-gradient(135deg, var(--c-primary), var(--c-primary-light)); }
    h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; text-align: center; }
    .sub, .status p { margin: 8px 0 20px; text-align: center; color: var(--c-text-2); font-size: 0.9rem; }
    .status { display: flex; flex-direction: column; align-items: center; }
    .badge { display: inline-flex; padding: 14px; border-radius: 50%; margin-bottom: 16px; }
    .badge.ok { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .badge.err { color: var(--c-error); background: color-mix(in srgb, var(--c-error) 12%, transparent); }
    .badge.warn { color: var(--c-warning); background: color-mix(in srgb, var(--c-warning) 12%, transparent); }
    .banner {
      display: flex; gap: 8px; align-items: center; padding: 10px 12px; margin-bottom: 12px; border-radius: 10px;
      color: var(--c-error); background: color-mix(in srgb, var(--c-error) 8%, transparent); font-size: 0.8rem;
    }
    .checklist { list-style: none; margin: -4px 0 10px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .checklist li { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--c-text-2); }
    .checklist li.ok { color: var(--c-success); }
    .back { display: block; margin-top: 16px; text-align: center; font-size: 0.85rem; font-weight: 600; color: var(--c-primary); }
    @keyframes in { from { opacity: 0; transform: translateY(12px); } }
  `,
})
export class ResetPasswordPage {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly token = input<string | undefined>(undefined);

  protected readonly state = signal<State>('validating');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    password: ['', [LsmsValidators.required('Password'), LsmsValidators.strongPassword()]],
    confirmPassword: ['', [LsmsValidators.required('Confirm password'), LsmsValidators.passwordMatch('password')]],
  });
  private readonly pw = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly rules = computed(() => passwordRules(this.pw() ?? ''));

  ngOnInit(): void {
    this.form.controls.password.valueChanges.subscribe(() =>
      this.form.controls.confirmPassword.updateValueAndValidity({ emitEvent: false }),
    );
    void this.validate();
  }

  protected async validate(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.state.set('validating');
    try {
      this.state.set((await this.auth.validateResetToken(token)) ? 'form' : 'invalid');
    } catch {
      this.state.set('network');
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { password, confirmPassword } = this.form.getRawValue();
      await this.auth.resetPassword(this.token()!, password, confirmPassword);
      this.state.set('done');
    } catch (e) {
      this.error.set(ApiError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
