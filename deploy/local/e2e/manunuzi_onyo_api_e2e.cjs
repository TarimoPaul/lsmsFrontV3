// 6e (owner 12/11 ga) - a WARNING only: the reco's purchase section is evidence (no journal); the buyer's purchase module
// writes the GL once. Day X: reco purchases vs purchases paid from the drawer (DROO) on X±1; a difference -> warning.
//   M0 the warning starts at lsms.purchase-check.from (02/12 on prod; this copy: LSMS_PURCHASE_CHECK_FROM=2026-11-01):
//      no day before it is ever reported (older recos are not looked at)
//   M1 reco of day X: Pepsi 200,000 from the drawer, no purchase -> "Reco ya X: 200,000; yaliyoandikwa 0"; no journal
//   (X = yesterday, X+1 = today: a repurchase is dated now)
//   M2 a purchase of 200,000 paid from NMB on X+1 -> the warning stays (not the drawer)
//   M3 a purchase of 200,000 paid from the drawer (Taslimu) on X+1 -> the warning goes; approved: one journal, Cr 1000
// Throw-away local copy only, backend up with LSMS_PURCHASE_CHECK_FROM=2026-11-01. Run: node manunuzi_onyo_api_e2e.cjs
const { execFileSync } = require('child_process');
const { ensureSeller } = require('./e2e-muuzaji.cjs');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Manunuzi-Onyo-Local-2026';
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

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  const ceo = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;
  // X = yesterday, X+1 = today (a repurchase is dated now)
  const X = sql("select (current_date - 1)::text"), X1 = sql("select current_date::text");
  const realMgrUid = sql(`select uid from users where email = '${MGR}'`);
  const mgrUid = ensureSeller(MGR, PW); // (ge) E2E seller: its days are always free; the real manager's day is never locked
  const brUid = sql(`select branch_uid from daily_reconciliation where user_uid = '${realMgrUid}' and branch_uid is not null order by reconciliation_date desc limit 1`);
  const check = async () => (await api('GET', `/api/v1/reconciliation/purchase-check?from=${X}&to=${X1}`, ceo)).j?.data || [];
  const gapX = (g) => g.find((x) => x.day === X);
  /** reco - recorded of day X (0 when it agrees): the test looks at how its own rows move it (works on a dump with real data) */
  const dX = (g) => { const x = gapX(g); return x ? x.reco - x.recorded : 0; };
  const d0 = dX(await check());

  const old = await api('GET', '/api/v1/reconciliation/purchase-check?from=2026-06-01&to=2026-10-31', ceo);
  const oldReco = Number(sql("select count(*) from reconciliation_purchases p join daily_reconciliation r on r.uid = p.reconciliation_uid where not p.is_deleted and r.reconciliation_date < '2026-11-01'"));
  ok(`M0 kabla ya tarehe ya kuanza hakuna siku inayoripotiwa (reco za zamani zenye manunuzi: ${oldReco})`, old.j?.status === 'Success' && (old.j.data || []).length === 0 && oldReco > 0, JSON.stringify(old.j).slice(0, 200));

  // M1 the seller's reco of X: Pepsi 200,000 from the drawer (evidence only)
  const ru = `e2e-6e-${Date.now()}`;
  const j0 = Number(sql("select count(*) from journal_entry"));
  sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status) values ('${ru}', now(), '${X}', '${mgrUid}', 'E2E Muuzaji', '${brUid}', 'DRAFT')`);
  sql(`insert into reconciliation_purchases (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, supplier_name, description, amount) values ('${ru}-p', now(), true, false, true, '${ru}', 'Pepsi', 'E2E 6e Pepsi malipo ya droo', 200000)`);
  let g = await check();
  ok('M1 reco ya X: Pepsi 200,000, hakuna manunuzi -> onyo (tofauti +200,000); hakuna journal', !!gapX(g) && dX(g) - d0 === 200000 && Number(sql('select count(*) from journal_entry')) === j0, `d0=${d0} ${JSON.stringify(g)}`);

  const pu = sql("select p.uid from products p where not coalesce(p.is_deleted,false) and p.is_active and exists (select 1 from purchases x where x.product_uid = p.uid) and not exists (select 1 from purchases x where x.product_uid = p.uid and x.status = 'PENDING') order by p.id limit 1");
  const buy = async (source, account, tag) => {
    const r = await api('POST', '/api/v1/purchases/repurchase/bulk', ceo, { paymentSource: source, sourceAccount: account, generalNotes: `E2E 6e ${tag}`,
      items: [{ productUid: pu, useLastPurchaseData: false, purchaseType: 'INDIVIDUAL_PIECES', priceInputMode: 'TOTAL_AMOUNT', quantity: 10, purchasePrice: 200000, supplierName: 'Pepsi' }] });
    const uid = sql(`select coalesce((select uid from purchases where product_uid = '${pu}' and payment_source = '${source}' and status <> 'CANCELLED' order by id desc limit 1), '')`);
    return { r, uid };
  };

  // M2 paid from NMB on X+1 -> not the drawer
  const nmb = await buy('BENKI', '1021', 'NMB');
  g = await check();
  ok('M2 manunuzi NMB 200,000 kesho yake -> onyo linabaki (chanzo si droo)', nmb.uid !== '' && !!gapX(g) && dX(g) - d0 === 200000, `${msg(nmb.r)} ${JSON.stringify(g)}`);
  if (nmb.uid) await api('POST', `/api/v1/purchases/${nmb.uid}/cancel?cancellationReason=${encodeURIComponent('E2E 6e jaribio la NMB')}`, ceo);

  // M3 paid from the drawer on X+1
  const droo = await buy('DROO', null, 'DROO');
  g = await check();
  const du = droo.uid || 'x';
  // the GL is written when the purchase is approved (the module's normal flow)
  const apv = await api('POST', `/api/v1/purchases/${du}/approve`, ceo, {});
  await new Promise((res) => setTimeout(res, 800));
  const jr = sql(`select count(*) || '|' || coalesce(string_agg(l.account_code || ':' || l.credit_amount, ',') filter (where l.credit_amount > 0), '') from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where j.reference_uid = '${du}' and j.status = 'POSTED'`);
  const nJ = sql(`select count(*) from journal_entry where reference_uid = '${du}' and status = 'POSTED'`);
  ok('M3 manunuzi Taslimu 200,000 kesho yake -> onyo la X linaondoka; yakiidhinishwa: journal 1, Cr 1000 200,000', droo.uid !== '' && dX(g) === d0 && (d0 !== 0 || !gapX(g)) && nJ === '1' && /1000:200000/.test(jr), `${msg(droo.r)} | approve: ${msg(apv)} | gaps=${JSON.stringify(g)} journals=${nJ} ${jr}`);

  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
