import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
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
 * collapsible 280↔72 (persisted), toolbar + page in a full-height panel whose
 * left edge is rounded against the sidebar. Smaller: modal drawer, full-bleed panel.
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

      <mat-sidenav-content class="content" [class.inset]="desktop()">
        <div class="panel">
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
          @if (theme.ambientMotion() && isHome()) {
            <div class="bubbles" aria-hidden="true">
              @for (b of bubbles; track $index) {
                <i [style.left.%]="b.x" [style.top.%]="b.y" [style.--r.px]="b.r" [style.animation-delay.s]="-b.phase * 28"></i>
              }
            </div>
          }
          <div class="scroll" #scroller>
            <main class="page" id="main">
              <router-outlet />
            </main>
            <footer class="footer">
              <span>© {{ year }} Elikom Group Company Limited</span>
              <span>LSMS v{{ version }}</span>
            </footer>
          </div>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host { display: block; height: 100dvh; }
    /* Frame in the sidebar colour, visible behind the panel's rounded left corners. */
    .shell { height: 100%; background: var(--c-sidebar-bg), var(--c-sidebar); }
    .sidenav {
      width: auto; border-right: 0; background: var(--c-sidebar-bg), var(--c-sidebar);
      --mat-sidenav-container-shape: 0; --mat-sidenav-container-width: auto;
    }
    .content { overflow: hidden; background: transparent; }
    /* Flutter main_home: sky blue easing towards the off-white surface (never pure white). */
    .panel {
      display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden;
      background: linear-gradient(180deg, var(--c-bg) 0%, color-mix(in srgb, var(--c-bg) 55%, var(--c-surface)) 100%);
    }
    /* Fills the page edge to edge; only the side meeting the sidebar is rounded. */
    .inset .panel {
      border-radius: 20px 0 0 20px;
      box-shadow: -4px 0 16px rgb(0 0 0 / 0.16);
    }
    :host-context([data-theme='dark']) .inset .panel {
      box-shadow: -1px 0 0 var(--c-border), -6px 0 24px rgb(0 0 0 / 0.4);
    }
    .panel { position: relative; }
    .topbar { flex: none; z-index: 20; }
    .scroll { position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }

    /* Floating bubbles behind the page — port of Flutter main_menu _FloatingShapesPainter
       (7 primary-tinted circles, 4% light / 6% dark, 20s drift of ±20px × ±15px). */
    .bubbles { position: absolute; inset: 72px 0 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .bubbles i {
      position: absolute; width: calc(var(--r) * 2); height: calc(var(--r) * 2);
      margin: calc(var(--r) * -1) 0 0 calc(var(--r) * -1); border-radius: 50%;
      /* Soft lit sphere: primary core fading out, a hint of the secondary blue at the rim. */
      background: radial-gradient(circle at 35% 30%,
        color-mix(in srgb, var(--c-primary) 9%, transparent) 0%,
        color-mix(in srgb, var(--c-secondary) 5%, transparent) 55%,
        transparent 72%);
      animation: bubble-drift 28s ease-in-out infinite;
    }
    :host-context([data-theme='dark']) .bubbles i { background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c-primary) 10%, transparent) 0%, transparent 70%); }
    @keyframes bubble-drift {
      0% { transform: translate(0, 15px); }
      12.5% { transform: translate(14px, 10.6px); }
      25% { transform: translate(20px, 0); }
      37.5% { transform: translate(14px, -10.6px); }
      50% { transform: translate(0, -15px); }
      62.5% { transform: translate(-14px, -10.6px); }
      75% { transform: translate(-20px, 0); }
      87.5% { transform: translate(-14px, 10.6px); }
      100% { transform: translate(0, 15px); }
    }
    @media (prefers-reduced-motion: reduce) { .bubbles i { animation: none; } }
    .page { flex: 1 0 auto; min-width: 0; }
    .footer {
      flex: none;
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
      padding: 14px 32px; font-size: 0.72rem; color: var(--c-text-2);
      border-top: 1px solid var(--c-border);
    }
    @media (max-width: 767px) { .footer { padding: 14px 16px; } }
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
  protected readonly theme = inject(ThemeService);

  protected readonly version = environment.appVersion;
  /** Flutter `_ShapeData(baseX, baseY, radius, phaseOffset)` — positions in % of the panel. */
  protected readonly bubbles = [
    { x: 10, y: 15, r: 80, phase: 0 },
    { x: 85, y: 10, r: 60, phase: 0.2 },
    { x: 70, y: 70, r: 100, phase: 0.4 },
    { x: 15, y: 80, r: 50, phase: 0.6 },
    { x: 50, y: 40, r: 70, phase: 0.8 },
    { x: 90, y: 50, r: 45, phase: 0.3 },
    { x: 30, y: 55, r: 55, phase: 0.7 },
  ];
  protected readonly year = new Date().getFullYear();
  protected readonly desktop = computed(() => this.bp.width() >= 1024);
  protected readonly drawerOpen = signal(false);
  protected readonly collapsed = signal(safeStorage.getBool('sidebar_collapsed') ?? false);
  /** The panel scrolls (not the window), so the router's scroll restoration can't reach it. */
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

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
      this.scroller()?.nativeElement.scrollTo({ top: 0 });
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
