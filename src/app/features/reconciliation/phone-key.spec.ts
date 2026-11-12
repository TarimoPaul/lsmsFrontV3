import { phoneKey } from './recon-entries-tab';

// (fr) the reco's phone chips group a provider the way the backend does (MobileMoney.KEYS)
describe('phoneKey', () => {
  it('groups names of one provider together and keeps unknown names apart', () => {
    expect(phoneKey('VODACOM')).toBe('1030');
    expect(phoneKey(' Vodacom ')).toBe('1030');
    expect(phoneKey('M-Pesa')).toBe('1030');
    expect(phoneKey('TIGOPESA')).toBe(phoneKey('tigo'));
    expect(phoneKey('AIRTELMONEY')).toBe('1033');
    expect(phoneKey('CHAKULA')).toBe('?CHAKULA');
    expect(phoneKey(null)).toBe('?');
  });
});
