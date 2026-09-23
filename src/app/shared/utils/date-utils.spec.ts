import { endOfDay, formatRangeLabel, rangeForPreset, toIsoDate } from './date-utils';

describe('date-utils', () => {
  // Wednesday 16 Sep 2026, 14:30
  const now = new Date(2026, 8, 16, 14, 30);

  it('today / yesterday presets span whole days', () => {
    const today = rangeForPreset('today', now);
    expect(today.start).toEqual(new Date(2026, 8, 16));
    expect(today.end).toEqual(new Date(2026, 8, 16, 23, 59, 59));

    const y = rangeForPreset('yesterday', now);
    expect(y.start).toEqual(new Date(2026, 8, 15));
    expect(y.end).toEqual(new Date(2026, 8, 15, 23, 59, 59));
  });

  it('thisWeek starts on Monday', () => {
    expect(rangeForPreset('thisWeek', now).start).toEqual(new Date(2026, 8, 14));
    // Sunday belongs to the week that started the previous Monday.
    expect(rangeForPreset('thisWeek', new Date(2026, 8, 20)).start).toEqual(new Date(2026, 8, 14));
  });

  it('thisMonth / thisYear start on the first day', () => {
    expect(rangeForPreset('thisMonth', now).start).toEqual(new Date(2026, 8, 1));
    expect(rangeForPreset('thisYear', now).start).toEqual(new Date(2026, 0, 1));
  });

  it('formats labels and ISO dates', () => {
    expect(formatRangeLabel({ start: new Date(2026, 8, 16), end: endOfDay(new Date(2026, 8, 16)) })).toBe(
      '16 Sep 2026',
    );
    expect(formatRangeLabel({ start: new Date(2026, 8, 1), end: new Date(2026, 8, 22) })).toBe(
      '1 Sep – 22 Sep 2026',
    );
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
