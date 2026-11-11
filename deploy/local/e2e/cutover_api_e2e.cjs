// Cut-over D (owner 11/11 fc) on the REAL schema (PG15, prod dump 29/10) through the API, with D SET on the copy:
//   T1 a reco BEFORE D approved -> no transfer (NMB / wallets are part of 1000)
//   T2 a reco ON/after D approved -> FUNDS_TRANSFER: Dr 1021 NMB = its BANK_DEPOSIT, Dr 103x = phone money less the seller's
//      own phone-paid sales of the day, Cr 1000 the total; TB 0
//   T3 reopen -> the transfer is reversed (nothing live); T4 approved again -> posted again, once
//   T5 supplier payment "Benki - NMB" dated after D -> Cr 1021 (not 1000)
//   T6 a Safe Box bank deposit (NMB) confirmed, after D -> Dr 1021 / Cr 1000
// Throw-away local copy only. Run: node cutover_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Cutover-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
const tb = () => Number(sql("select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)"));
/** live (not reversed) net per account of the journals with this reference_uid */
const live = (ref) => sql(`select coalesce(string_agg(account_code || ':' || v, ',' order by account_code), '') from (select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) v from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and (j.reference_uid = '${ref}' or j.reversed_entry_uid in (select uid from journal_entry where reference_uid = '${ref}')) group by 1 having round(sum(l.debit_amount - l.credit_amount), 2) <> 0) x`);
const msg = (r) => String(r.j?.message || '');

async function reapprove(ceo, uid) {
  const ro = await api('POST', `/api/v1/reconciliation/${uid}/reopen?reason=${encodeURIComponent('E2E cutover kufungua kwa jaribio')}`, ceo);
  // submission is not under test: straight to SUBMITTED, everything verified, variance explained (local copy only)
  sql(`update daily_reconciliation set status = 'SUBMITTED', variance_explanation = coalesce(nullif(variance_explanation,''), 'E2E cutover maelezo ya tofauti') where uid = '${uid}'`);
  for (const t of ['reconciliation_cash_entries', 'reconciliation_mobile_entries', 'reconciliation_expenses', 'reconciliation_purchases', 'reconciliation_debt_collections', 'reconciliation_debt_payments', 'reconciliation_retail_debts']) {
    try { execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-qAt', '-c', `update ${t} set is_verified = true where reconciliation_uid = '${uid}'`], { stdio: 'ignore' }); } catch { /* table without the flag */ }
  }
  const ap = await api('POST', `/api/v1/reconciliation/${uid}/approve?notes=${encodeURIComponent('E2E cutover')}`, ceo);
  return { ro, ap };
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  const ceo = await login(CEO);
  // two approved recos of the same seller: B before D, A on D (with NMB deposits and phone money)
  const [A, dayA] = sql("select r.uid || '|' || r.reconciliation_date from daily_reconciliation r where not r.is_deleted and r.status = 'APPROVED' and exists (select 1 from reconciliation_cash_entries e where e.reconciliation_uid = r.uid and not e.is_deleted and e.entry_type = 'BANK_DEPOSIT' and upper(trim(e.bank_name)) = 'NMB') and exists (select 1 from reconciliation_mobile_entries m where m.reconciliation_uid = r.uid and not m.is_deleted) order by r.reconciliation_date desc limit 1").split('|');
  const B = sql(`select uid from daily_reconciliation where not is_deleted and status = 'APPROVED' and reconciliation_date < '${dayA}' and exists (select 1 from reconciliation_cash_entries e where e.reconciliation_uid = daily_reconciliation.uid and not e.is_deleted and e.entry_type = 'BANK_DEPOSIT') order by reconciliation_date desc limit 1`);
  sql(`update gl_config set bank_cutover_date = '${dayA}'`);
  const tb0 = tb();

  // ── T1 before D ──
  let r = await reapprove(ceo, B);
  ok('T1 reco KABLA ya D imeidhinishwa -> hakuna uhamisho', r.ap.j?.status === 'Success' && live('RECO-TRF:' + B) === '', `${msg(r.ro)} | ${msg(r.ap)} | ${live('RECO-TRF:' + B)}`);

  // ── T2 on D: expected from the reco itself ──
  const dep = Number(sql(`select coalesce(sum(amount),0) from reconciliation_cash_entries where reconciliation_uid = '${A}' and not is_deleted and entry_type = 'BANK_DEPOSIT' and source_payment_uid is null and upper(trim(bank_name)) = 'NMB'`));
  const mob = Object.fromEntries(sql(`select upper(replace(trim(provider),' ','')), sum(amount) from reconciliation_mobile_entries where reconciliation_uid = '${A}' and not is_deleted and source_payment_uid is null group by 1`).split('\n').filter(Boolean).map((x) => x.split('|')).map(([p, a]) => [p, Number(a)]));
  const user = sql(`select user_uid from daily_reconciliation where uid = '${A}'`);
  const paidVoda = Number(sql(`select coalesce(sum(p.amount_paid),0) from payments p join sales s on s.uid = p.sale_uid where not s.is_deleted and not coalesce(p.is_deleted,false) and not coalesce(p.is_reversal,false) and s.user_uid = '${user}' and p.payment_date >= '${dayA}' and p.payment_date < date '${dayA}' + 1 and p.payment_method = 'VODACOM'`));
  const want = {};
  if (dep > 0) want['1021'] = dep;
  const voda = (mob.VODACOM || 0) - paidVoda; if (voda > 0) want['1030'] = voda;
  if (mob.TIGO) want['1031'] = mob.TIGO;
  if (mob.HALOPESA) want['1032'] = mob.HALOPESA;
  if (mob.AIRTEL) want['1033'] = mob.AIRTEL;
  const total = Object.values(want).reduce((a, b) => a + b, 0);
  want['1000'] = -total;
  const wantStr = Object.keys(want).sort().map((k) => `${k}:${want[k].toFixed(2)}`).join(',');
  r = await reapprove(ceo, A);
  ok('T2 reco ya siku D -> Dr 1021 amana za NMB, Dr 103x pesa ya simu, Cr 1000 jumla', r.ap.j?.status === 'Success' && live('RECO-TRF:' + A) === wantStr, `${msg(r.ap)} | ${live('RECO-TRF:' + A)} (lazima ${wantStr})`);

  // ── T3 / T4 reopen and approve again ──
  const ro = await api('POST', `/api/v1/reconciliation/${A}/reopen?reason=${encodeURIComponent('E2E cutover kufungua tena')}`, ceo);
  ok('T3 kufungua tena -> uhamisho umerudishwa (hakuna kilicho hai)', ro.j?.status === 'Success' && live('RECO-TRF:' + A) === '', `${msg(ro)} | ${live('RECO-TRF:' + A)}`);
  r = await reapprove(ceo, A);
  ok('T4 kuidhinisha tena -> umeandikwa tena, mara moja; kurudisha kuliandikwa tarehe ya siku ile', r.ap.j?.status === 'Success' && live('RECO-TRF:' + A) === wantStr
    && sql(`select count(*) from journal_entry j where j.reference_uid = 'RECO-TRF:${A}' and j.status = 'POSTED' and j.reversed_entry_uid is null and not exists (select 1 from journal_entry x where x.reversed_entry_uid = j.uid)`) === '1'
    && sql(`select count(*) from journal_entry j where j.reversed_entry_uid is not null and j.reference_uid = 'RECO-TRF:${A}' and j.entry_date <> '${dayA}'`) === '0', `${msg(r.ap)} | ${live('RECO-TRF:' + A)}`);

  // ── T5 supplier payment "Benki - NMB" after D ──
  const sup = sql("select uid from suppliers order by id limit 1");
  const pay = await api('POST', '/api/v1/supplier-payments', ceo, { supplierUid: sup, amount: 2000, paymentSource: 'BENKI', sourceAccount: '1021', paymentDate: `${dayA}T10:00:00`, reference: 'E2E-CUTOVER' });
  ok('T5 malipo ya msambazaji Benki NMB baada ya D -> Cr 1021', live(pay.j?.data?.uid || 'x') === '1021:-2000.00,2000:2000.00', `${msg(pay)} | ${live(pay.j?.data?.uid || 'x')}`);
  if (pay.j?.data?.uid) sql(`update supplier_payments set reference = 'E2E-CUTOVER' where uid = '${pay.j.data.uid}'`);

  // ── T6 Safe Box deposit to NMB, confirmed (submitted by the seller, confirmed by CEO) ──
  const sbu = `e2e-cut-${Date.now()}`;
  sql(`insert into safe_box_deposits (uid, created_at, is_active, is_deleted, source_recon_uid, cashier_uid, owner_uid, submitted_amount, deposit_type, bank_name, status, submitted_at, version)
       values ('${sbu}', now(), true, false, '${A}', '${user}', '${user}', 75000, 'BANK_DEPOSIT', 'NMB', 'PENDING', '${dayA} 15:00', 0)`);
  const cf = await api('POST', `/api/v1/safe-box/${sbu}/confirm`, ceo, {});
  ok('T6 amana ya sefu NMB imethibitishwa baada ya D -> Dr 1021 / Cr 1000', live('SAFE-TRF:' + sbu) === '1000:-75000.00,1021:75000.00', `${msg(cf)} | ${live('SAFE-TRF:' + sbu)}`);

  // ── T7 (fe) Selcom deposit 500k (sefu -> Selcom), then Selcom -> NMB 500k, fee 2k ──
  const bal = (c) => Number(sql(`select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '${c}'`));
  const sel = `e2e-sel-${Date.now()}`;
  sql(`insert into safe_box_deposits (uid, created_at, is_active, is_deleted, source_recon_uid, cashier_uid, owner_uid, submitted_amount, deposit_type, bank_name, status, submitted_at, version)
       values ('${sel}', now(), true, false, '${A}', '${user}', '${user}', 500000, 'BANK_DEPOSIT', 'SELCOM', 'PENDING', '${dayA} 16:00', 0)`);
  await api('POST', `/api/v1/safe-box/${sel}/confirm`, ceo, {});
  const b1023 = bal('1023'), b1021 = bal('1021'), b6130 = bal('6130');
  const tr = await api('POST', '/api/v1/gl/transfers', ceo, { fromAccount: '1023', toAccount: '1021', amount: 500000, fee: 2000, date: dayA, reason: 'Selcom kwenda NMB kulipa wasambazaji' });
  ok('T7 uhamisho Selcom -> NMB 500k ada 2k: 1023 -500k (=0 kwa amana hii), 1021 +498k, 6130 +2k', tr.j?.status === 'Success'
    && bal('1023') - b1023 === -500000 && bal('1021') - b1021 === 498000 && bal('6130') - b6130 === 2000 && b1023 === 500000,
    `${msg(tr)} 1023 ${b1023}->${bal('1023')} 1021 ${b1021}->${bal('1021')} 6130 ${b6130}->${bal('6130')}`);
  const early = await api('POST', '/api/v1/gl/transfers', ceo, { fromAccount: '1023', toAccount: '1021', amount: 1000, fee: 0, date: sql(`select (date '${dayA}' - 1)::text`), reason: 'jaribio la kabla ya D' });
  ok('T8 uhamisho wa benki KABLA ya D -> umekataliwa', early.j?.status !== 'Success' && /Kabla ya tarehe ya kukata/.test(msg(early)), msg(early));
  const noWhy = await api('POST', '/api/v1/gl/transfers', ceo, { fromAccount: '1023', toAccount: '1021', amount: 1000, fee: 0, date: dayA, reason: 'aaaa' });
  ok('T9 bila sababu halali -> imekataliwa', noWhy.j?.status !== 'Success', msg(noWhy));

  ok('TB = 0', Math.abs(tb()) < 0.005 && Math.abs(tb() - tb0) < 0.005, `${tb0} -> ${tb()}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
