/**
 * Where money physically sits — each payment method maps to one GL cash / bank /
 * mobile-money account (backend `AccountMapper.getCashAccountCode`). Used by
 * every form that moves money (expenses, assets, capital, loans, transfers).
 */
export interface MoneyAccount {
  method: string;
  code: string;
  en: string;
  sw: string;
  icon: string;
  group: 'cash' | 'bank' | 'mobile';
}

export const MONEY_ACCOUNTS: MoneyAccount[] = [
  { method: 'CASH', code: '1000', en: 'Cash', sw: 'Taslimu', icon: 'payments', group: 'cash' },
  { method: 'CRDB', code: '1020', en: 'CRDB', sw: 'CRDB', icon: 'account_balance', group: 'bank' },
  { method: 'NMB', code: '1021', en: 'NMB', sw: 'NMB', icon: 'account_balance', group: 'bank' },
  { method: 'NBC', code: '1022', en: 'NBC', sw: 'NBC', icon: 'account_balance', group: 'bank' },
  { method: 'SELCOM', code: '1023', en: 'Selcom', sw: 'Selcom', icon: 'account_balance', group: 'bank' },
  { method: 'PCB', code: '1024', en: 'PCB', sw: 'PCB', icon: 'account_balance', group: 'bank' },
  { method: 'VODACOM', code: '1030', en: 'M-Pesa', sw: 'M-Pesa', icon: 'phone_iphone', group: 'mobile' },
  { method: 'TIGOPESA', code: '1031', en: 'Tigo Pesa', sw: 'Tigo Pesa', icon: 'phone_iphone', group: 'mobile' },
  { method: 'HALOPESA', code: '1032', en: 'HaloPesa', sw: 'HaloPesa', icon: 'phone_iphone', group: 'mobile' },
  { method: 'AIRTELMONEY', code: '1033', en: 'Airtel Money', sw: 'Airtel Money', icon: 'phone_iphone', group: 'mobile' },
];

export function moneyAccountByMethod(method: string | null | undefined): MoneyAccount {
  return MONEY_ACCOUNTS.find((a) => a.method === (method ?? 'CASH')) ?? MONEY_ACCOUNTS[0];
}

export function moneyAccountByCode(code: string): MoneyAccount | undefined {
  return MONEY_ACCOUNTS.find((a) => a.code === code);
}
