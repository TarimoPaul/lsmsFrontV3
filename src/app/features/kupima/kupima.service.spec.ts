import { barFraction, normalizePour, priceFor } from './kupima.service';

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
});
