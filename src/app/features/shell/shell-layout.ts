import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { BreakpointService } from '@core/layout/breakpoint.service';
import { APP_MODULES, AppModule, findModule } from '@core/navigation/app-modules';
import { ModuleUsageService } from '@core/navigation/module-usage.service';
import { safeStorage } from '@core/utils/safe-storage';
import { DialogService, ToastService } from '@shared/ui';
import { environment } from '../../../environments/environment';
import { BranchPickerData, BranchPickerDialog } from '../auth/branch-picker/branch-picker-dialog';
import { CommandPalette } from './command-palette/command-palette';
import { Sidebar } from './sidebar/sidebar';
import { Topbar } from './topbar/topbar';

export interface PageMeta {
  title: { en: string; sw: string };
  subtitle?: { en: string; sw: string };
}

/**
 * Authenticated app frame — port of Flutter `main_home.dart` shell:
 * sidebar + toolbar + routed content. Desktop (≥1024): persistent sidebar,
 * collapsible 280↔72 (persisted). Smaller: modal drawer.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [MatSidenavContainer, MatSidenav, MatSidenavContent, RouterOutlet, Sidebar, Topbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="shell" [hasBackdrop]="!desktop()" [autosize]="true">
      <mat-sidenav
        class="sidenav"
        [mode]="desktop() ? 'side' : 'over'"
        [opened]="desktop() || drawerOpen()"
        [fixedInViewport]="!desktop()"
        (closedStart)="drawerOpen.set(false)"
      >
        <app-sidebar
          [collapsed]="desktop() && collapsed()"
          [collapsible]="desktop()"
          (toggleCollapse)="toggleCollapse()"
          (navigate)="drawerOpen.set(false)"
          (denied)="showDenied($event)"
        />
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <app-topbar
          class="topbar"
          [title]="pageTitle()"
          [subtitle]="pageSubtitle()"
          [isHome]="isHome()"
          [showMenuButton]="!desktop()"
          (menu)="drawerOpen.set(true)"
          (search)="openPalette()"
          (refresh)="refresh()"
          (switchBranch)="switchBranch()"
          (logout)="logout()"
        />
        <main class="page" id="main">
          <router-outlet />
        </main>
        <footer class="footer">
          <span>© {{ year }} Elikom Group Company Limited</span>
          <span>LSMS v{{ version }}</span>
        </footer>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host { display: block; height: 100dvh; }
    .shell { height: 100%; background: var(--c-bg); }
    .sidenav {
      width: auto; border-right: 0; background: var(--c-sidebar);
      --mat-sidenav-container-shape: 0; --mat-sidenav-container-width: auto;
    }
    .content { display: flex; flex-direction: column; min-height: 100%; }
    .topbar { position: sticky; top: 0; z-index: 20; flex: none; }
    .page { flex: 1; min-width: 0; }
    .footer {
      flex: none;
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
      padding: 14px 24px; font-size: 0.72rem; color: var(--c-text-2);
      border-top: 1px solid var(--c-border);
    }
  `,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ShellLayout {
  private readonly bp = inject(BreakpointService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(LanguageService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly usage = inject(ModuleUsageService);

  protected readonly version = environment.appVersion;
  protected readonly year = new Date().getFullYear();
  protected readonly desktop = computed(() => this.bp.width() >= 1024);
  protected readonly drawerOpen = signal(false);
  protected readonly collapsed = signal(safeStorage.getBool('sidebar_collapsed') ?? false);

  private readonly meta = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentMeta()),
    ),
    { initialValue: this.currentMeta() },
  );
  protected readonly pageTitle = computed(() => this.meta()?.title[this.i18n.lang()] ?? 'LSMS');
  protected readonly pageSubtitle = computed(() => this.meta()?.subtitle?.[this.i18n.lang()]);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isHome = computed(() => this.url().startsWith('/dashboard'));

  constructor() {
    effect(() => safeStorage.set('sidebar_collapsed', this.collapsed()));
    // Count module visits for the dashboard's "Frequently used" row.
    effect(() => {
      const path = this.url().split('?')[0];
      const mod = APP_MODULES.find((m) => path === m.route || path.startsWith(m.route + '/'));
      if (mod) this.usage.track(mod.id);
    });
    // Keep roles/permissions fresh while the app is open (Flutter background verification).
    void this.auth.verify();
  }

  protected toggleCollapse(): void {
    this.collapsed.update((c) => !c);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.openPalette();
    }
  }

  protected openPalette(): void {
    this.dialogs.open(CommandPalette, { size: 'md', ariaLabel: 'Search' });
  }

  protected async refresh(): Promise<void> {
    await this.auth.verify(true);
    // Re-run the current route's components so pages reload their data.
    const url = this.router.url;
    await this.router.navigateByUrl('/', { skipLocationChange: true });
    await this.router.navigateByUrl(url);
    this.toast.info(this.i18n.t('Refreshed', 'Imesasishwa'));
  }

  protected async switchBranch(): Promise<void> {
    const switched = await this.dialogs.openAsync<boolean, BranchPickerData>(BranchPickerDialog, {
      size: 'sm',
      data: { branches: this.auth.branches(), switching: true },
    });
    if (switched) {
      this.toast.success(
        this.i18n.t(`Switched to ${this.auth.activeBranch()?.branchName}`, `Umehamia ${this.auth.activeBranch()?.branchName}`),
      );
      await this.refresh();
    }
  }

  protected async logout(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: this.i18n.t('Sign out?', 'Toka kwenye mfumo?'),
      message: this.i18n.t('You will need to sign in again to continue.', 'Utahitaji kuingia tena ili kuendelea.'),
      confirmText: this.i18n.t('Sign out', 'Toka'),
    });
    if (ok) await this.auth.logout('user');
  }

  protected showDenied(module: AppModule): void {
    void this.dialogs.error(
      this.i18n.t(
        `You don't have permission to access ${module.title.en}. Contact your administrator to request access.`,
        `Huna ruhusa ya kufungua ${module.title.sw}. Wasiliana na msimamizi wako kuomba ruhusa.`,
      ),
      this.i18n.t('Access Denied', 'Ruhusa Imekataliwa'),
    );
  }

  private currentMeta(): PageMeta | undefined {
    let r = this.route.snapshot;
    let meta: PageMeta | undefined;
    while (r) {
      if (r.data['page']) meta = r.data['page'] as PageMeta;
      const section = r.data['section'] as string | undefined;
      const mod = section ? findModule(section) : undefined;
      if (mod) meta = { title: mod.title, subtitle: r.data['hideSubtitle'] ? undefined : mod.description };
      r = r.firstChild!;
    }
    return meta;
  }
}
