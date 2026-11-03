// Onyo la manunuzi kwenye njia 2 zisizo Repurchase (owner cg, 02/11), PRODUCTION build http://127.0.0.1:4300/v3/:
//   N. "Manunuzi mapya" (ununuzi wa kwanza): kipimo = wastani wa gharama Stoo (hakuna ununuzi wa mwisho).
//      Kwenye nakala hakuna bidhaa isiyonunuliwa yenye wastani > 0, kwa hiyo /display/stock/summary inapewa wastani wa
//      majaribio kwa bidhaa hiyo moja (route mock). POST /purchases inazuiwa (abort) - hakuna kinachoandikwa.
//   H. "Hariri" (ununuzi PENDING): kipimo = ununuzi wa mwisho. Setup inaunda PENDING MOJA kwenye nakala ya kutupwa
//      (API /repurchase/bulk, bei ya kawaida), PUT inazuiwa, na mwishoni PENDING hiyo inafutwa (API DELETE).
// Run: NODE_PATH=<npx playwright node_modules> node onyo_fomu_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const PW = 'B1-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}

let cleanup = async () => undefined;
(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  const token = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;

  // H setup: a product with a RECEIVED purchase (last cost per piece known) and nothing pending / approved
  const [hUid, hName, hCost] = sql(`select pr.uid, pr.product_name, round(p.cost_per_piece) from products pr
      join lateral (select cost_per_piece from purchases p where p.product_uid = pr.uid and p.status = 'RECEIVED' and coalesce(p.is_deleted,false) = false order by p.created_at desc limit 1) p on true
     where coalesce(pr.is_deleted,false) = false and p.cost_per_piece >= 1000
       and not exists (select 1 from purchases q where q.product_uid = pr.uid and q.status in ('PENDING','APPROVED') and coalesce(q.is_deleted,false) = false)
     order by pr.product_name limit 1`).split('|');
  const SUP = 'E2E-ONYO-' + Date.now();
  const made = await api('POST', '/api/v1/purchases/repurchase/bulk', token, { paymentSource: 'DROO', items: [{ productUid: hUid, useLastPurchaseData: false, purchaseType: 'INDIVIDUAL_PIECES', priceInputMode: 'PER_PIECE', quantity: 1, purchasePrice: Number(hCost), supplierName: SUP }] });
  const pending = sql(`select uid from purchases where product_uid = '${hUid}' and supplier_name = '${SUP}' and status = 'PENDING'`);
  cleanup = async () => { if (pending) await api('DELETE', `/api/v1/purchases/${pending}`, token); };
  ok('S1 setup: PENDING moja ya bei ya kawaida imeundwa', !!pending, `${hName} ${hCost} ${JSON.stringify(made.j).slice(0, 200)}`);

  // N setup: a product never purchased
  const [nUid, nName] = sql(`select pr.uid, pr.product_name from products pr where coalesce(pr.is_deleted,false) = false
      and not exists (select 1 from purchases p where p.product_uid = pr.uid) order by pr.product_name limit 1`).split('|');
  const AVG = 1000;

  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  let posts = 0, puts = 0;
  await page.route('**/api/v1/purchases', (r) => (r.request().method() === 'POST' ? (posts++, r.abort()) : r.fallback()));
  await page.route(`**/api/v1/purchases/${pending}`, (r) => (r.request().method() === 'PUT' ? (puts++, r.abort()) : r.fallback()));
  await page.route('**/display/stock/summary', async (r) => {
    const res = await r.fetch();
    const body = await res.json();
    const rows = Array.isArray(body) ? body : body.data;
    const row = rows.find((x) => x.productUid === nUid);
    if (row) row.averageCostPrice = AVG;
    else rows.push({ productUid: nUid, productName: nName, averageCostPrice: AVG, currentStock: 0 });
    await r.fulfill({ response: res, json: body });
  });

  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));

  const form = page.locator('app-purchase-form-dialog');
  const jump = form.locator('p.jump');
  const price = form.locator('lsms-text-field[formcontrolname="purchasePrice"] input');
  const qty = form.locator('lsms-text-field[formcontrolname="quantity"] input');
  const save = page.locator('button[type="submit"][form="purchase-form"]');
  const dlg = page.locator('lsms-confirm-dialog');
  const setPrice = async (v) => { await price.fill(String(v)); await price.press('Tab'); await page.waitForTimeout(400); };
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };

  // ---- H. edit a PENDING purchase
  await page.goto(V3 + '/purchases');
  await page.waitForTimeout(2000);
  await closeBanners();
  const row = page.locator('tr, [role="row"], .m-row, li').filter({ hasText: SUP }).first();
  let rowFound = true;
  try { await row.waitFor({ timeout: 30000 }); } catch { rowFound = false; }
  if (rowFound) {
    await row.click();
    await page.getByRole('button', { name: /^(Edit|Hariri)$/ }).first().click();
    await form.waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500); // reference (template) loads
    ok('H1 kuhariri: bei ya kawaida haina onyo', (await jump.count()) === 0);
    await setPrice(Number(hCost) * 10);
    ok('H2 kuhariri: bei x10 -> "kreti au chupa?" (ya manunuzi ya mwisho)', (await jump.count()) === 1 && /manunuzi ya mwisho|last purchase/.test(await jump.innerText()), await jump.count());
    await save.click();
    // (cg) the dialog is attached before its text is rendered: wait for the text itself
    await dlg.filter({ hasText: /Kreti au chupa|Crate or bottle/ }).waitFor({ timeout: 10000 }).catch(() => undefined);
    const t = (await dlg.count()) ? await dlg.innerText() : '';
    ok('H3 kuhifadhi: dialogi "Kreti au chupa?" inataja bidhaa', /Kreti au chupa|Crate or bottle/.test(t) && t.includes(hName.slice(0, 10)), JSON.stringify(t.slice(0, 200)));
    await dlg.getByRole('button', { name: /^(Rekebisha|Fix it)$/ }).click();
    await page.waitForTimeout(600);
    ok('H4 Rekebisha: hakuna PUT, fomu bado wazi', puts === 0 && (await form.count()) === 1, `puts ${puts}`);
    await save.click();
    await dlg.waitFor({ timeout: 10000 });
    await dlg.getByRole('button', { name: /Bei ni sahihi|The price is right/ }).click();
    for (let i = 0; i < 20 && puts === 0; i++) await page.waitForTimeout(250);
    ok('H5 Bei ni sahihi: PUT inatumwa (haikatai)', puts === 1, `puts ${puts}`);
    await page.keyboard.press('Escape');
    await page.goto(V3 + '/purchases');
  } else {
    ok('H0 safu ya PENDING ya majaribio inaonekana kwenye Purchases', false, SUP);
  }

  // ---- N. a first purchase (reference = Store average, mocked for this product only)
  await page.goto(V3 + '/purchases');
  await page.waitForTimeout(1500);
  await closeBanners();
  await page.getByRole('button', { name: /^(New purchase|Manunuzi mapya)$/ }).first().click();
  await form.waitFor({ timeout: 15000 });
  const combo = form.locator('lsms-combobox[formcontrolname="productUid"] input[role="combobox"]');
  await combo.click();
  await combo.fill(nName);
  await page.locator('[role="option"]').filter({ hasText: nName }).first().click();
  await page.waitForTimeout(2000); // eligibility + reference
  const pieces = form.getByRole('radio', { name: /(Pieces|Vipande)$/ });
  await pieces.first().click();
  for (let i = 0; i < 20 && (await pieces.first().getAttribute('aria-checked')) !== 'true'; i++) await page.waitForTimeout(100);
  ok('N0 aina = vipande (bei kwa kipande)', (await pieces.first().getAttribute('aria-checked')) === 'true');
  await qty.fill('1'); await qty.press('Tab');
  await setPrice(AVG);
  ok('N1 ununuzi mpya: bei = wastani -> hakuna onyo', (await jump.count()) === 0);
  await setPrice(AVG * 10);
  ok('N2 ununuzi mpya: bei x10 ya wastani wa Stoo -> onyo', (await jump.count()) === 1 && /wastani wa gharama Stoo|average cost in Store/.test(await jump.innerText()), await jump.count());
  // (cs) C3: no registered supplier = paid now -> the source is required before the price check runs
  await form.locator('app-payment-source-picker [data-source="DROO"]').click();
  await save.click();
  await dlg.filter({ hasText: /Kreti au chupa|Crate or bottle/ }).waitFor({ timeout: 10000 }).catch(() => undefined);
  ok('N3 kuhifadhi: dialogi "Kreti au chupa?"', (await dlg.count()) === 1 && /Kreti au chupa|Crate or bottle/.test(await dlg.innerText()));
  if (await dlg.count()) await dlg.getByRole('button', { name: /^(Rekebisha|Fix it)$/ }).click();
  await page.waitForTimeout(600);
  ok('N4 Rekebisha: hakuna POST', posts === 0, `posts ${posts}`);
  await save.click();
  await dlg.waitFor({ timeout: 10000 });
  await dlg.getByRole('button', { name: /Bei ni sahihi|The price is right/ }).click();
  for (let i = 0; i < 20 && posts === 0; i++) await page.waitForTimeout(250);
  ok('N5 Bei ni sahihi: POST inatumwa (haikatai)', posts === 1, `posts ${posts}`);

  // ---- DB unchanged, then clean up the one PENDING made in setup
  ok('D1 DB: PENDING ya majaribio haikubadilika (PUT ilizuiwa)', sql(`select round(purchase_price) from purchases where uid = '${pending}'`) === String(hCost));
  ok('D2 DB: hakuna ununuzi wa bidhaa mpya (POST ilizuiwa)', sql(`select count(*) from purchases where product_uid = '${nUid}'`) === '0');
  await cleanup();
  ok('D3 usafi: PENDING ya majaribio imefutwa', sql(`select count(*) from purchases where uid = '${pending}' and coalesce(is_deleted,false) = false`) === '0');

  ok('Z hakuna JS error kwenye kurasa', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch(async (e) => { console.log('ERROR', e.message); await cleanup().catch(() => undefined); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
