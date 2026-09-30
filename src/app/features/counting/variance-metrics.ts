import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { LanguageService } from '@core/i18n/language.service';
import { Money } from '@shared/utils/money';
import { CountLine, formatQty, formatVariance } from './counting.models';

/** System · Counted · Variance strip — shared by the starter's explanation rows and the approver's lines. */
@Component({
  selector: 'app-variance-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span><small>{{ i18n.t('System', 'Mfumo') }}</small><b>{{ fmt(line().systemQtySnapshot) }}</b></span>
    <span><small>{{ i18n.t('Counted', 'Imehesabiwa') }}</small><b>{{ fmt(line().countedQty) }}</b></span>
    <span class="var" [style.--vc]="color()">
      <small>{{ i18n.t('Variance', 'Tofauti') }}</small>
      <b>{{ variance() }}</b>
      @if (line().varianceValue !== null) { <em>{{ value() }}</em> }
    </span>
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 6px 22px; }
    span { display: flex; flex-direction: column; min-width: 70px; }
    small { font-size: 0.7rem; color: var(--c-text-2); }
    b { font-size: 0.86rem; font-weight: 600; color: var(--c-text); font-variant-numeric: tabular-nums; }
    .var b, .var em { color: var(--vc); }
    em { font-style: normal; font-size: 0.74rem; font-weight: 600; }
  `,
})
export class VarianceMetrics {
  protected readonly i18n = inject(LanguageService);
  readonly line = input.required<CountLine>();

  protected readonly color = computed(() => {
    const v = this.line().varianceQty ?? 0;
    return v < 0 ? 'var(--c-error)' : v > 0 ? 'var(--c-success)' : 'var(--c-text-2)';
  });
  protected readonly variance = computed(() => {
    const l = this.line();
    return formatVariance(l.varianceQty, l.piecesPerPackage, l.packageAbbreviation);
  });
  protected readonly value = computed(() => {
    const v = this.line().varianceValue ?? 0;
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Money.format(Math.abs(v), { decimals: 0 });
  });

  protected fmt(q: number | null): string {
    const l = this.line();
    return formatQty(q, l.piecesPerPackage, l.packageAbbreviation);
  }
}
