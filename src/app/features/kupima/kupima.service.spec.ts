import { barFraction, needsOpen, normalizePour, normalizeProfitRow, openableStock, pourLevel, priceFor } from './kupima.service';

describe('KUPIMA (ef/ek)', () => {
  const raw = {
    productUid: 'K',
    productName: 'KONYAGI YA KUPIMA',
    containerName: 'chupa',
    containerMl: 750,
    parentProductUid: 'P',
    parentName: 'KONYAGI 750ML',
    parentAvgCost: '10250.00',
    parentStock: 8,
    measures: [
      { uid: 'm30', ml: 30, price: '1000.00', cost: '410.00' },
      { uid: 'm60', ml: 60, price: '2000.00', cost: '820.00' },
    ],
    open: { uid: 'c1', referenceNumber: 'CHM-1', containerMl: 750, mlLeft: '375.00', costPerMl: '13.666667' },
  };

  it('normalizes the server row (numbers from strings, the open container)', () => {
    const p = normalizePour(raw);
    expect(p.measures.map((m) => [m.ml, m.price, m.cost])).toEqual([[30, 1000, 410], [60, 2000, 820]]);
    expect(p.open?.mlLeft).toBe(375);
    expect(p.parentAvgCost).toBe(10250);
  });

  it('the bar is ml left minus what the cart already holds, over the container (0..1)', () => {
    const p = normalizePour(raw);
    expect(barFraction(p)).toBe(0.5);
    expect(barFraction(p, 75)).toBe(0.4);
    expect(barFraction(p, 1000)).toBe(0);
    expect(barFraction({ ...p, open: null })).toBe(0);
  });

  it('(hq 4) bar colour by what is left: >=50% ok, 20-50% mid, <20% or <= 2 x biggest measure low, 0 / none empty', () => {
    const p = normalizePour(raw); // 750 ml, measures 30 / 60
    const at = (ml: number) => pourLevel({ ...p, open: { ...p.open!, mlLeft: ml } });
    expect(at(750)).toBe('ok');
    expect(at(375)).toBe('ok');
    expect(at(374)).toBe('mid');
    expect(at(150)).toBe('mid');
    expect(at(149)).toBe('low');
    expect(at(30)).toBe('low');
    expect(at(0)).toBe('empty');
    expect(pourLevel({ ...p, open: null })).toBe('empty');
    // the cart counts: 375 left, 300 in the cart -> 75 (10%) -> low
    expect(pourLevel(p, 300)).toBe('low');
    // "not % only": a small container (200 ml, 50 ml measure) at 100 ml (50%) is only 2 measures -> low
    const small = normalizePour({ ...raw, containerMl: 200, measures: [{ uid: 'm50', ml: 50, price: '2000' }], open: { ...raw.open, containerMl: 200, mlLeft: '100' } });
    expect(pourLevel(small)).toBe('low');
    // wine 5 L, 70 / 80 ml: 2 x 80 = 160 ml is under 20% anyway; 1,200 ml (24%) -> mid
    const wine = normalizePour({ ...raw, containerMl: 5000, measures: [{ uid: 'a', ml: 70, price: '2000' }, { uid: 'b', ml: 80, price: '3000' }], open: { ...raw.open, containerMl: 5000, mlLeft: '1200' } });
    expect(pourLevel(wine)).toBe('mid');
  });

  it('(hq 3) "Fungua chupa": nothing open or 0 ml; the bottles to open = the parents stock together', () => {
    const p = normalizePour(raw);
    expect(needsOpen(p)).toBe(false);
    expect(needsOpen({ ...p, open: null })).toBe(true);
    expect(needsOpen({ ...p, open: { ...p.open!, mlLeft: 0 } })).toBe(true);
    expect(openableStock(p)).toBe(8); // no parents listed -> parentStock
    const two = normalizePour({ ...raw, parents: [{ uid: 'G', name: 'GREPA', stock: 2, prices: [] }, { uid: 'M', name: 'MA-LOT', stock: 3, prices: [] }] });
    expect(openableStock(two)).toBe(5);
    expect(openableStock({ ...two, parents: two.parents.map((x) => ({ ...x, stock: 0 })) })).toBe(0);
  });

  it('es/eu: parents with their own prices; priceFor = own price, else the base', () => {
    const p = normalizePour({
      ...raw,
      measures: [{ uid: 'm70', ml: 70, price: '2500.00', basePrice: '2000.00', cost: null }],
      parents: [
        { uid: 'G', name: 'GREPA WINE', avgCost: '25000', stock: 1, prices: [{ ml: 70, price: '2000', own: false, cost: '350' }] },
        { uid: 'L', name: 'MA-LOT BOX WINE', avgCost: '35000', stock: 2, prices: [{ ml: 70, price: '2500', own: true, cost: '490' }] },
      ],
    });
    expect(p.parents.map((x) => x.name)).toEqual(['GREPA WINE', 'MA-LOT BOX WINE']);
    expect(p.measures[0].basePrice).toBe(2000);
    expect(priceFor(p, 'L', 70)).toBe(2500);
    expect(priceFor(p, 'G', 70)).toBe(2000);
    expect(priceFor(p, null, 70)).toBe(2000);
  });

  it('et: a profit row from the server (numbers from strings, missing = 0)', () => {
    const r = normalizeProfitRow({ drink: 'KONYAGI YA KUPIMA', mlSold: '720.00', revenue: '24000.00', costSold: '9840.00', lossCost: '410.00', profit: '13750.00' });
    expect([r.drink, r.month, r.mlSold, r.revenue, r.costSold, r.mlLost, r.lossCost, r.profit]).toEqual(['KONYAGI YA KUPIMA', null, 720, 24000, 9840, 0, 410, 13750]);
    expect(normalizeProfitRow(null).profit).toBe(0);
  });
});
