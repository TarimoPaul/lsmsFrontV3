import { isPlanned } from './capital.models';

/** G4 (owner dm): a future-month approved row is "Imepangwa", never "in the books". */
describe('isPlanned', () => {
  const now = new Date(2026, 10, 10, 9, 0, 0).getTime(); // 10/11/2026 09:00 local

  it('approved row of a later month is planned', () => {
    expect(isPlanned({ status: 'APPROVED', transactionDate: '2026-12-01T00:00:00' }, now)).toBe(true);
    expect(isPlanned({ status: 'APPROVED', transactionDate: '2026-12-01' }, now)).toBe(true);
  });

  it('this month (already posted on the 1st) and the past are not planned', () => {
    expect(isPlanned({ status: 'APPROVED', transactionDate: '2026-11-01T00:00:00' }, now)).toBe(false);
    expect(isPlanned({ status: 'APPROVED', transactionDate: '2026-11-10T08:59:00' }, now)).toBe(false);
  });

  it('only APPROVED rows can be planned; no date = not planned', () => {
    expect(isPlanned({ status: 'PENDING', transactionDate: '2026-12-01T00:00:00' }, now)).toBe(false);
    expect(isPlanned({ status: 'CANCELLED', transactionDate: '2027-01-01T00:00:00' }, now)).toBe(false);
    expect(isPlanned({ status: 'APPROVED', transactionDate: null }, now)).toBe(false);
  });
});
