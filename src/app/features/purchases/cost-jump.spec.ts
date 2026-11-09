import { describe, expect, it } from 'vitest';

import { RepurchaseLine, costJump, costJumpRatio } from './purchases.models';

// (bo/cf) 02/11 — "crate or bottle?": cost per piece vs the last purchase, past ×3 or below ⅓.
const line = (o: Partial<RepurchaseLine>): RepurchaseLine => ({
  productUid: 'p', name: 'Jagger', category: null, purchaseType: 'INDIVIDUAL_PIECES', quantity: 12, unitPrice: 8_833.33,
  supplierName: null, piecesPerPackage: 12, abbreviation: null, pieceSalePrice: 12_000,
  lastCostPerPiece: 8_833.33, lastCostPerPackage: 106_000, lastSupplierName: null, ...o,
});

describe('costJump', () => {
  it('flags a crate price typed as a bottle (×12) and a bottle price typed as a crate (÷12)', () => {
    expect(costJump(line({ unitPrice: 106_000 }))).toBe(12);
    expect(costJump(line({ purchaseType: 'WHOLE_PACKAGE', quantity: 1, unitPrice: 8_833.33 }))).toBe(0.08);
  });
  it('is quiet for normal prices, for crate prices typed as crates, and up to exactly ×3 / ⅓', () => {
    expect(costJump(line({}))).toBeNull();
    expect(costJump(line({ purchaseType: 'WHOLE_PACKAGE', quantity: 2, unitPrice: 110_000 }))).toBeNull();
    expect(costJump(line({ unitPrice: 8_833.33 * 3 }))).toBeNull();
    expect(costJump(line({ unitPrice: 8_833.33 / 3 + 0.01 }))).toBeNull();
    expect(costJump(line({ unitPrice: 26_600 }))).toBe(3.01);
  });
  it('is quiet when the last cost or the quantity is unknown', () => {
    expect(costJump(line({ lastCostPerPiece: null, unitPrice: 106_000 }))).toBeNull();
    expect(costJump(line({ quantity: 0, unitPrice: 106_000 }))).toBeNull();
  });
});

describe('costJumpRatio (cg: new purchase and edit use the same rule)', () => {
  it('compares any cost per piece with a reference', () => {
    expect(costJumpRatio(53_000, 8_833.33)).toBe(6);
    expect(costJumpRatio(8_833.33, 53_000)).toBe(0.17);
    expect(costJumpRatio(9_000, 8_833.33)).toBeNull();
  });
  it('is quiet without a reference or a cost', () => {
    expect(costJumpRatio(53_000, null)).toBeNull();
    expect(costJumpRatio(53_000, 0)).toBeNull();
    expect(costJumpRatio(0, 8_833.33)).toBeNull();
  });
});
