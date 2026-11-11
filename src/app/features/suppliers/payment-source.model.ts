/**
 * C3 (owner 03/11 cs): where the money paid to a supplier came from — backend `PaymentSource`.
 * Required, never a default: the person must pick one. BENKI / SIMU pick a real account from a list
 * (never free text); the server decides the GL account (and the bank cut-over rule).
 */
export type PaymentSource = 'DROO' | 'BENKI' | 'SIMU' | 'MMILIKI';

export const PAYMENT_SOURCES: Record<PaymentSource, { en: string; sw: string; icon: string; hint: { en: string; sw: string } }> = {
  DROO: { en: 'Drawer', sw: 'Droo', icon: 'point_of_sale', hint: { en: 'Cash from the sales drawer', sw: 'Pesa taslimu ya droo ya mauzo' } },
  BENKI: { en: 'Bank', sw: 'Benki', icon: 'account_balance', hint: { en: 'Paid from a bank account', sw: 'Imelipwa kutoka akaunti ya benki' } },
  SIMU: { en: 'Mobile', sw: 'Simu', icon: 'smartphone', hint: { en: 'Paid from a mobile wallet', sw: 'Imelipwa kutoka pesa ya simu' } },
  MMILIKI: { en: 'Owner', sw: 'Mmiliki', icon: 'person', hint: { en: "An owner's own money — a debt the shop owes that owner", sw: 'Pesa ya mmiliki mwenyewe — deni ambalo duka linadaiwa na mmiliki huyo' } },
};

export const SOURCE_ACCOUNTS: Record<'BENKI' | 'SIMU' | 'MMILIKI', { code: string; name: string }[]> = {
  BENKI: [
    { code: '1020', name: 'CRDB' },
    { code: '1021', name: 'NMB' },
    { code: '1022', name: 'NBC' },
    { code: '1023', name: 'Selcom' },
    { code: '1024', name: 'PCB' },
  ],
  SIMU: [
    { code: '1030', name: 'M-Pesa (Vodacom)' },
    { code: '1031', name: 'Tigo Pesa' },
    { code: '1032', name: 'Halopesa' },
    { code: '1033', name: 'Airtel Money' },
  ],
  // 6c (owner ct/fa): which owner paid — 2300 "Deni kwa mmiliki - Paul", 2310 "Deni kwa mmiliki - Jess".
  MMILIKI: [
    { code: '2300', name: 'Paul' },
    { code: '2310', name: 'Jess' },
  ],
};

export const needsAccount = (s: PaymentSource | null | undefined): s is 'BENKI' | 'SIMU' | 'MMILIKI' =>
  s === 'BENKI' || s === 'SIMU' || s === 'MMILIKI';

/** Null when the pair is complete, else what is missing (shown under the picker). */
export function sourceProblem(source: PaymentSource | null, account: string | null, sw: boolean): string | null {
  if (!source) return sw ? 'Chagua chanzo cha malipo.' : 'Choose where the money came from.';
  if (needsAccount(source) && !SOURCE_ACCOUNTS[source].some((a) => a.code === account)) {
    if (source === 'MMILIKI') return sw ? 'Chagua mmiliki aliyelipa.' : 'Choose which owner paid.';
    return source === 'BENKI' ? (sw ? 'Chagua benki.' : 'Choose the bank.') : (sw ? 'Chagua akaunti ya simu.' : 'Choose the wallet.');
  }
  return null;
}

/** "Benki · NMB", "Mmiliki", … for lists and details; null for records made before C3. */
export function sourceLabel(source: string | null | undefined, account: string | null | undefined, sw: boolean): string | null {
  const s = source as PaymentSource;
  if (!s || !PAYMENT_SOURCES[s]) return null;
  const base = sw ? PAYMENT_SOURCES[s].sw : PAYMENT_SOURCES[s].en;
  if (!needsAccount(s)) return base;
  // a MMILIKI record made before 6c has no account: it is Paul's (2300)
  const a = SOURCE_ACCOUNTS[s].find((x) => x.code === (account ?? (s === 'MMILIKI' ? '2300' : null)));
  return a ? `${base} · ${a.name}` : base;
}
