import { toLiability } from './counting.models';

describe('toLiability (kazi 4, V144)', () => {
  it('maps the open-balance split, payment parts and written agreements', () => {
    const l = toLiability({
      uid: 'l1',
      userUid: 'u1',
      amount: 13000,
      balance: 6000,
      status: 'PARTIALLY_PAID',
      items: [],
      chargedAtCost: true,
      costOpen: 3250,
      agreedOpen: 1000,
      marginOpen: 1750,
      payments: [{ amount: 7000, paymentType: 'CASH', costPart: 7000, agreedPart: 0, marginPart: 0 }],
      agreements: [{ uid: 'a1', amount: 1000, agreedOn: '2026-11-10', documentRef: 'Daftari uk. 12', note: 'Amekubali kwa maandishi', recordedByName: 'Chief' }],
    });
    expect(l.chargedAtCost).toBe(true);
    expect(l.costOpen! + l.agreedOpen! + l.marginOpen!).toBe(l.balance);
    expect(l.payments[0].costPart).toBe(7000);
    expect(l.agreements).toHaveLength(1);
    expect(l.agreements[0].documentRef).toBe('Daftari uk. 12');
  });

  it('an older debt (before V144) has no split and no parts', () => {
    const l = toLiability({ uid: 'l2', amount: 5000, balance: 5000, items: [], payments: [{ amount: 1000, paymentType: 'CASH' }] });
    expect(l.chargedAtCost).toBe(false);
    expect(l.costOpen).toBeNull();
    expect(l.payments[0].costPart).toBeNull();
    expect(l.agreements).toEqual([]);
  });
});
