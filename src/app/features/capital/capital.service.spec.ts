import { splitAnnual } from './capital.service';

/** G5: the dialog shows the same monthly split the backend books (AnnualPrepayment.split). */
describe('splitAnnual', () => {
  it('2,400,000 over 12 months = 200,000 each', () => {
    expect(splitAnnual(2_400_000, 12)).toEqual(Array(12).fill(200_000));
  });

  it('250,000 over 12: 20,833.33 x11 and the last takes the rest (20,833.37)', () => {
    const s = splitAnnual(250_000, 12);
    expect(s[0]).toBe(20_833.33);
    expect(s[11]).toBe(20_833.37);
    expect(Math.round(s.reduce((a, b) => a + b, 0) * 100) / 100).toBe(250_000);
  });

  it('nothing to split for 0 or no months', () => {
    expect(splitAnnual(0, 12)).toEqual([]);
    expect(splitAnnual(1000, 0)).toEqual([]);
  });
});
