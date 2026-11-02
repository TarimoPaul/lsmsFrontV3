// B1 (V3 side of A6) end to end on the PRODUCTION build (owner 31/10 bg): V3 Docker-local (prod nginx.conf + edge,
// http://127.0.0.1:4300/v3/) in front of the backend Docker-local (release/2.4.0, PG15, 29/10 prod copy).
// Setup touches ONLY the throw-away local copy: test passwords, counting date moved back, one old price nudged.
// Run: NODE_PATH=<npx playwright node_modules> node b1_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const MGR = 'macheda@gmail.com', CEO = 'tarimo@gmail.com';
const PW = 'B1-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const shortReceipt = (r) => (/^RCP-\d{8}-(.+)$/.exec(r) || [null, r])[1];

function sql(q) {
  return execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
}

async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const apiToken = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;

async function newPage(browser, errors) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}

async function login(page, email) {
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
}

async function toast(page, re) {
  try {
    await page.locator('lsms-toast-host, [role="status"], [role="alert"]').filter({ hasText: re }).first().waitFor({ timeout: 15000 });
    return true;
  } catch { return false; }
}

async function openRowMenu(page, receipt) {
  const row = page.locator('tr, .m-row, li, .row').filter({ hasText: shortReceipt(receipt) }).first();
  await row.waitFor({ timeout: 30000 });
  // (bi) the debt banners (unread payments on the copy, "+47 more") slide in over the bottom-right corner and cover
  // the row's Actions button; close them first, as a user would
  await page.waitForTimeout(1500);
  const closeAll = page.getByRole('button', { name: /^(Close all|Funga zote)$/ });
  if (await closeAll.count()) await closeAll.first().click();
  await row.getByRole('button', { name: /Actions|Vitendo/ }).first().click();
}

const bannerCount = async (page) => { await page.waitForTimeout(2500); return page.locator('app-sale-changes-banner .bar').count(); };

(async () => {
  // ---- setup (local copy only)
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${MGR}','${CEO}')`);
  sql("update counting_session set started_at = '2026-06-01 06:00' where started_at > '2026-06-01 06:00'");
  const pick = (extra) => sql(`select s.uid, s.receipt_number, s.sale_date::date from sales s where s.is_active and not exists (select 1 from daily_reconciliation dr where dr.reconciliation_date = s.sale_date::date and dr.user_uid = s.user_uid) and exists (select 1 from sales_details d where d.sale_uid = s.uid) ${extra} order by s.sale_date desc limit 1`).split('|');
  const [s1uid, s1, s1day] = pick('');
  const [s2uid, s2] = pick(`and s.uid <> '${s1uid}'`);
  const [sauid, sa, saday] = sql("select s.uid, s.receipt_number, s.sale_date::date from sales s join daily_reconciliation dr on dr.reconciliation_date = s.sale_date::date and dr.user_uid = s.user_uid and dr.status = 'APPROVED' where s.is_active order by s.sale_date desc limit 1").split('|');
  // one line of S1 at an old price that is surely not today's, so the cart must show "was …"
  const [nudged, oldPrice] = sql(`update sales_details set unit_price = unit_price + 777 where uid = (select uid from sales_details where sale_uid = '${s1uid}' order by uid limit 1) returning product_uid, unit_price`).split('|');
  console.log('S1', s1, s1day, '| S2', s2, '| approved', sa, saday, '| nudged', nudged, oldPrice);

  const browser = await chromium.launch();
  const errors = [];

  // ---- A. delete with a reason (MANAGER, no reconciliation that day)
  let page = await newPage(browser, errors);
  await login(page, MGR);
  await page.goto(`${V3}/sales?date=${s1day}`);
  await openRowMenu(page, s1);
  await page.getByRole('menuitem', { name: /^(Delete|Futa)$/ }).click();
  const dlg = page.locator('app-reason-dialog');
  await dlg.waitFor();
  await dlg.locator('textarea').waitFor();  // (bi) the dialog is attached before its text is rendered
  // (ce) wait for the rule text itself, not just the textarea (run 10 of b1x10 read "")
  await dlg.filter({ hasText: /approved|imeidhinishwa/i }).waitFor({ timeout: 15000 }).catch(() => undefined);
  const dlgText = await dlg.innerText();
  ok('A1 dialogi ya sababu inaeleza kanuni', /approved|imeidhinishwa/i.test(dlgText), JSON.stringify(dlgText.slice(0, 300)));
  const confirm = dlg.getByRole('button', { name: /^(Delete|Futa)$/ });
  await dlg.locator('textarea').fill('fupi');
  ok('A2 sababu fupi -> kitufe kimezimwa', await confirm.isDisabled());
  await dlg.locator('textarea').fill('Mteja alirudisha bidhaa zote - jaribio B1');
  await confirm.click();
  ok('A3 toast inaonyesha imerekodiwa #', await toast(page, /#\d+/));
  ok('A4 DB: deleted_by = MANAGER', sql(`select deleted_by from sales where uid='${s1uid}'`) === MGR);
  const mt = await apiToken(MGR);
  const d2 = await api('DELETE', `/api/v1/sales/${s2uid}?deleteReason=${encodeURIComponent('Imefutwa kwa jaribio la B1 (API)')}`, mt);
  ok('A5 mauzo ya pili yamefutwa (API)', d2.j.status === 'Success', d2.j.message);

  // ---- B. approved day: refused with the rule's message
  await page.goto(`${V3}/sales?date=${saday}`);
  await openRowMenu(page, sa);
  await page.getByRole('menuitem', { name: /^(Delete|Futa)$/ }).click();
  await page.locator('app-reason-dialog textarea').fill('Jaribio la siku iliyoidhinishwa B1');
  await page.locator('app-reason-dialog').getByRole('button', { name: /^(Delete|Futa)$/ }).click();
  ok('B1 kukataliwa: ujumbe wa upatanisho', await toast(page, /umeshaidhinishwa/));
  ok('B2 DB: mauzo bado hai', sql(`select is_active from sales where uid='${sauid}'`) === 't');

  // ---- C. deleted list: no restore; "Make again" fills the till, shows old prices, and the new sale points back
  await page.goto(`${V3}/sales`);
  await page.getByRole('button', { name: /^(Deleted|Yaliyofutwa)$/ }).click();
  const del = page.locator('app-deleted-sales-dialog');
  await del.waitFor();
  ok('C1 hakuna kitufe cha Restore', (await del.getByRole('button', { name: /Restore|Rejesha/ }).count()) === 0);
  await del.locator('lsms-search-bar input').first().fill(s1);
  await del.locator('li').filter({ hasText: s1 }).getByRole('button', { name: /Make again|Tengeneza upya/ }).click();
  await page.waitForURL(/\/v3\/sales\/new/);
  const chip = page.locator('.remake');
  await chip.waitFor({ timeout: 30000 });
  ok('C2 kapu linaonyesha "Badala ya <risiti>"', (await chip.innerText()).includes(shortReceipt(s1)) && (await chip.getAttribute('title')) === s1);
  const was = page.locator('.cart .was');
  ok('C3 bei ya zamani inaonyeshwa pembeni (bei imebadilika)', (await was.count()) >= 1 && /ilikuwa|was/i.test(await was.first().innerText()),
    await was.count());
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  const closeAll = page.getByRole('button', { name: /^(Close all|Funga zote)$/ });
  if (await closeAll.count()) await closeAll.first().click();
  page.on('response', (r) => { if (r.url().includes('/api/v1/sales') && r.request().method() !== 'GET') if (r.url().includes('/partial')) { const pd = r.request().postData() || ''; const i = pd.indexOf('replacesSaleUid'); console.log('PAY-REQ', JSON.stringify(pd.slice(i, i + 70)), 'S1', s1uid); } if (r.url().includes('/partial')) r.json().then((j) => console.log('PAY-BODY', j.status, j.message, JSON.stringify(j.data || {}).slice(0, 300))).catch(() => {}); console.log('PAY-API', r.status(), r.request().method(), r.url().replace(/^.*\/api/, '/api')); });
  await page.locator('button.pay').click();
  const done = page.locator('app-sale-done-dialog');
  let doneOk = true;
  try { await done.waitFor({ timeout: 30000 }); } catch {
    doneOk = false;
    await page.screenshot({ path: require('path').join(__dirname, 'out', 'b1_pay.png') });
    console.log('PAY-STATE', await page.locator('.blocker, lsms-toast-host, lsms-dialog').allInnerTexts());
  }
  ok('C4 mauzo mapya yamekamilika', doneOk);
  const remade = sql(`select receipt_number || '|' || coalesce(sale_notes,'') from sales where replaces_sale_uid = '${s1uid}' and not coalesce(is_deleted,false)`);
  ok('C5 DB: sales.replaces_sale_uid = mauzo yaliyofutwa', remade !== '', remade);
  ok('C6 maelezo "Badala ya <risiti>" yamebaki', remade.includes(`Badala ya mauzo yaliyofutwa: ${s1}`), remade);
  const newReceipt = remade.split('|')[0];

  // ---- D. CEO: banner after login until HIS "Nimeona"; Kagua shows made-again / not made again
  const ceo = await newPage(browser, errors);
  await login(ceo, CEO);
  const banner = ceo.locator('app-sale-changes-banner .bar');
  await banner.waitFor({ timeout: 30000 });
  ok('D1 banner ya CEO inaonekana', /review|kukagua/i.test(await banner.innerText()));
  ok('D2 banner haina kitufe cha kufunga', (await banner.locator('.x').count()) === 0);
  // (ce) /pending answers 3 s late: while the list is loading, "Nimeona" must not be clickable
  const PENDING = '**/api/v1/sales/changes/pending';
  const slowPending = () => ceo.route(PENDING, async (r) => { await new Promise((res) => setTimeout(res, 3000)); await r.continue().catch(() => undefined); });
  // while the skeleton shows (~2 s of the 3 s delay): was a skeleton seen, and was "Nimeona" never clickable?
  const watchLoading = async () => {
    let loadingSeen = false, seenLocked = true;
    for (let i = 0; i < 10; i++) {
      if (await rv.locator('lsms-skeleton').count()) {
        loadingSeen = true;
        if ((await seen.count()) && !(await seen.first().isDisabled())) seenLocked = false;
      }
      await ceo.waitForTimeout(200);
    }
    return { loadingSeen, seenLocked };
  };
  const rv = ceo.locator('app-sale-changes-dialog');
  const seen = rv.getByRole('button', { name: /Seen|Nimeona/ });
  await slowPending();
  await banner.getByRole('button', { name: /Review|Kagua/ }).click();
  await rv.waitFor();
  const w1 = await watchLoading();
  ok('D2a /pending ikichelewa: "Nimeona" haibofyeki mpaka orodha ionekane', w1.loadingSeen && w1.seenLocked, JSON.stringify(w1));
  // (ce) read the dialog only when the real list is there (b1x10 run 9 / (ca) read the skeleton)
  await rv.locator('li').filter({ hasText: s1 }).first().waitFor({ timeout: 30000 }).catch(() => undefined);
  await ceo.unroute(PENDING);
  const rvText = await rv.innerText();
  ok('D3 Kagua: mauzo, mtumiaji na sababu', rvText.includes(s1) && /jaribio B1/.test(rvText));
  ok('D4 Kagua: S1 "Imerudishwa → #<mpya>"', new RegExp(`(Imerudishwa|Made again) → #${newReceipt}`).test(rvText), newReceipt);
  ok('D5 Kagua: S2 "Haijarudishwa"', (await rv.locator('li').filter({ hasText: s2 }).filter({ hasText: /Haijarudishwa|Not made again/ }).count()) === 1);
  ok('D6 Nimeona inahitaji maelezo', await seen.isDisabled());
  await rv.locator('textarea').fill('Nimeona, sawa');
  // (ce) maelezo yameshaandikwa, orodha inapakiwa upya (Siku 30 -> Zinasubiri) na /pending inachelewa:
  // "Nimeona" isibofyeke juu ya orodha ya zamani mpaka mpya ifike
  await rv.getByRole('radio', { name: /Last 30 days|Siku 30/ }).click();
  await rv.locator('lsms-skeleton').waitFor({ state: 'detached', timeout: 30000 }).catch(() => undefined);
  await slowPending();
  await rv.getByRole('radio', { name: /Waiting|Zinasubiri/ }).click();
  const w2 = await watchLoading();
  ok('D2b maelezo yapo + /pending inachelewa: "Nimeona" bado haibofyeki', w2.loadingSeen && w2.seenLocked, JSON.stringify(w2));
  await rv.locator('li').filter({ hasText: s1 }).first().waitFor({ timeout: 30000 }).catch(() => undefined);
  await ceo.unroute(PENDING);
  await seen.click();
  ok('D7 toast ya Nimeona', await toast(ceo, /Nimeona|seen/i));
  await rv.getByRole('button', { name: /^(Close|Funga)$/ }).last().click();
  ok('D8 banner ya CEO imeondoka baada ya Nimeona', (await bannerCount(ceo)) === 0);

  // ---- E. the PERMISSION decides, not the role (owner bg)
  const mgr1 = await newPage(browser, errors);
  await login(mgr1, MGR);
  ok('E1 MANAGER bila ruhusa haoni banner', (await bannerCount(mgr1)) === 0);
  const ct = await apiToken(CEO);
  const role = sql("select uid from roles where name = 'MANAGER'");
  const perms = sql(`select permission_uid from role_permissions where role_uid = '${role}'`).split('\n').filter(Boolean);
  const review = sql("select uid from permissions where name = 'SALE_DELETE_REVIEW'");
  const g = await api('POST', `/api/v1/roles/${role}/permissions`, ct, [...perms, review]);
  ok('E2 MANAGER role inapewa SALE_DELETE_REVIEW (API ya roles)', g.j.status === 'Success', g.j.message);
  const mgr2 = await newPage(browser, errors);
  await login(mgr2, MGR);
  const mb = mgr2.locator('app-sale-changes-banner .bar');
  let mgrSees = true;
  try { await mb.waitFor({ timeout: 20000 }); } catch { mgrSees = false; }
  ok('E3 MANAGER akipewa ruhusa anaona banner', mgrSees);
  // (bi) the bar shows its icon first and the count when /pending answers; and the copy keeps MANAGER's pending
  // rows of earlier runs, so the count must equal MANAGER's own pending rows (>= this run's 2), not a fixed 2
  const mgrUid = sql(`select uid from users where email = '${MGR}'`);
  const mgrPending = Number(sql(`select count(*) from sale_change_audit a where a.result = 'ALLOWED' and not exists (select 1 from sale_change_ack k where k.audit_id = a.id and k.by_uid = '${mgrUid}')`));
  let mbText = '';
  for (let i = 0; mgrSees && i < 40 && !/\d/.test(mbText); i++) { mbText = await mb.innerText(); if (!/\d/.test(mbText)) await mgr2.waitForTimeout(250); }
  ok('E4 Nimeona ya CEO haimfichii MANAGER', mgrSees && mgrPending >= 2 && new RegExp(`\\b${mgrPending}\\b`).test(mbText), `${mbText} | pending ya MANAGER kwenye DB ${mgrPending}`);
  ok('E5 CEO bado hana banner', (await bannerCount(ceo)) === 0);
  await api('POST', `/api/v1/roles/${role}/permissions`, ct, perms);

  ok('Z hakuna JS error kwenye kurasa', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
