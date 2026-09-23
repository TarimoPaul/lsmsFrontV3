import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { parsePermission } from '@core/auth/access-resolver';
import { initials } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { Card, Icon, SearchBar } from '@shared/ui';

/**
 * My profile — who I am, my roles and the permissions my roles grant,
 * grouped by module (handy to verify RBAC after a role change).
 */
@Component({
  selector: 'app-profile-page',
  imports: [Card, Icon, SearchBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <section class="head">
        <span class="avatar">
          @if (auth.user()?.profileImageUrl; as img) {
            <img [src]="img" alt="" />
          } @else {
            {{ userInitials() }}
          }
        </span>
        <div>
          <h1>{{ auth.displayName() }}</h1>
          <p>{{ auth.user()?.email }}</p>
          <div class="chips">
            @for (r of auth.roles(); track r) {
              <span class="chip">{{ r }}</span>
            }
            @if (auth.isRoot()) {
              <span class="chip root"><lsms-icon name="shield" [size]="14" />ROOT</span>
            }
            @if (auth.activeBranch(); as b) {
              <span class="chip branch"><lsms-icon name="storefront" [size]="14" />{{ b.branchName }}</span>
            }
          </div>
        </div>
      </section>

      <lsms-card [title]="i18n.t('My permissions', 'Ruhusa zangu')" icon="key">
        @if (auth.isRoot()) {
          <p class="muted">{{ i18n.t('ROOT users have full access to every module.', 'Watumiaji wa ROOT wana ruhusa kamili kwenye kila moduli.') }}</p>
        }
        @if (auth.permissions().length) {
          <lsms-search-bar [placeholder]="i18n.t('Filter permissions…', 'Chuja ruhusa…')" (search)="filter.set($event)" />
          <div class="groups">
            @for (g of groups(); track g.module) {
              <div class="group">
                <h3>{{ g.module }} <small>{{ g.items.length }}</small></h3>
                <div class="perms">
                  @for (p of g.items; track p) {
                    <code>{{ p }}</code>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (!auth.isRoot()) {
          <p class="muted">{{ i18n.t('No permissions assigned yet.', 'Hakuna ruhusa zilizotolewa bado.') }}</p>
        }
      </lsms-card>
    </div>
  `,
  styles: `
    .wrap { max-width: 1000px; margin: 0 auto; padding: 28px 24px; display: flex; flex-direction: column; gap: 20px; }
    .head { display: flex; align-items: center; gap: 20px; padding: 24px; border-radius: 20px; background: var(--c-surface); border: 1px solid var(--c-border); }
    .avatar { display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 50%; overflow: hidden; flex-shrink: 0; color: #fff; font-size: 1.4rem; font-weight: 800; background: linear-gradient(135deg, var(--c-primary), var(--c-secondary)); }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    h1 { font-size: 1.4rem; font-weight: 800; }
    p { color: var(--c-text-2); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 100px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.4px; color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 10%, transparent); }
    .chip.root { color: var(--c-success); background: color-mix(in srgb, var(--c-success) 12%, transparent); }
    .chip.branch { color: var(--c-text-2); background: var(--c-surface-variant); }
    .muted { margin-bottom: 12px; }
    .groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 14px; }
    .group { padding: 12px; border-radius: 12px; background: var(--c-bg); }
    .group h3 { font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
    .group h3 small { color: var(--c-text-2); font-weight: 600; }
    .perms { display: flex; flex-wrap: wrap; gap: 4px; }
    code { padding: 2px 6px; border-radius: 6px; font-size: 0.7rem; background: var(--c-surface); border: 1px solid var(--c-border); }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LanguageService);
  protected readonly filter = signal('');
  protected readonly userInitials = computed(() => initials(this.auth.user()));

  protected readonly groups = computed(() => {
    const q = this.filter().trim().toUpperCase();
    const map = new Map<string, string[]>();
    for (const p of this.auth.permissions()) {
      if (q && !p.toUpperCase().includes(q)) continue;
      const mod = parsePermission(p)?.module ?? 'other';
      (map.get(mod) ?? map.set(mod, []).get(mod)!).push(p);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, items]) => ({ module, items: items.sort() }));
  });
}
