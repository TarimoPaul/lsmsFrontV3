// KUPIMA in the browser, on the PRODUCTION build of feature/t2-kupima + backend Docker-local (V143) (owner ef/ek):
//   CEO   Bidhaa -> "Kupima" -> "+ Mipangilio": Konyagi ya kupima, chupa 750ml, mzazi KONYAGI 750ML, 30ml = 1,000, 60ml = 2,000
//   MGR   no "+ Mipangilio"; POS: card with bar, measure buttons; registered price cannot be edited
//         no open container -> "Fungua chombo kipya" -> sold, bar 720, parent -1
//         (i)  container 40ml, 60ml -> "Tumia ml zilizobaki + fungua kipya" -> old CLOSED SPLIT, no loss, bar 730
//         (ii) container 20ml, 30ml -> "Chombo kimeisha kweli" -> 20ml loss Dr 5100 / Cr 1200, bar 720
//         "Kupima" dialog: "Chombo kimeisha" -> loss; containers tab shows the loss
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node kupima_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Kupima-UI-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const K = () => sql("select uid from products where product_name = 'KONYAGI YA KUPIMA'");
const bar = (p) => sql(`select coalesce((select ml_left from pour_container where product_uid = '${p}' and status = 'OPEN'), -1)`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(browser, email) {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  return { page, errors };
}
const closeBanners = async (page) => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  const k = K();
  const parent = sql("select uid from products where product_name = 'KONYAGI 750ML'");
  // independent of kupima_api_e2e on the same copy: start from "not set up, nothing open" (throw-away copy only)
  sql(`update pour_container set status='CLOSED', close_kind='FINISHED', closed_at=now(), closed_by='E2E-RESET', ml_left=0 where product_uid='${k}' and status='OPEN'`);
  sql(`delete from pour_measure where product_uid='${k}'`);
  sql(`delete from pour_product where product_uid='${k}'`);
  const browser = await chromium.launch();

  // ── CEO: settings through the dialog ──
  const ceo = await session(browser, CEO);
  await ceo.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(ceo.page);
  await ceo.page.locator('[data-test="kupima"]').click();
  const dlg = ceo.page.locator('app-kupima-dialog');
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('[data-test="new"]').click();
  await sleep(1500);
  await dlg.locator('[data-test="product"]').selectOption(k);
  await dlg.locator('[data-test="cname"]').fill('chupa');
  await dlg.locator('[data-test="cml"]').fill('750');
  await dlg.locator('[data-test="parent"]').selectOption(parent);
  await dlg.locator('[data-test="ml-0"]').fill('30');
  await dlg.locator('[data-test="price-0"]').fill('1000');
  await dlg.locator('[data-test="add-measure"]').click();
  await dlg.locator('[data-test="ml-1"]').fill('60');
  await dlg.locator('[data-test="price-1"]').fill('2000');
  await dlg.locator('[data-test="save"]').click();
  await sleep(2500);
  ok('S1 CEO: mipangilio imehifadhiwa kupitia dialog (vipimo 30/60, mzazi KONYAGI 750ML)',
    sql(`select string_agg(ml||'='||round(price), ',' order by ml) from pour_measure where product_uid='${k}' and active`) === '30=1000,60=2000'
    && sql(`select parent_product_uid from pour_product where product_uid='${k}'`) === parent);
  ok('S2 orodha ya dialog inaonyesha Konyagi ya kupima', /KONYAGI YA KUPIMA/.test(await dlg.innerText()));

  // ── MGR: no settings, POS pouring ──
  const mgr = await session(browser, MGR);
  await mgr.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(mgr.page);
  await mgr.page.locator('[data-test="kupima"]').click();
  const mdlg = mgr.page.locator('app-kupima-dialog');
  await mdlg.waitFor({ timeout: 15000 });
  ok('M1 MANAGER: hakuna "+ Mipangilio" wala "Mipangilio" (KUPIMA_SETTINGS tu)', (await mdlg.locator('[data-test="new"]').count()) === 0 && (await mdlg.locator('[data-test="edit"]').count()) === 0);
  await mgr.page.keyboard.press('Escape');

  const pos = async () => { await mgr.page.goto(V3 + '/sales/new'); await sleep(3000); await closeBanners(mgr.page); return mgr.page.locator(`[data-pour="KONYAGI YA KUPIMA"]`); };
  const pay = () => mgr.page.getByRole('button', { name: /(Complete sale|Kamilisha mauzo)/ }).first();
  const shortDlg = () => mgr.page.locator('app-kupima-short-dialog');
  const done = async () => { await mgr.page.locator('app-sale-done-dialog').waitFor({ timeout: 20000 }); await mgr.page.keyboard.press('Escape'); await sleep(800); };

  let card = await pos();
  ok('U1 POS: Konyagi ya kupima iko kama kadi (si kwenye orodha ya bidhaa), "Hakuna chupa wazi"', (await card.count()) === 1 && /Hakuna chupa wazi|No open chupa/.test(await card.innerText()), await card.innerText().catch(() => ''));
  await card.locator('[data-ml="30"]').click();
  await sleep(700);
  const line = mgr.page.locator('.price-btn').filter({ hasText: '1,000' }).first();
  ok('U2 mstari wa 30ml kwa 1,000; bei haibadilishwi (kitufe kimezimwa)', (await line.count()) === 1 && await line.isDisabled());
  const p0 = Number(sql(`select current_stock from products where uid='${parent}'`));
  await pay().click();
  await shortDlg().waitFor({ timeout: 15000 });
  ok('U3 hakuna chombo wazi -> dialog "Fungua chombo kipya"', (await shortDlg().locator('[data-choice="OPEN"]').count()) === 1);
  await shortDlg().locator('[data-choice="OPEN"]').click();
  await done();
  ok('U4 imeuzwa: bar 720, mzazi -1', bar(k) === '720.00' && Number(sql(`select current_stock from products where uid='${parent}'`)) === p0 - 1, `bar=${bar(k)}`);

  // (i) SPLIT
  const c1 = sql(`select uid from pour_container where product_uid='${k}' and status='OPEN'`);
  sql(`update pour_container set ml_left = 40 where uid='${c1}'`);
  card = await pos();
  ok('U5 bar inaonyesha 40 / 750 ml', /40 \/ 750 ml/.test(await card.innerText()), await card.innerText());
  await card.locator('[data-ml="60"]').click();
  await pay().click();
  await shortDlg().waitFor({ timeout: 15000 });
  ok('U6 haitoshi -> chaguo mbili: (i) tumia zilizobaki + fungua kipya, (ii) kimeisha kweli', (await shortDlg().locator('[data-choice="SPLIT"]').count()) === 1 && (await shortDlg().locator('[data-choice="FINISHED"]').count()) === 1);
  await shortDlg().locator('[data-choice="SPLIT"]').click();
  await done();
  ok('U7 (i): chombo cha zamani CLOSED SPLIT bila upotevu; kipya bar 730 (40 + 20)', sql(`select status||'|'||close_kind||'|'||ml_lost from pour_container where uid='${c1}'`) === 'CLOSED|SPLIT|0.00' && bar(k) === '730.00' && sql(`select count(*) from journal_entry where reference_uid='${c1}'`) === '0', `${sql(`select status||'|'||close_kind||'|'||ml_lost from pour_container where uid='${c1}'`)} bar=${bar(k)}`);

  // (ii) FINISHED
  const c2 = sql(`select uid from pour_container where product_uid='${k}' and status='OPEN'`);
  sql(`update pour_container set ml_left = 20 where uid='${c2}'`);
  card = await pos();
  await card.locator('[data-ml="30"]').click();
  await pay().click();
  await shortDlg().waitFor({ timeout: 15000 });
  await shortDlg().locator('[data-choice="FINISHED"]').click();
  await done();
  const loss = sql(`select string_agg(l.account_code||':'||sign(l.debit_amount-l.credit_amount), ',' order by l.account_code) from journal_entry j join journal_entry_line l on l.journal_entry_uid=j.uid where j.reference_uid='${c2}'`);
  ok('U8 (ii): 20ml upotevu, Dr 5100 / Cr 1200; kipya bar 720', sql(`select close_kind||'|'||ml_lost from pour_container where uid='${c2}'`) === 'FINISHED|20.00' && loss === '1200:-1,5100:1' && bar(k) === '720.00', `${loss} bar=${bar(k)}`);

  // dialog: manual finish + containers report
  await mgr.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(mgr.page);
  await mgr.page.locator('[data-test="kupima"]').click();
  await mdlg.waitFor({ timeout: 15000 });
  await sleep(1000);
  await mdlg.locator('[data-product="KONYAGI YA KUPIMA"] [data-test="finish"]').click();
  await mgr.page.getByRole('button', { name: /(Yes, finished|Ndiyo, kimeisha)/ }).click();
  await sleep(2000);
  ok('U9 "Chombo kimeisha" kwa mkono: hakuna chombo wazi, 720ml upotevu', bar(k) === '-1' && sql(`select ml_lost from pour_container where product_uid='${k}' order by id desc limit 1`) === '720.00');
  await mdlg.getByRole('button', { name: /(Containers & loss|Vyombo na upotevu)/ }).click();
  await sleep(1500);
  const rep = await mdlg.innerText();
  ok('U10 ripoti ya vyombo inaonyesha upotevu (720ml ≈ 24 × 30ml)', /Upotevu 720ml|Lost 720ml/.test(rep) && /24 × 30ml/.test(rep), rep.replace(/\s+/g, ' ').slice(0, 300));
  ok('U11 hakuna kosa la JavaScript', ceo.errors.length + mgr.errors.length === 0, [...ceo.errors, ...mgr.errors].join(' | ').slice(0, 300));
  await browser.close();
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
