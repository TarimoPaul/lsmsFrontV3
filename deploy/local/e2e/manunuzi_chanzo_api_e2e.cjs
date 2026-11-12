// (owner 12/11 gb) after D a purchase with NO registered supplier (paid in full when bought) is credited to the source
// chosen - never 1000 regardless; the source is required. D = yesterday on a fresh copy; GL is posted on approval.
//   S1 no supplier + Benki NMB 500,000 -> approved: Cr 1021 500,000 (Dr 1200)
//   S2 no supplier + Taslimu (Droo) 500,000 -> approved: Cr 1000 500,000
//   S3 no supplier, no source -> refused ("Chagua chanzo cha malipo ...")
// Throw-away local copy only. Run: node manunuzi_chanzo_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const PW = 'Manunuzi-Chanzo-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const msg = (r) => String(r.j?.message || '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  sql('update gl_config set posting_enabled = true, bank_cutover_date = current_date - 1');
  const ceo = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;
  const prods = sql("select p.uid from products p where not coalesce(p.is_deleted,false) and p.is_active and exists (select 1 from purchases x where x.product_uid = p.uid) and not exists (select 1 from purchases x where x.product_uid = p.uid and x.status = 'PENDING') order by p.id limit 3").split('\n');

  /** A repurchase with no registered supplier (paid in full now), then approved; returns the purchase and its money credit. */
  const buy = async (pu, source, account, tag) => {
    const r = await api('POST', '/api/v1/purchases/repurchase/bulk', ceo, { paymentSource: source, sourceAccount: account, generalNotes: `E2E gb ${tag}`,
      items: [{ productUid: pu, useLastPurchaseData: false, purchaseType: 'INDIVIDUAL_PIECES', priceInputMode: 'TOTAL_AMOUNT', quantity: 10, purchasePrice: 500000, supplierName: 'Takawedo' }] });
    const uid = sql(`select coalesce((select uid from purchases where product_uid = '${pu}' and status <> 'CANCELLED' and created_at > now() - interval '2 minutes' order by id desc limit 1), '')`);
    let ap = null;
    if (uid) { ap = await api('POST', `/api/v1/purchases/${uid}/approve`, ceo, {}); await sleep(800); }
    const credit = uid ? sql(`select coalesce(string_agg(l.account_code || ':' || l.credit_amount, ',' order by l.account_code), '') from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where j.reference_uid = '${uid}' and j.status = 'POSTED' and l.credit_amount > 0`) : '';
    const sup = uid ? sql(`select coalesce(supplier_uid, '') || '|' || coalesce(payment_source, '') || '|' || coalesce(source_account, '') from purchases where uid = '${uid}'`) : '';
    return { r, uid, ap, credit, sup };
  };

  const s1 = await buy(prods[0], 'BENKI', '1021', 'NMB');
  ok('S1 bila msambazaji + Benki NMB 500,000 (baada ya D) -> Cr 1021 500,000', s1.uid && s1.sup === '|BENKI|1021' && s1.credit === '1021:500000.00', `${msg(s1.r)} | ${s1.ap ? msg(s1.ap) : ''} | sup=${s1.sup} credit=${s1.credit}`);
  const s2 = await buy(prods[1], 'DROO', null, 'Taslimu');
  ok('S2 bila msambazaji + Taslimu 500,000 -> Cr 1000 500,000', s2.uid && s2.sup === '|DROO|' && s2.credit === '1000:500000.00', `${msg(s2.r)} | sup=${s2.sup} credit=${s2.credit}`);
  const s3 = await buy(prods[2], null, null, 'bila chanzo');
  ok('S3 bila msambazaji, bila chanzo -> imekataliwa', !s3.uid && /chanzo/i.test(JSON.stringify(s3.r.j)), `uid=${s3.uid} ${JSON.stringify(s3.r.j).slice(0, 250)}`);

  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
