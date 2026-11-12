// (owner 12/11 fu) the gap after D: a real move of money outside the system (Selcom -> NMB) is invisible to the GL.
//   P1 a seller's reco: a customer paid 10,000 by Selcom (declared on the reco) -> Dr 1023 10,000 / Cr 1000
//   P2 a supplier paid 50,000 from NMB WITHOUT a GL Transfer -> Cr 1021 50,000: 1023 +10,000 although Selcom was emptied,
//      1021 -50,000 although only 40,000 left NMB net -> books wrong (1021 can go negative)
//   P3 the real move recorded as a GL Transfer Selcom -> NMB 10,000 -> 1023 back to +0, 1021 -40,000: books = reality
// Throw-away local copy only (D set to 2026-11-01). Run: node pengo_d_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Pengo-Jaribio-Local-2026';
const DAY = '2026-11-05';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const bal = (c) => Number(sql(`select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '${c}'`));
const msg = (r) => String(r.j?.message || '');

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql("update gl_config set posting_enabled = true, bank_cutover_date = '2026-11-01'");
  const ceo = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;
  const mgrUid = sql(`select uid from users where email = '${MGR}'`);
  const brUid = sql(`select branch_uid from daily_reconciliation where user_uid = '${mgrUid}' and branch_uid is not null order by reconciliation_date desc limit 1`);
  const b0 = { s: bal('1023'), n: bal('1021') };
  console.log(`MWANZO 1023=${b0.s} 1021=${b0.n}`);

  // P1 the seller's reco: Selcom 10,000 received from a customer
  const ru = `e2e-pengo-${Date.now()}`;
  sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status, variance_explanation) values ('${ru}', now(), '${DAY}', '${mgrUid}', 'macheda macheda', '${brUid}', 'SUBMITTED', 'E2E pengo maelezo ya tofauti')`);
  sql(`insert into reconciliation_cash_entries (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, entry_type, bank_name, amount, deposit_date) values ('${ru}-sel', now(), true, false, true, '${ru}', 'BANK_DEPOSIT', 'SELCOM', 10000, '${DAY}')`);
  const ap = await api('POST', `/api/v1/reconciliation/${ru}/approve?notes=${encodeURIComponent('E2E pengo')}`, ceo);
  ok('P1 reco: mteja amelipa Selcom 10,000 -> 1023 +10,000', ap.j?.status === 'Success' && bal('1023') - b0.s === 10000, `${msg(ap)} 1023 ${b0.s}->${bal('1023')}`);

  // P2 supplier paid 50,000 from NMB, no Transfer recorded for the real Selcom -> NMB move
  const sup = sql('select uid from suppliers order by id limit 1');
  const pay = await api('POST', '/api/v1/supplier-payments', ceo, { supplierUid: sup, amount: 50000, paymentSource: 'BENKI', sourceAccount: '1021', paymentDate: `${DAY}T12:00:00`, reference: 'E2E-PENGO' });
  const s2 = bal('1023') - b0.s, n2 = bal('1021') - b0.n;
  console.log(`BILA TRANSFER: 1023 ${bal('1023')} (${s2 >= 0 ? '+' : ''}${s2})  1021 ${bal('1021')} (${n2})`);
  ok('P2 bila Transfer: 1023 inabaki +10,000 (Selcom halisi = 0), 1021 -50,000 (NMB halisi -40,000) -> vitabu si sahihi', pay.j?.status === 'Success' && s2 === 10000 && n2 === -50000, `${msg(pay)} 1023 ${s2} 1021 ${n2}`);

  // P3 the real move recorded as a GL Transfer
  const tr = await api('POST', '/api/v1/gl/transfers', ceo, { fromAccount: '1023', toAccount: '1021', amount: 10000, fee: 0, date: DAY, reason: 'Selcom kwenda NMB kulipa msambazaji' });
  const s3 = bal('1023') - b0.s, n3 = bal('1021') - b0.n;
  console.log(`NA TRANSFER:  1023 ${bal('1023')} (${s3})  1021 ${bal('1021')} (${n3})`);
  ok('P3 na Transfer Selcom -> NMB 10,000: 1023 +0, 1021 -40,000 -> vitabu = hali halisi', tr.j?.status === 'Success' && s3 === 0 && n3 === -40000, `${msg(tr)} 1023 ${s3} 1021 ${n3}`);

  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
