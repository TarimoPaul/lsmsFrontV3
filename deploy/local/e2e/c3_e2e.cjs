// C3 (owner 03/11 cs): chanzo cha malipo kwa msambazaji - DROO / BENKI (orodha) / SIMU (orodha) / MMILIKI, cha lazima,
// bila default - on the PRODUCTION build (http://127.0.0.1:4300/v3/ + backend Docker-local with V138 + PaymentSource).
//   A  UI "Lipa" (supplier statement): no source -> refused (nothing written); BENKI without a bank -> refused;
//      BENKI + NMB -> saved BENKI/1021, method BANK_TRANSFER, provider NMB; D unset -> journal Cr 1000; statement "Benki · NMB".
//   B  API both sides of D: D = yesterday -> SIMU Tigo Cr 1031, MMILIKI Cr 2300 (never 3000); D tomorrow -> BENKI Cr 1000;
//      no source / free-text bank -> refused.
//   C  UI new purchase without a registered supplier: note "paid now", no source -> no POST; MMILIKI -> saved; approve -> Cr 2300.
//   D  UI repurchase order: no source -> nothing sent; SIMU without wallet -> nothing; SIMU + M-Pesa -> body carries SIMU/1030.
// Writes on the throw-away copy only (test password, gl_config D for B and back to NULL, the rows it makes - deleted /
// cancelled at the end). Run: NODE_PATH=<npx playwright node_modules> node c3_e2e.cjs
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
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
/** Dr - Cr per account of the live journals of one reference, as "code:amount" sorted. */
const journal = (ref) => sql(`select string_agg(account_code || ':' || round(s), ',' order by account_code) from (select l.account_code, sum(l.debit_amount - l.credit_amount) s
    from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1) x`);
const localNow = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 19); };

const made = { payments: [], purchases: [] };
let tokenG = null;
async function cleanup() {
  for (const u of made.payments.splice(0)) await api('DELETE', `/api/v1/supplier-payments/${u}`, tokenG);
  // purchases of this run, and of an earlier crashed run (marked by their source + note)
  const left = sql("select uid from purchases where payment_source is not null and status in ('PENDING','APPROVED') and purchase_notes like '%E2E-C3%'").split('\n').filter(Boolean);
  for (const u of new Set([...made.purchases.splice(0), ...left])) await api('POST', `/api/v1/purchases/${u}/cancel?cancellationReason=${encodeURIComponent('E2E C3 - majaribio')}`, tokenG);
  // payments of an earlier crashed run
  for (const u of sql("select uid from supplier_payments where reference = 'E2E-C3' and not is_deleted").split('\n').filter(Boolean)) await api('DELETE', `/api/v1/supplier-payments/${u}`, tokenG);
  sql('update gl_config set bank_cutover_date = null');
}
(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  sql('update gl_config set bank_cutover_date = null');
  const token = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;
  tokenG = token;
  await cleanup();
  const [supUid, supName] = sql(`select s.uid, s.name from suppliers s where not coalesce(s.is_deleted,false)
      and (select count(*) from suppliers q where q.name = s.name) = 1 order by s.created_at limit 1`).split('|');
  ok('S1 nakala: msambazaji wa majaribio + akaunti 2300 + D haijawekwa', !!supUid && sql("select count(*) from gl_account where account_code='2300'") === '1'
      && sql('select coalesce(bank_cutover_date::text, \'NULL\') from gl_config') === 'NULL', `${supName}`);
  const payCount = () => sql(`select count(*) from supplier_payments where supplier_uid = '${supUid}'`);

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };

  // ── A. UI "Lipa" ──
  await page.goto(V3 + '/suppliers');
  await page.waitForTimeout(1500);
  await closeBanners();
  await page.locator('app-suppliers-page table tbody tr').filter({ hasText: supName }).first().click();
  const stmt = page.locator('app-supplier-statement-dialog');
  await stmt.waitFor({ timeout: 20000 });
  await stmt.getByRole('button', { name: /^(Record payment|Lipa)$/ }).first().click();
  const pay = page.locator('app-supplier-payment-dialog');
  await pay.waitFor({ timeout: 15000 });
  const before = payCount();
  await pay.locator('lsms-text-field[formcontrolname="amount"] input').fill('1000');
  const save = page.locator('button[type="submit"][form="pay-form"]');
  ok('A0 hakuna chanzo kilichochaguliwa mwanzoni (bila default)', (await pay.locator('app-payment-source-picker button.on').count()) === 0);
  await save.click();
  await page.waitForTimeout(800);
  const errA = pay.locator('app-payment-source-picker .err');
  ok('A1 bila chanzo: "Chagua chanzo" na hakuna kilichoandikwa', /Chagua chanzo|Choose where/.test(await errA.innerText().catch(() => '')) && payCount() === before, `${payCount()} vs ${before}`);
  await pay.locator('[data-source="BENKI"]').click();
  await save.click();
  await page.waitForTimeout(800);
  ok('A2 Benki bila benki: "Chagua benki" na hakuna kilichoandikwa', /Chagua benki|Choose the bank/.test(await errA.innerText().catch(() => '')) && payCount() === before);
  ok('A3 orodha ya benki ni akaunti halisi 5 (si maandishi)', (await pay.locator('[data-account]').count()) === 5 && (await pay.locator('input[formcontrolname="paymentProvider"], lsms-text-field[formcontrolname="paymentProvider"]').count()) === 0);
  await pay.locator('[data-account="1021"]').click();
  await save.click();
  await pay.waitFor({ state: 'detached', timeout: 15000 }).catch(() => undefined);
  const rowA = sql(`select uid, payment_source, source_account, payment_method, payment_provider from supplier_payments where supplier_uid = '${supUid}' order by created_at desc limit 1`).split('|');
  if (rowA[0]) made.payments.push(rowA[0]);
  ok('A4 imehifadhiwa: BENKI / 1021 / BANK_TRANSFER / NMB', payCount() === String(Number(before) + 1) && rowA.slice(1).join('|') === 'BENKI|1021|BANK_TRANSFER|NMB', rowA.join('|'));
  ok('A5 GL (D haijawekwa): Dr 2000 / Cr 1000', journal(rowA[0]) === '1000:-1000,2000:1000', journal(rowA[0]));
  await page.waitForTimeout(1200);
  const shown = await stmt.locator('[data-test="chanzo-malipo"]').allInnerTexts().catch(() => []);
  ok('A6 taarifa ya msambazaji inaonyesha "Benki · NMB"', shown.some((t) => /Benki · NMB|Bank · NMB/.test(t)), JSON.stringify(shown));
  await page.keyboard.press('Escape');

  // ── B. API both sides of D ──
  const body = (paymentSource, sourceAccount) => ({ supplierUid: supUid, amount: 2000, paymentSource, sourceAccount, paymentDate: localNow(), reference: 'E2E-C3' });
  // the UI payment of A gets the same reference so a crashed run is cleaned next time
  if (rowA[0]) sql(`update supplier_payments set reference = 'E2E-C3' where uid = '${rowA[0]}'`);
  sql("update gl_config set bank_cutover_date = current_date - 1");
  const b1 = await api('POST', '/api/v1/supplier-payments', token, body('SIMU', '1031'));
  if (b1.j.data?.uid) made.payments.push(b1.j.data.uid);
  ok('B1 baada ya D: SIMU Tigo -> Cr 1031', journal(b1.j.data?.uid) === '1031:-2000,2000:2000', journal(b1.j.data?.uid) + ' ' + JSON.stringify(b1.j).slice(0, 150));
  const b2 = await api('POST', '/api/v1/supplier-payments', token, body('MMILIKI', null));
  if (b2.j.data?.uid) made.payments.push(b2.j.data.uid);
  ok('B2 MMILIKI -> Cr 2300 (si 3000)', journal(b2.j.data?.uid) === '2000:2000,2300:-2000', journal(b2.j.data?.uid));
  sql("update gl_config set bank_cutover_date = current_date + 1");
  const b3 = await api('POST', '/api/v1/supplier-payments', token, body('BENKI', '1022'));
  if (b3.j.data?.uid) made.payments.push(b3.j.data.uid);
  ok('B3 kabla ya D: BENKI NBC -> Cr 1000, chanzo kimehifadhiwa', journal(b3.j.data?.uid) === '1000:-2000,2000:2000'
      && sql(`select payment_source || '/' || source_account from supplier_payments where uid = '${b3.j.data?.uid}'`) === 'BENKI/1022', journal(b3.j.data?.uid));
  const n0 = payCount();
  const b4 = await api('POST', '/api/v1/supplier-payments', token, body(null, null));
  const b5 = await api('POST', '/api/v1/supplier-payments', token, body('BENKI', 'CRDB'));
  ok('B4 bila chanzo / benki ya maandishi -> inakataliwa, hakuna kilichoandikwa',
      b4.j.status !== 'Success' && /Chagua chanzo/.test(b4.j.message || '') && /Chagua benki/.test(b5.j.message || '') && payCount() === n0, `${b4.j.message} | ${b5.j.message}`);
  sql('update gl_config set bank_cutover_date = null');

  // ── C. UI new purchase without a registered supplier ──
  // a product never bought: the form for a product with history sends the user to "Nunua tena" instead
  const [pUid, pName] = sql(`select pr.uid, pr.product_name from products pr where coalesce(pr.is_deleted,false) = false
       and not exists (select 1 from purchases q where q.product_uid = pr.uid)
       and (select count(*) from products q where q.product_name = pr.product_name and coalesce(q.is_deleted,false) = false) = 1
     order by pr.product_name limit 1`).split('|');
  const pCost = '1500';
  let posts = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/v1\/purchases$/.test(r.url())) posts++; });
  await page.goto(V3 + '/purchases');
  await page.waitForTimeout(1500);
  await closeBanners();
  await page.getByRole('button', { name: /^(New purchase|Manunuzi mapya)$/ }).first().click();
  const form = page.locator('app-purchase-form-dialog');
  await form.waitFor({ timeout: 15000 });
  const combo = form.locator('lsms-combobox[formcontrolname="productUid"] input[role="combobox"]');
  await combo.click();
  await combo.fill(pName);
  await page.locator('[role="option"]').filter({ hasText: pName }).first().click();
  await page.waitForTimeout(2000);
  await form.locator('lsms-text-field[formcontrolname="quantity"] input').fill('1');
  const price = form.locator('lsms-text-field[formcontrolname="purchasePrice"] input');
  await price.fill(String(pCost)); await price.press('Tab');
  await page.waitForTimeout(600);
  ok('C1 bila msambazaji: ujumbe "umelipwa sasa" + chanzo kinaonekana', (await form.locator('[data-test="bila-msambazaji"]').count()) === 1 && (await form.locator('app-payment-source-picker').count()) === 1);
  const fsave = page.locator('button[type="submit"][form="purchase-form"]');
  await fsave.click();
  await page.waitForTimeout(900);
  ok('C2 bila chanzo: hakuna POST', posts === 0 && /Chagua chanzo|Choose where/.test(await form.locator('app-payment-source-picker .err').innerText().catch(() => '')), `posts ${posts}`);
  await form.locator('[data-source="MMILIKI"]').click();
  await fsave.click();
  const jumpDlg = page.locator('lsms-confirm-dialog');
  for (let i = 0; i < 40 && posts === 0; i++) {
    if (await jumpDlg.count()) await jumpDlg.getByRole('button', { name: /Bei ni sahihi|The price is right/ }).click().catch(() => undefined);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  const pu = sql(`select uid, payment_source, coalesce(source_account,'-'), status from purchases where product_uid = '${pUid}' order by created_at desc limit 1`).split('|');
  if (pu[0] && pu[3] === 'PENDING') { made.purchases.push(pu[0]); sql(`update purchases set purchase_notes = coalesce(purchase_notes,'') || ' E2E-C3' where uid = '${pu[0]}'`); }
  ok('C3 MMILIKI: ununuzi umehifadhiwa na chanzo', posts === 1 && pu.slice(1).join('|') === 'MMILIKI|-|PENDING', `posts ${posts} ${pu.join('|')}`);
  const ap = await api('POST', `/api/v1/purchases/${pu[0]}/approve`, token, {});
  ok('C4 kuidhinisha: Dr 1200 / Cr 2300', journal(pu[0]) === `1200:${pCost},2300:-${pCost}`, `${journal(pu[0])} ${JSON.stringify(ap.j).slice(0, 120)}`);
  await page.keyboard.press('Escape');

  // ── D. UI repurchase order (sending is intercepted - nothing is written) ──
  let bulkBody = null, bulks = 0;
  await page.route('**/api/v1/purchases/repurchase/bulk', (r) => { bulks++; bulkBody = r.request().postDataJSON(); return r.abort(); });
  const [rUid] = sql(`select pr.uid from products pr where coalesce(pr.is_deleted,false) = false and pr.uid <> '${pUid}'
       and exists (select 1 from purchases p where p.product_uid = pr.uid and p.status = 'RECEIVED')
       and not exists (select 1 from purchases q where q.product_uid = pr.uid and q.status in ('PENDING','APPROVED') and coalesce(q.is_deleted,false) = false)
     order by pr.product_name limit 1`).split('|');
  await page.goto(V3 + `/purchases/repurchase?add=${rUid}`);
  await page.waitForTimeout(3000);
  await closeBanners();
  const send = page.locator('button.send');
  if (!(await send.isVisible().catch(() => false))) { const v = page.getByRole('button', { name: /(View order|Angalia agizo)/ }); if (await v.count()) await v.first().click(); }
  await send.click();
  await page.waitForTimeout(900);
  ok('D1 agizo bila chanzo: halitumwi', bulks === 0 && /Chagua chanzo|Choose where/.test(await page.locator('app-payment-source-picker .err').innerText().catch(() => '')), `bulks ${bulks}`);
  await page.locator('app-payment-source-picker [data-source="SIMU"]').click();
  await send.click();
  await page.waitForTimeout(900);
  ok('D2 Simu bila akaunti: halitumwi', bulks === 0 && /akaunti ya simu|the wallet/.test(await page.locator('app-payment-source-picker .err').innerText().catch(() => '')));
  await page.locator('app-payment-source-picker [data-account="1030"]').click();
  await send.click();
  const dlg = page.locator('lsms-confirm-dialog');
  for (let i = 0; i < 20 && bulks === 0; i++) {
    if (await dlg.count()) await dlg.getByRole('button', { name: /Bei ni sahihi|The price is right/ }).click().catch(() => undefined);
    await page.waitForTimeout(250);
  }
  ok('D3 agizo: body ina SIMU / 1030 kwa agizo lote', bulks === 1 && bulkBody?.paymentSource === 'SIMU' && bulkBody?.sourceAccount === '1030', JSON.stringify(bulkBody).slice(0, 160));

  ok('E1 hakuna kosa la JavaScript', errors.length === 0, errors.join(' | ').slice(0, 300));

  // ── cleanup ──
  const all = [...made.payments], allPu = [...made.purchases];
  await cleanup();
  ok('Z1 usafi: malipo ya majaribio yamefutwa (GL imerudishwa)', all.length === 4 && all.every((u) => sql(`select is_deleted from supplier_payments where uid = '${u}'`) === 't') && all.every((u) => /^(\d+:0,?)+$/.test(journal(u))), all.map(journal).join(';'));
  ok('Z2 usafi: ununuzi wa majaribio umesitishwa (CANCELLED)', allPu.length === 1 && allPu.every((u) => sql(`select status from purchases where uid = '${u}'`) === 'CANCELLED'), allPu.map((u) => sql(`select status from purchases where uid = '${u}'`)).join(','));
  await browser.close();
  console.log(`MUHTASARI c3_e2e: PASS ${P}, FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch(async (e) => { console.log('FAIL kosa', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); await cleanup().catch(() => undefined); process.exit(1); });
