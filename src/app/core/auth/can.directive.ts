import { Directive, TemplateRef, ViewContainerRef, computed, effect, inject, input } from '@angular/core';

import { CrudAction } from './access-resolver';
import { AuthService } from './auth.service';

/**
 * Structural permission check — replaces Flutter `ProtectedWidget` /
 * `SharedPermissionWrapper`.
 *
 *   <button *lsmsCan="'SALES_CREATE'">New sale</button>              any-of permission(s)
 *   <button *lsmsCan="['USER_UPDATE', 'USER_RESET_PASSWORD']">…</button>
 *   <div *lsmsCan="'sales'; action: 'delete'">…</div>                module CRUD
 *   <div *lsmsCan="'SALES_VIEW_PROFIT'; else noAccess">…</div>
 */
@Directive({ selector: '[lsmsCan]' })
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef);
  private readonly vcr = inject(ViewContainerRef);

  readonly lsmsCan = input.required<string | string[]>();
  /** When set, `lsmsCan` is a module / section and this is the CRUD action. */
  readonly lsmsCanAction = input<CrudAction | undefined>(undefined);
  readonly lsmsCanElse = input<TemplateRef<unknown> | undefined>(undefined);

  private readonly allowed = computed(() => {
    const target = this.lsmsCan();
    const action = this.lsmsCanAction();
    if (action && typeof target === 'string') return this.auth.can(target, action);
    return this.auth.hasAnyPermission(Array.isArray(target) ? target : [target]);
  });

  constructor() {
    effect(() => {
      this.vcr.clear();
      if (this.allowed()) this.vcr.createEmbeddedView(this.tpl);
      else if (this.lsmsCanElse()) this.vcr.createEmbeddedView(this.lsmsCanElse()!);
    });
  }
}
