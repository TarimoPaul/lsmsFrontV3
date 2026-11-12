// Cut-over D (owner 11/11 fc) on the REAL schema (PG15, prod dump 29/10) through the API, with D SET on the copy:
//   T1 a reco BEFORE D approved -> no transfer (NMB / wallets are part of 1000)
//   T2 a reco ON/after D approved -> FUNDS_TRANSFER: Dr 1021 NMB = its BANK_DEPOSIT, Dr 103x = phone money less the seller's
//      own phone-paid sales of the day, Cr 1000 the total; TB 0
//   T3 reopen -> the transfer is reversed (nothing live); T4 approved again -> posted again, once
//   T5 supplier payment "Benki - NMB" dated after D -> Cr 1021 (not 1000)
//   T6 a Safe Box bank deposit (NMB) confirmed, after D -> Dr 1021 / Cr 1000
//   T7-T9 transfers with a fee; T10 (fq) a day after D with every POS sale CASH + phone/bank money only on the reco ->
//      the sales Dr 1000 only, the reco Dr 102x/103x / Cr 1000 its own amounts, nothing twice
//   T11-T13 (fr) one rule "reco phone = the whole day": POS M-Pesa P + typed 0 / P / P+30k -> 1030 +P / +P / +P+30k, reco the same
// Throw-away local copy only. Run: node cutover_api_e2e.cjs
const { execFileSync } = require('child_process');
const { SELLER, ensureSeller } = require('./e2e-muuzaji.cjs');

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

  // ── T10 (fq) today's way of working after D: every POS sale rung up as CASH, phone / bank money only on the reco ──
  //   -> the sales post Dr 1000 only; the reco moves exactly its own amounts Dr 102x/103x / Cr 1000 (nothing twice)
  // (ge) T10-T14 run as the E2E SELLER (a copy of the manager with no sales / recos): its days are always free, and
  // approving its recos never locks the manager's day for the tests that follow (k3, kupima_api)
  const mgrUid = ensureSeller(MGR, PW);
  const mgr = await login(SELLER);
  const realMgrUid = sql(`select uid from users where email = '${MGR}'`);
  const day10 = sql('select current_date::text');
  const pad = (n) => String(n).padStart(2, '0');
  const now10 = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const free = sql(`select count(*) from daily_reconciliation where user_uid = '${mgrUid}' and reconciliation_date = '${day10}' and not is_deleted`) === '0'
    && sql(`select count(*) from payments p join sales s on s.uid = p.sale_uid where s.user_uid = '${mgrUid}' and p.payment_date::date = '${day10}' and p.payment_method <> 'CASH'`) === '0';
  const [pu, pn, pr] = sql("select uid || '|' || product_name || '|' || round(piece_sale_price) from products where not coalesce(is_deleted,false) and is_active and current_stock >= 10 and piece_sale_price > coalesce(current_average_cost,0) * 1.05 and product_name not ilike '%pima%' order by current_stock desc, id limit 1").split('|');
  const saleUids = [];
  for (const i of [1, 2]) {
    const s = await api('POST', '/api/v1/sales/partial', mgr, { saleDate: now10(), customerUid: null, userUid: mgrUid, discountAmount: 0, saleNotes: `E2E-CUTOVER-T10 ${i}`,
      saleDetails: [{ productUid: pu, productName: pn, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: Number(pr), subTotal: Number(pr), overrideUnitPrice: null }],
      payments: [{ customerName: 'Walk-in Customer', paymentMethod: 'CASH', totalAmount: Number(pr), amountPaid: Number(pr), paymentDate: now10() }] });
    if (s.j?.status === 'Success') saleUids.push(sql(`select uid from sales where sale_notes like '%E2E-CUTOVER-T10 ${i}' order by id desc limit 1`));
  }
  await new Promise((res) => setTimeout(res, 800));
  const inList = saleUids.map((u) => `'${u}'`).join(',') || "''";
  const saleMoney = sql(`select coalesce(string_agg(account_code || ':' || v, ',' order by account_code), '') from (select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) v from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid in (${inList}) and (l.account_code = '1000' or l.account_code like '102%' or l.account_code like '103%') group by 1) x`);
  const r10 = `e2e-t10-${Date.now()}`;
  sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status, variance_explanation)
       values ('${r10}', now(), '${day10}', '${mgrUid}', 'E2E Muuzaji',
               (select branch_uid from daily_reconciliation where user_uid = '${realMgrUid}' and branch_uid is not null order by reconciliation_date desc limit 1),
               'SUBMITTED', 'E2E cutover T10 maelezo ya tofauti')`);
  for (const [prov, amt] of [['VODACOM', 30000], ['TIGO', 20000]]) {
    sql(`insert into reconciliation_mobile_entries (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, provider, amount) values ('${r10}-${prov}', now(), true, false, true, '${r10}', '${prov}', ${amt})`);
  }
  for (const [bank, amt] of [['NMB', 100000], ['SELCOM', 50000]]) {
    sql(`insert into reconciliation_cash_entries (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, entry_type, bank_name, amount, deposit_date) values ('${r10}-${bank}', now(), true, false, true, '${r10}', 'BANK_DEPOSIT', '${bank}', ${amt}, '${day10}')`);
  }
  const ap10 = await api('POST', `/api/v1/reconciliation/${r10}/approve?notes=${encodeURIComponent('E2E cutover T10')}`, ceo);
  const want10 = '1000:-200000.00,1021:100000.00,1023:50000.00,1030:30000.00,1031:20000.00';
  ok('T10 siku baada ya D: POS yote CASH (sale -> Dr 1000 tu) + reco ya simu/benki -> Dr 1021/1023/1030/1031 / Cr 1000 kiasi cha reco tu',
    free && saleUids.length === 2 && saleMoney === `1000:${(2 * Number(pr)).toFixed(2)}` && ap10.j?.status === 'Success' && live('RECO-TRF:' + r10) === want10,
    `free=${free} sales=${saleUids.length} saleMoney=${saleMoney} | ${msg(ap10)} | ${live('RECO-TRF:' + r10)} (lazima ${want10})`);
  const twice = sql(`select count(*) from journal_entry j where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid in (${inList}) and exists (select 1 from journal_entry_line l where l.journal_entry_uid = j.uid and (l.account_code like '102%' or l.account_code like '103%'))`);
  ok('T10b hakuna mara mbili: journal za sale hazina 102x/103x; uhamisho mmoja tu wa reco', twice === '0'
    && sql(`select count(*) from journal_entry where reference_uid = 'RECO-TRF:${r10}' and status = 'POSTED' and reversed_entry_uid is null`) === '1', `twice=${twice}`);

  // ── T11-T13 (fr) ONE rule: the reco's phone money = the day's WHOLE phone money (POS phone sales included) ──
  //   a POS sale of P (the product's price) paid by M-Pesa (Dr 1030 at the sale, mirrored on the reco as an automatic entry), then what the
  //   seller types: T11 nothing, T12 P (the whole day), T13 P + 30,000 (POS + 30,000 more by phone rung up as CASH).
  //   1030 must move: T11 +P, T12 +P (not 2P), T13 +P + 30,000; the reco counts the same phone figure.
  const brUid = sql(`select branch_uid from daily_reconciliation where user_uid = '${realMgrUid}' and branch_uid is not null order by reconciliation_date desc limit 1`);
  const d1030 = (refs) => Number(sql(`select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '1030' and j.reference_uid in (${refs.map((x) => `'${x}'`).join(',')})`));
  const P10 = Number(pr);
  for (const [tag, day, typed, want] of [['T11', '2026-11-01', 0, P10], ['T12', '2026-11-02', P10, P10], ['T13', '2026-11-03', P10 + 30000, P10 + 30000]]) {
    const clean = sql(`select count(*) from sales where user_uid = '${mgrUid}' and sale_date::date = '${day}'`) === '0' && sql(`select count(*) from daily_reconciliation where user_uid = '${mgrUid}' and reconciliation_date = '${day}'`) === '0';
    const s = await api('POST', '/api/v1/sales/partial', mgr, { saleDate: `${day}T11:00:00`, customerUid: null, userUid: mgrUid, discountAmount: 0, saleNotes: `E2E-CUTOVER-${tag}`,
      saleDetails: [{ productUid: pu, productName: pn, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: P10, subTotal: P10, overrideUnitPrice: null }],
      payments: [{ customerName: 'Walk-in Customer', paymentMethod: 'VODACOM', totalAmount: P10, amountPaid: P10, paymentDate: `${day}T11:00:00` }] });
    await new Promise((res) => setTimeout(res, 800));
    const sid = sql(`select coalesce((select uid from sales where sale_notes like '%E2E-CUTOVER-${tag}' order by id desc limit 1),'')`);
    const ru = `e2e-${tag.toLowerCase()}-${Date.now()}`;
    sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status) values ('${ru}', now(), '${day}', '${mgrUid}', 'E2E Muuzaji', '${brUid}', 'DRAFT')`);
    if (typed) sql(`insert into reconciliation_mobile_entries (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, provider, amount) values ('${ru}-typed', now(), true, false, true, '${ru}', 'VODACOM', ${typed})`);
    const rf = await api('POST', `/api/v1/reconciliation/${ru}/refresh`, mgr);
    const mirrored = sql(`select count(*) from reconciliation_mobile_entries where reconciliation_uid = '${ru}' and source_payment_uid is not null and not is_deleted`);
    const recoPhone = Number(rf.j?.data?.mobileMoneytotal ?? rf.j?.data?.mobileMoneyTotal ?? NaN);
    sql(`update daily_reconciliation set status = 'SUBMITTED', variance_explanation = 'E2E cutover ${tag} maelezo ya tofauti' where uid = '${ru}'`);
    sql(`update reconciliation_mobile_entries set is_verified = true where reconciliation_uid = '${ru}'`);
    const ap = await api('POST', `/api/v1/reconciliation/${ru}/approve?notes=${encodeURIComponent('E2E cutover ' + tag)}`, ceo);
    const got = d1030([sid, 'RECO-TRF:' + ru]);
    ok(`${tag} POS M-Pesa ${P10} + reco ya simu ${typed} -> 1030 +${want} tu; reco inahesabu simu ${want}`, clean && s.j?.status === 'Success' && mirrored === '1' && ap.j?.status === 'Success'
      && Math.abs(got - want) < 0.005 && Math.abs(recoPhone - want) < 0.005, `clean=${clean} sale=${msg(s)} mirrored=${mirrored} recoPhone=${recoPhone} | ${msg(ap)} | 1030 ${got} transfer=${live('RECO-TRF:' + ru)}`);
  }

  // ── T14 (fr) a POS sale paid by NMB is declared on the reco as an NMB deposit (Formula 1 takes nothing off for it):
  //   P by NMB on the POS + 50,000 drawer cash to NMB, declared together as P + 50,000 -> 1021 +P + 50,000 (not 2P + 50,000)
  {
    const day = '2026-11-04';
    const s = await api('POST', '/api/v1/sales/partial', mgr, { saleDate: `${day}T11:00:00`, customerUid: null, userUid: mgrUid, discountAmount: 0, saleNotes: 'E2E-CUTOVER-T14',
      saleDetails: [{ productUid: pu, productName: pn, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: P10, subTotal: P10, overrideUnitPrice: null }],
      payments: [{ customerName: 'Walk-in Customer', paymentMethod: 'NMB', totalAmount: P10, amountPaid: P10, paymentDate: `${day}T11:00:00` }] });
    await new Promise((res) => setTimeout(res, 800));
    const sid = sql("select coalesce((select uid from sales where sale_notes like '%E2E-CUTOVER-T14' order by id desc limit 1),'')");
    const ru = `e2e-t14-${Date.now()}`;
    sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status) values ('${ru}', now(), '${day}', '${mgrUid}', 'E2E Muuzaji', '${brUid}', 'DRAFT')`);
    sql(`insert into reconciliation_cash_entries (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, entry_type, bank_name, amount, deposit_date) values ('${ru}-nmb', now(), true, false, true, '${ru}', 'BANK_DEPOSIT', 'NMB', ${P10 + 50000}, '${day}')`);
    await api('POST', `/api/v1/reconciliation/${ru}/refresh`, mgr);
    sql(`update daily_reconciliation set status = 'SUBMITTED', variance_explanation = 'E2E cutover T14 maelezo ya tofauti' where uid = '${ru}'`);
    sql(`update reconciliation_cash_entries set is_verified = true where reconciliation_uid = '${ru}'`);
    const ap = await api('POST', `/api/v1/reconciliation/${ru}/approve?notes=${encodeURIComponent('E2E cutover T14')}`, ceo);
    const n1021 = Number(sql(`select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '1021' and j.reference_uid in ('${sid}', 'RECO-TRF:${ru}')`));
    ok(`T14 POS NMB ${P10} + amana ya NMB kwenye reco ${P10 + 50000} -> 1021 +${P10 + 50000} tu (uhamisho 50,000)`, s.j?.status === 'Success' && ap.j?.status === 'Success'
      && Math.abs(n1021 - (P10 + 50000)) < 0.005 && live('RECO-TRF:' + ru) === '1000:-50000.00,1021:50000.00', `${msg(s)} | ${msg(ap)} | 1021 ${n1021} transfer=${live('RECO-TRF:' + ru)}`);
  }

  ok('TB = 0', Math.abs(tb()) < 0.005 && Math.abs(tb() - tb0) < 0.005, `${tb0} -> ${tb()}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
