import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '@core/api/api.service';
import { ApiError } from '@core/api/api.types';
import { initials } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { LsmsValidators } from '@shared/forms/validators';
import { Button, Card, TextField, ToastService } from '@shared/ui';

interface Profile {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
  gender: string | null;
}

const PHOTO_PX = 256;

/** Downscale to a PHOTO_PX square JPEG — a phone photo (3–5 MB) becomes ~20–40 KB. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PHOTO_PX;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
}

/**
 * My details + photo (Flutter `user_profile_section`). Users edit only their own
 * name, phone and gender (the server ignores anything else). Photos are cropped to
 * a square and shrunk in the browser, then stored server-side in the database
 * (V123) — Flutter's uploads lived on the container disk and vanished on deploy.
 */
@Component({
  selector: 'app-profile-details',
  imports: [ReactiveFormsModule, Card, TextField, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lsms-card [title]="i18n.t('My details', 'Taarifa zangu')" icon="badge">
      <div class="photo">
        <span class="avatar">
          @if (photo(); as img) {
            <img [src]="img" alt="" (error)="broken.set(img)" />
          } @else {
            {{ userInitials() }}
          }
        </span>
        <div>
          <input #file type="file" accept="image/*" hidden (change)="upload($any($event.target))" />
          <button lsmsButton="secondary" size="sm" icon="photo_camera" [loading]="uploading()" (click)="file.click()">{{ i18n.t('Change photo', 'Badilisha picha') }}</button>
          <small>{{ i18n.t('Square crop, saved small. JPG or PNG up to 5 MB.', 'Inakatwa mraba na kuhifadhiwa ndogo. JPG au PNG hadi MB 5.') }}</small>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="grid">
          <lsms-text-field formControlName="firstName" [label]="i18n.t('First name', 'Jina la kwanza')" prefixIcon="person" [required]="true" [maxLength]="50" />
          <lsms-text-field formControlName="lastName" [label]="i18n.t('Last name', 'Jina la mwisho')" prefixIcon="person" [required]="true" [maxLength]="50" />
          <lsms-text-field formControlName="phoneNumber" type="tel" [label]="i18n.t('Phone', 'Simu')" prefixIcon="call" placeholder="07xx xxx xxx" />
          <div class="gender">
            <span class="lbl">{{ i18n.t('Gender', 'Jinsia') }}</span>
            <div class="seg">
              @for (g of genders; track g.value) {
                <button type="button" [class.on]="form.controls.gender.value === g.value" (click)="form.controls.gender.setValue(g.value); form.markAsDirty()">{{ i18n.t(g.en, g.sw) }}</button>
              }
            </div>
          </div>
        </div>
        <div class="acts">
          <span class="muted">{{ email() }}</span>
          <button lsmsButton="primary" size="sm" icon="save" type="submit" [disabled]="form.pristine || form.invalid" [loading]="saving()">{{ i18n.t('Save', 'Hifadhi') }}</button>
        </div>
      </form>
    </lsms-card>
  `,
  styles: `
    .photo { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
    .photo small { display: block; margin-top: 6px; font-size: 0.72rem; color: var(--c-text-2); }
    .avatar { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; overflow: hidden; flex-shrink: 0; color: #fff; font-size: 1.2rem; font-weight: 800; background: linear-gradient(135deg, var(--c-primary), var(--c-secondary)); }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
    .gender { display: flex; flex-direction: column; gap: 6px; }
    .lbl { font-size: 0.8rem; font-weight: 600; color: var(--c-text-2); }
    .seg { display: inline-flex; gap: 6px; }
    .seg button { padding: 8px 16px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); font: inherit; font-size: 0.85rem; cursor: pointer; }
    .seg button.on { border-color: var(--c-primary); color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 8%, var(--c-surface)); font-weight: 600; }
    .acts { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
    .muted { color: var(--c-text-2); font-size: 0.82rem; overflow-wrap: anywhere; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class ProfileDetails {
  protected readonly i18n = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly genders = [
    { value: 'MALE', en: 'Male', sw: 'Mwanaume' },
    { value: 'FEMALE', en: 'Female', sw: 'Mwanamke' },
  ];
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly broken = signal<string | null>(null);
  protected readonly email = signal('');
  protected readonly userInitials = computed(() => initials(this.auth.user()));
  protected readonly photo = computed(() => {
    const url = this.auth.user()?.profileImageUrl;
    return url && url !== this.broken() ? url : null;
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [LsmsValidators.required('First name'), LsmsValidators.minLength(2, 'First name'), LsmsValidators.maxLength(50, 'First name')]],
    lastName: ['', [LsmsValidators.required('Last name'), LsmsValidators.minLength(2, 'Last name'), LsmsValidators.maxLength(50, 'Last name')]],
    phoneNumber: ['', [LsmsValidators.phone()]],
    gender: [''],
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const p = await this.api.get<Profile>('/api/user/profile');
      this.email.set(p.email);
      this.form.reset({ firstName: p.firstName ?? '', lastName: p.lastName ?? '', phoneNumber: p.phoneNumber ?? '', gender: p.gender ?? '' });
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.api.put('/api/user/profile', {
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        phoneNumber: v.phoneNumber.trim() || null,
        email: this.email(),
        gender: v.gender || null,
      });
      await this.auth.verify(true);
      this.form.markAsPristine();
      this.toast.success(this.i18n.t('Profile saved', 'Taarifa zimehifadhiwa'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      this.toast.error(this.i18n.t('Choose an image up to 5 MB.', 'Chagua picha isiyozidi MB 5.'));
      return;
    }
    this.uploading.set(true);
    try {
      const small = await toSquareJpeg(file);
      const body = new FormData();
      body.append('file', small, 'photo.jpg');
      await this.api.post('/api/user/profile-image', body);
      await this.auth.verify(true);
      this.toast.success(this.i18n.t('Photo updated', 'Picha imebadilishwa'));
    } catch (e) {
      this.toast.error(ApiError.from(e).message || this.i18n.t('Could not upload the photo', 'Imeshindikana kupakia picha'));
    } finally {
      this.uploading.set(false);
    }
  }
}
