// STAGING (tunnel localhost:8081): can an ordinary user (not root, not macheda) submit a Safe box deposit
// on macheda's entry? It must be refused. If the backend accepts it, the deposit is cancelled straight away
// by the same user, so staging keeps no extra waiting deposit. Email and password come from env vars.
const API = 'http://localhost:8081';
const MACHEDA = '0d75927b-4aae-442d-9b5f-3a70d85f4bfd', ENTRY = '20e5e616-155f-40aa-a288-11617cfb6d9a'; // 194,500 of 2026-08-18, 4,500 left
const email = (process.env.QA_EMAIL ?? '').trim();
if (!email || email.toLowerCase() === 'root@system.com') { console.log('SIMAMA: tumia user wa kawaida, si root.'); process.exit(1); }
const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: process.env.QA_PASS }) });
if (!res.ok) { console.log('LOGIN_IMESHINDWA', res.status, (await res.text()).slice(0, 200)); process.exit(1); }
const token = (await res.json()).data.tokenInfo.token;
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const call = async (method, u, body) => { const r = await fetch(API + u, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); } return { status: r.status, raw: j }; };
console.log(`user: ${email}`);
console.log('token claims (bila siri):', JSON.stringify(Object.fromEntries(Object.entries(claims).filter(([k]) => !/pass|secret/i.test(k)))).slice(0, 600));
if (JSON.stringify(claims).includes(MACHEDA)) { console.log('SIMAMA: huyu ni macheda mwenyewe - tumia user mwingine.'); process.exit(1); }

const r = await call('POST', '/api/v1/safe-box/deposit', { cashEntryUid: ENTRY, submittedAmount: 1000, depositType: 'BANK_DEPOSIT', bankName: 'NMB', receiptNumber: 'QA-MMILIKI', recipientUid: null, remainderReason: null });
console.log(`\nPOST /api/v1/safe-box/deposit kwenye entry ya macheda -> HTTP ${r.status}`);
console.log(JSON.stringify(r.raw).slice(0, 700));
const accepted = r.status < 300 && r.raw?.status === 'Success';
if (accepted) {
  const d = r.raw.data;
  // Right only for a holder of SAFEBOX_DEPOSIT_ON_BEHALF on backend 2.2.70+, and then onBehalf must be true with the owner named.
  console.log(`\nIMEKUBALIWA: deposit ${d.uid} | aliyewasilisha "${d.cashierName}" | mmiliki "${d.ownerName ?? 'HAKUNA (backend ya zamani)'}" | kwa niaba: ${d.onBehalf ?? 'HAKUNA (backend ya zamani)'}`);
  console.log('  -> user wa kawaida: hili ni KOSA.   mwenye SAFEBOX_DEPOSIT_ON_BEHALF kwenye 2.2.70: SAWA kama mmiliki ni macheda na kwa niaba ni true.');
  const c = await call('DELETE', `/api/v1/safe-box/${d.uid}?reason=${encodeURIComponent('QA: jaribio la mmiliki')}`);
  console.log(`kufuta deposit ya jaribio -> HTTP ${c.status} ${JSON.stringify(c.raw).slice(0, 200)}`);
} else {
  console.log(`\nIMEKATALIWA: ${r.raw?.message ?? r.status}`);
  console.log('  -> user wa kawaida: SAWA.   mwenye SAFEBOX_DEPOSIT_ON_BEHALF kwenye 2.2.70: hili ni KOSA.');
}
