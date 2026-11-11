import { describe, expect, it } from 'vitest';

import { needsAccount, sourceLabel, sourceProblem } from './payment-source.model';

// C3 (owner 03/11 cs): the source is required with no default; BENKI / SIMU need an account of the list.
describe('payment source', () => {
  it('refuses a missing source and a bank / wallet without an account of the list', () => {
    expect(sourceProblem(null, null, true)).toBe('Chagua chanzo cha malipo.');
    expect(sourceProblem('BENKI', null, true)).toBe('Chagua benki.');
    expect(sourceProblem('BENKI', '1030', true)).toBe('Chagua benki.');
    expect(sourceProblem('SIMU', '1020', false)).toBe('Choose the wallet.');
  });
  it('accepts every complete choice', () => {
    expect(sourceProblem('DROO', null, true)).toBeNull();
    expect(sourceProblem('MMILIKI', '2300', true)).toBeNull();
    expect(sourceProblem('MMILIKI', '2310', true)).toBeNull();
    expect(sourceProblem('BENKI', '1021', true)).toBeNull();
    expect(sourceProblem('SIMU', '1033', true)).toBeNull();
    expect(needsAccount('BENKI') && needsAccount('SIMU') && needsAccount('MMILIKI') && !needsAccount('DROO')).toBe(true);
  });
  it('6c: MMILIKI needs the owner (Paul 2300 / Jess 2310)', () => {
    expect(sourceProblem('MMILIKI', null, true)).toBe('Chagua mmiliki aliyelipa.');
    expect(sourceProblem('MMILIKI', '1020', false)).toBe('Choose which owner paid.');
  });
  it('labels a stored source, and nothing for records made before C3', () => {
    expect(sourceLabel('BENKI', '1021', true)).toBe('Benki · NMB');
    expect(sourceLabel('SIMU', '1031', false)).toBe('Mobile · Tigo Pesa');
    expect(sourceLabel('MMILIKI', null, true)).toBe('Mmiliki · Paul');
    expect(sourceLabel('MMILIKI', '2310', true)).toBe('Mmiliki · Jess');
    expect(sourceLabel(null, null, true)).toBeNull();
    expect(sourceLabel('CASH', null, true)).toBeNull();
  });
});
