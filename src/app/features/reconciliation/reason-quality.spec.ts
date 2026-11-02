import { describe, expect, it } from 'vitest';

import { distinctChars, isJunkReason } from './reason-quality';

// (bv) 02/11 — must match the server's ReasonQuality (ReasonQualityTest uses the same cases).
describe('isJunkReason', () => {
  it('refuses one repeated letter and fewer than 4 different letters', () => {
    for (const s of ['6666666666', 'rrrrrrrrrr', 'RRRRR rrrrr', 'ab ab ab ab ab', 'abc abc abc abc', '12-12-12-12-12', '....aaaa....', 'x']) {
      expect(isJunkReason(s), s).toBe(true);
    }
  });
  it('accepts real reasons; empty is left to the length rule', () => {
    for (const s of ['Mteja alirudisha bidhaa', 'Nilikosea bei', 'abcd abcd ab', 'Tigo 2026']) {
      expect(isJunkReason(s), s).toBe(false);
    }
    expect(isJunkReason(null)).toBe(false);
    expect(isJunkReason('   ')).toBe(false);
    expect(distinctChars('Ñaña ÑAÑA')).toBe(2);
  });
});
