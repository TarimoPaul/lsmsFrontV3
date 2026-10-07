import { packUnit } from '@shared/utils/product-label';
import { packagesLabel } from '../store/store.models';
import { OrderCandidate, OrderLine, OrderSlowAction, SlowWarning } from './order.models';

/**
 * Display arithmetic of the order screen — pure, so it is unit-tested. None of
 * it changes the order: the packages still come from the backend formula; this
 * only tells the buyer what the shelf looks like before and after buying.
 */

/** Below this many days of stock after the order, the line is flagged. */
export const LOW_COVER_DAYS = 1.5;

/** Language-dependent words; callers pass `i18n.t(...)` results. */
export interface QtyWords {
  /** Stands in for the abbreviation of a product without a measure. Default "pkg". */
  pkg?: string;
  /** Default "pcs". */
  pcs?: string;
}

type Sized = Pick<OrderLine, 'piecesPerPack' | 'packageAbbreviation'>;

/**
 * Pieces in the product's own package: "3 crt + 5 pcs" — the same formatter Store,
 * POS and the stock reports use (`packagesLabel`). Whole pieces only.
 */
export function qtyLabel(pieces: number, l: Sized, words: QtyWords = {}): string {
  return packagesLabel(Math.round(pieces), l.piecesPerPack, packUnit(l.packageAbbreviation, words.pkg), words.pcs ?? 'pcs');
}

/**
 * Pieces expected to sell per day in the days the order covers: the 14-day
 * velocity times the season factor — the same daily figure the target is built on.
 */
export function dailySales(l: Pick<OrderLine, 'velocity' | 'seasonFactor'>): number {
  const season = l.seasonFactor > 0 ? l.seasonFactor : 1;
  return Math.max(0, l.velocity) * season;
}

export interface AfterOrder {
  /** Stock + what the order adds. */
  pieces: number;
  /** How long that lasts at the expected daily sales; null when the product is not selling. */
  days: number | null;
  /** Lasts less than {@link LOW_COVER_DAYS}. */
  low: boolean;
}

/** What is on the shelf once `packs` packages arrive, and how many days it covers. */
export function afterOrder(l: Pick<OrderLine, 'stock' | 'piecesPerPack' | 'velocity' | 'seasonFactor'>, packs: number): AfterOrder {
  const added = Math.max(0, Math.floor(packs) || 0) * Math.max(1, l.piecesPerPack);
  const pieces = l.stock + added;
  const daily = dailySales(l);
  // Negative system stock cannot be sold: it covers nothing until the order tops it up.
  const days = daily > 0 ? Math.max(0, pieces) / daily : null;
  return { pieces, days, low: days !== null && days < LOW_COVER_DAYS };
}

// ── "+ Ongeza bidhaa" ─────────────────────────────────────────────────────────

const fold = (v: string | null | undefined) => (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The products matching what the buyer typed: every word must be in the name or the
 * category (any order, any case), so "wine dry" finds "DRY WINE 750ML" and "spirit"
 * lists the whole category. Nothing typed = everything, in the order given.
 */
export function filterCandidates<T extends Pick<OrderCandidate, 'displayName' | 'productName' | 'category'>>(list: readonly T[], query: string): T[] {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return [...list];
  return list.filter((c) => {
    const hay = `${fold(c.displayName)} ${fold(c.productName)} ${fold(c.category)}`;
    return words.every((w) => hay.includes(w));
  });
}

/** Language-dependent words of the slow-movers warning; callers pass `i18n.t(...)` results. */
export interface SlowWords {
  actions: Record<OrderSlowAction, string>;
  /** "stock for {days} days" with the figure already in it. */
  days: (days: string) => string;
  /** Shown instead of the days when nothing was sold in the 60 days. */
  notSelling: string;
  /** "value {money}" with the figure already in it. */
  value: (money: string) => string;
}

/**
 * The words of the warning in the current language (`t` = `i18n.t`). The days are the
 * slow-movers report's — stock ÷ the sales of the last 60 days — and say so, because the
 * line beside them shows days at the 14-day sales the order works with.
 */
export function slowWords(t: (en: string, sw: string) => string): SlowWords {
  return {
    actions: {
      RETURN_OR_DISCOUNT: t('Return / cut price', 'Rudisha / punguza bei'),
      DISCOUNT: t('Cut price', 'Punguza bei'),
      STOP_ORDERING: t('Stop ordering', 'Acha kuagiza'),
    },
    days: (d) => t(`stock for ${d} days at the 60-day sales`, `stoki ya siku ${d} kwa mauzo ya siku 60`),
    notSelling: t('nothing sold in 60 days', 'haijauzwa siku 60'),
    value: (v) => t(`value ${v}`, `thamani ${v}`),
  };
}

/**
 * The warning on a product the slow-movers report marks as stuck:
 * "Acha kuagiza — stoki ya siku 96 · thamani 126,000". Null when it has none.
 * It informs the buyer; it never stops the product being added.
 */
export function slowWarning(w: SlowWarning, words: SlowWords, money: (v: number) => string): string | null {
  if (!w.slowAction) return null;
  const facts = [
    w.slowCoverDays === null ? words.notSelling : words.days(daysLabel(w.slowCoverDays)),
    w.slowValue === null ? '' : words.value(money(w.slowValue)),
  ].filter(Boolean);
  return `${words.actions[w.slowAction]} — ${facts.join(' · ')}`;
}

/** "2.3" — one decimal, never "0.0" for something that is not zero. */
export function daysLabel(days: number): string {
  if (days > 0 && days < 0.05) return '0.1';
  return days >= 100 ? String(Math.round(days)) : days.toFixed(1);
}
