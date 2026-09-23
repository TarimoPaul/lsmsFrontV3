import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Button } from '../button/button';

export type ApprovalStage = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';

/**
 * Submit → review → approve bar for recon / capex / settings-approval state
 * machines — port of `SharedApprovalActionBar`. Presentational: the parent
 * owns the stage and permission flags. Only the action valid for the current
 * stage is shown, disabled when its capability flag is false.
 */
@Component({
  selector: 'lsms-approval-action-bar',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (stage()) {
      @case ('draft') {
        <button lsmsButton size="sm" icon="send" [disabled]="!canSubmit()" (click)="submit.emit()">
          {{ submitLabel() }}
        </button>
      }
      @case ('submitted') {
        <button lsmsButton size="sm" icon="fact_check" class="info" [disabled]="!canReview()" (click)="review.emit()">
          {{ reviewLabel() }}
        </button>
      }
      @case ('reviewed') {
        @if (showReject()) {
          <button lsmsButton="secondary" size="sm" class="reject" (click)="reject.emit()">{{ rejectLabel() }}</button>
        }
        <button lsmsButton="success" size="sm" icon="check_circle" [disabled]="!canApprove()" (click)="approve.emit()">
          {{ approveLabel() }}
        </button>
      }
    }
  `,
  host: { '[attr.title]': 'disabledReason() ?? null' },
  styles: `
    :host { display: inline-flex; gap: 8px; }
    .info { --btn-bg: var(--c-info); --btn-fg: #fff; }
    button.reject { --btn-fg: var(--c-error); --btn-border: var(--c-error); }
  `,
})
export class ApprovalActionBar {
  readonly stage = input.required<ApprovalStage>();
  readonly canSubmit = input(false);
  readonly canReview = input(false);
  readonly canApprove = input(false);
  readonly showReject = input(true);
  /** Tooltip explaining why an action is disabled. */
  readonly disabledReason = input<string | undefined>(undefined);
  readonly submitLabel = input('Submit');
  readonly reviewLabel = input('Review');
  readonly approveLabel = input('Approve');
  readonly rejectLabel = input('Reject');
  readonly submit = output<void>();
  readonly review = output<void>();
  readonly approve = output<void>();
  readonly reject = output<void>();
}
