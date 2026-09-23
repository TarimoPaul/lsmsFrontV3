/** Inclusive date range. `end` is normalised to 23:59:59 by the pickers. */
export interface DateRange {
  start: Date;
  end: Date;
}

export type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'custom';

export function dayOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Ranges for the quick presets (Leo, Jana, Wiki Hii, Mwezi Huu, Mwaka Huu). */
export function rangeForPreset(preset: Exclude<DateRangePreset, 'custom'>, now = new Date()): DateRange {
  const today = dayOnly(now);
  switch (preset) {
    case 'today':
      return { start: today, end: endOfDay(now) };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { start: y, end: endOfDay(y) };
    }
    case 'thisWeek': {
      // Monday-first week, as in Flutter (weekday 1 = Monday).
      const weekday = (now.getDay() + 6) % 7;
      return { start: addDays(today, -weekday), end: endOfDay(now) };
    }
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case 'thisYear':
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
  }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `d MMM yyyy` → "5 Sep 2026" */
export function formatDayMonthYear(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** `d MMM` → "5 Sep" */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** `dd MMMM yyyy` → "05 September 2026" */
export function formatLongDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** `MMMM yyyy` → "September 2026" */
export function formatMonthYear(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** `yyyy-MM-dd` — the format the backend expects in query params. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Chip label for a range: single day or "5 Sep – 12 Sep 2026". */
export function formatRangeLabel(range: DateRange): string {
  const sameDay =
    isSameDay(range.start, range.end) || isSameDay(range.start, addDays(range.end, -1));
  return sameDay
    ? formatDayMonthYear(range.start)
    : `${formatDayMonth(range.start)} – ${formatDayMonthYear(range.end)}`;
}
