import { LOW_COVER_DAYS, afterOrder, dailySales, daysLabel, filterCandidates, qtyLabel, slowWarning, slowWords } from './order-math';

const line = (over: Partial<{ stock: number; piecesPerPack: number; velocity: number; seasonFactor: number; packageAbbreviation: string | null }> = {}) => ({
  stock: 45,
  piecesPerPack: 20,
  velocity: 40,
  seasonFactor: 1,
  packageAbbreviation: 'crt' as string | null,
  ...over,
});

describe('order: quantity in the product package', () => {
  it('whole packages + loose pieces, in the product own package', () => {
    expect(qtyLabel(45, line())).toBe('2 crt + 5 pcs');
    expect(qtyLabel(40, line())).toBe('2 crt');
    expect(qtyLabel(60, line({ piecesPerPack: 30, packageAbbreviation: 'CTN' }))).toBe('2 ctn');
  });

  it('less than one package is pieces only; zero is "0 pcs"', () => {
    expect(qtyLabel(7, line())).toBe('7 pcs');
    expect(qtyLabel(0, line())).toBe('0 pcs');
  });

  it('a product without a measure uses the fallback word; without a package size it is pieces', () => {
    expect(qtyLabel(50, line({ packageAbbreviation: null }))).toBe('2 pkg + 10 pcs');
    expect(qtyLabel(50, line({ packageAbbreviation: null }), { pkg: 'pkt', pcs: 'vip' })).toBe('2 pkt + 10 vip');
    expect(qtyLabel(9, line({ piecesPerPack: 1 }))).toBe('9 pcs');
  });

  it('negative system stock keeps its sign; fractions are rounded to whole pieces', () => {
    expect(qtyLabel(-25, line())).toBe('−1 crt + 5 pcs');
    expect(qtyLabel(44.6, line())).toBe('2 crt + 5 pcs');
  });
});

describe('order: "+ Ongeza bidhaa" search', () => {
  const list = [
    { displayName: 'DRY WINE 750ML', productName: 'DRY WINE', category: 'Wine' },
    { displayName: 'CUCA 200ML', productName: 'CUCA', category: 'SPIRIT' },
    { displayName: 'K-VANT 750ML', productName: 'K-VANT', category: 'SPIRIT' },
    { displayName: 'OLD RUM', productName: 'OLD RUM', category: null },
  ];
  const names = (q: string) => filterCandidates(list, q).map((c) => c.displayName);

  it('nothing typed lists everything, in the order given', () => {
    expect(names('')).toEqual(['DRY WINE 750ML', 'CUCA 200ML', 'K-VANT 750ML', 'OLD RUM']);
    expect(names('   ')).toHaveLength(4);
  });

  it('finds by name, any case, and by the unit in the label', () => {
    expect(names('cuca')).toEqual(['CUCA 200ML']);
    expect(names('750')).toEqual(['DRY WINE 750ML', 'K-VANT 750ML']);
  });

  it('finds a whole category', () => {
    expect(names('spirit')).toEqual(['CUCA 200ML', 'K-VANT 750ML']);
  });

  it('every word must match, in any order, across name and category', () => {
    expect(names('wine dry')).toEqual(['DRY WINE 750ML']);
    expect(names('spirit 750')).toEqual(['K-VANT 750ML']);
    expect(names('spirit rum')).toEqual([]);
  });

  it('a product without a category is still found by name', () => {
    expect(names('rum')).toEqual(['OLD RUM']);
  });
});

describe('order: slow-movers warning on a product being added', () => {
  const words = {
    actions: { RETURN_OR_DISCOUNT: 'Rudisha / punguza bei', DISCOUNT: 'Punguza bei', STOP_ORDERING: 'Acha kuagiza' },
    days: (d: string) => `stoki ya siku ${d}`,
    notSelling: 'haijauzwa siku 60',
    value: (v: string) => `thamani ${v}`,
  };
  const money = (v: number) => new Intl.NumberFormat('en-US').format(v);

  it('says what the report advises, the days of stock and the value', () => {
    expect(slowWarning({ slowAction: 'STOP_ORDERING', slowCoverDays: 96, slowValue: 126000 }, words, money)).toBe('Acha kuagiza — stoki ya siku 96.0 · thamani 126,000');
    expect(slowWarning({ slowAction: 'DISCOUNT', slowCoverDays: 140.25, slowValue: 216000 }, words, money)).toBe('Punguza bei — stoki ya siku 140 · thamani 216,000');
  });

  it('a product that sold nothing in 60 days has no days figure', () => {
    expect(slowWarning({ slowAction: 'RETURN_OR_DISCOUNT', slowCoverDays: null, slowValue: 40000 }, words, money)).toBe('Rudisha / punguza bei — haijauzwa siku 60 · thamani 40,000');
  });

  it('the app words say the days are at the 60-day sales, in both languages', () => {
    const sw = slowWords((_en, s) => s);
    const en = slowWords((e) => e);
    const flag = { slowAction: 'STOP_ORDERING' as const, slowCoverDays: 96, slowValue: 126000 };
    expect(slowWarning(flag, sw, money)).toBe('Acha kuagiza — stoki ya siku 96.0 kwa mauzo ya siku 60 · thamani 126,000');
    expect(slowWarning(flag, en, money)).toBe('Stop ordering — stock for 96.0 days at the 60-day sales · value 126,000');
    expect(sw.actions.DISCOUNT).toBe('Punguza bei');
    expect(sw.actions.RETURN_OR_DISCOUNT).toBe('Rudisha / punguza bei');
  });

  it('no verdict, no warning — the product is simply offered', () => {
    expect(slowWarning({ slowAction: null, slowCoverDays: null, slowValue: null }, words, money)).toBeNull();
  });
});

describe('order: a product offered to add shows its stock and the days it lasts', () => {
  const wine = { stock: 14, piecesPerPack: 6, velocity: 0.5, seasonFactor: 1, packageAbbreviation: 'ctn' as string | null };

  it('stock in the product own package, and days at its daily sales', () => {
    expect(qtyLabel(wine.stock, wine)).toBe('2 ctn + 2 pcs');
    expect(afterOrder(wine, 0).days).toBeCloseTo(28, 6);
    // adding 2 cartons: 14 + 12 = 26 pieces → 52 days
    expect(afterOrder(wine, 2)).toEqual({ pieces: 26, days: 52, low: false });
  });

  it('a product with no sales in the 14 days has no days figure', () => {
    expect(afterOrder({ ...wine, velocity: 0 }, 0).days).toBeNull();
  });
});

describe('order: after the order', () => {
  it('stock + order, and the days it lasts at the daily sales', () => {
    // 45 + 5 × 20 = 145 pieces; 40 a day → 3.625 days
    const a = afterOrder(line(), 5);
    expect(a.pieces).toBe(145);
    expect(a.days).toBeCloseTo(3.625, 6);
    expect(a.low).toBe(false);
    expect(qtyLabel(a.pieces, line())).toBe('7 crt + 5 pcs');
  });

  it('follows the quantity the buyer types', () => {
    expect(afterOrder(line(), 0).pieces).toBe(45);
    expect(afterOrder(line(), 1).pieces).toBe(65);
    expect(afterOrder(line(), 2).days).toBeCloseTo(85 / 40, 6);
    // junk input counts as nothing ordered
    expect(afterOrder(line(), NaN).pieces).toBe(45);
    expect(afterOrder(line(), -3).pieces).toBe(45);
    expect(afterOrder(line(), 2.9).pieces).toBe(85);
  });

  it(`warns below ${LOW_COVER_DAYS} days, not at or above it`, () => {
    expect(afterOrder(line({ stock: 59 }), 0).low).toBe(true); // 1.475 days
    expect(afterOrder(line({ stock: 60 }), 0).low).toBe(false); // exactly 1.5
    expect(afterOrder(line({ stock: 0 }), 0)).toEqual({ pieces: 0, days: 0, low: true });
    expect(afterOrder(line({ stock: 0 }), 3).low).toBe(false); // 60 / 40 = 1.5
  });

  it('the season factor raises the daily sales, so the same stock lasts less', () => {
    expect(dailySales(line({ seasonFactor: 1.25 }))).toBe(50);
    expect(afterOrder(line({ stock: 70, seasonFactor: 1.25 }), 0).days).toBeCloseTo(1.4, 6);
    expect(afterOrder(line({ stock: 70, seasonFactor: 1.25 }), 0).low).toBe(true);
    expect(afterOrder(line({ stock: 70, seasonFactor: 1 }), 0).low).toBe(false);
    // a missing factor counts as 1
    expect(dailySales(line({ seasonFactor: 0 }))).toBe(40);
  });

  it('a product that is not selling has no days figure and no warning', () => {
    expect(afterOrder(line({ velocity: 0 }), 2)).toEqual({ pieces: 85, days: null, low: false });
  });

  it('negative system stock covers nothing until the order tops it up', () => {
    const a = afterOrder(line({ stock: -10 }), 0);
    expect(a.pieces).toBe(-10);
    expect(a.days).toBe(0);
    expect(a.low).toBe(true);
    expect(afterOrder(line({ stock: -10 }), 5).pieces).toBe(90);
  });

  it('days are shown with one decimal', () => {
    expect(daysLabel(3.625)).toBe('3.6');
    expect(daysLabel(0)).toBe('0.0');
    expect(daysLabel(0.01)).toBe('0.1');
    expect(daysLabel(1.45)).toBe('1.4');
    expect(daysLabel(123.4)).toBe('123');
  });
});
