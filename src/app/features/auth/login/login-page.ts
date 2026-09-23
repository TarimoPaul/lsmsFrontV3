import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { nameFromEmail } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { sessionStore } from '@core/auth/session-storage';
import { LanguageService } from '@core/i18n/language.service';
import { BreakpointService } from '@core/layout/breakpoint.service';
import { ThemeService } from '@core/theme/theme.service';
import { LsmsValidators, passwordRules } from '@shared/forms/validators';
import { Button, DialogService, Icon, TextField, ToastService } from '@shared/ui';
import { environment } from '../../../../environments/environment';
import { AuthBackground } from '../auth-background';
import { BranchPickerData, BranchPickerDialog } from '../branch-picker/branch-picker-dialog';
import { BrandPanel } from '../brand-panel/brand-panel';

export type AuthView = 'login' | 'register' | 'forgot';

/**
 * Sign-in screen — port of Flutter `LoginScreen`.
 *
 * Wide (≥1040px): a large ELIKOM hero card with the login card floating over
 * its right edge; for register / forgot the two cards swap roles (form moves
 * into the big card, compact branding into the floating one).
 * Narrow: compact brand lockup above a single card.
 *
 * Features kept from Flutter: returning-user mode (remembered email → only
 * password + "use another account"), remember me, caps-lock warning, inline
 * error banner, live password checklist, multi-branch picker, SW/EN toggle.
 */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, NgTemplateOutlet, MatTooltip, AuthBackground, BrandPanel, TextField, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  private readonly bp = inject(BreakpointService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Route query params (withComponentInputBinding). */
  readonly returnUrl = input<string | undefined>(undefined);
  readonly view = input<AuthView | undefined>(undefined);

  protected readonly version = environment.appVersion;
  protected readonly wide = computed(() => this.bp.width() >= 1040);
  protected readonly activeView = signal<AuthView>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly capsLock = signal(false);

  // Returning user (remembered email): show only the password field.
  private readonly savedEmail = signal<string | null>(sessionStore.rememberedEmail());
  protected readonly returningName = computed(() => {
    const e = this.savedEmail();
    return e ? nameFromEmail(e) : null;
  });

  protected readonly loginForm = this.fb.group({
    email: [this.savedEmail() ?? '', [LsmsValidators.required('Email'), LsmsValidators.email()]],
    password: ['', [LsmsValidators.required('Password')]],
    rememberMe: [true],
  });

  protected readonly registerForm = this.fb.group({
    name: ['', [LsmsValidators.required('Full name'), LsmsValidators.personName(), LsmsValidators.fullName()]],
    email: ['', [LsmsValidators.required('Email'), LsmsValidators.email()]],
    password: ['', [LsmsValidators.required('Password'), LsmsValidators.strongPassword()]],
    confirmPassword: ['', [LsmsValidators.required('Confirm password'), LsmsValidators.passwordMatch('password')]],
  });

  protected readonly forgotForm = this.fb.group({
    email: ['', [LsmsValidators.required('Email'), LsmsValidators.email()]],
  });

  private readonly loginValue = toSignal(this.loginForm.valueChanges, { initialValue: this.loginForm.getRawValue() });
  private readonly registerPassword = toSignal(this.registerForm.controls.password.valueChanges, {
    initialValue: '',
  });
  protected readonly canSubmitLogin = computed(() => {
    const v = this.loginValue();
    return !!v.email?.trim() && !!v.password;
  });
  protected readonly passwordChecklist = computed(() => passwordRules(this.registerPassword() ?? ''));

  private readonly passwordField = viewChild<TextField>('passwordField');

  constructor() {
    const reason = this.auth.lastLogoutReason();
    if (reason === 'expired' || reason === 'unauthorized') {
      this.error.set('SESSION_EXPIRED');
    } else if (reason === 'inactivity') {
      this.error.set('INACTIVITY');
    }
    // Keep confirm-password validity in sync when the password changes.
    this.registerForm.controls.password.valueChanges.subscribe(() =>
      this.registerForm.controls.confirmPassword.updateValueAndValidity({ emitEvent: false }),
    );
  }

  ngOnInit(): void {
    const v = this.view();
    if (v === 'register' || v === 'forgot') this.switchView(v);
  }

  // ─── View switching ────────────────────────────────────────────────────────

  protected switchView(view: AuthView): void {
    if (this.activeView() === view) return;
    // Email is shared across the three forms (Flutter used one controller).
    const email =
      this.activeView() === 'login'
        ? this.loginForm.controls.email.value
        : this.activeView() === 'register'
          ? this.registerForm.controls.email.value
          : this.forgotForm.controls.email.value;
    if (email) {
      this.loginForm.controls.email.setValue(email);
      this.registerForm.controls.email.setValue(email);
      this.forgotForm.controls.email.setValue(email);
    }
    this.error.set(null);
    this.activeView.set(view);
  }

  protected useAnotherAccount(): void {
    this.savedEmail.set(null);
    sessionStore.remember(null);
    this.loginForm.patchValue({ email: '', password: '' });
    this.loginForm.markAsUntouched();
  }

  protected onKey(e: KeyboardEvent): void {
    if (typeof e.getModifierState === 'function') this.capsLock.set(e.getModifierState('CapsLock'));
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  protected async login(): Promise<void> {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid || this.busy()) return;
    const { email, password, rememberMe } = this.loginForm.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      const outcome = await this.auth.login(email.trim(), password, rememberMe);
      if (outcome.requiresBranchSelection) {
        const picked = await this.dialogs.openAsync<boolean, BranchPickerData>(BranchPickerDialog, {
          size: 'sm',
          disableClose: true,
          data: { branches: outcome.branches },
        });
        if (!picked) {
          this.auth.cancelPendingLogin();
          return;
        }
      }
      this.toast.success(this.i18n.t(`Welcome, ${this.auth.displayName()}`, `Karibu, ${this.auth.displayName()}`));
      const target = this.returnUrl();
      await this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('/login') ? target : '/dashboard');
    } catch (e) {
      this.error.set(ApiError.from(e).message);
      this.loginForm.controls.password.setValue('');
      this.passwordField()?.focus();
    } finally {
      this.busy.set(false);
    }
  }

  protected async register(): Promise<void> {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid || this.busy()) return;
    const { name, email, password } = this.registerForm.getRawValue();
    this.busy.set(true);
    try {
      await this.auth.register(name, email.trim(), password);
      this.toast.success(
        this.i18n.t(
          'Registration successful! Please wait for admin approval before logging in.',
          'Usajili umefanikiwa! Tafadhali subiri idhini ya msimamizi kabla ya kuingia.',
        ),
        { duration: 5000 },
      );
      this.registerForm.reset({ name: '', email, password: '', confirmPassword: '' });
      this.savedEmail.set(null);
      this.switchView('login');
    } catch (e) {
      const err = ApiError.from(e);
      this.toast.error(
        err.status === 409
          ? this.i18n.t('An account with this email already exists.', 'Akaunti yenye barua pepe hii tayari ipo.')
          : err.message || this.i18n.t('Registration failed. Please try again.', 'Usajili umeshindikana. Tafadhali jaribu tena.'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async forgot(): Promise<void> {
    this.forgotForm.markAllAsTouched();
    if (this.forgotForm.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.requestPasswordReset(this.forgotForm.controls.email.value.trim());
      this.toast.success(
        this.i18n.t(
          'Password reset instructions sent to your email.',
          'Maelekezo ya kuweka upya nenosiri yametumwa kwenye barua pepe yako.',
        ),
      );
      this.switchView('login');
    } catch (e) {
      const err = ApiError.from(e);
      this.toast.error(
        err.isNetwork
          ? this.i18n.t('Cannot connect to server.', 'Imeshindikana kuunganisha na seva.')
          : this.i18n.t(
              'Failed to send reset instructions. Please try again.',
              'Imeshindikana kutuma maelekezo. Tafadhali jaribu tena.',
            ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** Inline banner text for error codes set by AuthService / logout reasons. */
  protected errorText(code: string): string {
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return this.i18n.t(
          'Incorrect email or password. Please try again.',
          'Barua pepe au nenosiri si sahihi. Tafadhali jaribu tena.',
        );
      case 'ACCOUNT_LOCKED':
        return this.i18n.t(
          'Account temporarily locked after too many attempts. Try again in 15 minutes.',
          'Akaunti imefungwa kwa muda baada ya majaribio mengi. Jaribu tena baada ya dakika 15.',
        );
      case 'NETWORK':
        return this.i18n.t(
          'Cannot connect to server — please check your connection.',
          'Imeshindikana kuunganisha na seva — tafadhali angalia mtandao wako.',
        );
      case 'SESSION_EXPIRED':
        return this.i18n.t('Your session has expired. Please sign in again.', 'Muda wa kuingia umeisha. Tafadhali ingia tena.');
      case 'INACTIVITY':
        return this.i18n.t(
          'You were signed out after 30 minutes of inactivity.',
          'Umetolewa kwenye mfumo baada ya dakika 30 bila shughuli.',
        );
      default:
        return code;
    }
  }

  protected isNotice(code: string): boolean {
    return code === 'SESSION_EXPIRED' || code === 'INACTIVITY';
  }
}
