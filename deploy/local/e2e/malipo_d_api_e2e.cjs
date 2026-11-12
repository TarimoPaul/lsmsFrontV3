// (owner 12/11 fk) after the cut-over D a sale's own journal must debit the account the money really went into:
//   "Benki · NMB" -> Dr 1021, Selcom -> 1023, M-Pesa -> 1030, Tigo -> 1031, CRDB -> 1020 (all accounts stay open, fj), cash -> 1000,
//   PCB 1024, Halopesa 1032, Airtel 1033, BANK_TRANSFER -> 1020, MOBILE_MONEY -> 1030, a split CASH + NMB -> both.
//   Each journal balances; no gl_posting_failure. D = today on a fresh copy. Before V151 the DB check refused SELCOM / PCB /
//   AIRTELMONEY / BANK_TRANSFER / MOBILE_MONEY (constraint error, no sale).
// Throw-away local copy only. Run: node malipo_d_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const MGR = 'macheda@gmail.com';
const PW = 'MalipoD-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const pad = (n) => String(n).padStart(2, '0');
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tb = () => Number(sql("select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)"));
/** Money lines (1000 / 102x / 103x) of the sale's journal: account -> debit - credit. */
const money = (sid) => sql(`select string_agg(account_code || ':' || v, ',' order by account_code) from (select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) v from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid = '${sid}' and (l.account_code = '1000' or l.account_code like '102%' or l.account_code like '103%') group by 1) x`);
const balanced = (sid) => sql(`select coalesce(bool_and(abs(t) < 0.005), false) from (select sum(l.debit_amount - l.credit_amount) t from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.reference_uid = '${sid}' and j.status = 'POSTED' and not coalesce(j.is_deleted,false) group by j.uid) x`) === 't';

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${MGR}'`);
  sql('update gl_config set posting_enabled = true, bank_cutover_date = current_date');
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT')");
  const mgr = (await api('POST', '/api/auth/login', null, { email: MGR, password: PW })).j.data.tokenInfo.token;
  const mgrUid = sql(`select uid from users where email='${MGR}'`);
  ok('D0 D = leo kwenye nakala safi', sql('select bank_cutover_date = current_date from gl_config order by id limit 1') === 't');
  const tb0 = tb(); const fail0 = Number(sql('select count(*) from gl_posting_failure'));

  const [pu, pn, price] = sql("select uid || '|' || product_name || '|' || round(piece_sale_price) from products where not coalesce(is_deleted,false) and is_active and current_stock >= 10 and piece_sale_price > coalesce(current_average_cost,0) * 1.05 and product_name not ilike '%pima%' order by current_stock desc, id limit 1").split('|');
  const P1 = Number(price);
  const sell = async (tag, pays) => {
    const r = await api('POST', '/api/v1/sales/partial', mgr, { saleDate: nowLocal(), customerUid: null, userUid: mgrUid, discountAmount: 0, saleNotes: `E2E-MALIPO-D ${tag}`,
      saleDetails: [{ productUid: pu, productName: pn, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: P1, subTotal: P1, overrideUnitPrice: null }],
      payments: pays.map(([m, a]) => ({ customerName: 'Walk-in Customer', paymentMethod: m, totalAmount: P1, amountPaid: a, paymentDate: nowLocal() })) });
    await sleep(600);
    return { r, sid: sql(`select coalesce((select uid from sales where sale_notes like '%E2E-MALIPO-D ${tag}' order by id desc limit 1),'')`) };
  };
  const v = P1.toFixed(2);
  for (const [tag, method, acc] of [['NMB', 'NMB', '1021'], ['SELCOM', 'SELCOM', '1023'], ['MPESA', 'VODACOM', '1030'], ['TIGO', 'TIGOPESA', '1031'], ['CRDB', 'CRDB', '1020'], ['NBC', 'NBC', '1022'], ['PCB', 'PCB', '1024'],
    ['HALOPESA', 'HALOPESA', '1032'], ['AIRTEL', 'AIRTELMONEY', '1033'], ['BANKTRANSFER', 'BANK_TRANSFER', '1020'], ['MOBILEMONEY', 'MOBILE_MONEY', '1030'], ['CASH', 'CASH', '1000']]) {
    const { r, sid } = await sell(tag, [[method, P1]]);
    ok(`M ${tag}: sale baada ya D -> Dr ${acc} ${v} tu, journal inalingana`, r.j?.status === 'Success' && money(sid) === `${acc}:${v}` && balanced(sid), `${String(r.j?.message).slice(0, 120)} money=${money(sid)}`);
  }
  const half = Math.floor(P1 / 2), rest = P1 - half;
  const sp = await sell('SPLIT', [['CASH', half], ['NMB', rest]]);
  ok(`M SPLIT: CASH ${half} + NMB ${rest} -> Dr 1000 + Dr 1021`, sp.r.j?.status === 'Success' && money(sp.sid) === `1000:${half.toFixed(2)},1021:${rest.toFixed(2)}` && balanced(sp.sid), `money=${money(sp.sid)}`);

  ok('hakuna gl_posting_failure mpya; TB = 0', Number(sql('select count(*) from gl_posting_failure')) === fail0 && Math.abs(tb()) < 0.005 && Math.abs(tb() - tb0) < 0.005, `fail ${fail0}->${sql('select count(*) from gl_posting_failure')} tb ${tb0}->${tb()}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
