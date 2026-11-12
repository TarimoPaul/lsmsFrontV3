// Kazi 3 (owner ec = b; BAADA 0.1) + L1, on the PRODUCTION build of feature/t2-gharama + backend Docker-local (V142).
// A sale below cost is ALLOWED only with a reason; it is then recorded as BELOW_COST and waits for the CEO's "Nimeona".
//   UI  MANAGER: POS cart CASTLE LITE x4 at the normal price, discount so the total is 600 under cost -> "Kamilisha"
//       -> dialog "Mauzo chini ya gharama" with the server's figures; nothing saved yet; reason -> sale saved,
//       sale_change_audit BELOW_COST (cost -> total, reason, MANAGER)
//   API the same body without a reason -> 422 BELOW_COST_REASON, no sale, no stock change; junk reason -> 422;
//       no discount -> 200, no BELOW_COST row; edit a sale's discount below cost (A6 reason) -> BELOW_COST row
//   CEO banner + Kagua shows "Imeuzwa chini ya gharama"; /pending amount leaves the cost out; "Nimeona" clears it
//   L1  backend log: "SELLING BELOW RECOMMENDED PRICE" only as WARN, never ERROR
// Throw-away local copy only (sales are made on it). Run: NODE_PATH=<npx playwright node_modules> node k3_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'K3-Jaribio-Local-2026';
const TAG = 'E2E-K3';
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
const belowRows = () => Number(sql("select count(*) from sale_change_audit where action = 'BELOW_COST'"));
const salesCount = () => Number(sql('select count(*) from sales'));
const stock = (uid) => Number(sql(`select current_stock from products where uid = '${uid}'`));

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  const [pUid, pName, avg, price, ppp] = sql("select uid, product_name, current_average_cost, piece_sale_price, coalesce(pieces_per_package,1) from products where product_name = 'CASTLE LITE' and not coalesce(is_deleted,false) limit 1").split('|');
  const [cUid, cName, cPhone] = sql("select uid, name, coalesce(phone_number,'') from customers where not coalesce(is_deleted,false) order by id limit 1").split('|');
  const qty = 4;
  const cost = Math.round(Number(avg) * qty * 100) / 100;
  const sub = Number(price) * qty;
  const discount = Math.round((sub - cost + 600) * 100) / 100; // total = cost - 600
  const mgrTok = await login(MGR);
  const ceoTok = await login(CEO);
  const below0 = belowRows();

  // ── UI: POS as MANAGER ──
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const bodies = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/v1\/sales\/partial$/.test(r.url())) bodies.push(r.postDataJSON()); });
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(MGR);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  const cartKey = await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('lsms_session') || '{}');
    return `lsms.cart.${s.activeBranchUid ?? 'none'}.${s.user?.uid ?? s.user?.email ?? 'me'}`;
  });
  await page.evaluate(({ key, saved }) => { localStorage.setItem(key, JSON.stringify(saved)); sessionStorage.setItem('lsms.missingDaysAck', '1'); }, {
    key: cartKey,
    saved: {
      lines: [{ key: `${pUid}|PIECES`, productUid: pUid, name: pName, category: null, saleType: 'PIECES', unitPieces: 1, qty, unitPrice: Number(price), defaultPrice: Number(price), costPerPiece: Number(avg), piecesPerPackage: Number(ppp), abbreviation: null }],
      customer: { uid: cUid, name: cName, phone: cPhone || null },
      discount,
      heldSince: null,
    },
  });
  await page.goto(V3 + '/sales/new');
  await page.waitForTimeout(3000);
  const closeBanners = page.getByRole('button', { name: /^(Close all|Funga zote)$/ });
  if (await closeBanners.count()) await closeBanners.first().click();
  const sales0 = salesCount();
  const stock0 = stock(pUid);
  const pay = page.getByRole('button', { name: /(Complete sale|Kamilisha mauzo)/ }).first();
  ok('U0 kapu: CASTLE LITE x4 + punguzo, kitufe kinaonyesha total = gharama - 600', /Kamilisha|Complete/.test(await pay.innerText()) && await pay.isEnabled(), await pay.innerText());
  await pay.click();
  const dlg = page.locator('app-reason-dialog');
  await dlg.waitFor({ timeout: 20000 }).catch(() => undefined);
  const dlgTxt = (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ');
  ok('U1 dialog "Mauzo chini ya gharama" na takwimu za server (chini kwa TZS 600)', /chini ya gharama|below cost/i.test(dlgTxt) && /chini kwa TZS 600\b/.test(dlgTxt), dlgTxt.slice(0, 300));
  ok('U2 hakuna kilichohifadhiwa kabla ya sababu', salesCount() === sales0 && stock(pUid) === stock0 && belowRows() === below0);
  const confirm = dlg.getByRole('button', { name: /(Sell with this reason|Uza kwa sababu hii)/ });
  await dlg.locator('textarea').fill('aaaaaaaaaaaaaa');
  await page.waitForTimeout(300);
  ok('U3 sababu takataka: kitufe kimezimwa', await confirm.isDisabled());
  const why = `Mteja wa jumla, ofa ya bei ${TAG}`;
  await dlg.locator('textarea').fill(why);
  await confirm.click();
  await page.locator('app-sale-done-dialog').waitFor({ timeout: 20000 }).catch(() => undefined);
  const row = sql(`select a.sale_uid, round(a.amount_before), round(a.amount_after), a.by_email, a.result from sale_change_audit a where a.action='BELOW_COST' and a.reason = '${why}' order by a.id desc limit 1`).split('|');
  ok('U4 sale imehifadhiwa + BELOW_COST: gharama -> total, sababu, MANAGER', row[4] === 'ALLOWED' && Number(row[1]) === Math.round(cost) && Number(row[2]) === Math.round(cost - 600) && row[3] === MGR && salesCount() === sales0 + 1 && stock(pUid) === stock0 - qty, row.join('|'));
  ok('U5 ombi la pili lilibeba belowCostReason (la kwanza halikuwa nalo)', bodies.length === 2 && !bodies[0].belowCostReason && bodies[1].belowCostReason === why, JSON.stringify(bodies.map((b) => b.belowCostReason ?? null)));
  ok('U6 hakuna kosa la JavaScript (POS)', errors.length === 0, errors.join(' | ').slice(0, 300));

  // ── API ──
  const body = { ...bodies[0], belowCostReason: null, saleNotes: `${TAG} api` };
  const s1 = salesCount(); const st1 = stock(pUid); const b1 = belowRows();
  const r1 = await api('POST', '/api/v1/sales/partial', mgrTok, body);
  ok('A1 bila sababu -> 422 BELOW_COST_REASON, hakuna sale, stock haijaguswa', r1.status === 422 && r1.j?.errorCode === 'BELOW_COST_REASON' && salesCount() === s1 && stock(pUid) === st1 && belowRows() === b1, `${r1.status} ${r1.j?.errorCode} ${r1.j?.message}`);
  const r2 = await api('POST', '/api/v1/sales/partial', mgrTok, { ...body, belowCostReason: 'aaaaaaaaaaaaaa' });
  ok('A2 sababu takataka -> 422, hakuna sale', r2.status === 422 && salesCount() === s1, `${r2.status}`);
  const r3 = await api('POST', '/api/v1/sales/partial', mgrTok, { ...body, discountAmount: 0, saleNotes: `${TAG} bila punguzo` });
  const fairUid = r3.j?.data?.sale?.uid;
  ok('A3 bila punguzo (juu ya gharama) -> 200, hakuna BELOW_COST mpya', r3.status === 200 && !!fairUid && belowRows() === b1, `${r3.status} ${r3.j?.message}`);
  const sd = sql(`select sale_date from sales where uid='${fairUid}'`).replace(' ', 'T').slice(0, 19);
  const editWhy = `Punguzo la baadaye kwa mteja ${TAG}`;
  const r4 = await api('PUT', `/api/v1/sales/${fairUid}?reason=${encodeURIComponent(editWhy)}`, mgrTok, { uid: fairUid, saleDate: sd, discountAmount: discount, saleNotes: `${TAG} edit`, customerUid: cUid });
  ok('A4 edit: punguzo linashusha chini ya gharama -> inaruhusiwa kwa sababu ya A6, BELOW_COST yenye sababu hiyo', r4.j?.status === 'Success' && sql(`select count(*) from sale_change_audit where action='BELOW_COST' and sale_uid='${fairUid}' and reason='${editWhy}'`) === '1', `${r4.status} ${r4.j?.message}`);

  // between cost and cost x 1.1 (L1 territory): allowed with no reason, no audit row - only the WARN log
  const thin = Math.ceil(Number(avg) * 1.03);
  const b5 = belowRows();
  const r5 = await api('POST', '/api/v1/sales/partial', mgrTok, { ...body, discountAmount: 0, saleNotes: `${TAG} bei nyembamba`,
    saleDetails: body.saleDetails.map((l) => ({ ...l, unitPrice: thin, overrideUnitPrice: thin, subTotal: thin * l.packageQuantity })) });
  ok(`A5 bei ${thin} (juu ya gharama, chini ya x1.1) -> 200 bila sababu, hakuna BELOW_COST`, r5.status === 200 && !!r5.j?.data?.sale?.uid && belowRows() === b5, `${r5.status} ${r5.j?.message}`);

  // ── CEO review ──
  const pend = await api('GET', '/api/v1/sales/changes/pending', ceoTok);
  const mine = (pend.j?.data?.items ?? []).filter((i) => i.action === 'BELOW_COST' && /E2E-K3/.test(i.reason || ''));
  const nonBelowAmt = Number(sql(`select coalesce(sum(a.amount_before),0) from sale_change_audit a where a.result='ALLOWED' and a.action <> 'BELOW_COST' and not exists (select 1 from sale_change_ack k join users u on u.uid = k.by_uid where k.audit_id = a.id and u.email = '${CEO}')`));
  ok('R1 /pending ya CEO ina BELOW_COST 2; kiasi hakijumuishi gharama', mine.length === 2 && Number(pend.j?.data?.below_cost) >= 2 && Math.round(Number(pend.j?.data?.amount)) === Math.round(nonBelowAmt), `${mine.length} ${pend.j?.data?.below_cost} ${pend.j?.data?.amount} vs ${nonBelowAmt}`);
  const mgrPend = await api('GET', '/api/v1/sales/changes/pending', mgrTok);
  ok('R2 MANAGER hana Kagua (403)', mgrPend.status === 403, `${mgrPend.status}`);

  const ctx2 = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push(String(e)));
  await p2.goto(V3 + '/login');
  await p2.locator('input[autocomplete="username"]').fill(CEO);
  await p2.locator('input[autocomplete="current-password"]').fill(PW);
  await p2.locator('button[type="submit"]').first().click();
  await p2.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await p2.waitForTimeout(3000);
  const banner = p2.locator('app-sale-changes-banner');
  ok('R3 banner ya CEO inataja chini ya gharama', /chini ya gharama|below-cost/.test(await banner.innerText().catch(() => '')));
  await banner.getByRole('button', { name: /^(Review|Kagua)$/ }).click();
  const rv = p2.locator('app-sale-changes-dialog');
  await rv.waitFor({ timeout: 15000 });
  await p2.waitForTimeout(1500);
  ok('R4 Kagua inaonyesha "Imeuzwa chini ya gharama" + sababu', /Imeuzwa chini ya gharama|Sold below cost/.test(await rv.innerText()) && (await rv.innerText()).includes(why));
  const ids = mine.map((i) => i.id);
  const ack = await api('POST', '/api/v1/sales/changes/ack', ceoTok, { ids, note: 'Nimeona E2E K3' });
  const pend2 = await api('GET', '/api/v1/sales/changes/pending', ceoTok);
  ok('R5 "Nimeona" inaondoa BELOW_COST kwenye pending ya CEO', ack.j?.data?.acked === 2 && !(pend2.j?.data?.items ?? []).some((i) => ids.includes(i.id)), JSON.stringify(ack.j?.data));
  ok('R6 hakuna kosa la JavaScript (CEO)', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();

  // ── L1 ──
  const logs = execFileSync('docker', ['logs', 'lsms-local-backend-1'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const sel = logs.split('\n').filter((l) => /SELLING BELOW RECOMMENDED PRICE/.test(l));
  ok('L1 "SELLING BELOW RECOMMENDED PRICE" ni WARN tu, si ERROR', sel.length > 0 && sel.every((l) => /\bWARN\b/.test(l) && !/\bERROR\b/.test(l)), `${sel.length} ${sel.slice(0, 1).join('')}`);
  ok('L2 "SALE BELOW COST allowed" iko kwenye log (WARN)', logs.split('\n').some((l) => /WARN/.test(l) && /SALE BELOW COST allowed/.test(l)));

  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
