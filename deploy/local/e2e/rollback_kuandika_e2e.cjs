// (owner 12/11 ge 3) ROLLBACK BY WRITING: the 2.4.0 image running on a 2.5.0 schema (Flyway 151) must still WRITE without
// an error. Run against the backend that is up (rollback test: local copy migrated by the 2.5.0 image, then the backend
// container swapped to the 2.4.0 image on the same DB). Every write goes through the 2.4.0 API:
//   R1 a POS sale paid Taslimu -> Success, its GL journal posted
//   R2 a credit sale to a customer, then the debt paid (Taslimu) -> Success, payment row + journal
//   R3 a reco of today: created, cash in hand entered, submitted, approved (CEO) -> APPROVED, snapshot frozen
//   R4 a purchase (repurchase, no supplier, Droo) approved -> Success, GL journal Cr 1000
//   R5 nothing went to gl_posting_failure; TB = 0
// Throw-away local copy only. Run: node rollback_kuandika_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Rollback-Kuandika-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const msg = (r) => String(r?.j?.message || '').slice(0, 160);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const now = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const tb = () => Number(sql("select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)"));
const journals = (ref) => Number(sql(`select count(*) from journal_entry where reference_uid = '${ref}' and status = 'POSTED'`));

(async () => {
  const image = execFileSync('docker', ['inspect', '--format', '{{.Config.Image}}', 'lsms-local-backend-1'], { encoding: 'utf8' }).trim();
  const flyway = sql("select max(version::numeric) from flyway_schema_history where success and version ~ '^[0-9]+$'");
  console.log(`BACKEND ${image} | FLYWAY ${flyway}`);
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT')");
  const ceo = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;
  const mgr = (await api('POST', '/api/auth/login', null, { email: MGR, password: PW })).j.data.tokenInfo.token;
  const mgrUid = sql(`select uid from users where email = '${MGR}'`);
  const fail0 = Number(sql('select count(*) from gl_posting_failure'));
  const [pu, pn, pr] = sql("select uid || '|' || product_name || '|' || round(piece_sale_price) from products where not coalesce(is_deleted,false) and is_active and current_stock >= 10 and piece_sale_price > coalesce(current_average_cost,0) * 1.05 and product_name not ilike '%pima%' order by current_stock desc, id limit 1").split('|');
  const P1 = Number(pr);
  const sale = async (tag, pays, customerUid) => {
    const r = await api('POST', '/api/v1/sales/partial', mgr, { saleDate: now(), customerUid, userUid: mgrUid, discountAmount: 0, saleNotes: `RB-KUANDIKA ${tag}`,
      saleDetails: [{ productUid: pu, productName: pn, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: P1, subTotal: P1, overrideUnitPrice: null }],
      payments: pays.map(([m, a]) => ({ customerName: customerUid ? null : 'Walk-in Customer', paymentMethod: m, totalAmount: P1, amountPaid: a, paymentDate: now() })) });
    await sleep(700);
    return { r, sid: sql(`select coalesce((select uid from sales where sale_notes like '%RB-KUANDIKA ${tag}' order by id desc limit 1),'')`) };
  };

  // R1 POS sale, Taslimu
  const s1 = await sale('TASLIMU', [['CASH', P1]], null);
  ok(`R1 sale ya Taslimu ${P1} -> Success, journal 1`, s1.r.j?.status === 'Success' && s1.sid && journals(s1.sid) >= 1, `${msg(s1.r)} journals=${journals(s1.sid)}`);

  // R2 credit sale to a customer + the debt paid in cash
  const cust = sql("select uid from customers where not coalesce(is_deleted,false) and coalesce(is_active,true) order by id limit 1");
  const s2 = await sale('DENI', [['CREDIT', 0]], cust);
  const pay = s2.sid ? await api('POST', `/api/v1/sales/${s2.sid}/payments`, mgr, { saleUid: s2.sid, paymentMethod: 'CASH', totalAmount: P1, amountPaid: P1, paymentDate: now(), transactionReference: null, paymentNotes: 'RB-KUANDIKA deni' }) : null;
  await sleep(700);
  const paid = s2.sid ? sql(`select coalesce(sum(amount_paid),0)::numeric(19,0) from payments where sale_uid = '${s2.sid}' and payment_method = 'CASH' and not coalesce(is_deleted,false)`) : '0';
  ok(`R2 sale ya mkopo + malipo ya deni Taslimu ${P1} -> Success, payment imeandikwa`, s2.r.j?.status === 'Success' && pay?.j?.status === 'Success' && Number(paid) === P1, `${msg(s2.r)} | ${msg(pay)} | paid=${paid}`);

  // R3 reco of today: create -> cash in hand -> submit -> approve
  const today = sql('select current_date::text');
  sql(`update daily_reconciliation set is_deleted = true where user_uid = '${mgrUid}' and reconciliation_date = '${today}' and status <> 'APPROVED'`);
  const c = await api('POST', '/api/v1/reconciliation', mgr, { reconciliationDate: today });
  const ru = c.j?.data?.uid || sql(`select coalesce((select uid from daily_reconciliation where user_uid = '${mgrUid}' and reconciliation_date = '${today}' and not is_deleted order by id desc limit 1),'')`);
  const ce = await api('POST', `/api/v1/reconciliation/${ru}/cash-entry`, mgr, { entryType: 'CASH_IN_HAND', amount: P1, notes: 'RB-KUANDIKA taslimu' });
  await api('PUT', `/api/v1/reconciliation/${ru}/variance-explanation?explanation=${encodeURIComponent('Jaribio la rollback kuandika tofauti')}`, mgr);
  const sub = await api('POST', `/api/v1/reconciliation/${ru}/submit`, mgr, {});
  // verification of each entry is not under test here (local copy only)
  for (const t of ['reconciliation_cash_entries', 'reconciliation_mobile_entries', 'reconciliation_expenses', 'reconciliation_purchases', 'reconciliation_debt_collections', 'reconciliation_retail_debts']) {
    try { sql(`update ${t} set is_verified = true where reconciliation_uid = '${ru}'`); } catch { /* table without the flag */ }
  }
  const ap = await api('POST', `/api/v1/reconciliation/${ru}/approve?notes=${encodeURIComponent('RB-KUANDIKA')}`, ceo);
  const st = sql(`select status || '|' || (select count(*) from daily_financial_snapshot s where s.reconciliation_uid = r.uid) from daily_reconciliation r where uid = '${ru}'`);
  ok('R3 reco ya leo: imeundwa, taslimu, imewasilishwa, IMEIDHINISHWA (snapshot)', c.j?.status === 'Success' && ce.j?.status === 'Success' && sub.j?.status === 'Success' && ap.j?.status === 'Success' && /^APPROVED\|[1-9]/.test(st), `create=${msg(c)} | cash=${msg(ce)} | submit=${msg(sub)} | approve=${msg(ap)} | ${st}`);

  // R4 purchase: repurchase, no supplier, Droo, approved
  const pp = sql("select p.uid from products p where not coalesce(p.is_deleted,false) and p.is_active and exists (select 1 from purchases x where x.product_uid = p.uid) and not exists (select 1 from purchases x where x.product_uid = p.uid and x.status = 'PENDING') order by p.id limit 1");
  const b = await api('POST', '/api/v1/purchases/repurchase/bulk', ceo, { paymentSource: 'DROO', sourceAccount: null, generalNotes: 'RB-KUANDIKA',
    items: [{ productUid: pp, useLastPurchaseData: false, purchaseType: 'INDIVIDUAL_PIECES', priceInputMode: 'TOTAL_AMOUNT', quantity: 5, purchasePrice: 50000, supplierName: 'RB' }] });
  const puid = sql(`select coalesce((select uid from purchases where product_uid = '${pp}' and status <> 'CANCELLED' and created_at > now() - interval '3 minutes' order by id desc limit 1),'')`);
  const apv = puid ? await api('POST', `/api/v1/purchases/${puid}/approve`, ceo, {}) : null;
  await sleep(800);
  const cr = puid ? sql(`select coalesce(string_agg(l.account_code || ':' || l.credit_amount, ','), '') from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where j.reference_uid = '${puid}' and j.status = 'POSTED' and l.credit_amount > 0`) : '';
  ok('R4 manunuzi (repurchase, Droo 50,000) yameidhinishwa -> journal Cr 1000', b.j?.status === 'Success' && apv?.j?.status === 'Success' && cr === '1000:50000.00', `${msg(b)} | ${msg(apv)} | ${cr}`);

  ok('R5 hakuna gl_posting_failure mpya; TB = 0', Number(sql('select count(*) from gl_posting_failure')) === fail0 && Math.abs(tb()) < 0.005, `fail ${fail0}->${sql('select count(*) from gl_posting_failure')} tb=${tb()}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
