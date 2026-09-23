import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Icon } from '@shared/ui';

/**
 * ELIKOM branding panel (blue gradient, sheen, decorative blobs) — port of
 * Flutter `_brandingPanel`. `large` fills the hero card on the login view;
 * `mini` sits in the floating card while the hero hosts register / forgot.
 */
@Component({
  selector: 'app-brand-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i>
    <div class="content">
      <div class="wordmark">
        <span class="mark"><img src="/icons/Finallogo.png" alt="" width="26" height="26" /></span>
        <div>
          <strong>ELIKOM</strong>
          <small>SALES &amp; MANAGEMENT SYSTEM</small>
        </div>
      </div>

      @if (size() === 'large') {
        <span class="trust"><i></i>{{ i18n.t('Secure business management platform', 'Mfumo salama wa usimamizi wa biashara') }}</span>
        <h2 class="headline">
          {{ i18n.t('Manage your business', 'Simamia biashara yako') }}<br />
          {{ i18n.t('with confidence.', 'kwa uhakika.') }}
        </h2>
        <p class="lead">
          {{
            i18n.t(
              'Manage sales, inventory, purchases and business growth from a single platform.',
              'Simamia mauzo, bidhaa, manunuzi na ukuaji wa biashara kutoka jukwaa moja.'
            )
          }}
        </p>
        <ul class="features">
          <li><lsms-icon name="point_of_sale" [size]="18" />{{ i18n.t('Sales & POS', 'Mauzo na POS') }}</li>
          <li><lsms-icon name="inventory_2" [size]="18" />{{ i18n.t('Inventory', 'Hesabu ya mali') }}</li>
          <li><lsms-icon name="balance" [size]="18" />{{ i18n.t('Reconciliation', 'Ulinganisho') }}</li>
          <li><lsms-icon name="analytics" [size]="18" />{{ i18n.t('Reports', 'Ripoti') }}</li>
        </ul>
        <i class="rule"></i>
        <div class="contact">
          <h3>{{ i18n.t('Contact Us', 'Wasiliana Nasi') }}</h3>
          <span><lsms-icon name="mail" [size]="17" />support&#64;elikom.co.tz</span>
          <span><lsms-icon name="call" [size]="17" />+255 7XX XXX XXX</span>
        </div>
      } @else {
        <h2 class="headline mini">
          {{ i18n.t('Welcome to your', 'Karibu kwenye kitovu') }}<br />
          {{ i18n.t('business command center.', 'cha biashara yako.') }}
        </h2>
        <p class="lead mini">
          {{ i18n.t('Sales, inventory, purchases and growth — all in one place.', 'Mauzo, bidhaa, manunuzi na ukuaji — yote mahali pamoja.') }}
        </p>
      }

      <div class="social">
        <a href="https://facebook.com" target="_blank" rel="noopener" aria-label="Facebook">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14.1 2C10.9 2 10 4.4 10 6.3v2.2H8v3.8h2V22h4v-9.7h2.9l.4-3.8H14z"/></svg>
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
        </a>
        <a href="https://wa.me/" target="_blank" rel="noopener" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>
        </a>
      </div>
    </div>
  `,
  host: { '[class.mini]': "size() === 'mini'" },
  styles: `
    :host {
      position: relative;
      display: flex;
      overflow: hidden;
      color: #fff;
      background:
        radial-gradient(135% 135% at 7% 0%, rgb(255 255 255 / 0.12), transparent 60%),
        linear-gradient(135deg, #3b7597 0%, #2c5778 55%, #1e3e5c 100%);
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18);
    }
    :host-context([data-theme='dark']) {
      background:
        radial-gradient(135% 135% at 7% 0%, rgb(255 255 255 / 0.08), transparent 60%),
        linear-gradient(135deg, #0a1628 0%, #13294b 55%, #1c2128 100%);
    }
    .blob { position: absolute; border-radius: 50%; pointer-events: none; }
    .b1 { top: -120px; left: -80px; width: 320px; height: 320px; background: radial-gradient(rgb(255 255 255 / 0.06), transparent 70%); }
    .b2 { bottom: -140px; left: 20px; width: 380px; height: 380px; background: radial-gradient(rgb(255 255 255 / 0.05), transparent 70%); }
    .b3 { top: 90px; left: 210px; width: 180px; height: 180px; background: radial-gradient(rgb(241 228 209 / 0.1), transparent 70%); }
    :host(.mini) .b3 { left: 120px; }

    .content {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      /* Right padding clears the floating card overlapping the hero. */
      padding: 64px 348px 56px 64px;
    }
    :host(.mini) .content { padding: 44px 36px; }

    .wordmark { display: flex; align-items: center; gap: 14px; text-align: left; }
    .mark {
      display: inline-flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; border-radius: 16px;
      background: rgb(255 255 255 / 0.14); border: 1px solid rgb(255 255 255 / 0.22);
    }
    .wordmark strong { display: block; font-size: 1.375rem; font-weight: 800; letter-spacing: 2px; }
    .wordmark small { font-size: 0.6rem; font-weight: 600; letter-spacing: 1.6px; color: rgb(255 255 255 / 0.65); }

    .trust {
      display: inline-flex; align-items: center; gap: 9px; margin-top: 56px;
      padding: 8px 14px; border-radius: 100px;
      background: rgb(255 255 255 / 0.12); border: 1px solid rgb(255 255 255 / 0.2);
      font-size: 0.75rem; font-weight: 600; color: rgb(255 255 255 / 0.88);
    }
    .trust i { width: 7px; height: 7px; border-radius: 50%; background: #66bb6a; box-shadow: 0 0 0 4px rgb(102 187 106 / 0.25); }

    .headline { margin-top: 22px; font-size: 2.5rem; line-height: 1.18; font-weight: 800; letter-spacing: -1px; }
    .headline.mini { margin-top: 30px; font-size: 1.5rem; line-height: 1.22; letter-spacing: -0.6px; }
    .lead { margin-top: 20px; font-size: 1.03rem; line-height: 1.6; color: rgb(255 255 255 / 0.8); max-width: 420px; }
    .lead.mini { margin-top: 14px; font-size: 0.9rem; }

    .features { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 28px 0 0; padding: 0; list-style: none; }
    .features li {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px;
      background: rgb(255 255 255 / 0.08); font-size: 0.78rem; font-weight: 600; color: rgb(255 255 255 / 0.9);
    }
    .rule { display: block; width: 56px; height: 2px; margin: 32px 0 24px; border-radius: 2px; background: rgb(255 255 255 / 0.28); }
    .contact { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .contact h3 { font-size: 0.875rem; font-weight: 700; letter-spacing: 0.4px; }
    .contact span { display: inline-flex; align-items: center; gap: 10px; font-size: 0.875rem; color: rgb(255 255 255 / 0.85); }
    .contact lsms-icon { color: rgb(255 255 255 / 0.75); }

    .social { display: flex; gap: 12px; margin-top: 26px; }
    .social a {
      display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px;
      border-radius: 12px; color: #fff; background: rgb(255 255 255 / 0.12); border: 1px solid rgb(255 255 255 / 0.18);
      transition: background-color 0.15s ease, transform 0.15s ease;
    }
    .social a:hover { background: rgb(255 255 255 / 0.22); transform: translateY(-2px); }
  `,
})
export class BrandPanel {
  protected readonly i18n = inject(LanguageService);
  readonly size = input<'large' | 'mini'>('large');
}
